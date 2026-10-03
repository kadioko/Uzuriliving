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
  return lines;
}

function customText(template: LabelTemplate): string {
  return template.fields.includes("custom") ? escapeText(template.customText) : "";
}

function customFontSize(template: LabelTemplate): number {
  return template.customTextSize === "LARGE" ? 28 : template.customTextSize === "MEDIUM" ? 24 : 18;
}

function textLines(product: LabelProduct, template: LabelTemplate): Array<{ value: string; size: number }> {
  const lines = productLines(product, template).map((value) => ({ value, size: 22 }));
  const custom = customText(template);
  if (!custom || template.customTextPosition === "BELOW_BARCODE") return lines;
  const customLine = { value: custom, size: customFontSize(template) };
  return template.customTextPosition === "TOP" ? [customLine, ...lines] : [...lines, customLine];
}

function labelBarcode(product: LabelProduct, template: LabelTemplate): string {
  return template.fields.includes("barcode") ? normalizeBarcode(product.barcode) : "";
}

export function renderZpl(products: LabelProduct[], template: LabelTemplate): string {
  const widthDots = Math.round(template.widthMm * 8);
  const heightDots = Math.round(template.heightMm * 8);
  return products.map((product) => {
    const lines = textLines(product, template);
    const barcode = labelBarcode(product, template);
    const barcodeY = Math.max(36, 24 + lines.length * 28);
    const text = lines.map((line, index) => `^FO24,${24 + index * 28}^A0N,${line.size},${line.size}^FD${line.value}^FS`).join("");
    const symbology = printerCodeFor(product.barcodeType);
    const barcodeCommand = barcode ? `^FO24,${barcodeY}^BY2^${symbology === "EAN13" ? "BEN" : symbology === "UPCA" ? "BUN" : "BCN"},48,Y,N,N^FD${escapeText(barcode)}^FS` : "";
    const below = customText(template) && template.customTextPosition === "BELOW_BARCODE" ? `^FO24,${barcodeY + 58}^A0N,${customFontSize(template)},${customFontSize(template)}^FD${customText(template)}^FS` : "";
    return `^XA^PW${widthDots}^LL${heightDots}${text}${barcodeCommand}${below}^XZ`;
  }).join("\n");
}

export function renderTspl(products: LabelProduct[], template: LabelTemplate): string {
  return products.map((product) => {
    const lines = textLines(product, template);
    const barcode = labelBarcode(product, template);
    const barcodeY = Math.max(40, 24 + lines.length * 24);
    const text = lines.map((line, index) => `TEXT 24,${24 + index * 24},"0",0,${line.size >= 28 ? 2 : 1},${line.size >= 28 ? 2 : 1},"${line.value}"`).join("\n");
    const symbology = printerCodeFor(product.barcodeType);
    const barcodeCommand = barcode ? `BARCODE 24,${barcodeY},"${symbology === "EAN13" ? "EAN13" : symbology === "UPCA" ? "UPCA" : "128"}",48,1,0,2,2,"${escapeText(barcode)}"` : "";
    const below = customText(template) && template.customTextPosition === "BELOW_BARCODE" ? `TEXT 24,${barcodeY + 58},"0",0,${customFontSize(template) >= 28 ? 2 : 1},${customFontSize(template) >= 28 ? 2 : 1},"${customText(template)}"` : "";
    return `SIZE ${template.widthMm} mm,${template.heightMm} mm\nGAP 2 mm,0\nCLS\n${text}${barcodeCommand ? `\n${barcodeCommand}` : ""}${below ? `\n${below}` : ""}\nPRINT 1,1`;
  }).join("\n\n");
}

export function renderEpl(products: LabelProduct[], template: LabelTemplate): string {
  return products.map((product) => {
    const lines = textLines(product, template);
    const barcode = labelBarcode(product, template);
    const barcodeY = Math.max(40, 24 + lines.length * 24);
    const text = lines.map((line, index) => `A24,${24 + index * 24},0,3,${line.size >= 28 ? 2 : 1},${line.size >= 28 ? 2 : 1},N,"${line.value}"`).join("\n");
    const barcodeCommand = barcode ? `B24,${barcodeY},0,1,2,4,60,B,"${escapeText(barcode)}"` : "";
    const below = customText(template) && template.customTextPosition === "BELOW_BARCODE" ? `A24,${barcodeY + 58},0,3,${customFontSize(template) >= 28 ? 2 : 1},${customFontSize(template) >= 28 ? 2 : 1},N,"${customText(template)}"` : "";
    return `N\n${text}${barcodeCommand ? `\n${barcodeCommand}` : ""}${below ? `\n${below}` : ""}\nP1`;
  }).join("\n\n");
}

function escPosText(value: string, size = 0): number[] {
  return [0x1d, 0x21, size, ...new TextEncoder().encode(`${value}\n`)];
}

export function renderEscPos(products: LabelProduct[], template: LabelTemplate): string {
  const labels = products.map((product) => {
    const lines = textLines(product, template);
    const barcode = labelBarcode(product, template);
    const bytes: number[] = [0x1b, 0x40, 0x1b, 0x61, 0x01];
    const text = [...lines.flatMap((line) => escPosText(line.value, line.size >= 28 ? 0x11 : line.size >= 24 ? 0x01 : 0x00))];
    bytes.push(...text);
    if (barcode) {
      const data = new TextEncoder().encode(barcode);
      bytes.push(0x1d, 0x68, 0x40, 0x1d, 0x77, 0x02, 0x1d, 0x48, 0x02, 0x1d, 0x6b, 0x49, data.length, ...data);
    }
    if (customText(template) && template.customTextPosition === "BELOW_BARCODE") bytes.push(...escPosText(customText(template), customFontSize(template) >= 28 ? 0x11 : customFontSize(template) >= 24 ? 0x01 : 0x00));
    bytes.push(0x0a, 0x0a, 0x1d, 0x56, 0x00);
    return bytes;
  }).flat();
  return Array.from(labels, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function renderPrinterFile(protocol: PrinterProtocol, products: LabelProduct[], template: LabelTemplate): { content: string; extension: string; mime: string } {
  if (protocol === "ZPL") return { content: renderZpl(products, template), extension: "zpl", mime: "text/plain;charset=utf-8" };
  if (protocol === "TSPL") return { content: renderTspl(products, template), extension: "tspl", mime: "text/plain;charset=utf-8" };
  if (protocol === "EPL") return { content: renderEpl(products, template), extension: "epl", mime: "text/plain;charset=utf-8" };
  if (protocol === "ESCPOS") return { content: renderEscPos(products, template), extension: "escpos.hex", mime: "text/plain;charset=utf-8" };
  return { content: "", extension: "html", mime: "text/html;charset=utf-8" };
}
