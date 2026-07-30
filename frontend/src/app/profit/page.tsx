"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, TrendingUp } from "lucide-react";

type Period = "today" | "month" | "quarter" | "year" | "custom";
type Analytics = {
  group: "hour" | "day" | "month";
  summary: { salesRevenue: number; costOfGoodsSold: number; grossProfit: number; grossProfitMargin: number; salesCount: number; unitsSold: number; missingCostSalesRevenue: number };
  chart: Array<{ label: string; revenue: number; costOfGoodsSold: number; grossProfit: number }>;
};

const dateValue = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export default function ProfitPage() {
  const lang = useLang();
  const [period, setPeriod] = useState<Period>("today");
  const [from, setFrom] = useState(() => dateValue(-29));
  const [to, setTo] = useState(() => dateValue());
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const labels = useMemo(() => ({
    title: lang === "sw" ? "Uchambuzi wa Faida" : "Profit Analytics",
    subtitle: lang === "sw" ? "Faida hutumia bei ya kuuza na gharama iliyohifadhiwa wakati wa mauzo." : "Profit uses the selling price and cost saved when each sale was recorded.",
    today: lang === "sw" ? "Leo" : "Today", month: lang === "sw" ? "Mwezi huu" : "This month", quarter: lang === "sw" ? "Robo hii" : "This quarter", year: lang === "sw" ? "Mwaka huu" : "This year", custom: lang === "sw" ? "Chagua tarehe" : "Custom range",
  }), [lang]);

  useEffect(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom") { params.set("from", from); params.set("to", to); }
    setLoading(true);
    setError("");
    api.get<Analytics>(`/dashboard/profit?${params}`, lang)
      .then(setData)
      .catch((value: unknown) => setError(value instanceof Error ? value.message : (lang === "sw" ? "Imeshindikana kupakia uchambuzi." : "Could not load analytics.")))
      .finally(() => setLoading(false));
  }, [period, from, to, lang]);

  const cards = data ? [
    [lang === "sw" ? "Mauzo" : "Sales revenue", formatTZS(data.summary.salesRevenue), "text-sky-700 bg-sky-50 border-sky-100"],
    [lang === "sw" ? "Gharama ya Bidhaa" : "Cost of goods sold", formatTZS(data.summary.costOfGoodsSold), "text-amber-700 bg-amber-50 border-amber-100"],
    [lang === "sw" ? "Faida Ghafi" : "Gross profit", formatTZS(data.summary.grossProfit), "text-emerald-700 bg-emerald-50 border-emerald-100"],
    [lang === "sw" ? "Asilimia ya Faida" : "Gross profit margin", `${data.summary.grossProfitMargin}%`, "text-violet-700 bg-violet-50 border-violet-100"],
    [lang === "sw" ? "Miamala" : "Completed sales", String(data.summary.salesCount), "text-gray-700 bg-gray-50 border-gray-200"],
    [lang === "sw" ? "Vipande vilivyouzwa" : "Units sold", String(data.summary.unitsSold), "text-gray-700 bg-gray-50 border-gray-200"],
  ] : [];

  return <AppShell><div className="mx-auto max-w-6xl pb-20 lg:pb-6">
    <section className="mb-6 border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex items-center gap-2 text-brand-700"><TrendingUp className="h-5 w-5" /><span className="text-sm font-bold">Uzuri Living</span></div><h1 className="mt-2 text-2xl font-bold text-gray-950">{labels.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{labels.subtitle}</p></div>
        <div className="flex items-center gap-2 text-sm font-medium text-gray-500"><CalendarDays className="h-4 w-4" />Africa/Dar_es_Salaam</div>
      </div>
      <div className="mt-5 flex max-w-full gap-1 overflow-x-auto bg-gray-100 p-1">
        {(["today", "month", "quarter", "year", "custom"] as Period[]).map((key) => <button key={key} onClick={() => setPeriod(key)} className={`whitespace-nowrap px-3 py-2 text-sm font-semibold ${period === key ? "bg-white text-brand-800 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{labels[key]}</button>)}
      </div>
      {period === "custom" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">{lang === "sw" ? "Kuanzia" : "From"}<input aria-label={lang === "sw" ? "Kuanzia" : "From"} type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full border border-gray-300 px-3 py-2" /></label><label className="text-sm font-medium text-gray-700">{lang === "sw" ? "Mpaka" : "To"}<input aria-label={lang === "sw" ? "Mpaka" : "To"} type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full border border-gray-300 px-3 py-2" /></label></div>}
    </section>
    {loading && !data ? <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin border-2 border-brand-200 border-t-brand-700" /></div> : error ? <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{cards.map(([label, value, tone]) => <div key={label} className={`border p-4 ${tone}`}><p className="break-words text-lg font-bold">{value}</p><p className="mt-1 text-xs font-medium">{label}</p></div>)}</div>
      <section className="mt-6 border border-gray-200 bg-white p-4 sm:p-5"><h2 className="text-sm font-semibold text-gray-900">{lang === "sw" ? "Faida kwa muda" : "Profit over time"}</h2>{data?.chart.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={data.chart} margin={{ top: 20, left: 0, right: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => formatTZS(Number(value || 0))} /><Bar dataKey="grossProfit" name={lang === "sw" ? "Faida" : "Profit"} fill="#16a34a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="py-14 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna mauzo yaliyokamilika kwenye kipindi hiki." : "No completed sales were recorded during this period."}</p>}</section>
      <p className="mt-4 text-xs leading-5 text-gray-500">{lang === "sw" ? "Faida ghafi = Mauzo âˆ’ Gharama ya Bidhaa. Kila sale hutumia buying price iliyohifadhiwa wakati wa sale." : "Gross profit = Sales revenue âˆ’ Cost of goods sold. Each sale uses the buying price saved at the time of that sale."}</p>
    </>}
  </div></AppShell>;
}
