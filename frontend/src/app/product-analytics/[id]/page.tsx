"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { ArrowLeft, BarChart3, Package, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ProductSummary = {
  product: { id: string; name: string; unit: string; sku?: string | null; barcode?: string | null; buyingPrice?: number | null; sellingPrice: number; wholesalePrice?: number | null; currentStock: number; minimumStock: number; imageUrl?: string | null; supplier?: { id: string; name: string } | null };
  sales: { salesCount: number; unitsSold: number; revenue: number; costOfGoods: number; retailUnits: number; wholesaleUnits: number; lastSoldAt?: string | null; averageSellingPrice: number; grossProfit?: number | null; grossMargin?: number | null };
  stock: { receivedQuantity: number; returnedQuantity: number; removedQuantity: number; adjustmentCount: number; currentStock: number; minimumStock: number; lastMovementAt?: string | null };
  orders: { orderedQuantity: number; onTheWayQuantity: number; openOrderCount: number };
  customerOrders: { orderCount: number; requestedQuantity: number; pendingQuantity: number };
  trend: Array<{ date: string; unitsSold: number; revenue: number }>;
};

type AnalyticsData = {
  period: string;
  primary: ProductSummary;
  comparisons: ProductSummary[];
  availableProducts: Array<{ id: string; name: string; unit: string; currentStock: number }>;
  recentMovements: Array<{ type: string; quantity: number; note?: string | null; createdAt: string }>;
};

const PERIODS = [
  ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["365", "12 months"], ["all", "All time"],
] as const;
const LINE_COLORS = ["#0f766e", "#7c3aed", "#ea580c", "#2563eb", "#be123c"];

function dateLabel(value: string | null | undefined, lang: string) {
  return value ? new Date(value).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default function ProductAnalyticsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const lang = useLang();
  const { toast } = useToast();
  const [period, setPeriod] = useState("30");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ period });
    if (compareIds.length) query.set("compareIds", compareIds.join(","));
    api.get<AnalyticsData>(`/products/${id}/analytics?${query}`)
      .then((result) => { if (active) setData(result); })
      .catch((error: unknown) => { if (active) toast(error instanceof Error ? error.message : (lang === "sw" ? "Imeshindikana kupakia analytics ya bidhaa." : "Could not load product analytics."), "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, period, compareIds, toast, lang]);

  const summaries = data ? [data.primary, ...data.comparisons] : [];
  const chartData = useMemo(() => {
    const dates = [...new Set(summaries.flatMap((summary) => summary.trend.map((point) => point.date)))].sort();
    return dates.map((date) => Object.fromEntries(["date", ...summaries.map((summary) => summary.product.id)].map((key) => [key, key === "date" ? date : summaries.find((summary) => summary.product.id === key)?.trend.find((point) => point.date === date)?.revenue ?? 0])));
  }, [data]);

  function toggleCompare(productId: string) {
    setCompareIds((current) => current.includes(productId) ? current.filter((idValue) => idValue !== productId) : current.length < 4 ? [...current, productId] : current);
  }

  const primary = data?.primary;
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5 pb-24 lg:pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Link href="/inventory" aria-label={lang === "sw" ? "Rudi inventory" : "Back to inventory"} className="mt-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100"><ArrowLeft className="h-5 w-5" /></Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{lang === "sw" ? "Utendaji wa bidhaa" : "Product performance"}</p>
              <h1 className="text-2xl font-bold text-gray-900">{primary?.product.name ?? (lang === "sw" ? "Analytics ya bidhaa" : "Product analytics")}</h1>
              {primary?.product.sku && <p className="mt-1 text-xs text-gray-500">SKU: {primary.product.sku}</p>}
            </div>
          </div>
          <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label={lang === "sw" ? "Muda wa analytics" : "Analytics period"} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
            {PERIODS.map(([value, label]) => <option key={value} value={value}>{lang === "sw" ? value === "all" ? "Muda wote" : `Siku ${value}` : label}</option>)}
          </select>
        </div>

        {loading ? <div className="py-20 text-center text-gray-400">{lang === "sw" ? "Inapakia analytics..." : "Loading analytics..."}</div> : !data || !primary ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{lang === "sw" ? "Bidhaa haikupatikana." : "Product analytics could not be found."}</div> : <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label={lang === "sw" ? "Units zilizouzwa" : "Units sold"} value={`${primary.sales.unitsSold} ${primary.product.unit}`} />
            <Metric label={lang === "sw" ? "Mapato" : "Revenue"} value={formatTZS(primary.sales.revenue)} />
            <Metric label={lang === "sw" ? "Faida" : "Gross profit"} value={primary.sales.grossProfit == null ? "—" : formatTZS(primary.sales.grossProfit)} />
            <Metric label={lang === "sw" ? "Stock sasa" : "Current stock"} value={`${primary.stock.currentStock} ${primary.product.unit}`} />
            <Metric label={lang === "sw" ? "Maagizo ya wateja" : "Customer demand"} value={`${primary.customerOrders.requestedQuantity} ${primary.product.unit}`} />
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3"><div className="rounded-lg bg-brand-50 p-2 text-brand-700"><BarChart3 className="h-5 w-5" /></div><div><h2 className="font-semibold text-gray-900">{lang === "sw" ? "Mwelekeo wa mauzo" : "Sales trend"}</h2><p className="text-xs text-gray-500">{lang === "sw" ? "Mapato kwa siku katika muda uliochaguliwa." : "Daily revenue for the selected period."}</p></div></div>
            <div className="mt-4 h-72 w-full">{chartData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="date" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => formatTZS(Number(value ?? 0))} /><Legend />{summaries.map((summary, index) => <Line key={summary.product.id} type="monotone" dataKey={summary.product.id} name={summary.product.name} stroke={LINE_COLORS[index]} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-sm text-gray-400">{lang === "sw" ? "Hakuna mauzo katika muda huu." : "No sales in this period."}</div>}</div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-gray-900">{lang === "sw" ? "Stock na supply" : "Stock and supply"}</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><Fact label={lang === "sw" ? "Zimepokelewa" : "Received"} value={`${primary.stock.receivedQuantity} ${primary.product.unit}`} /><Fact label={lang === "sw" ? "Zilirudishwa" : "Returned"} value={`${primary.stock.returnedQuantity} ${primary.product.unit}`} /><Fact label={lang === "sw" ? "Zinakuja" : "On the way"} value={`${primary.orders.onTheWayQuantity} ${primary.product.unit}`} /><Fact label={lang === "sw" ? "Zimeagizwa" : "Ordered"} value={`${primary.orders.orderedQuantity} ${primary.product.unit}`} /><Fact label={lang === "sw" ? "Kiwango cha chini" : "Minimum stock"} value={`${primary.stock.minimumStock} ${primary.product.unit}`} /><Fact label={lang === "sw" ? "Mwisho movement" : "Last movement"} value={dateLabel(primary.stock.lastMovementAt, lang)} /></div></section>
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-gray-900">{lang === "sw" ? "Bei na mchanganyiko wa mauzo" : "Pricing and sales mix"}</h2><div className="mt-3 grid grid-cols-2 gap-3 text-sm"><Fact label={lang === "sw" ? "Bei ya kuuza" : "Selling price"} value={formatTZS(primary.product.sellingPrice)} /><Fact label={lang === "sw" ? "Bei ya wastani" : "Average price"} value={formatTZS(primary.sales.averageSellingPrice)} /><Fact label="Retail units" value={`${primary.sales.retailUnits}`} /><Fact label="Wholesale units" value={`${primary.sales.wholesaleUnits}`} /><Fact label={lang === "sw" ? "Margin" : "Gross margin"} value={primary.sales.grossMargin == null ? "—" : `${primary.sales.grossMargin}%`} /><Fact label={lang === "sw" ? "Mauzo ya mwisho" : "Last sold"} value={dateLabel(primary.sales.lastSoldAt, lang)} /></div></section>
          </div>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-brand-700" /><h2 className="font-semibold text-gray-900">{lang === "sw" ? "Linganisha bidhaa" : "Compare products"}</h2></div><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Chagua hadi bidhaa nne kuona mwenendo pamoja na bidhaa hii." : "Select up to four products to compare against this product."}</p><div className="mt-3 grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{data.availableProducts.filter((product) => product.id !== primary.product.id).map((product) => <label key={product.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"><input type="checkbox" checked={compareIds.includes(product.id)} onChange={() => toggleCompare(product.id)} /><span className="truncate">{product.name}</span><span className="ml-auto text-xs text-gray-400">{product.currentStock} {product.unit}</span></label>)}</div>{data.comparisons.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b border-gray-100 text-xs text-gray-500"><th className="px-2 py-2">Product</th><th className="px-2 py-2">Units sold</th><th className="px-2 py-2">Revenue</th><th className="px-2 py-2">Gross profit</th><th className="px-2 py-2">Current stock</th></tr></thead><tbody>{summaries.map((summary) => <tr key={summary.product.id} className="border-b border-gray-50"><td className="px-2 py-2 font-medium">{summary.product.name}</td><td className="px-2 py-2">{summary.sales.unitsSold}</td><td className="px-2 py-2">{formatTZS(summary.sales.revenue)}</td><td className="px-2 py-2">{summary.sales.grossProfit == null ? "—" : formatTZS(summary.sales.grossProfit)}</td><td className="px-2 py-2">{summary.stock.currentStock} {summary.product.unit}</td></tr>)}</tbody></table></div>}</section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><Package className="h-5 w-5 text-brand-700" /><h2 className="font-semibold text-gray-900">{lang === "sw" ? "Maelezo ya ziada" : "Additional signals"}</h2></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Fact label={lang === "sw" ? "Maagizo yote ya wateja" : "Customer orders"} value={`${primary.customerOrders.orderCount}`} /><Fact label={lang === "sw" ? "Yanayosubiri" : "Pending demand"} value={`${primary.customerOrders.pendingQuantity} ${primary.product.unit}`} /><Fact label={lang === "sw" ? "Supplier" : "Supplier"} value={primary.product.supplier?.name || "—"} /><Fact label={lang === "sw" ? "Stock adjustments" : "Stock adjustments"} value={`${primary.stock.adjustmentCount}`} /></div></section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"><h2 className="font-semibold text-gray-900">{lang === "sw" ? "Mabadiliko ya karibuni" : "Recent stock movements"}</h2><div className="mt-3 space-y-2">{data.recentMovements.length ? data.recentMovements.map((movement, index) => <div key={`${movement.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-50 py-2 text-xs"><span className="font-semibold text-gray-700">{movement.type} · {movement.quantity} {primary.product.unit}</span><span className="text-gray-500">{movement.note || "—"}</span><span className="text-gray-400">{dateLabel(movement.createdAt, lang)}</span></div>) : <p className="py-4 text-sm text-gray-400">{lang === "sw" ? "Hakuna movements bado." : "No stock movements yet."}</p>}</div></section>
        </>}
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-lg font-bold text-gray-900">{value}</p></div>; }
function Fact({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-gray-50 p-3"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 font-semibold text-gray-800">{value}</p></div>; }
