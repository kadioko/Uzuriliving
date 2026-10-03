import { linearBarcodeBits } from "./barcodes";
import type { LabelProduct, LabelTemplate } from "./types";

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function shorten(value: unknown, maxLength: number): string {
  const text = String(value ?? "").trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 1))}…` : text;
}

function productLines(product: LabelProduct, template: LabelTemplate): string[] {
  const lines: string[] = [];
  if (template.fields.includes("name")) lines.push(shorten(product.name, 32));
  if (template.fields.includes("price")) {
    const price = template.priceMode === "WHOLESALE" ? product.wholesalePrice : product.sellingPrice;
    if (price != null) lines.push(`TZS ${Number(price).toLocaleString("en-TZ")}`);
  }
  if (template.fields.includes("sku") && product.sku) lines.push(`SKU: ${shorten(product.sku, 26)}`);
  if (template.fields.includes("unit") && product.unit) lines.push(shorten(product.unit, 26));
  return lines;
}

function renderBarcode(value: string | null | undefined, barcodeType: string | null | undefined, x: number, y: number, width: number, height: number): string {
  const symbol = value ? linearBarcodeBits(value, barcodeType) : null;
  if (!symbol) return "";
  const bars = symbol.bits.split("").map((bit, index) => bit === "1"
    ? `<rect x="${(10 + (index * 190) / symbol.bits.length).toFixed(3)}" y="6" width="${(190 / symbol.bits.length + 0.08).toFixed(3)}" height="48" fill="#000"/>`
    : "").join("");
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 210 76" preserveAspectRatio="none" role="img" aria-label="${escapeXml(symbol.displayValue)}"><rect width="210" height="76" fill="#fff"/>${bars}<text x="105" y="69" text-anchor="middle" font-size="10" font-family="monospace">${escapeXml(symbol.displayValue)}</text></svg>`;
}

/** Renders selected labels as one exact-size vertical label roll. */
export function renderLabelImageSvg(products: LabelProduct[], template: LabelTemplate): string {
  const width = Math.max(20, template.widthMm);
  const height = Math.max(15, template.heightMm);
  const padding = 2;
  const barcodeHeight = Math.min(12, Math.max(8, height * 0.38));
  const labelMarkup = products.map((product, index) => {
    const offsetY = index * height;
    const lines = productLines(product, template);
    const customText = template.fields.includes("custom") ? shorten(template.customText, 26) : "";
    const customPosition = template.customTextPosition ?? "ABOVE_BARCODE";
    const customSize = template.customTextSize === "LARGE" ? 2.9 : template.customTextSize === "MEDIUM" ? 2.5 : 2.1;
    const renderText = (line: string, lineIndex: number, size = lineIndex === 0 ? 2.5 : 2.1, weight = lineIndex === 0 ? 700 : 400) => {
      const y = offsetY + padding + 3 + lineIndex * 2.8;
      return `<text x="${width / 2}" y="${y.toFixed(2)}" text-anchor="middle" font-size="${size}" font-family="Arial, sans-serif" font-weight="${weight}" fill="#102a43">${escapeXml(line)}</text>`;
    };
    const topText = customText && customPosition === "TOP" ? renderText(customText, 0, customSize, 600) : "";
    const textMarkup = lines.map((line, lineIndex) => {
      const isPrice = template.fields.includes("price") && line.startsWith("TZS ");
      const adjustedIndex = customText && customPosition === "TOP" ? lineIndex + 1 : lineIndex;
      return renderText(line, adjustedIndex, isPrice ? 2.8 : adjustedIndex === 0 ? 2.5 : 2.1, isPrice || adjustedIndex === 0 ? 700 : 400);
    }).join("");
    const aboveBarcode = customText && customPosition === "ABOVE_BARCODE" ? renderText(customText, lines.length, customSize, 600) : "";
    const belowSpace = customText && customPosition === "BELOW_BARCODE" ? 3.5 : 0;
    const barcodeY = offsetY + Math.max(padding + 5 + lines.length * 2.8 + (customText && customPosition === "ABOVE_BARCODE" ? 2.8 : 0), height - barcodeHeight - 2 - belowSpace);
    const barcode = template.fields.includes("barcode")
      ? renderBarcode(product.barcode, product.barcodeType, padding, barcodeY, width - padding * 2, barcodeHeight)
      : "";
    const belowBarcode = customText && customPosition === "BELOW_BARCODE" ? `<text x="${width / 2}" y="${(offsetY + height - 1).toFixed(2)}" text-anchor="middle" font-size="${customSize}" font-family="Arial, sans-serif" font-weight="600" fill="#102a43">${escapeXml(customText)}</text>` : "";
    return `<g><rect x="0" y="${offsetY}" width="${width}" height="${height}" fill="#fff"/>${topText}${textMarkup}${aboveBarcode}${barcode}${belowBarcode}</g>`;
  }).join("");
  const totalHeight = Math.max(height, products.length * height);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${totalHeight}mm" viewBox="0 0 ${width} ${totalHeight}" role="img" aria-label="Uzuri Living product labels">${labelMarkup}</svg>`;
}
