import type { BarcodeType } from "./types";

const CODE128_PATTERNS = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];
const EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const EAN_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

export function normalizeBarcode(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

export function resolveBarcodeType(value: unknown, type?: unknown): BarcodeType {
  const normalized = normalizeBarcode(value);
  const explicit = String(type ?? "").toUpperCase();
  if (explicit === "EAN13" || explicit === "UPC" || explicit === "CODE128" || explicit === "INTERNAL") return explicit;
  if (/^\d{13}$/.test(normalized)) return "EAN13";
  if (/^\d{12}$/.test(normalized)) return "UPC";
  return "CODE128";
}

export function hasValidCheckDigit(value: string, type?: unknown): boolean {
  const normalized = normalizeBarcode(value);
  const resolved = resolveBarcodeType(normalized, type);
  const digits = resolved === "UPC" && /^\d{12}$/.test(normalized) ? `0${normalized}` : normalized;
  if (resolved === "EAN13" || resolved === "UPC") {
    if (!/^\d{13}$/.test(digits)) return false;
    const sum = [...digits.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (sum % 10)) % 10 === Number(digits[12]);
  }
  return true;
}

export function code128Bits(value: string): string | null {
  const normalized = normalizeBarcode(value);
  if (!normalized || [...normalized].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) > 127)) return null;
  const codes = [...normalized].map((character) => character.charCodeAt(0) - 32);
  const checksum = (104 + codes.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  const widths = [104, ...codes, checksum, 106].flatMap((code) => [...CODE128_PATTERNS[code]].map(Number));
  let bar = true;
  return widths.map((width) => {
    const bits = (bar ? "1" : "0").repeat(width);
    bar = !bar;
    return bits;
  }).join("");
}

function ean13Bits(value: string): string | null {
  if (!/^\d{13}$/.test(value)) return null;
  const first = Number(value[0]);
  const parity = EAN_PARITY[first];
  const left = [...value.slice(1, 7)].map((digit, index) => parity[index] === "G" ? EAN_G[Number(digit)] : EAN_L[Number(digit)]).join("");
  const right = [...value.slice(7)].map((digit) => EAN_L[Number(digit)].split("").map((bit) => bit === "0" ? "1" : "0").join("")).join("");
  return `101${left}01010${right}101`;
}

export function linearBarcodeBits(value: unknown, type?: unknown): { bits: string; displayValue: string; type: BarcodeType } | null {
  const normalized = normalizeBarcode(value);
  const resolved = resolveBarcodeType(normalized, type);
  if (!normalized) return null;
  if (resolved === "EAN13") {
    const bits = hasValidCheckDigit(normalized, resolved) ? ean13Bits(normalized) : null;
    return bits ? { bits, displayValue: normalized, type: resolved } : null;
  }
  if (resolved === "UPC") {
    if (!/^\d{12}$/.test(normalized)) return null;
    const bits = hasValidCheckDigit(normalized, resolved) ? ean13Bits(`0${normalized}`) : null;
    return bits ? { bits, displayValue: normalized, type: resolved } : null;
  }
  const bits = code128Bits(normalized);
  return bits ? { bits, displayValue: normalized, type: resolved } : null;
}

export function printerCodeFor(type: unknown): "EAN13" | "UPCA" | "CODE128" {
  const resolved = resolveBarcodeType("", type);
  return resolved === "EAN13" ? "EAN13" : resolved === "UPC" ? "UPCA" : "CODE128";
}
