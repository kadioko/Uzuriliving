import type { PrinterProtocol } from "./types";

export type AndroidPrintTransport = "LAN" | "BLUETOOTH" | "USB";

export type AndroidPrintConfig = {
  transport: AndroidPrintTransport;
  host?: string;
  port?: number;
  bluetoothAddress?: string;
  usbVendorId?: number;
  usbProductId?: number;
};

function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function openAndroidPrint(protocol: PrinterProtocol, data: string, config: AndroidPrintConfig): void {
  if (typeof window === "undefined") throw new Error("Android printing is only available in a browser.");
  if (!/Android/i.test(navigator.userAgent)) throw new Error("Open Uzuri Living inside the Android app to print directly from a phone.");
  if (config.transport === "LAN" && !config.host?.trim()) throw new Error("Enter the printer LAN address first.");
  if (config.transport === "BLUETOOTH" && !config.bluetoothAddress?.trim()) throw new Error("Enter the paired printer Bluetooth address first.");
  const params = new URLSearchParams({
    protocol,
    transport: config.transport,
    data: base64UrlEncode(data),
  });
  if (config.host) params.set("host", config.host.trim());
  if (config.port) params.set("port", String(config.port));
  if (config.bluetoothAddress) params.set("bluetoothAddress", config.bluetoothAddress.trim());
  if (config.usbVendorId != null) params.set("usbVendorId", String(config.usbVendorId));
  if (config.usbProductId != null) params.set("usbProductId", String(config.usbProductId));
  window.location.href = `uzuriliving://print?${params.toString()}`;
}
