"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { getAppDateInputValue, getAppTimeZone, timeZoneOffsetLabel } from "@/lib/timezone";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Image as ImageIcon, Package, Store, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Period = "today" | "month" | "quarter" | "year" | "custom";

type Analytics = {
  period: Period;
  timeZone: string;
  group: "hour" | "day" | "month";
  summary: {
    salesRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    grossProfitMargin: number;
    salesCount: number;
    unitsSold: number;
    missingCostSalesRevenue: number;
  };
  chart: Array<{ label: string; revenue: number; costOfGoodsSold: number; grossProfit: number }>;
  topProducts: Array<{ id: string; name: string; unit: string; imageUrl: string | null; revenue: number; costOfGoodsSold: number; grossProfit: number; unitsSold: number; rank: number }>;
  topSupplier: { id: string; name: string; revenue: number; unitsSold: number; productsSold: number } | null;
};

const dateValue = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return getAppDateInputValue(date);
};

const numberValue = (value: number) => value.toLocaleString("en-TZ", { maximumFractionDigits: 2 });

export default function AnalyticsPage() {
  const lang = useLang();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(() => dateValue(-29));
  const [to, setTo] = useState(() => dateValue());
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timeZone, setTimeZone] = useState(getAppTimeZone());

  const labels = useMemo(() => ({
    title: lang === "sw" ? "Uchambuzi" : "Analytics",
    subtitle: lang === "sw" ? "Elewa mapato, mauzo, faida na bidhaa zinazoongoza." : "Understand revenue, sales, profitability, and the products driving your shop.",
    today: lang === "sw" ? "Leo" : "Today",
    month: lang === "sw" ? "Mwezi huu" : "This month",
    quarter: lang === "sw" ? "Robo hii" : "This quarter",
    year: lang === "sw" ? "Mwaka huu" : "This year",
    custom: lang === "sw" ? "Chagua tarehe" : "Custom range",
  }), [lang]);

  useEffect(() => {
    setTimeZone(getAppTimeZone());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    setLoading(true);
    setError("");
    api.get<Analytics>(`/dashboard/analytics?${params}`, lang)
      .then(setData)
      .catch((value: unknown) => setError(value instanceof Error ? value.message : (lang === "sw" ? "Imeshindikana kupakia uchambuzi." : "Could not load analytics.")))
      .finally(() => setLoading(false));
  }, [period, from, to, lang]);

  const cards = data ? [
    { label: lang === "sw" ? "Mapato" : "Revenue", value: formatTZS(data.summary.salesRevenue), tone: "border-sky-100 bg-sky-50 text-sky-800" },
    { label: lang === "sw" ? "Mauzo" : "Sales", value: numberValue(data.summary.salesCount), tone: "border-indigo-100 bg-indigo-50 text-indigo-800" },
    { label: lang === "sw" ? "Faida Ghafi" : "Gross profit", value: formatTZS(data.summary.grossProfit), tone: "border-emerald-100 bg-emerald-50 text-emerald-800" },
    { label: lang === "sw" ? "Faida kwa Asilimia" : "Gross profit margin", value: `${data.summary.grossProfitMargin}%`, tone: "border-violet-100 bg-violet-50 text-violet-800" },
    { label: lang === "sw" ? "Gharama ya Bidhaa" : "Cost of goods sold", value: formatTZS(data.summary.costOfGoodsSold), tone: "border-amber-100 bg-amber-50 text-amber-800" },
    { label: lang === "sw" ? "Vipande vilivyouzwa" : "Units sold", value: numberValue(data.summary.unitsSold), tone: "border-gray-200 bg-gray-50 text-gray-800" },
  ] : [];

  const periodKeys: Period[] = ["today", "month", "quarter", "year", "custom"];
  const chartHasValues = Boolean(data?.chart.length);

  return <AppShell>
    <div className="mx-auto max-w-7xl pb-20 lg:pb-6">
      <section className="mb-6 border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-brand-700"><BarChart3 className="h-5 w-5" /><span className="text-sm font-bold">Uzuri Living</span></div>
            <h1 className="mt-2 text-2xl font-bold text-gray-950">{labels.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{labels.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500"><CalendarDays className="h-4 w-4" /><span>{timeZone} ({timeZoneOffsetLabel(timeZone)})</span></div>
        </div>
        <div className="mt-5 flex items-center gap-2">
          <button type="button" aria-label={lang === "sw" ? "Kipindi kilichopita" : "Previous period"} className="hidden border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 sm:block"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto bg-gray-100 p-1">
            {periodKeys.map((key) => <button key={key} type="button" onClick={() => setPeriod(key)} className={`whitespace-nowrap px-3 py-2 text-sm font-semibold ${period === key ? "bg-white text-brand-800 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{labels[key]}</button>)}
          </div>
          <button type="button" aria-label={lang === "sw" ? "Kipindi kijacho" : "Next period"} className="hidden border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 sm:block"><ChevronRight className="h-4 w-4" /></button>
        </div>
        {period === "custom" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">{lang === "sw" ? "Kuanzia" : "From"}<input aria-label={lang === "sw" ? "Kuanzia" : "From"} type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full border border-gray-300 px-3 py-2" /></label><label className="text-sm font-medium text-gray-700">{lang === "sw" ? "Mpaka" : "To"}<input aria-label={lang === "sw" ? "Mpaka" : "To"} type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full border border-gray-300 px-3 py-2" /></label></div>}
      </section>

      {loading && !data ? <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin border-2 border-brand-200 border-t-brand-700" /></div> : error ? <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map((card) => <div key={card.label} className={`border p-4 ${card.tone}`}><p className="break-words text-lg font-bold sm:text-xl">{card.value}</p><p className="mt-1 text-xs font-medium">{card.label}</p></div>)}</div>

        <section className="mt-6 border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-base font-semibold text-gray-900">{lang === "sw" ? "Mwelekeo wa biashara" : "Business performance"}</h2><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Mapato, gharama ya bidhaa na faida kwa muda." : "Revenue, cost of goods sold, and gross profit over time."}</p></div><TrendingUp className="h-5 w-5 text-brand-600" /></div>
          {chartHasValues ? <ResponsiveContainer width="100%" height={280}><LineChart data={data?.chart} margin={{ top: 20, left: 4, right: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => formatTZS(Number(value ?? 0))} /><Line type="monotone" dataKey="revenue" name={lang === "sw" ? "Mapato" : "Revenue"} stroke="#0ea5e9" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="grossProfit" name={lang === "sw" ? "Faida Ghafi" : "Gross profit"} stroke="#10b981" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="costOfGoodsSold" name={lang === "sw" ? "Gharama" : "COGS"} stroke="#f59e0b" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer> : <p className="py-14 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna mauzo yaliyokamilika kwenye kipindi hiki." : "No completed sales were recorded during this period."}</p>}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <section className="border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-gray-900">{lang === "sw" ? "Bidhaa zinazoongoza" : "Top products"}</h2><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Bidhaa zilizozalisha mapato mengi zaidi." : "Products ranked by revenue in this period."}</p></div><Package className="h-5 w-5 text-brand-600" /></div>
            {data?.topProducts.length ? <div className="divide-y divide-gray-100">{data.topProducts.map((product) => <div key={product.id} className="flex items-center gap-3 px-4 py-3 sm:px-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100 text-gray-400">{product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900"><span className="mr-2 text-xs text-gray-400">#{product.rank}</span>{product.name}</p><p className="mt-1 text-xs text-gray-500">{numberValue(product.unitsSold)} {product.unit} · {lang === "sw" ? "Faida" : "Profit"} {formatTZS(product.grossProfit)}</p></div><p className="shrink-0 text-right text-sm font-semibold text-gray-900">{formatTZS(product.revenue)}</p></div>)}</div> : <p className="p-8 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna bidhaa zilizouzwa." : "No products were sold in this period."}</p>}
          </section>

          <section className="border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5"><div><h2 className="text-base font-semibold text-gray-900">{lang === "sw" ? "Msambazaji bora" : "Top supplier"}</h2><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Kwa mapato ya bidhaa zilizouzwa." : "Based on revenue from sold products."}</p></div><Store className="h-5 w-5 text-brand-600" /></div>{data?.topSupplier ? <div className="p-5"><p className="text-lg font-bold text-gray-950">{data.topSupplier.name}</p><p className="mt-2 text-2xl font-bold text-brand-700">{formatTZS(data.topSupplier.revenue)}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="bg-gray-50 p-3"><p className="font-semibold text-gray-900">{numberValue(data.topSupplier.unitsSold)}</p><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Vipande" : "Units sold"}</p></div><div className="bg-gray-50 p-3"><p className="font-semibold text-gray-900">{numberValue(data.topSupplier.productsSold)}</p><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Bidhaa" : "Products"}</p></div></div></div> : <p className="p-8 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna msambazaji mwenye mauzo kwenye kipindi hiki." : "No supplier-linked sales were recorded in this period."}</p>}</section>
        </div>
        {data?.summary.missingCostSalesRevenue ? <p className="mt-4 border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">{lang === "sw" ? "Baadhi ya mauzo hayakuwa na bei ya kununua; faida inaweza kuwa juu kuliko uhalisia." : `${formatTZS(data.summary.missingCostSalesRevenue)} of revenue had no saved buying price, so COGS and gross profit may be incomplete.`}</p> : null}
        <p className="mt-4 text-xs leading-5 text-gray-500">{lang === "sw" ? "Faida ghafi = Mapato - Gharama ya Bidhaa. Hesabu hutumia bei ya kununua iliyohifadhiwa wakati wa mauzo." : "Gross profit = Revenue - Cost of goods sold. Calculations use the buying price saved when each sale was recorded."}</p>
      </>}
    </div>
  </AppShell>;
}
