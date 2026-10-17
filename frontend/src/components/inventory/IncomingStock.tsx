"use client";
import { useLang } from "@/lib/i18n";

export default function IncomingStock({ product }: { product: { unit: string; onOrderStatus?: "ORDERED" | "ON_THE_WAY" | null; onOrderQuantity?: number; onOrderInTransitQuantity?: number; onOrderOrderedQuantity?: number } }) {
  const lang = useLang();
  if (!product.onOrderStatus) return null;
  const onTheWay = product.onOrderStatus === "ON_THE_WAY";
  return <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-blue-700">
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${onTheWay ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{onTheWay ? (lang === "sw" ? "Iko njiani" : "On the way") : (lang === "sw" ? "Imeagizwa" : "Ordered")}</span>
    {product.onOrderQuantity != null && <span>{product.onOrderQuantity} {product.unit} {lang === "sw" ? "zinakuja" : "incoming"}</span>}
    {Boolean(product.onOrderInTransitQuantity && product.onOrderOrderedQuantity) && <span className="text-[11px] font-normal text-gray-500">({product.onOrderInTransitQuantity} {lang === "sw" ? "njiani" : "on the way"}, {product.onOrderOrderedQuantity} {lang === "sw" ? "imeagizwa" : "ordered"})</span>}
  </p>;
}
