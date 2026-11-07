"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { TextReveal } from "@/components/ui/cascade-text";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatAppDateTime } from "@/lib/timezone";
import { ArrowRight, CheckCircle2, ClipboardCopy, HandCoins, Package, ReceiptText, ShoppingCart, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

interface DashboardData {
  summary: { totalSales: number; totalProfit: number; totalExpenses?: number; netProfit?: number; lowStockCount: number; outOfStockCount: number; pendingOrders: number; salesCount?: number };
  lowStockAlerts?: Array<{ id: string; name: string; currentStock: number; minimumStock: number; unit: string }>;
  topProducts?: Array<{ product?: { name: string; unit?: string }; totalQuantity?: number; totalRevenue?: number }>;
}

interface DebtSummary {
  summary: { openCount: number; totalOwed: number };
  debts?: Array<{ customerName?: string | null; customerPhone: string; amount: number; amountPaid: number; status: string; dueDate?: string | null }>;
}

interface ExpenseSummary {
  summary: { total: number; count: number };
  expenses?: Array<{ title: string; amount: number; category: string; spentAt: string }>;
}

interface ProfitCoverage {
  summary: { salesRevenue: number; missingCostSalesRevenue: number };
}

interface StockSnapshot {
  products: Array<{ id: string; name: string; currentStock: number; minimumStock: number; unit: string }>;
}

interface AssistantAnswer {
  message: string;
  source: string | null;
  href: string | null;
  from: string | null;
  to: string | null;
  checkedAt: string;
  timeZone: string;
}

type SourceKey = "today" | "history" | "debts" | "expenses" | "actions" | "costs" | "stock" | "purchases";
type SourceStatus = { status: "loading" | "ready" | "unavailable" | "restricted"; checkedAt?: string; businessDate?: string; timeZone?: string };
const SOURCE_KEYS: SourceKey[] = ["today", "history", "debts", "expenses", "actions", "costs", "stock", "purchases"];

interface Recommendation {
  id: string;
  rank: number;
  icon: typeof Package;
  tone: string;
  title: string;
  body: string;
  action: string;
  href: string;
  why: string;
  impact: string;
}

interface AssistantAction {
  id: string;
  actionKey: string;
  title: string;
  href: string;
  status: "OPEN" | "OPENED" | "COMPLETED" | "DISMISSED";
  openedAt?: string | null;
  completedAt?: string | null;
  dismissedAt?: string | null;
  shownAt: string;
  businessDate: string;
  baselineStock?: number | null;
  observedOutcome?: { type: string; beforeUnits: number; afterUnits: number; changeUnits: number; observedAt: string; attribution: "not-established" } | null;
  updatedAt: string;
}

export default function AssistantPage() {
  const lang = useLang();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [allTime, setAllTime] = useState<DashboardData | null>(null);
  const [debts, setDebts] = useState<DebtSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [costs, setCosts] = useState<ProfitCoverage | null>(null);
  const [stock, setStock] = useState<StockSnapshot | null>(null);
  const [sourceStatus, setSourceStatus] = useState<Partial<Record<SourceKey, SourceStatus>>>({});
  const sourceGeneration = useRef<Partial<Record<SourceKey, number>>>({});
  const shownOccurrences = useRef(new Set<string>());
  const lastDayRefresh = useRef("");
  const [actionError, setActionError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadSource(key: SourceKey) {
    const generation = (sourceGeneration.current[key] ?? 0) + 1;
    sourceGeneration.current[key] = generation;
    setSourceStatus((current) => ({ ...current, [key]: { status: "loading" } }));
    if (key === "today") setDashboard(null);
    if (key === "history") setAllTime(null);
    if (key === "debts") setDebts(null);
    if (key === "expenses") setExpenses(null);
    if (key === "actions") setActions([]);
    if (key === "costs") setCosts(null);
    if (key === "stock") setStock(null);
    try {
      const paths: Record<SourceKey, string> = { today: "/dashboard?period=today", history: "/dashboard?period=all", debts: "/debts", expenses: "/expenses", actions: "/assistant/actions?days=1&limit=100", costs: "/dashboard/profit?period=today", stock: "/assistant/stock", purchases: "/purchases/analytics?period=month" };
      const data = await api.get<unknown>(paths[key], lang);
      if (sourceGeneration.current[key] !== generation) return;
      if (key === "today") setDashboard(data as DashboardData);
      if (key === "history") setAllTime(data as DashboardData);
      if (key === "debts") setDebts(data as DebtSummary);
      if (key === "expenses") setExpenses(data as ExpenseSummary);
      if (key === "actions") setActions((data as { actions: AssistantAction[] }).actions);
      if (key === "costs") setCosts(data as ProfitCoverage);
      if (key === "stock") setStock(data as StockSnapshot);
      const dayContext = key === "actions" ? data as { businessDate?: string; timeZone?: string } : null;
      setSourceStatus((current) => ({ ...current, [key]: { status: "ready", checkedAt: new Date().toISOString(), ...(dayContext ? { businessDate: dayContext.businessDate, timeZone: dayContext.timeZone } : {}) } }));
    } catch (error) {
      if (sourceGeneration.current[key] !== generation) return;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      setSourceStatus((current) => ({ ...current, [key]: { status: /permission|forbidden|ruhusa/.test(message) ? "restricted" : "unavailable", checkedAt: new Date().toISOString() } }));
    }
  }

  useEffect(() => {
    SOURCE_KEYS.forEach((key) => { void loadSource(key); });
  }, [lang]);

  useEffect(() => {
    const expectedDate = sourceStatus.actions?.businessDate;
    const timeZone = sourceStatus.actions?.timeZone;
    if (!expectedDate || !timeZone) return;
    const interval = window.setInterval(() => {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
      const currentDate = `${values.year}-${values.month}-${values.day}`;
      if (currentDate !== expectedDate && lastDayRefresh.current !== currentDate) {
        lastDayRefresh.current = currentDate;
        SOURCE_KEYS.forEach((key) => { void loadSource(key); });
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [sourceStatus.actions?.businessDate, sourceStatus.actions?.timeZone, lang]);

  const recommendations = useMemo(() => sourceStatus.actions?.status === "ready" ? buildRecommendations({ dashboard, allTime, debts, expenses, costs, stockAlerts: stock?.products ?? null, lang }) : [], [sourceStatus.actions?.status, dashboard, allTime, debts, expenses, costs, stock, lang]);
  const ownerSummary = buildOwnerSummary(recommendations, lang);
  const urgentCount = recommendations.filter((item) => item.rank >= 80).length;
  const actionCount = recommendations.length;

  async function copyOwnerSummary() {
    const message = lang === "sw"
      ? `Uzuri Living leo: ${ownerSummary}`
      : `Uzuri Living today: ${ownerSummary}`;
    await navigator.clipboard?.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function askQuestion(event: React.FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value) return;
    setAnswer(null);
    setAskError("");
    setAsking(true);
    try {
      const result = await api.post<{ answer: AssistantAnswer }>("/assistant/ask", { question: value, language: lang }, lang);
      setAnswer(result.answer);
    } catch (error) {
      setAskError(error instanceof Error ? error.message : (lang === "sw" ? "Swali halikujibiwa." : "The question could not be answered."));
    } finally {
      setAsking(false);
    }
  }

  function actionStatus(item: Recommendation) {
    return actions.find((action) => action.actionKey === item.id);
  }

  const trackRecommendation = useCallback(async (item: Recommendation, eventType: "SHOWN" | "OPENED" | "COMPLETED" | "DISMISSED") => {
    setActionError("");
    try {
    const data = await api.post<{ action: AssistantAction }>("/assistant/actions", {
      actionKey: item.id,
      title: item.title,
      href: item.href,
      eventType,
    }, lang);
    setActions((prev) => {
      const next = prev.filter((action) => action.actionKey !== item.id);
      return [data.action, ...next];
    });
    } catch (error) {
      if (eventType === "SHOWN") shownOccurrences.current.delete(item.id);
      setActionError(error instanceof Error ? error.message : (lang === "sw" ? "Imeshindikana kuhifadhi hatua." : "Could not save the action."));
    }
  }, [lang]);

  useEffect(() => {
    if (sourceStatus.actions?.status !== "ready") return;
    for (const item of recommendations) {
      const occurrenceKey = `${sourceStatus.actions.businessDate ?? "unknown"}:${item.id}`;
      if (shownOccurrences.current.has(occurrenceKey)) continue;
      shownOccurrences.current.add(occurrenceKey);
      void trackRecommendation(item, "SHOWN");
    }
  }, [recommendations, sourceStatus.actions?.businessDate, sourceStatus.actions?.status, trackRecommendation]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-brand-600 p-3 text-white shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-950">
                  <TextReveal text="Uzuri Living AI Assistant" fontSize="inherit" hoverColor="#15803d" />
                </h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                  {lang === "sw"
                    ? "Kila siku inachambua mauzo, bidhaa, madeni na matumizi kisha inapanga hatua za kufanya kwanza."
                    : "Every day it reads sales, inventory, debts, and expenses, then ranks what to do first."}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 md:min-w-80">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">{lang === "sw" ? "Haraka" : "Urgent"}</p>
                <p className="text-xl font-black text-red-700">{urgentCount}</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <p className="text-xs text-gray-500">{lang === "sw" ? "Hatua" : "Actions"}</p>
                <p className="text-xl font-black text-brand-700">{actionCount}</p>
              </div>
              <button
                type="button"
                onClick={copyOwnerSummary}
                className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-3 py-3 text-xs font-bold text-white sm:col-span-1"
              >
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}
                {copied ? (lang === "sw" ? "Imecopy" : "Copied") : "WhatsApp"}
              </button>
              <Link href="/assistant/history" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-3 text-xs font-bold text-brand-700 hover:bg-brand-50 sm:col-span-3">
                {lang === "sw" ? "Historia ya hatua za AI" : "AI action history"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <section className="rounded-xl border border-brand-100 bg-white p-4">
          <h2 className="font-bold text-gray-950">{lang === "sw" ? "Uliza Uzuri Living" : "Ask Uzuri Living"}</h2>
          <p className="mt-1 text-sm text-gray-600">{lang === "sw" ? "Uliza kuhusu mauzo au matumizi ya leo au mwezi huu, stock ya sasa, au madeni yaliyopo. Jibu hutumia rekodi zilizoruhusiwa tu." : "Ask about sales or expenses today or this month, current stock, or outstanding debts. Answers use only records you are allowed to see."}</p>
          <form onSubmit={askQuestion} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input aria-label={lang === "sw" ? "Swali kwa msaidizi" : "Question for assistant"} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={250} placeholder={lang === "sw" ? "Mauzo ya mwezi huu ni kiasi gani?" : "What were my sales this month?"} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={asking || !question.trim()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{asking ? (lang === "sw" ? "Inatafuta…" : "Checking…") : (lang === "sw" ? "Uliza" : "Ask")}</button>
          </form>
          {askError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{askError}</p>}
          {answer && <div aria-live="polite" className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-gray-800"><p>{answer.message}</p>{answer.source && <p className="mt-2 text-xs text-gray-600">{lang === "sw" ? "Chanzo" : "Source"}: {answer.source} · {answer.from ? `${formatAppDateTime(answer.from)} – ` : ""}{answer.to ? formatAppDateTime(answer.to) : formatAppDateTime(answer.checkedAt)} · {answer.timeZone}</p>}{answer.href && <Link href={answer.href} className="mt-2 inline-block text-xs font-bold text-brand-700">{lang === "sw" ? "Fungua rekodi husika" : "Open relevant records"} →</Link>}</div>}
          <p className="mt-2 text-xs text-gray-500">{lang === "sw" ? "Msaidizi huyu hutumia kanuni na haitumii huduma ya AI ya nje; haibadilishi rekodi zako." : "This rules-based assistant does not use an external AI service or change your records."}</p>
        </section>

        <section aria-label={lang === "sw" ? "Hali ya vyanzo vya data" : "Data source status"} className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">{lang === "sw" ? "Hali ya vyanzo vya data" : "Data source status"}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCE_KEYS.map((key) => {
              const labels: Record<SourceKey, string> = { today: lang === "sw" ? "Mauzo ya leo" : "Today’s sales", history: lang === "sw" ? "Historia ya mauzo" : "Sales history", debts: lang === "sw" ? "Madeni" : "Debts", expenses: lang === "sw" ? "Matumizi" : "Expenses", actions: lang === "sw" ? "Historia ya hatua" : "Action history", costs: lang === "sw" ? "Gharama za mauzo" : "Sales cost coverage", stock: lang === "sw" ? "Stock na order zinazoingia" : "Stock and incoming orders", purchases: lang === "sw" ? "Manunuzi yaliyopokelewa" : "Received purchases" };
              const state = sourceStatus[key];
              return <div key={key} className="rounded-lg bg-gray-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-800">{labels[key]}</span>{state?.status !== "loading" && state?.status !== "ready" && <button type="button" onClick={() => void loadSource(key)} className="font-bold text-brand-700">{lang === "sw" ? "Jaribu tena" : "Retry"}</button>}</div><p className="mt-1 text-gray-600">{!state || state.status === "loading" ? (lang === "sw" ? "Inapakia…" : "Checking…") : state.status === "ready" ? (lang === "sw" ? "Imekaguliwa" : "Checked") : state.status === "restricted" ? (lang === "sw" ? "Ruhusa inahitajika" : "Permission required") : (lang === "sw" ? "Haipatikani; mapendekezo yanayotegemea chanzo hiki yamefichwa" : "Unavailable; dependent recommendations are hidden")}{state?.checkedAt ? ` · ${formatAppDateTime(state.checkedAt)}` : ""}</p></div>;
            })}
          </div>
        </section>
        {actionError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{actionError}</p>}

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-950">{lang === "sw" ? "Orodha ya leo" : "Today's command list"}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {lang === "sw" ? "Uzuri Living inapanga hatua muhimu kwanza." : "Uzuri Living ranks the most useful next action first."}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-red-50 px-3 py-2 text-red-800">
                  <p className="font-bold">{recommendations.filter((item) => item.rank >= 80).length}</p>
                  <p>{lang === "sw" ? "Haraka" : "Urgent"}</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                  <p className="font-bold">{recommendations.filter((item) => item.rank >= 60 && item.rank < 80).length}</p>
                  <p>{lang === "sw" ? "Leo" : "Today"}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2 text-green-800">
                  <p className="font-bold">{recommendations.length}</p>
                  <p>{lang === "sw" ? "Hatua" : "Actions"}</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600 sm:max-w-xs">
              <span className="font-semibold text-gray-800">WhatsApp:</span> {ownerSummary}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {recommendations.length === 0 ? (
              <p className="text-sm text-gray-500">{Object.values(sourceStatus).some((source) => source?.status !== "ready") ? (lang === "sw" ? "Baadhi ya vyanzo bado vinakaguliwa au havipatikani. Kagua hali hapo juu." : "Some sources are still loading or unavailable. Check their status above.") : (lang === "sw" ? "Hakuna mapendekezo kwa rekodi zilizopo sasa." : "No recommendations for the available records right now.")}</p>
            ) : recommendations.map((item, index) => {
              const status = actionStatus(item);
              return (
              <div key={item.id} className={`rounded-xl border bg-white p-4 shadow-sm ${status?.status === "COMPLETED" ? "border-green-200" : status?.status === "DISMISSED" ? "border-gray-200 opacity-75" : "border-gray-200"}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                        {lang === "sw" ? `Kipaumbele ${index + 1}` : `Priority ${index + 1}`}
                      </p>
                      {status && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          status.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                          status.status === "OPENED" ? "bg-blue-100 text-blue-700" :
                          status.status === "DISMISSED" ? "bg-gray-100 text-gray-500" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {status.status === "COMPLETED" ? (lang === "sw" ? "Imefanyika" : "Done") :
                            status.status === "OPENED" ? (lang === "sw" ? "Imefunguliwa" : "Opened") :
                              status.status === "DISMISSED" ? (lang === "sw" ? "Imeachwa" : "Dismissed") :
                                (lang === "sw" ? "Wazi" : "Open")}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 font-semibold text-gray-950">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">{item.body}</p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      <span className="font-semibold text-gray-700">{lang === "sw" ? "Kwa nini:" : "Why:"}</span> {item.why}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      <span className="font-semibold text-gray-700">{lang === "sw" ? "Matokeo:" : "Expected impact:"}</span> {item.impact}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                        {lang === "sw" ? "Fanya sasa" : "Do this now"}
                      </span>
                      <Link
                        href={item.href}
                        onClick={() => {
                          trackRecommendation(item, "OPENED").catch(console.error);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        {item.action}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => trackRecommendation(item, "COMPLETED").catch(console.error)}
                        className="rounded-lg bg-green-100 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-200"
                      >
                        {lang === "sw" ? "Nimefanya" : "Mark done"}
                      </button>
                      <button
                        type="button"
                        onClick={() => trackRecommendation(item, "DISMISSED").catch(console.error)}
                        className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"
                      >
                        {lang === "sw" ? "Acha" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            [lang === "sw" ? "Tambua hatari" : "Spot risk", lang === "sw" ? "Bidhaa kuisha, madeni kuchelewa, na matumizi kupanda." : "Low stock, slow collections, and rising expenses."],
            [lang === "sw" ? "Panga hatua" : "Plan action", lang === "sw" ? "Pendekeza cha kuagiza, nani wa kumpigia, na gharama zipi kupunguza." : "Suggest what to reorder, who to follow up with, and which costs to review."],
            [lang === "sw" ? "Ongea kwa lugha mbili" : "Work bilingually", lang === "sw" ? "Kiingereza na Kiswahili kwenye kurasa zote muhimu." : "English and Swahili across the important product surfaces."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}

function buildRecommendations({
  dashboard,
  allTime,
  debts,
  expenses,
  costs,
  stockAlerts,
  lang,
}: {
  dashboard: DashboardData | null;
  allTime: DashboardData | null;
  debts: DebtSummary | null;
  expenses: ExpenseSummary | null;
  costs: ProfitCoverage | null;
  stockAlerts: StockSnapshot["products"] | null;
  lang: "sw" | "en";
}): Recommendation[] {
  const items: Recommendation[] = [];
  const lowStock = stockAlerts || [];
  const mostUrgentStock = lowStock[0];
  const todaySalesCount = dashboard?.summary.salesCount || 0;
  const hasBusinessHistory = Boolean((allTime?.summary.salesCount || 0) > 0 || (allTime?.summary.totalSales || 0) > 0);

  const costCoverageComplete = costs?.summary && costs.summary.missingCostSalesRevenue === 0 && costs.summary.salesRevenue === dashboard?.summary.totalSales;
  if (costCoverageComplete && (dashboard?.summary.totalSales || 0) > 0 && (dashboard?.summary.netProfit || 0) < 0) {
    items.push({
      id: "net-profit",
      rank: 95,
      icon: ReceiptText,
      tone: "bg-red-50 text-red-700",
      title: lang === "sw" ? "Matumizi yamezidi faida iliyorekodiwa leo" : "Expenses exceed today's recorded profit estimate",
      body: lang === "sw"
        ? `Makadirio kwa gharama zilizorekodiwa ni ${formatTZS(dashboard?.summary.netProfit || 0)} baada ya matumizi ya ${formatTZS(dashboard?.summary.totalExpenses || 0)}. Hakiki gharama za bidhaa.`
        : `The estimate using recorded costs is ${formatTZS(dashboard?.summary.netProfit || 0)} after ${formatTZS(dashboard?.summary.totalExpenses || 0)} in expenses. Check that product costs are accurate.`,
      action: lang === "sw" ? "Kagua matumizi" : "Review expenses",
      href: "/expenses?focus=profit",
      why: lang === "sw"
        ? "Duka linaweza kuuza lakini bado lisipate faida kama gharama zimepanda."
        : "A shop can sell well and still lose money when costs rise.",
      impact: lang === "sw"
        ? "Tambua gharama zinazokula faida na punguza mapema."
        : "Find costs eating profit and reduce them early.",
    });
  }

  if (dashboard && allTime && hasBusinessHistory && todaySalesCount === 0) {
    items.push({
      id: "quiet-sales",
      rank: 85,
      icon: TrendingDown,
      tone: "bg-red-50 text-red-700",
      title: lang === "sw" ? "Hakuna sale iliyorekodiwa leo" : "No sale recorded today yet",
      body: lang === "sw"
        ? "Angalia kama mauzo hayajaingizwa au tumia bidhaa inayouza sana kuvutia wateja."
        : "Check whether sales were missed or use a proven product to pull customers in.",
      action: lang === "sw" ? "Rekodi sale ya kwanza" : "Record first sale",
      href: "/sales?intent=first-sale",
      why: lang === "sw"
        ? "Duka likikaa bila sale, ni vigumu kujua kama tatizo ni wateja, stock, au kurekodi."
        : "A quiet sales day makes it hard to know whether the issue is demand, stock, or missing records.",
      impact: lang === "sw"
        ? "Kuanza siku kwa data sahihi ili mapendekezo yawe makali zaidi."
        : "Start the day with clean data so recommendations become sharper.",
    });
  }

  if (mostUrgentStock) {
    items.push({
      id: `stock-${mostUrgentStock.id}`,
      rank: 100,
      icon: Package,
      tone: "bg-red-50 text-red-700",
      title: lang === "sw"
        ? `Kagua stock ya ${mostUrgentStock.name}`
        : `Review stock for ${mostUrgentStock.name}`,
      body: lang === "sw"
        ? `Imebaki ${mostUrgentStock.currentStock} ${mostUrgentStock.unit}; kiwango cha chini ni ${mostUrgentStock.minimumStock}. Order zilizopo zimezingatiwa. Huu si utabiri wa mahitaji.`
        : `${mostUrgentStock.currentStock} ${mostUrgentStock.unit} left; minimum is ${mostUrgStockMinimum(mostUrgentStock)}. Open supplier orders are considered; this is not a demand forecast.`,
      action: lang === "sw" ? "Fungua inventory na agiza tena" : "Open inventory and reorder",
      href: `/inventory?search=${encodeURIComponent(mostUrgentStock.name)}&action=restock`,
      why: lang === "sw"
        ? "Stock ikiisha, mauzo husimama na mteja huenda kwa duka lingine."
        : "When stock runs out, sales stop and customers move to another shop.",
      impact: lang === "sw"
        ? "Kulinda mauzo ya bidhaa inayohitajika kabla wiki haijaisha."
        : "Protect sales from a needed item before the week ends.",
    });
  }

  if (debts?.summary.totalOwed) {
    const openDebt = debts.debts?.find((debt) => debt.status === "OPEN" || debt.status === "PARTIAL");
    const customer = openDebt?.customerName || openDebt?.customerPhone;
    const debtBalance = openDebt ? Math.max(0, openDebt.amount - openDebt.amountPaid) : debts.summary.totalOwed;
    const debtParams = new URLSearchParams();
    if (openDebt?.customerName) debtParams.set("customer", openDebt.customerName);
    if (openDebt?.customerPhone) debtParams.set("phone", openDebt.customerPhone);
    if (debtBalance) debtParams.set("amount", String(debtBalance));
    items.push({
      id: "debt",
      rank: 90,
      icon: HandCoins,
      tone: "bg-amber-50 text-amber-700",
      title: lang === "sw"
        ? `Fuatilia madeni ya ${formatTZS(debts.summary.totalOwed)}`
        : `Follow up on ${formatTZS(debts.summary.totalOwed)} in unpaid debt`,
      body: lang === "sw"
        ? customer ? `Anza na ${customer}. Kuna madeni ${debts.summary.openCount} ambayo bado hayajafungwa.` : `Kuna madeni ${debts.summary.openCount} ambayo bado hayajafungwa.`
        : customer ? `Start with ${customer}. ${debts.summary.openCount} debt records are still open.` : `${debts.summary.openCount} debt records are still open.`,
      action: lang === "sw" ? "Fungua madeni na rekodi malipo" : "Open debts and record payment",
      href: `/debts${debtParams.toString() ? `?${debtParams.toString()}` : ""}`,
      why: lang === "sw"
        ? "Madeni yakikaa muda mrefu hupunguza cash ya kununua stock mpya."
        : "Old debts reduce the cash available to buy new stock.",
      impact: lang === "sw"
        ? "Kuongeza cash ya kununua stock au kulipa gharama za duka."
        : "Free up cash for stock purchases or shop expenses.",
    });
  }

  const expenseTrend = getExpenseTrend(expenses?.expenses || []);
  if (expenseTrend.current > 0) {
    const rose = expenseTrend.currentCount >= 3 && expenseTrend.previousCount >= 3 && expenseTrend.previous > 0 && expenseTrend.current >= expenseTrend.previous * 1.25;
    const percent = expenseTrend.previous > 0 ? Math.round(((expenseTrend.current - expenseTrend.previous) / expenseTrend.previous) * 100) : null;
    items.push({
      id: "expenses",
      rank: rose ? 80 : 50,
      icon: ReceiptText,
      tone: rose ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700",
      title: rose && percent
        ? lang === "sw" ? `Matumizi yamepanda ${percent}% siku 7 zilizopita` : `Expenses rose ${percent}% over the last 7 days`
        : lang === "sw" ? `Kagua matumizi ya ${formatTZS(expenseTrend.current)}` : `Review ${formatTZS(expenseTrend.current)} in expenses`,
      body: lang === "sw"
        ? `Matumizi ya siku 7 zilizopita ni ${formatTZS(expenseTrend.current)}. Linganisha na faida ili ujue gharama zinazokula margin.`
        : `Last 7 days expenses are ${formatTZS(expenseTrend.current)}. Compare them against profit to find costs eating margin.`,
      action: lang === "sw" ? "Fungua matumizi" : "Open expenses",
      href: "/expenses?focus=weekly-review",
      why: lang === "sw"
        ? "Gharama ndogo ndogo zikikua bila kufuatiliwa zinaweza kula faida ya duka."
        : "Small costs can quietly eat shop profit when they are not tracked.",
      impact: lang === "sw"
        ? "Kupunguza gharama zisizo muhimu na kulinda margin."
        : "Reduce unnecessary costs and protect margin.",
    });
  }

  const topProduct = allTime?.topProducts?.[0];
  if (topProduct?.product?.name && topProduct.totalRevenue) {
    items.push({
      id: "top-product",
      rank: 60,
      icon: TrendingUp,
      tone: "bg-green-50 text-green-700",
      title: lang === "sw"
        ? `Promote ${topProduct.product.name}`
        : `Promote ${topProduct.product.name}`,
      body: lang === "sw"
        ? `Bidhaa hii imeleta ${formatTZS(topProduct.totalRevenue)} kwenye mauzo. Iweke mbele kwenye duka na catalog.`
        : `This product has generated ${formatTZS(topProduct.totalRevenue)} in sales. Feature it in the shop and catalog.`,
      action: lang === "sw" ? "Tumia kama bidhaa ya kuvutia wateja" : "Use it as a customer magnet",
      href: `/inventory?search=${encodeURIComponent(topProduct.product.name)}&action=promote`,
      why: lang === "sw"
        ? "Bidhaa inayouza vizuri inaweza kuvuta wateja wanunue bidhaa nyingine pia."
        : "A strong seller can bring customers in and lift other basket items too.",
      impact: lang === "sw"
        ? "Kuongeza basket size kwa kuweka bidhaa inayopendwa mbele."
        : "Increase basket size by putting a proven seller in front.",
    });
  }

  if (dashboard?.summary.pendingOrders) {
    items.push({
      id: "orders",
      rank: 70,
      icon: ShoppingCart,
      tone: "bg-purple-50 text-purple-700",
      title: lang === "sw"
        ? `Kagua order ${dashboard.summary.pendingOrders} za wasambazaji`
        : `Review ${dashboard.summary.pendingOrders} supplier orders`,
      body: lang === "sw"
        ? "Kagua order zinazongoja, zilizothibitishwa na zinazosafirishwa."
        : "Review pending, confirmed and in-transit supplier orders.",
      action: lang === "sw" ? "Fungua order za wasambazaji" : "Open supplier orders",
      href: "/orders",
      why: lang === "sw"
        ? "Kufuatilia usafirishaji kunasaidia kupanga stock."
        : "Tracking supplier deliveries helps you plan stock.",
      impact: lang === "sw"
        ? "Tambua order zinazohitaji kufuatiliwa."
        : "Identify orders that need follow-up.",
    });
  }

  return items.sort((a, b) => b.rank - a.rank).slice(0, 5);
}

function buildOwnerSummary(recommendations: Recommendation[], lang: "sw" | "en") {
  if (recommendations.length === 0) {
    return lang === "sw"
      ? "Ongeza bidhaa na mauzo machache ili Uzuri Living itoe hatua za leo."
      : "Add a few products and sales so Uzuri Living can produce today's actions.";
  }

  return recommendations
    .slice(0, 3)
    .map((item, index) => `${index + 1}. ${item.title}`)
    .join(" ");
}

function mostUrgStockMinimum(product: { minimumStock: number }) {
  return product.minimumStock;
}

function getExpenseTrend(expenses: Array<{ amount: number; spentAt: string }>) {
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return expenses.reduce(
    (totals, expense) => {
      const age = now - new Date(expense.spentAt).getTime();
      if (age >= 0 && age <= sevenDays) { totals.current += expense.amount; totals.currentCount += 1; }
      if (age > sevenDays && age <= sevenDays * 2) { totals.previous += expense.amount; totals.previousCount += 1; }
      return totals;
    },
    { current: 0, previous: 0, currentCount: 0, previousCount: 0 }
  );
}
