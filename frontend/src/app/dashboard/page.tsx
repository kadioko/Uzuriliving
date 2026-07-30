"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Clock,
  BarChart2,
  ArrowRight,
  Package,
  Sparkles,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface DashboardData {
  period: string;
  features?: { staff: boolean; assistant: boolean; exports: boolean };
  summary: {
    totalSales: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    expenseCount: number;
    salesCount: number;
    pendingOrders: number;
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  allTimeSummary: {
    totalSales: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    expenseCount: number;
    salesCount: number;
    firstSaleAt: string | null;
  };
  lowStockAlerts: Array<{ id: string; name: string; currentStock: number; minimumStock: number; unit: string }>;
  recentSales: Array<{ id: string; totalAmount: number; profit: number; paymentMethod: string; createdAt: string }>;
  dailyChart: Array<{ date: string; sales: number; profit: number }>;
  paymentBreakdown: Array<{ paymentMethod: string; totalAmount: number; salesCount: number }>;
  historyTimeline: Array<{ period: string; sales: number; profit: number; salesCount: number }>;
  topProducts: Array<{ product: { name: string; unit: string }; totalQuantity: number; totalRevenue: number }>;
}

const PERIODS = [
  { key: "today", labelKey: "common.today" },
  { key: "week", labelKey: "common.week" },
  { key: "month", labelKey: "common.month" },
  { key: "all", labelKey: "common.all" },
] as const;

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Taslimu",
  MPESA: "M-Pesa",
  TIGOPESA: "Tigo Pesa",
  AIRTEL_MONEY: "Airtel",
  HALOPESA: "HaloPesa",
  BANK: "Benki",
  CREDIT: "Mkopo",
};

export default function DashboardPage() {
  const lang = useLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<DashboardData>(`/dashboard?period=${period}`)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period]);

  if (loading && !data) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      </AppShell>
    );
  }

  const s = data?.summary;
  const allTime = data?.allTimeSummary;
  const currentPeriodLabel = t(PERIODS.find((p) => p.key === period)?.labelKey || "common.today", lang);

  function paymentLabel(paymentMethod: string) {
    if (paymentMethod === "BANK") return t("sales.bank", lang);
    if (paymentMethod === "CASH") return t("sales.cash", lang);
    if (paymentMethod === "MPESA") return t("sales.mpesa", lang);
    if (paymentMethod === "TIGOPESA") return t("sales.tigopesa", lang);
    if (paymentMethod === "AIRTEL_MONEY") return t("sales.airtel", lang);
    if (paymentMethod === "HALOPESA") return t("sales.halopesa", lang);
    if (paymentMethod === "CREDIT") return t("sales.credit", lang);
    return PAYMENT_LABELS[paymentMethod] || paymentMethod;
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl pb-20 lg:pb-6">
        <section className="mb-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
            <div className="p-5 sm:p-6 lg:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-700">Uzuri Living</p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
                    {t("dashboard.title", lang)}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                    {lang === "sw"
                      ? `Muhtasari wa ${currentPeriodLabel.toLowerCase()} na hatua muhimu za duka lako.`
                      : `${currentPeriodLabel} performance and the next actions your shop needs.`}
                  </p>
                </div>
                <Link
                  href="/sales"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand-800"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {t("sales.startSale", lang)}
                </Link>
                <Link
                  href="/profit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <BarChart2 className="h-4 w-4" />
                  {lang === "sw" ? "Uchambuzi wa faida" : "Profit analytics"}
                </Link>
              </div>

              <div className="mt-6 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`min-h-0 flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      period === p.key
                        ? "bg-white text-brand-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    {t(p.labelKey, lang)}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100 bg-gray-950 p-5 text-white lg:border-l lg:border-t-0 sm:p-6 lg:p-7">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand-300" />
                <p className="text-sm font-bold">{lang === "sw" ? "Kinachohitaji hatua" : "Needs attention"}</p>
              </div>
              <div className="mt-5 space-y-3">
                <QuickAction
                  href="/inventory"
                  icon={<Package className="h-4 w-4" />}
                  label={lang === "sw" ? "Bidhaa chache stock" : "Low-stock items"}
                  value={String(s?.lowStockCount || 0)}
                />
                <QuickAction
                  href="/orders"
                  icon={<Clock className="h-4 w-4" />}
                  label={t("dashboard.pendingOrders", lang)}
                  value={String(s?.pendingOrders || 0)}
                />
                {data?.features?.assistant !== false ? (
                  <QuickAction
                    href="/assistant"
                    icon={<Sparkles className="h-4 w-4" />}
                    label={lang === "sw" ? "AI hatua za leo" : "AI next actions"}
                    value={lang === "sw" ? "Fungua" : "Open"}
                  />
                ) : (
                  <QuickAction
                    href="/billing"
                    icon={<Sparkles className="h-4 w-4" />}
                    label={lang === "sw" ? "Fungua AI kwa Pro" : "Unlock AI with Pro"}
                    value="Pro"
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <KpiCard
            label={t("dashboard.sales", lang)}
            value={formatTZS(s?.totalSales || 0)}
            icon={<ShoppingCart className="w-5 h-5 text-blue-600" />}
            color="blue"
          />
          <KpiCard
            label={period === "today" ? (lang === "sw" ? "Faida Leo" : "Profit Today") : (lang === "sw" ? "Faida kabla ya matumizi" : "Gross profit")}
            value={formatTZS(s?.totalProfit || 0)}
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
            color="green"
            sub={s && s.totalSales > 0 ? `${((s.totalProfit / s.totalSales) * 100).toFixed(0)}% ${t("dashboard.margin", lang)}` : undefined}
          />
          <KpiCard
            label={lang === "sw" ? "Faida halisi" : "Net profit"}
            value={formatTZS(s?.netProfit || 0)}
            icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
            color="green"
            sub={`${formatTZS(s?.totalExpenses || 0)} ${lang === "sw" ? "matumizi" : "expenses"}`}
          />
          <KpiCard
            label={t("dashboard.salesCount", lang)}
            value={String(s?.salesCount || 0)}
            icon={<BarChart2 className="w-5 h-5 text-purple-600" />}
            color="purple"
          />
          <KpiCard
            label={t("dashboard.pendingOrders", lang)}
            value={String(s?.pendingOrders || 0)}
            icon={<Clock className="w-5 h-5 text-orange-600" />}
            color="orange"
          />
        </div>

        <div className="mb-6 grid gap-3 lg:grid-cols-5">
          <KpiCard
            label={t("dashboard.allTime", lang)}
            value={formatTZS(allTime?.totalSales || 0)}
            icon={<ShoppingCart className="w-5 h-5 text-sky-600" />}
            color="blue"
          />
          <KpiCard
            label={lang === "sw" ? "Faida kabla ya matumizi" : "Gross profit"}
            value={formatTZS(allTime?.totalProfit || 0)}
            icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
            color="green"
          />
          <KpiCard
            label={lang === "sw" ? "Faida halisi" : "Net profit"}
            value={formatTZS(allTime?.netProfit || 0)}
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
            color="green"
            sub={`${formatTZS(allTime?.totalExpenses || 0)} ${lang === "sw" ? "matumizi" : "expenses"}`}
          />
          <KpiCard
            label={t("dashboard.salesCount", lang)}
            value={String(allTime?.salesCount || 0)}
            icon={<BarChart2 className="w-5 h-5 text-violet-600" />}
            color="purple"
          />
          <KpiCard
            label={t("dashboard.started", lang)}
            value={allTime?.firstSaleAt ? new Date(allTime.firstSaleAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { month: "short", year: "numeric" }) : "-"}
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            color="orange"
          />
        </div>

        {data && data.lowStockAlerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h2 className="font-semibold text-amber-800 text-sm">
                {t("dashboard.lowStock", lang)} ({data.lowStockAlerts.length})
              </h2>
            </div>
            <div className="space-y-2">
              {data.lowStockAlerts.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center justify-between">
                  <span className="text-sm text-amber-900 font-medium">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${p.currentStock === 0 ? "text-red-600" : "text-amber-700"}`}>
                      {p.currentStock === 0 ? t("inventory.outOfStockBadge", lang).toUpperCase() : `${p.currentStock} ${p.unit} ${t("dashboard.remaining", lang)}`}
                    </span>
                  </div>
                </div>
              ))}
              {data.lowStockAlerts.length > 5 && (
                <p className="text-amber-600 text-xs">+{data.lowStockAlerts.length - 5} {t("dashboard.more", lang)}...</p>
              )}
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">{t("dashboard.weeklyChart", lang)}</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.dailyChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { weekday: "short" });
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value, name) => [
                    formatTZS(typeof value === "number" ? value : 0),
                    name === "sales" ? t("dashboard.sales", lang) : t("dashboard.profit", lang),
                  ]}
                />
                <Bar dataKey="sales" fill="#16a34a" radius={[4, 4, 0, 0]} name="sales" />
                <Bar dataKey="profit" fill="#86efac" radius={[4, 4, 0, 0]} name="profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">{t("dashboard.topProducts", lang)}</h2>
            {data?.topProducts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{t("dashboard.noData", lang)}</p>
            ) : (
              <div className="space-y-3">
                {data?.topProducts.map((tp, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{tp.product?.name}</p>
                      <p className="text-xs text-gray-500">
                        {tp.totalQuantity} {tp.product?.unit} {t("dashboard.transactions", lang)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-700">
                      {formatTZS(tp.totalRevenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">{t("dashboard.paymentMix", lang)}</h2>
            {data?.paymentBreakdown.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{t("dashboard.noData", lang)}</p>
            ) : (
              <div className="space-y-3">
                {data?.paymentBreakdown.map((item) => (
                  <div key={item.paymentMethod} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{paymentLabel(item.paymentMethod)}</p>
                      <p className="text-xs text-gray-500">{item.salesCount} {t("dashboard.transactions", lang)}</p>
                    </div>
                    <p className="text-sm font-semibold text-brand-700">{formatTZS(item.totalAmount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">{t("dashboard.businessHistory", lang)}</h2>
            {data?.historyTimeline.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{t("dashboard.noData", lang)}</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {data?.historyTimeline.slice().reverse().map((item) => (
                  <div key={item.period} className="flex items-start justify-between border-b border-gray-100 pb-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.period}</p>
                      <p className="text-xs text-gray-500">{item.salesCount} {t("dashboard.transactions", lang)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatTZS(item.sales)}</p>
                      <p className="text-xs text-green-600">+{formatTZS(item.profit)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {data && data.recentSales.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6">
            <h2 className="font-semibold text-gray-800 mb-4 text-sm">{t("dashboard.recentSales", lang)}</h2>
            <div className="divide-y divide-gray-100">
              {data.recentSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{formatTZS(s.totalAmount)}</p>
                    <p className="text-xs text-gray-500">
                      {paymentLabel(s.paymentMethod)} â€¢{" "}
                      {new Date(s.createdAt).toLocaleTimeString(lang === "sw" ? "sw-TZ" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-600">+{formatTZS(s.profit)}</p>
                    <p className="text-xs text-gray-400">{t("dashboard.profit", lang).toLowerCase()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function KpiCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  const bgMap: Record<string, string> = {
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    purple: "bg-violet-50 text-violet-700 ring-violet-100",
    orange: "bg-amber-50 text-amber-700 ring-amber-100",
  };
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md">
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${bgMap[color]}`}>
        {icon}
      </div>
      <p className="break-words text-lg font-bold leading-tight text-gray-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-gray-500">{label}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 text-sm transition hover:bg-white/15">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-brand-200">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-gray-100">{label}</span>
      </span>
      <span className="flex items-center gap-1 font-bold text-white">
        {value}
        <ArrowRight className="h-3.5 w-3.5 text-gray-400 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
