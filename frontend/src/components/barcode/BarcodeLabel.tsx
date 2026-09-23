"use client";

import type { LabelField } from "@/lib/labels/types";

// Code 128-B bar patterns. EAN/UPC rendering will be added as a separate
// symbology adapter; this component deliberately keeps the label layout
// independent from the printer/output format.
const PATTERNS = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

function widths(value: string) {
  const codes = [104, ...[...value].map((char) => char.charCodeAt(0) - 32)];
  const checksum = (104 + codes.slice(1).reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  return [...codes, checksum, 106].flatMap((code) => [...PATTERNS[code]].map(Number));
}

export function BarcodeLabel({
  value,
  name,
  price,
  sku,
  unit,
  customText,
  fields = ["name", "barcode", "price"],
  widthMm = 40,
  heightMm = 30,
  className = "",
}: {
  value?: string | null;
  name?: string;
  price?: string;
  sku?: string | null;
  unit?: string | null;
  customText?: string;
  fields?: LabelField[];
  widthMm?: number;
  heightMm?: number;
  className?: string;
}) {
  const showBarcode = fields.includes("barcode") && Boolean(value);
  const bars = showBarcode ? widths(String(value)) : [];
  let x = 10;
  const scale = 1.35;

  return (
    <div
      className={`label-card flex flex-col items-center justify-center overflow-hidden bg-white p-1.5 text-center ${className}`}
      style={{ width: `${widthMm}mm`, minHeight: `${heightMm}mm` }}
    >
      {fields.includes("name") && name && <p className="max-w-full truncate text-[9px] font-semibold leading-tight text-gray-900">{name}</p>}
      {fields.includes("sku") && sku && <p className="max-w-full truncate font-mono text-[8px] leading-tight text-gray-500">{sku}</p>}
      {fields.includes("unit") && unit && <p className="text-[8px] leading-tight text-gray-500">{unit}</p>}
      {fields.includes("price") && price && <p className="text-[10px] font-bold leading-tight text-gray-800">{price}</p>}
      {fields.includes("custom") && customText && <p className="max-w-full truncate text-[8px] leading-tight text-gray-600">{customText}</p>}
      {showBarcode ? (
        <svg viewBox="0 0 210 76" className="mt-0.5 h-auto w-full" role="img" aria-label={`Barcode ${value}`}>
          <rect width="210" height="76" fill="white" />
          {bars.map((barWidth, index) => {
            const current = x;
            x += barWidth * scale;
            return index % 2 === 0 ? <rect key={index} x={current} y="6" width={barWidth * scale} height="48" fill="black" /> : null;
          })}
          <text x="105" y="69" textAnchor="middle" fontSize="10" fontFamily="monospace">{value}</text>
        </svg>
      ) : fields.includes("barcode") ? (
        <p className="text-[8px] text-gray-400">No barcode assigned</p>
      ) : null}
    </div>
  );
}
