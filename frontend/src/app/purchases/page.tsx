"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatAppDate, getAppDateInputValue } from "@/lib/timezone";
import { CalendarDays, Package, Search, ShoppingBag, Store } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Period = "month" | "all" | "custom";
type Supplier = { id: string; name: string };
type PurchaseData = {
  period: Period;
  timeZone: string;
  group: "day" | "month";
  summary: { totalPurchaseAmount: number; purchaseCount: number; unitsPurchased: number; averagePurchaseAmount: number };
  chart: Array<{ label: string; amount: number; orders: number; unitsPurchased: number }>;
  suppliers: Array<{ id: string; name: string; amount: number; orders: number; unitsPurchased: number }>;
  orders: Array<{ id: string; receivedAt: string; amount: number; unitsPurchased: number; productCount: number; supplier: Supplier | null }>;
};

const dateValue = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return getAppDateInputValue(date);
};
const numberValue = (value: number) => value.toLocaleString("en-TZ", { maximumFractionDigits: 2 });

export default function PurchasesPage() {
  const lang = useLang();
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState(() => dateValue(-29));
  const [to, setTo] = useState(() => dateValue());
  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [data, setData] = useState<PurchaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<{ suppliers: Supplier[] }>("/suppliers").then((result) => setSuppliers(result.suppliers ?? [])).catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", from);
      params.set("to", to);
    }
    if (supplierId) params.set("supplierId", supplierId);
    if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    setError("");
    api.get<PurchaseData>(`/purchases/analytics?${params}`, lang)
      .then(setData)
      .catch((value: unknown) => setError(value instanceof Error ? value.message : (lang === "sw" ? "Imeshindikana kupakia manunuzi." : "Could not load purchases.")))
      .finally(() => setLoading(false));
  }, [period, from, to, supplierId, search, lang]);

  const labels = useMemo(() => ({
    title: lang === "sw" ? "Manunuzi" : "Purchases",
    subtitle: lang === "sw" ? "Fuatilia kiasi kilichotumika kununua bidhaa kutoka kwa wasambazaji." : "Track how much your shop has spent buying stock from suppliers.",
    month: lang === "sw" ? "Mwezi huu" : "This month",
    all: lang === "sw" ? "Muda wote" : "All time",
    custom: lang === "sw" ? "Tarehe maalum" : "Custom dates",
  }), [lang]);

  const cards = data ? [
    { label: lang === "sw" ? "Jumla ya manunuzi" : "Total purchases", value: formatTZS(data.summary.totalPurchaseAmount), tone: "border-sky-100 bg-sky-50 text-sky-800" },
    { label: lang === "sw" ? "Maagizo yaliyopokelewa" : "Received orders", value: numberValue(data.summary.purchaseCount), tone: "border-indigo-100 bg-indigo-50 text-indigo-800" },
    { label: lang === "sw" ? "Bidhaa zilizonunuliwa" : "Units purchased", value: numberValue(data.summary.unitsPurchased), tone: "border-emerald-100 bg-emerald-50 text-emerald-800" },
    { label: lang === "sw" ? "Wastani kwa order" : "Average per order", value: formatTZS(data.summary.averagePurchaseAmount), tone: "border-violet-100 bg-violet-50 text-violet-800" },
  ] : [];

  return <AppShell>
    <div className="mx-auto max-w-7xl pb-20 lg:pb-6">
      <section className="mb-6 border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-brand-700"><ShoppingBag className="h-5 w-5" /><span className="text-sm font-bold">Uzuri Living</span></div><h1 className="mt-2 text-2xl font-bold text-gray-950">{labels.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{labels.subtitle}</p></div><div className="flex items-center gap-2 text-xs font-medium text-gray-500"><CalendarDays className="h-4 w-4" />{lang === "sw" ? "Huhesabiwa wakati order inapokelewa" : "Counted when an order is received"}</div></div>
        <div className="mt-5 flex gap-1 overflow-x-auto bg-gray-100 p-1">{(["month", "all", "custom"] as Period[]).map((key) => <button key={key} type="button" onClick={() => setPeriod(key)} className={`whitespace-nowrap px-4 py-2 text-sm font-semibold ${period === key ? "bg-white text-brand-800 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}>{labels[key]}</button>)}</div>
        {period === "custom" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-gray-700">{lang === "sw" ? "Kuanzia" : "From"}<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} className="mt-1 block w-full border border-gray-300 px-3 py-2" /></label><label className="text-sm font-medium text-gray-700">{lang === "sw" ? "Mpaka" : "To"}<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} className="mt-1 block w-full border border-gray-300 px-3 py-2" /></label></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_220px]"><label className="relative block"><span className="sr-only">{lang === "sw" ? "Tafuta manunuzi" : "Search purchases"}</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={lang === "sw" ? "Tafuta supplier, bidhaa au order..." : "Search supplier, product, or order..."} className="w-full border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" /></label><select aria-label={lang === "sw" ? "Chuja kwa supplier" : "Filter by supplier"} value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className="border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"><option value="">{lang === "sw" ? "Wasambazaji wote" : "All suppliers"}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
      </section>

      {loading && !data ? <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin border-2 border-brand-200 border-t-brand-700" /></div> : error ? <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : data ? <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards.map((card) => <div key={card.label} className={`border p-4 ${card.tone}`}><p className="break-words text-lg font-bold sm:text-xl">{card.value}</p><p className="mt-1 text-xs font-medium">{card.label}</p></div>)}</div>
        <section className="mt-6 border border-gray-200 bg-white p-4 shadow-sm sm:p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-semibold text-gray-900">{lang === "sw" ? "Manunuzi kwa muda" : "Purchases over time"}</h2><p className="mt-1 text-xs text-gray-500">{data.group === "month" ? (lang === "sw" ? "Kwa mwezi" : "Monthly") : (lang === "sw" ? "Kwa siku" : "Daily")}</p></div><Package className="h-5 w-5 text-brand-600" /></div>{data.chart.length ? <ResponsiveContainer width="100%" height={280}><LineChart data={data.chart} margin={{ top: 16, left: 4, right: 8, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} /><Tooltip formatter={(value) => formatTZS(Number(value ?? 0))} /><Line type="monotone" dataKey="amount" name={lang === "sw" ? "Manunuzi" : "Purchases"} stroke="#2ec7ad" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer> : <p className="py-14 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna manunuzi yaliyopokelewa kwenye kipindi hiki." : "No received purchases were recorded in this period."}</p>}</section>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.6fr]"><section className="border border-gray-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-gray-200 px-4 py-4"><div><h2 className="text-base font-semibold text-gray-900">{lang === "sw" ? "Kwa supplier" : "By supplier"}</h2><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Wapi fedha zilienda." : "Where the money went."}</p></div><Store className="h-5 w-5 text-brand-600" /></div>{data.suppliers.length ? <div className="divide-y divide-gray-100">{data.suppliers.map((supplier) => <div key={supplier.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-900">{supplier.name}</p><p className="mt-1 text-xs text-gray-500">{supplier.orders} {lang === "sw" ? "order" : "orders"} · {numberValue(supplier.unitsPurchased)} {lang === "sw" ? "vipande" : "units"}</p></div><p className="shrink-0 text-sm font-semibold text-gray-900">{formatTZS(supplier.amount)}</p></div>)}</div> : <p className="p-8 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna supplier kwenye kipindi hiki." : "No suppliers in this period."}</p>}</section>
          <section className="border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-200 px-4 py-4"><h2 className="text-base font-semibold text-gray-900">{lang === "sw" ? "Historia ya manunuzi" : "Purchase history"}</h2><p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Orders zilizofika na kuingia kwenye stock." : "Delivered supplier orders counted as actual purchases."}</p></div>{data.orders.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 font-semibold">Supplier</th><th className="px-4 py-3 font-semibold">{lang === "sw" ? "Tarehe" : "Date"}</th><th className="px-4 py-3 text-right font-semibold">{lang === "sw" ? "Vipande" : "Units"}</th><th className="px-4 py-3 text-right font-semibold">{lang === "sw" ? "Kiasi" : "Amount"}</th></tr></thead><tbody className="divide-y divide-gray-100">{data.orders.map((order) => <tr key={order.id}><td className="whitespace-nowrap px-4 py-3 font-medium text-gray-800">{order.supplier?.name ?? (lang === "sw" ? "Supplier hajulikani" : "Unknown supplier")}<span className="ml-2 text-xs text-gray-400">#{order.id.slice(-6).toUpperCase()}</span></td><td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatAppDate(order.receivedAt, lang === "sw" ? "sw-TZ" : "en-US")}</td><td className="px-4 py-3 text-right text-gray-600">{numberValue(order.unitsPurchased)}</td><td className="px-4 py-3 text-right font-semibold text-gray-900">{formatTZS(order.amount)}</td></tr>)}</tbody></table></div> : <p className="p-8 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna manunuzi yaliyopokelewa." : "No received purchases found."}</p>}</section></div>
        <p className="mt-4 text-xs leading-5 text-gray-500">{lang === "sw" ? "Manunuzi yanahesabiwa wakati supplier order inapowekwa Delivered na stock kuongezwa. Orders ambazo bado ziko njiani hazijaingia kwenye jumla." : "Purchases are counted when a supplier order is marked Delivered and stock is added. Orders still pending or on the way are not included in the total."}</p>
      </> : null}
    </div>
  </AppShell>;
}
