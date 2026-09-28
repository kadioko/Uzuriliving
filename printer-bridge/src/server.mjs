import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const VERSION = "0.1.0";
const ALLOWED_PROTOCOLS = new Set(["TSPL", "ZPL", "EPL", "ESCPOS"]);
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5_000;

function env(name, fallback = "") {
  const value = process.env[name];
  return value == null || value === "" ? fallback : value;
}

function numberEnv(name, fallback) {
  const value = Number.parseInt(env(name), 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function configuredPrinter() {
  return {
    id: env("UZURI_PRINTER_ID", "default"),
    name: env("UZURI_PRINTER_NAME", "Thermal label printer"),
    protocol: env("UZURI_PRINTER_PROTOCOL", "TSPL").toUpperCase(),
    connection: env("UZURI_PRINTER_CONNECTION", "NETWORK").toUpperCase(),
    host: env("UZURI_PRINTER_HOST"),
    port: numberEnv("UZURI_PRINTER_PORT", 9100),
    queue: env("UZURI_PRINTER_QUEUE"),
    serialPath: env("UZURI_PRINTER_SERIAL_PATH"),
    baudRate: numberEnv("UZURI_PRINTER_BAUD_RATE", 9600),
  };
}

function configuredPrinters() {
  const printer = configuredPrinter();
  return printerConfigured(printer) ? [printer] : [];
}

function printerConfigured(printer) {
  if (printer.connection === "NETWORK") return Boolean(printer.host);
  if (printer.connection === "USB") return Boolean(printer.queue);
  if (printer.connection === "BLUETOOTH") return Boolean(printer.serialPath);
  return false;
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Uzuri-Bridge-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(payload);
}

function authorized(req) {
  const expected = env("UZURI_BRIDGE_TOKEN");
  if (!expected) return true;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return bearer === expected || req.headers["x-uzuri-bridge-token"] === expected;
}

async function readJson(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_PAYLOAD_BYTES) throw new Error("Print payload is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function decodePayload(protocol, data) {
  if (typeof data !== "string" || !data.trim()) throw new Error("Print data is required.");
  if (protocol === "ESCPOS") {
    const compact = data.replace(/\s+/g, "");
    if (!/^(?:[0-9a-f]{2})+$/i.test(compact)) throw new Error("ESC/POS data must be hexadecimal bytes.");
    return Buffer.from(compact, "hex");
  }
  return Buffer.from(data, "utf8");
}

function validatePrintRequest(body) {
  const printer = configuredPrinter();
  const protocol = String(body.protocol || printer.protocol).toUpperCase();
  if (!ALLOWED_PROTOCOLS.has(protocol)) throw new Error(`Unsupported printer protocol: ${protocol}`);
  const printerId = String(body.printerId || printer.id);
  if (printerId !== printer.id) throw new Error(`Printer profile not found: ${printerId}`);
  if (!["NETWORK", "USB", "BLUETOOTH"].includes(printer.connection)) throw new Error(`Unsupported printer connection: ${printer.connection}`);
  if (printer.connection === "NETWORK" && !printer.host) throw new Error("UZURI_PRINTER_HOST is not configured.");
  if (printer.connection === "USB" && !printer.queue) throw new Error("UZURI_PRINTER_QUEUE is not configured.");
  if (printer.connection === "BLUETOOTH" && !printer.serialPath) throw new Error("UZURI_PRINTER_SERIAL_PATH is not configured.");
  return { printer, protocol, data: decodePayload(protocol, body.data) };
}

function sendToNetworkPrinter({ host, port }, data) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error); else resolve(result);
    };
    socket.setTimeout(DEFAULT_TIMEOUT_MS, () => finish(new Error(`Printer connection timed out after ${DEFAULT_TIMEOUT_MS} ms.`)));
    socket.once("error", (error) => finish(new Error(`Could not connect to printer at ${host}:${port}: ${error.message}`)));
    socket.once("connect", () => {
      socket.end(data, () => finish(null, { bytesSent: data.length }));
    });
  });
}

function runPowerShell(script, data, environment) {
  if (process.platform !== "win32") return Promise.reject(new Error("This printer adapter is currently available on Windows only."));
  return new Promise((resolve, reject) => {
    const processHandle = spawn(env("UZURI_POWERSHELL", "powershell.exe"), ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
      windowsHide: true,
      env: { ...process.env, ...environment },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    processHandle.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    processHandle.once("error", (error) => reject(new Error(`Could not start PowerShell printer adapter: ${error.message}`)));
    processHandle.once("close", (code) => code === 0 ? resolve({ bytesSent: data.length }) : reject(new Error(stderr.trim() || `PowerShell printer adapter exited with code ${code}.`)));
    processHandle.stdin.end(data);
  });
}

function sendToWindowsSpooler({ queue }, data) {
  if (!queue) return Promise.reject(new Error("UZURI_PRINTER_QUEUE is not configured."));
  const script = `
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class UzuriRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] public static extern int StartDocPrinter(IntPtr handle, int level, [In] DOCINFO docInfo);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)] public static extern bool WritePrinter(IntPtr handle, byte[] bytes, int count, out int written);
  public static void Send(string name, byte[] bytes) {
    IntPtr handle;
    if (!OpenPrinter(name, out handle, IntPtr.Zero)) throw new Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
    try {
      var doc = new DOCINFO { pDocName = "Uzuri Living label", pDataType = "RAW" };
      if (StartDocPrinter(handle, 1, doc) == 0) throw new Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
      try {
        if (!StartPagePrinter(handle)) throw new Exception("StartPagePrinter failed: " + Marshal.GetLastWin32Error());
        try { int written; if (!WritePrinter(handle, bytes, bytes.Length, out written) || written != bytes.Length) throw new Exception("WritePrinter failed: " + Marshal.GetLastWin32Error()); }
        finally { EndPagePrinter(handle); }
      } finally { EndDocPrinter(handle); }
    } finally { ClosePrinter(handle); }
  }
}
"@
$inputStream = [Console]::OpenStandardInput()
$memory = New-Object System.IO.MemoryStream
$inputStream.CopyTo($memory)
[UzuriRawPrinter]::Send($env:UZURI_PRINTER_QUEUE, $memory.ToArray())
`;
  return runPowerShell(script, data, { UZURI_PRINTER_QUEUE: queue });
}

function sendToWindowsSerial({ serialPath, baudRate }, data) {
  if (!serialPath) return Promise.reject(new Error("UZURI_PRINTER_SERIAL_PATH is not configured. Use a paired Bluetooth COM port such as COM3."));
  const script = `
$ErrorActionPreference = "Stop"
$port = New-Object System.IO.Ports.SerialPort
$port.PortName = $env:UZURI_PRINTER_SERIAL_PATH
$port.BaudRate = [int]$env:UZURI_PRINTER_BAUD_RATE
$port.Parity = [System.IO.Ports.Parity]::None
$port.DataBits = 8
$port.StopBits = [System.IO.Ports.StopBits]::One
$port.Open()
try {
  $inputStream = [Console]::OpenStandardInput()
  $memory = New-Object System.IO.MemoryStream
  $inputStream.CopyTo($memory)
  $bytes = $memory.ToArray()
  $port.Write($bytes, 0, $bytes.Length)
} finally { $port.Close() }
`;
  return runPowerShell(script, data, { UZURI_PRINTER_SERIAL_PATH: serialPath, UZURI_PRINTER_BAUD_RATE: String(baudRate) });
}

function sendToPrinter(printer, data) {
  if (printer.connection === "NETWORK") return sendToNetworkPrinter(printer, data);
  if (printer.connection === "USB") return sendToWindowsSpooler(printer, data);
  if (printer.connection === "BLUETOOTH") return sendToWindowsSerial(printer, data);
  return Promise.reject(new Error(`Unsupported printer connection: ${printer.connection}`));
}

function testCommand(printer) {
  if (printer.protocol === "TSPL") {
    return Buffer.from([
      "SIZE 50 mm,30 mm",
      "GAP 2 mm,0",
      "CLS",
      'TEXT 24,24,"0",0,1,1,"Uzuri Living"',
      'TEXT 24,52,"0",0,1,1,"Printer test"',
      "BARCODE 24,90,\"128\",48,1,0,2,2,\"UZURI-TEST\"",
      "PRINT 1,1",
      "",
    ].join("\n"), "utf8");
  }
  if (printer.protocol === "ZPL") return Buffer.from("^XA^FO24,24^A0N,28,28^FDUzuri Living^FS^FO24,70^BCN,60,Y,N,N^FDUZURI-TEST^FS^XZ", "utf8");
  if (printer.protocol === "EPL") return Buffer.from("N\nA20,20,0,4,1,1,N,\"Uzuri Living\"\nB20,70,0,1,2,4,60,B,\"UZURI-TEST\"\nP1\n", "utf8");
  return Buffer.from([0x1b, 0x40, ...Buffer.from("Uzuri Living\nPrinter test\nUZURI-TEST\n\n", "ascii")]);
}

async function handle(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!authorized(req)) return json(res, 401, { error: "Invalid bridge token" });
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const printer = configuredPrinter();
    return json(res, 200, { ok: true, service: "uzuriliving-print-bridge", version: VERSION, configured: printerConfigured(printer), printer: { id: printer.id, name: printer.name, protocol: printer.protocol, connection: printer.connection } });
  }
  if (req.method === "GET" && url.pathname === "/printers") {
    return json(res, 200, { printers: configuredPrinters().map(({ host, queue, serialPath, ...printer }) => ({ ...printer, address: host || queue || serialPath })) });
  }
  if (req.method !== "POST") return json(res, 404, { error: "Bridge route not found" });

  if (url.pathname === "/test") {
    const printer = configuredPrinter();
    if (printer.connection === "NETWORK" && !printer.host) return json(res, 400, { error: "UZURI_PRINTER_HOST is not configured." });
    if (printer.connection === "USB" && !printer.queue) return json(res, 400, { error: "UZURI_PRINTER_QUEUE is not configured." });
    if (printer.connection === "BLUETOOTH" && !printer.serialPath) return json(res, 400, { error: "UZURI_PRINTER_SERIAL_PATH is not configured." });
    const result = await sendToPrinter(printer, testCommand(printer));
    return json(res, 200, { ok: true, test: true, printer: printer.name, ...result });
  }
  if (url.pathname === "/print") {
    const body = await readJson(req);
    const request = validatePrintRequest(body);
    const result = await sendToPrinter(request.printer, request.data);
    return json(res, 200, { ok: true, printer: request.printer.name, protocol: request.protocol, ...result });
  }
  return json(res, 404, { error: "Bridge route not found" });
}

function start() {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => json(res, 400, { error: error instanceof Error ? error.message : "Bridge request failed" }));
  });
  const host = env("UZURI_BRIDGE_HOST", "127.0.0.1");
  const port = numberEnv("UZURI_BRIDGE_PORT", 38100);
  server.listen(port, host, () => {
    console.log(`Uzuri Living Print Bridge listening on http://${host}:${port}`);
    console.log(`Configured printers: ${configuredPrinters().length}`);
  });
  return server;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) start();

export { decodePayload, configuredPrinter, validatePrintRequest, start };
