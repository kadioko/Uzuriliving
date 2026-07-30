"use client";

// Code 128-B bar patterns. Internal DP codes use this printable, scanner-readable symbology.
const PATTERNS = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];

function widths(value: string) {
  const codes = [104, ...[...value].map((char) => char.charCodeAt(0) - 32)];
  const checksum = (104 + codes.slice(1).reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  return [...codes, checksum, 106].flatMap((code) => [...PATTERNS[code]].map(Number));
}

export function BarcodeLabel({ value, name, price, className = "" }: { value: string; name?: string; price?: string; className?: string }) {
  const bars = widths(value); let x = 10; const scale = 1.35;
  return <div className={`bg-white p-2 text-center ${className}`}><p className="truncate text-xs font-semibold text-gray-900">{name || "Uzuri Living"}</p><svg viewBox="0 0 210 76" className="h-auto w-full" role="img" aria-label={`Barcode ${value}`}><rect width="210" height="76" fill="white" />{bars.map((width, index) => { const current = x; x += width * scale; return index % 2 === 0 ? <rect key={index} x={current} y="6" width={width * scale} height="48" fill="black" /> : null; })}<text x="105" y="69" textAnchor="middle" fontSize="10" fontFamily="monospace">{value}</text></svg>{price && <p className="text-xs font-bold text-gray-800">{price}</p>}</div>;
}
