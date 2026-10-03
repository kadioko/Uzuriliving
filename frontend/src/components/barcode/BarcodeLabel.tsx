"use client";

import { linearBarcodeBits } from "@/lib/labels/barcodes";
import type { LabelField, LabelTextPosition, LabelTextSize } from "@/lib/labels/types";

export function BarcodeLabel({
  value,
  barcodeType,
  name,
  price,
  sku,
  unit,
  customText,
  customTextPosition = "ABOVE_BARCODE",
  customTextSize = "SMALL",
  fields = ["name", "barcode", "price"],
  widthMm = 40,
  heightMm = 30,
  className = "",
}: {
  value?: string | null;
  barcodeType?: string | null;
  name?: string;
  price?: string;
  sku?: string | null;
  unit?: string | null;
  customText?: string;
  customTextPosition?: LabelTextPosition;
  customTextSize?: LabelTextSize;
  fields?: LabelField[];
  widthMm?: number;
  heightMm?: number;
  className?: string;
}) {
  const showBarcode = fields.includes("barcode") && Boolean(value);
  const symbol = showBarcode ? linearBarcodeBits(value, barcodeType) : null;
  const barcodeTypeLabel = symbol?.type === "EAN13" ? "EAN-13" : symbol?.type === "UPC" ? "UPC-A" : "Code 128";
  const customTextClass = customTextSize === "LARGE" ? "text-[10px] font-semibold" : customTextSize === "MEDIUM" ? "text-[9px] font-medium" : "text-[8px]";
  const customTextNode = fields.includes("custom") && customText ? <p className={`max-w-full truncate leading-tight text-gray-600 ${customTextClass}`}>{customText}</p> : null;

  return (
    <div
      className={`label-card flex flex-col items-center justify-center overflow-hidden bg-white p-1.5 text-center ${className}`}
      style={{ width: `${widthMm}mm`, minHeight: `${heightMm}mm` }}
    >
      {customTextPosition === "TOP" && customTextNode}
      {fields.includes("name") && name && <p className="max-w-full truncate text-[9px] font-semibold leading-tight text-gray-900">{name}</p>}
      {fields.includes("sku") && sku && <p className="max-w-full truncate font-mono text-[8px] leading-tight text-gray-500">{sku}</p>}
      {fields.includes("unit") && unit && <p className="text-[8px] leading-tight text-gray-500">{unit}</p>}
      {fields.includes("price") && price && <p className="text-[10px] font-bold leading-tight text-gray-800">{price}</p>}
      {customTextPosition === "ABOVE_BARCODE" && customTextNode}
      {symbol ? (
        <svg viewBox="0 0 210 76" className="mt-0.5 h-auto w-full" role="img" aria-label={`${barcodeTypeLabel} barcode ${symbol.displayValue}`}>
          <rect width="210" height="76" fill="white" />
          {symbol.bits.split("").map((bit, index) => bit === "1" ? <rect key={index} x={10 + (index * 190) / symbol.bits.length} y="6" width={190 / symbol.bits.length + 0.08} height="48" fill="black" /> : null)}
          <text x="105" y="69" textAnchor="middle" fontSize="10" fontFamily="monospace">{symbol.displayValue}</text>
        </svg>
      ) : fields.includes("barcode") ? (
        <p className="text-[8px] text-gray-400">{showBarcode ? `Invalid ${barcodeType || "barcode"}` : "No barcode assigned"}</p>
      ) : null}
      {customTextPosition === "BELOW_BARCODE" && customTextNode}
    </div>
  );
}
