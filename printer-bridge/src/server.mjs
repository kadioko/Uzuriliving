import http from "node:http";
import net from "node:net";
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
  };
}

function configuredPrinters() {
  const printer = configuredPrinter();
  return printer.host ? [printer] : [];
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
  if (printer.connection !== "NETWORK") throw new Error("This bridge release supports network printers only.");
  if (!printer.host) throw new Error("UZURI_PRINTER_HOST is not configured.");
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
    return json(res, 200, { ok: true, service: "uzuriliving-print-bridge", version: VERSION, configured: Boolean(printer.host), printer: { id: printer.id, name: printer.name, protocol: printer.protocol, connection: printer.connection } });
  }
  if (req.method === "GET" && url.pathname === "/printers") {
    return json(res, 200, { printers: configuredPrinters().map(({ host, ...printer }) => ({ ...printer, address: host })) });
  }
  if (req.method !== "POST") return json(res, 404, { error: "Bridge route not found" });

  if (url.pathname === "/test") {
    const printer = configuredPrinter();
    if (!printer.host) return json(res, 400, { error: "UZURI_PRINTER_HOST is not configured." });
    const result = await sendToNetworkPrinter(printer, testCommand(printer));
    return json(res, 200, { ok: true, test: true, printer: printer.name, ...result });
  }
  if (url.pathname === "/print") {
    const body = await readJson(req);
    const request = validatePrintRequest(body);
    const result = await sendToNetworkPrinter(request.printer, request.data);
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
