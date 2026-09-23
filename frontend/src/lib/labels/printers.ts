import type { LabelProduct, LabelTemplate, PrinterProtocol } from "./types";
import { normalizeBarcode, printerCodeFor } from "./barcodes";

function escapeText(value: unknown): string {
  return String(value ?? "").replace(/[\^~\\]/g, " ").replace(/[\r\n]+/g, " ").trim();
}

function productLines(product: LabelProduct, template: LabelTemplate): string[] {
  const lines: string[] = [];
  if (template.fields.includes("name")) lines.push(product.name);
  if (template.fields.includes("price")) {
    const price = template.priceMode === "WHOLESALE" ? product.wholesalePrice : product.sellingPrice;
    if (price != null) lines.push(`TZS ${Number(price).toLocaleString("en-TZ")}`);
  }
  if (template.fields.includes("sku") && product.sku) lines.push(`SKU: ${product.sku}`);
  if (template.fields.includes("unit") && product.unit) lines.push(`Unit: ${product.unit}`);
  if (template.fields.includes("custom") && template.customText) lines.push(template.customText);
  return lines;
}

function labelBarcode(product: LabelProduct, template: LabelTemplate): string {
  return template.fields.includes("barcode") ? normalizeBarcode(product.barcode) : "";
}

export function renderZpl(products: LabelProduct[], template: LabelTemplate): string {
  const widthDots = Math.round(template.widthMm * 8);
  const heightDots = Math.round(template.heightMm * 8);
  return products.map((product) => {
    const lines = productLines(product, template);
    const barcode = labelBarcode(product, template);
    const text = lines.map((line, index) => `^FO24,${24 + index * 28}^A0N,22,22^FD${escapeText(line)}^FS`).join("");
    const symbology = printerCodeFor(product.barcodeType);
    const barcodeCommand = barcode ? `^FO24,${Math.max(36, 24 + lines.length * 28)}^BY2^${symbology === "EAN13" ? "BEN" : symbology === "UPCA" ? "BUN" : "BCN"},48,Y,N,N^FD${escapeText(barcode)}^FS` : "";
    return `^XA^PW${widthDots}^LL${heightDots}${text}${barcodeCommand}^XZ`;
  }).join("\n");
}

export function renderTspl(products: LabelProduct[], template: LabelTemplate): string {
  return products.map((product) => {
    const lines = productLines(product, template);
    const barcode = labelBarcode(product, template);
    const text = lines.map((line, index) => `TEXT 24,${24 + index * 24},"0",0,1,1,"${escapeText(line)}"`).join("\n");
    const symbology = printerCodeFor(product.barcodeType);
    const barcodeCommand = barcode ? `BARCODE 24,${Math.max(40, 24 + lines.length * 24)},"${symbology === "EAN13" ? "EAN13" : symbology === "UPCA" ? "UPCA" : "128"}",48,1,0,2,2,"${escapeText(barcode)}"` : "";
    return `SIZE ${template.widthMm} mm,${template.heightMm} mm\nGAP 2 mm,0\nCLS\n${text}${barcodeCommand ? `\n${barcodeCommand}` : ""}\nPRINT 1,1`;
  }).join("\n\n");
}

function escPosText(value: string): string {
  return `${value}\n`;
}

export function renderEscPos(products: LabelProduct[], template: LabelTemplate): string {
  const labels = products.map((product) => {
    const lines = productLines(product, template);
    const barcode = labelBarcode(product, template);
    const bytes: number[] = [0x1b, 0x40, 0x1b, 0x61, 0x01];
    const text = [...lines.flatMap((line) => [...new TextEncoder().encode(escPosText(line))])];
    bytes.push(...text);
    if (barcode) {
      const data = new TextEncoder().encode(barcode);
      bytes.push(0x1d, 0x68, 0x40, 0x1d, 0x77, 0x02, 0x1d, 0x48, 0x02, 0x1d, 0x6b, 0x49, data.length, ...data);
    }
    bytes.push(0x0a, 0x0a, 0x1d, 0x56, 0x00);
    return bytes;
  }).flat();
  return Array.from(labels, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function renderPrinterFile(protocol: PrinterProtocol, products: LabelProduct[], template: LabelTemplate): { content: string; extension: string; mime: string } {
  if (protocol === "ZPL") return { content: renderZpl(products, template), extension: "zpl", mime: "text/plain;charset=utf-8" };
  if (protocol === "TSPL") return { content: renderTspl(products, template), extension: "tspl", mime: "text/plain;charset=utf-8" };
  if (protocol === "ESCPOS") return { content: renderEscPos(products, template), extension: "escpos.hex", mime: "text/plain;charset=utf-8" };
  return { content: "", extension: "html", mime: "text/html;charset=utf-8" };
}
