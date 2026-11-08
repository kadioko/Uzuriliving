"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { TextReveal } from "@/components/ui/cascade-text";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatAppDateTime } from "@/lib/timezone";
import { getPendingOfflineSalesCount } from "@/lib/offline-sales";
import { ArrowRight, CheckCircle2, ClipboardCopy, HandCoins, Package, ReceiptText, ShoppingCart, Sparkles, TrendingDown, TrendingUp, Undo2 } from "lucide-react";

interface DashboardData {
  summary: { totalSales: number; totalProfit: number; totalExpenses?: number; netProfit?: number; lowStockCount: number; outOfStockCount: number; pendingOrders: number; salesCount?: number };
  lowStockAlerts?: Array<{ id: string; name: string; currentStock: number; minimumStock: number; unit: string }>;
  topProducts?: Array<{ product?: { name: string; unit?: string }; totalQuantity?: number; totalRevenue?: number }>;
}

interface DebtSummary {
  summary: { openCount: number; totalOwed: number };
  debts?: Array<{ id?: string; customerName?: string | null; balance: number; status: string; dueDate?: string | null; daysOverdue?: number }>;
}

interface ExpenseSummary {
  daily: Array<{ businessDate: string; amount: number; count: number }>;
  businessDate: string;
}

interface ProfitCoverage {
  summary: { salesRevenue: number; headerSalesRevenue?: number; missingCostSalesRevenue: number };
}

interface ProductTrends {
  windowDays: number;
  from: string;
  to: string;
  comparisonFrom: string;
  comparisonTo: string;
  products: Array<{ id: string; name: string; unit: string; revenue30d: number; units30d: number; previousRevenue30d: number; previousUnits30d: number; revenueChangePercent: number | null }>;
}

interface SyncHealth {
  serverKnownPending: number;
  serverKnownFailed: number;
  devicesObserved: number;
  lastEventReceivedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  observedFrom?: string | null;
  eventsInspected: number;
  observationLimitReached: boolean;
  checkedAt: string;
}

interface StockSnapshot {
  count?: number;
  businessDate?: string;
  demandStatus?: "ready" | "restricted" | "unavailable";
  dailySales?: Array<{ productId: string; date: string; quantity: number }>;
  products: Array<{
    id: string;
    name: string;
    currentStock: number;
    minimumStock: number;
    unit: string;
    onOrderQuantity?: number;
    onOrderStatus?: "ORDERED" | "ON_THE_WAY" | null;
    supplierLeadTimeDays?: number | null;
    reorderSafetyDays?: number | null;
    reorderPackSize?: number;
    stockRevisionAt?: string | null;
    reorderEstimate?: {
      observedDays: number;
      coverageTo: string | null;
      activeDays: number;
      dailyRate: number;
      hasEnoughHistory: boolean;
      hasConfiguredReorderPolicy: boolean;
      daysOfCover: number | null;
      availabilityDays: number;
      stockoutDays: number;
      suggestedOrderQuantity: number | null;
      leadTimeDays: number | null;
      safetyDays: number | null;
      packSize: number;
    } | null;
  }>;
}

interface AssistantSnapshot {
  checkedAt: string;
  businessDate: string;
  timeZone: string;
  permissions: { canManageStock: boolean };
  sources: Record<Exclude<SourceKey, "actions">, { status: "ready" | "unavailable" | "restricted" }>;
  dashboard: DashboardData | null;
  historySummary: { summary: { hasBusinessHistory: boolean } } | null;
  productTrends?: ProductTrends | null;
  syncHealth?: SyncHealth | null;
  debts: DebtSummary | null;
  expenses: { daily: ExpenseSummary["daily"] } | null;
  costs: ProfitCoverage | null;
  stock: StockSnapshot | null;
}

interface AssistantAnswer {
  message: string;
  source: string | null;
  href: string | null;
  from: string | null;
  to: string | null;
  checkedAt: string;
  timeZone: string;
  evidence?: { definition: string; recordCount: number | null; recordCountLabel?: string; relatedRecordCount?: number | null; relatedRecordCountLabel?: string; warnings: string[] };
  clarificationOptions?: Array<{ label: string; question: string }>;
}

type SourceKey = "today" | "history" | "trends" | "debts" | "expenses" | "actions" | "costs" | "stock" | "purchases" | "sync";
type SourceStatus = { status: "loading" | "ready" | "unavailable" | "restricted"; checkedAt?: string; businessDate?: string; timeZone?: string };
const SOURCE_KEYS: SourceKey[] = ["today", "history", "trends", "debts", "expenses", "actions", "costs", "stock", "purchases", "sync"];

function shiftAssistantDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

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
  conditionKey: string;
}

interface AssistantAction {
  id: string;
  actionKey: string;
  title: string;
  href: string;
  status: "OPEN" | "OPENED" | "COMPLETED" | "DISMISSED" | "SNOOZED";
  openedAt?: string | null;
  completedAt?: string | null;
  dismissedAt?: string | null;
  shownAt: string;
  businessDate: string;
  baselineStock?: number | null;
  observedOutcome?: { type: string; beforeUnits: number; afterUnits: number; changeUnits: number; observedAt: string; attribution: "not-established" } | null;
  updatedAt: string;
  conditionKey?: string;
  snoozedUntil?: string | null;
  dismissReason?: string | null;
  events?: Array<{ eventType: string; createdAt: string; reason?: string | null; snoozedUntil?: string | null }>;
}

export default function AssistantPage() {
  const lang = useLang();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [historySummary, setHistorySummary] = useState<{ summary: { hasBusinessHistory: boolean } } | null>(null);
  const [productTrends, setProductTrends] = useState<ProductTrends | null>(null);
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null);
  const [debts, setDebts] = useState<DebtSummary | null>(null);
  const [expenses, setExpenses] = useState<ExpenseSummary | null>(null);
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [costs, setCosts] = useState<ProfitCoverage | null>(null);
  const [stock, setStock] = useState<StockSnapshot | null>(null);
  const [sourceStatus, setSourceStatus] = useState<Partial<Record<SourceKey, SourceStatus>>>({});
  const sourceGeneration = useRef<Partial<Record<SourceKey, number>>>({});
  const snapshotGeneration = useRef(0);
  const [canManageStock, setCanManageStock] = useState(false);
  const [pendingOfflineSales, setPendingOfflineSales] = useState(0);
  const shownOccurrences = useRef(new Set<string>());
  const lastDayRefresh = useRef("");
  const [actionError, setActionError] = useState("");
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [askError, setAskError] = useState("");
  const [asking, setAsking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());

  async function loadSource(key: SourceKey) {
    const generation = (sourceGeneration.current[key] ?? 0) + 1;
    sourceGeneration.current[key] = generation;
    if (key === "actions") {
      setSourceStatus((current) => ({ ...current, actions: { status: "loading" } }));
      setActions([]);
    } else {
      const snapshotKeys = SOURCE_KEYS.filter((source): source is Exclude<SourceKey, "actions"> => source !== "actions");
      const snapshotId = ++snapshotGeneration.current;
      setSourceStatus((current) => ({ ...current, ...Object.fromEntries(snapshotKeys.map((source) => [source, { status: "loading" }])) }));
      try {
        const data = await api.get<AssistantSnapshot>("/assistant/snapshot", lang);
        if (snapshotGeneration.current !== snapshotId) return;
        setDashboard(data.dashboard);
        setHistorySummary(data.historySummary);
        setProductTrends(data.productTrends ?? null);
        setSyncHealth(data.syncHealth ?? null);
        setDebts(data.debts);
        setExpenses(data.expenses ? { ...data.expenses, businessDate: data.businessDate } : null);
        setCosts(data.costs);
        setStock(data.stock);
        setCanManageStock(Boolean(data.permissions?.canManageStock));
        const checkedAt = data.checkedAt || new Date().toISOString();
        setSourceStatus((current) => ({
          ...current,
          ...Object.fromEntries(snapshotKeys.map((source) => [source, {
            status: data.sources?.[source]?.status ?? "unavailable",
            checkedAt,
            businessDate: data.businessDate,
            timeZone: data.timeZone,
          }])),
        }));
      } catch {
        if (snapshotGeneration.current !== snapshotId) return;
        const checkedAt = new Date().toISOString();
        setSourceStatus((current) => ({ ...current, ...Object.fromEntries(snapshotKeys.map((source) => [source, { status: "unavailable", checkedAt }])) }));
        setDashboard(null); setHistorySummary(null); setProductTrends(null); setSyncHealth(null); setDebts(null); setExpenses(null); setCosts(null); setStock(null);
      }
      return;
    }
    try {
      const data = await api.get<{ actions: AssistantAction[]; businessDate?: string; timeZone?: string }>("/assistant/actions?days=1&limit=100", lang);
      if (sourceGeneration.current[key] !== generation) return;
      setActions(data.actions ?? []);
      setSourceStatus((current) => ({ ...current, actions: { status: "ready", checkedAt: new Date().toISOString(), businessDate: data.businessDate, timeZone: data.timeZone } }));
    } catch (error) {
      if (sourceGeneration.current[key] !== generation) return;
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      setSourceStatus((current) => ({ ...current, [key]: { status: /permission|forbidden|ruhusa/.test(message) ? "restricted" : "unavailable", checkedAt: new Date().toISOString() } }));
    }
  }

  useEffect(() => {
    void loadSource("today");
    void loadSource("actions");
  }, [lang]);

  useEffect(() => {
    let active = true;
    const refreshPendingSales = async () => {
      try {
        const data = await api.get<{ user: { shop?: { id?: string } } }>("/auth/me");
        if (active) setPendingOfflineSales(getPendingOfflineSalesCount(data.user.shop?.id));
      } catch {
        if (active) setPendingOfflineSales(0);
      }
    };
    const onFocus = () => void refreshPendingSales();
    const onStorage = () => void refreshPendingSales();
    void refreshPendingSales();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setFreshnessNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

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
        void loadSource("today");
        void loadSource("actions");
      }
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [sourceStatus.actions?.businessDate, sourceStatus.actions?.timeZone, lang]);

  const allRecommendations = useMemo(() => sourceStatus.actions?.status === "ready" ? buildRecommendations({ dashboard, historySummary, productTrends, debts, expenses, costs, stockSnapshot: stock, canManageStock, lang }) : [], [sourceStatus.actions?.status, dashboard, historySummary, productTrends, debts, expenses, costs, stock, canManageStock, lang]);
  const currentBusinessDate = sourceStatus.actions?.businessDate;
  const recommendations = allRecommendations.filter((item) => {
    const status = actionStatus(item);
    return status?.status !== "DISMISSED" && !(status?.status === "SNOOZED" && status.snoozedUntil && currentBusinessDate && status.snoozedUntil > currentBusinessDate);
  });
  const dismissedActions = actions.filter((action) => ["DISMISSED", "SNOOZED"].includes(action.status) && (!currentBusinessDate || action.businessDate === currentBusinessDate));
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

  async function askQuestionText(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    if (!value) return;
    setAnswer(null);
    setAskError("");
    setAsking(true);
    try {
      const result = await api.post<{ answer: AssistantAnswer }>("/assistant/ask", { question: normalized, language: lang }, lang);
      const warnings = [...(result.answer.evidence?.warnings ?? [])];
      if (pendingOfflineSales > 0) warnings.push(lang === "sw" ? `Kuna mauzo ${pendingOfflineSales} ya offline kwenye kifaa hiki ambayo bado hayajasawazishwa; hayajajumuishwa kwenye jibu.` : `${pendingOfflineSales} offline sale(s) on this device are waiting to sync and are not included in this answer.`);
      if (syncHealth && (syncHealth.serverKnownPending > 0 || syncHealth.serverKnownFailed > 0)) warnings.push(lang === "sw"
        ? `Ripoti za seva zinaonyesha mauzo ${syncHealth.serverKnownPending} yanayosubiri na ${syncHealth.serverKnownFailed} yaliyoshindwa kusawazishwa kwenye vifaa vilivyoripoti. Vifaa vilivyo nje ya mtandao haviwezi kutoa hali ya sasa.`
        : `Server-received reports show ${syncHealth.serverKnownPending} pending and ${syncHealth.serverKnownFailed} failed sale sync(s) from reporting devices. Devices currently offline may not have reported their latest queue.`);
      setAnswer({ ...result.answer, evidence: result.answer.evidence ? { ...result.answer.evidence, warnings } : undefined });
    } catch (error) {
      setAskError(error instanceof Error ? error.message : (lang === "sw" ? "Swali halikujibiwa." : "The question could not be answered."));
    } finally {
      setAsking(false);
    }
  }

  async function askQuestion(event: React.FormEvent) {
    event.preventDefault();
    await askQuestionText(question);
  }

  function actionStatus(item: Recommendation) {
    return actions.find((action) => action.actionKey === item.id && (action.conditionKey ?? "") === item.conditionKey);
  }

  const trackRecommendation = useCallback(async (item: Pick<Recommendation, "id" | "title" | "href" | "conditionKey">, eventType: "SHOWN" | "OPENED" | "COMPLETED" | "DISMISSED" | "RESTORED" | "SNOOZED", reason?: "ALREADY_HANDLED" | "NOT_RELEVANT" | "NOT_NOW") => {
    setActionError("");
    try {
    const data = await api.post<{ action: AssistantAction }>("/assistant/actions", {
      actionKey: item.id,
      title: item.title,
      href: item.href,
      conditionKey: item.conditionKey,
      eventType,
      reason,
      snoozedUntil: eventType === "SNOOZED" && sourceStatus.actions?.businessDate ? shiftAssistantDate(sourceStatus.actions.businessDate, 1) : undefined,
    }, lang);
    setActions((prev) => {
      const next = prev.filter((action) => action.actionKey !== item.id || (action.conditionKey ?? "") !== item.conditionKey);
      return [data.action, ...next];
    });
    } catch (error) {
      if (eventType === "SHOWN") shownOccurrences.current.delete(`${sourceStatus.actions?.businessDate ?? "unknown"}:${item.id}:${item.conditionKey}`);
      setActionError(error instanceof Error ? error.message : (lang === "sw" ? "Imeshindikana kuhifadhi hatua." : "Could not save the action."));
    }
  }, [lang, sourceStatus.actions?.businessDate]);

  useEffect(() => {
    if (sourceStatus.actions?.status !== "ready") return;
    for (const item of recommendations) {
      const occurrenceKey = `${sourceStatus.actions.businessDate ?? "unknown"}:${item.id}:${item.conditionKey}`;
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
          <p className="mt-1 text-sm text-gray-600">{lang === "sw" ? "Uliza kuhusu mauzo, bidhaa ambazo hazijauzwa, matumizi, manunuzi, makusanyo, mwenendo wa bidhaa, supplier, mabadiliko ya stock, madeni yaliyochelewa au stock. Tumia wiki, siku 30/90, mwezi au tarehe maalum." : "Ask about sales, products with no recorded sales, expenses, purchases, collections, product trends, supplier spend, stock movements, debt aging, or inventory. Use weekly, last 30/90 days, monthly, or custom dates."}</p>
          <form onSubmit={askQuestion} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input aria-label={lang === "sw" ? "Swali kwa msaidizi" : "Question for assistant"} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={250} placeholder={lang === "sw" ? "Mauzo ya mwezi huu ni kiasi gani?" : "What were my sales this month?"} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <button type="submit" disabled={asking || !question.trim()} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{asking ? (lang === "sw" ? "Inatafuta…" : "Checking…") : (lang === "sw" ? "Uliza" : "Ask")}</button>
          </form>
          {askError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{askError}</p>}
          {answer && <div aria-live="polite" className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-gray-800">
            <p>{answer.message}</p>
            {answer.clarificationOptions?.length ? <div className="mt-3 flex flex-wrap gap-2">{answer.clarificationOptions.map((option) => <button key={option.question} type="button" disabled={asking} onClick={() => { setQuestion(option.question); void askQuestionText(option.question); }} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100 disabled:opacity-50">{option.label}</button>)}</div> : null}
            {answer.source && <p className="mt-2 text-xs text-gray-600">{lang === "sw" ? "Chanzo" : "Source"}: {answer.source} · {answer.from ? `${formatAppDateTime(answer.from)} – ` : ""}{answer.to ? formatAppDateTime(answer.to) : formatAppDateTime(answer.checkedAt)} · {answer.timeZone}</p>}
            {answer.evidence && <div className="mt-3 rounded-lg border border-brand-100 bg-white/80 p-3">
              <p className="text-xs font-bold text-gray-800">{lang === "sw" ? "Jinsi jibu lilivyohesabiwa" : "How this was calculated"}</p>
              <p className="mt-2 text-xs leading-5 text-gray-700">{answer.evidence.definition}</p>
              {answer.evidence.recordCount !== null && <p className="mt-1 text-xs text-gray-600">{answer.evidence.recordCountLabel ?? (lang === "sw" ? "Rekodi zilizohusika" : "Records included")}: {answer.evidence.recordCount}{answer.evidence.relatedRecordCount != null ? ` · ${answer.evidence.relatedRecordCountLabel ?? (lang === "sw" ? "Rekodi zinazohusiana" : "Related records")}: ${answer.evidence.relatedRecordCount}` : ""}</p>}
              {answer.evidence.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-amber-800">{answer.evidence.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
            </div>}
            {answer.href && <Link href={answer.href} className="mt-2 inline-block text-xs font-bold text-brand-700">{lang === "sw" ? "Fungua rekodi husika" : "Open relevant records"} →</Link>}
          </div>}
          <p className="mt-2 text-xs text-gray-500">{lang === "sw" ? "Msaidizi huyu hutumia kanuni na haitumii huduma ya AI ya nje; haibadilishi rekodi zako." : "This rules-based assistant does not use an external AI service or change your records."}</p>
        </section>

        <section aria-label={lang === "sw" ? "Hali ya vyanzo vya data" : "Data source status"} className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">{lang === "sw" ? "Hali ya vyanzo vya data" : "Data source status"}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SOURCE_KEYS.map((key) => {
              const labels: Record<SourceKey, string> = { today: lang === "sw" ? "Mauzo ya leo" : "Today’s sales", history: lang === "sw" ? "Historia ya mauzo" : "Sales history", trends: lang === "sw" ? "Mwenendo wa bidhaa" : "Recent product trends", debts: lang === "sw" ? "Madeni" : "Debts", expenses: lang === "sw" ? "Matumizi" : "Expenses", actions: lang === "sw" ? "Historia ya hatua" : "Action history", costs: lang === "sw" ? "Gharama za mauzo" : "Sales cost coverage", stock: lang === "sw" ? "Stock na order zinazoingia" : "Stock and incoming orders", purchases: lang === "sw" ? "Manunuzi yaliyopokelewa" : "Received purchases", sync: lang === "sw" ? "Ripoti za sync za vifaa" : "Device sync reports" };
              const state = sourceStatus[key];
              const checkedAtMs = state?.checkedAt ? Date.parse(state.checkedAt) : NaN;
              const stale = Number.isFinite(checkedAtMs) && freshnessNow - checkedAtMs >= 5 * 60_000;
              return <div key={key} className="rounded-lg bg-gray-50 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-gray-800">{labels[key]}</span>{state?.status !== "loading" && (state?.status !== "ready" || stale) && <button type="button" onClick={() => void loadSource(key)} className="font-bold text-brand-700">{lang === "sw" ? "Sasisha" : state?.status === "ready" && stale ? "Refresh" : "Retry"}</button>}</div><p className="mt-1 text-gray-600">{!state || state.status === "loading" ? (lang === "sw" ? "Inapakia…" : "Checking…") : state.status === "ready" ? (stale ? (lang === "sw" ? "Ukaguzi huu unaweza kuwa wa zamani" : "This check may be stale") : (lang === "sw" ? "Ombi limefanikiwa; si uthibitisho wa sync ya vifaa" : "Request succeeded; this alone does not prove devices are synced")) : state.status === "restricted" ? (lang === "sw" ? "Ruhusa inahitajika" : "Permission required") : (lang === "sw" ? "Haipatikani; mapendekezo yanayotegemea chanzo hiki yamefichwa" : "Unavailable; dependent recommendations are hidden")}{state?.checkedAt ? ` · ${lang === "sw" ? "imekaguliwa mara ya mwisho" : "last checked"} ${formatAppDateTime(state.checkedAt)}` : ""}</p></div>;
            })}
          </div>
        </section>
        {pendingOfflineSales > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{lang === "sw" ? `Mauzo ${pendingOfflineSales} ya offline kwenye kifaa hiki yanasubiri kusawazishwa. Jumla za AI hutumia rekodi za seva na haziyaoni mpaka sync ikamilike.` : `${pendingOfflineSales} offline sale(s) on this device are waiting to sync. Assistant totals use server records and will not include them until sync completes.`}</p>}
        {syncHealth && <section aria-label={lang === "sw" ? "Ripoti za sync za vifaa" : "Cross-device sync report"} className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-bold text-gray-900">{lang === "sw" ? "Hali ya sync inayojulikana kwa seva" : "Server-known sync status"}</h2>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <p className="rounded-lg bg-gray-50 p-3 text-gray-700">{lang === "sw" ? "Vifaa vilivyoripoti" : "Devices observed"}: <strong>{syncHealth.devicesObserved}</strong></p>
            <p className="rounded-lg bg-amber-50 p-3 text-amber-900">{lang === "sw" ? "Mauzo yanayosubiri (ripoti za seva)" : "Pending (server reports)"}: <strong>{syncHealth.serverKnownPending}</strong></p>
            <p className="rounded-lg bg-red-50 p-3 text-red-900">{lang === "sw" ? "Sync zilizoshindwa (ripoti za seva)" : "Failed syncs (server reports)"}: <strong>{syncHealth.serverKnownFailed}</strong></p>
            <p className="rounded-lg bg-brand-50 p-3 text-brand-900">{lang === "sw" ? "Sync iliyofanikiwa mwisho" : "Last successful sync reported"}: <strong>{syncHealth.lastSuccessfulSyncAt ? formatAppDateTime(syncHealth.lastSuccessfulSyncAt) : (lang === "sw" ? "hakuna ripoti" : "no report")}</strong></p>
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-500">{lang === "sw" ? `Ripoti ya mwisho kupokelewa: ${syncHealth.lastEventReceivedAt ? formatAppDateTime(syncHealth.lastEventReceivedAt) : "hakuna"}. Ukaguzi: ${formatAppDateTime(syncHealth.checkedAt)}. Hii ni historia ya matukio yaliyofika seva tu; kifaa kisicho na mtandao hakiwezi kuripoti foleni yake.` : `Latest event received: ${syncHealth.lastEventReceivedAt ? formatAppDateTime(syncHealth.lastEventReceivedAt) : "none"}. Checked: ${formatAppDateTime(syncHealth.checkedAt)}. This reflects events received by the server only; an offline device cannot report its current local queue.`}{syncHealth.observationLimitReached ? (lang === "sw" ? " Matukio 2,000 ya karibuni pekee yamekaguliwa." : " Only the latest 2,000 sync events were inspected.") : ""}</p>
        </section>}
        {costs && costs.summary.missingCostSalesRevenue > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{lang === "sw" ? `Bei ya kununua haipo kwa mauzo ya leo yenye thamani ya ${formatTZS(costs.summary.missingCostSalesRevenue)}. Mapendekezo yanayohitaji faida yatafichwa badala ya kutumia namba isiyokamilika.` : `${formatTZS(costs.summary.missingCostSalesRevenue)} of today’s sales have no saved buying cost. Profit-dependent recommendations are withheld rather than calculated from incomplete cost data.`}</p>}
        {costs?.summary.headerSalesRevenue != null && costs.summary.headerSalesRevenue !== costs.summary.salesRevenue && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">{lang === "sw" ? `Tahadhari ya ulinganisho: total ya header ya mauzo (${formatTZS(costs.summary.headerSalesRevenue)}) inatofautiana na jumla ya bidhaa (${formatTZS(costs.summary.salesRevenue)}). Hakiki risiti kabla ya kutegemea hesabu ya faida.` : `Reconciliation warning: sale-header revenue (${formatTZS(costs.summary.headerSalesRevenue)}) differs from saved sale-item revenue (${formatTZS(costs.summary.salesRevenue)}). Verify receipts before relying on profit figures.`}</p>}
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
                        onClick={() => setDismissTarget((current) => current === item.id ? null : item.id)}
                        className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200"
                      >
                        {lang === "sw" ? "Ficha" : "Dismiss / snooze"}
                      </button>
                    </div>
                    {dismissTarget === item.id && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-700">{lang === "sw" ? "Kwa nini unaficha pendekezo hili?" : "Why are you hiding this recommendation?"}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void trackRecommendation(item, "DISMISSED", "ALREADY_HANDLED").then(() => setDismissTarget(null))} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700">{lang === "sw" ? "Tayari nimeshughulikia" : "Already handled"}</button>
                        <button type="button" onClick={() => void trackRecommendation(item, "DISMISSED", "NOT_RELEVANT").then(() => setDismissTarget(null))} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700">{lang === "sw" ? "Halifai sasa" : "Not relevant"}</button>
                        <button type="button" onClick={() => void trackRecommendation(item, "SNOOZED", "NOT_NOW").then(() => setDismissTarget(null))} className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-800">{lang === "sw" ? "Nikumbushe kesho" : "Remind me tomorrow"}</button>
                      </div>
                    </div>}
                  </div>
                </div>
              </div>
            );
            })}
          </div>
          {dismissedActions.length > 0 && <details className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">{lang === "sw" ? `Mapendekezo yaliyofichwa leo (${dismissedActions.length})` : `Hidden today (${dismissedActions.length})`}</summary>
            <div className="mt-2 divide-y divide-gray-200">{dismissedActions.map((action) => <div key={action.id} className="flex flex-wrap items-center gap-2 py-2"><span className="min-w-0 flex-1 text-sm text-gray-700">{action.title}<span className="ml-2 text-xs text-gray-500">{action.status === "SNOOZED" ? (lang === "sw" ? `Imesitishwa hadi ${action.snoozedUntil ?? "kesho"}` : `Snoozed until ${action.snoozedUntil ?? "tomorrow"}`) : action.dismissReason === "ALREADY_HANDLED" ? (lang === "sw" ? "Tayari imeshughulikiwa" : "Already handled") : action.dismissReason === "NOT_RELEVANT" ? (lang === "sw" ? "Haifai" : "Not relevant") : ""}</span></span><button type="button" onClick={() => trackRecommendation({ id: action.actionKey, title: action.title, href: action.href, conditionKey: action.conditionKey ?? "" }, "RESTORED").catch(console.error)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"><Undo2 className="h-3.5 w-3.5" />{lang === "sw" ? "Rejesha" : "Undo"}</button></div>)}</div>
          </details>}
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
  historySummary,
  productTrends,
  debts,
  expenses,
  costs,
  stockSnapshot,
  canManageStock,
  lang,
}: {
  dashboard: DashboardData | null;
  historySummary: { summary: { hasBusinessHistory: boolean } } | null;
  productTrends: ProductTrends | null;
  debts: DebtSummary | null;
  expenses: ExpenseSummary | null;
  costs: ProfitCoverage | null;
  stockSnapshot: StockSnapshot | null;
  canManageStock: boolean;
  lang: "sw" | "en";
}): Recommendation[] {
  const items: Recommendation[] = [];
  const lowStock = stockSnapshot?.products || [];
  const mostUrgentStock = lowStock[0];
  const todaySalesCount = dashboard?.summary.salesCount || 0;
  const hasBusinessHistory = Boolean(historySummary?.summary.hasBusinessHistory);

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
      conditionKey: `${dashboard?.summary.netProfit ?? 0}:${dashboard?.summary.totalExpenses ?? 0}:${costs?.summary.missingCostSalesRevenue ?? 0}`,
    });
  }

  if (dashboard && historySummary && hasBusinessHistory && todaySalesCount === 0) {
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
      conditionKey: `sales:${todaySalesCount}`,
    });
  }

  if (mostUrgentStock && canManageStock) {
    items.push({
      id: `stock-${mostUrgentStock.id}`,
      rank: 100,
      icon: Package,
      tone: "bg-red-50 text-red-700",
      title: lang === "sw"
        ? `Kagua stock ya ${mostUrgentStock.name}`
        : `Review stock for ${mostUrgentStock.name}`,
      body: (() => {
        const estimate = mostUrgentStock.reorderEstimate;
        const prefix = lang === "sw"
          ? `Imebaki ${mostUrgentStock.currentStock} ${mostUrgentStock.unit}; kiwango cha chini ni ${mostUrgentStock.minimumStock}.`
          : `${mostUrgentStock.currentStock} ${mostUrgentStock.unit} left; minimum is ${mostUrgStockMinimum(mostUrgentStock)}.`;
        if (estimate?.hasEnoughHistory && estimate.hasConfiguredReorderPolicy && estimate.suggestedOrderQuantity !== null && estimate.suggestedOrderQuantity > 0) {
          const packs = Math.ceil(estimate.suggestedOrderQuantity / estimate.packSize);
          return lang === "sw"
            ? `${prefix} Kwa siku ${estimate.availabilityDays} zilizokuwa na stock ndani ya siku ${estimate.observedDays} zilizofuatiliwa (stockout ${estimate.stockoutDays}) na order zilizopo, fikiria kuagiza ${estimate.suggestedOrderQuantity} ${mostUrgentStock.unit} (${packs} pakiti). Imetumia lead time ya siku ${estimate.leadTimeDays} na buffer ya siku ${estimate.safetyDays}. Ni mwongozo, si forecast; hauhesabu mahitaji yaliyokosekana kabla ufuatiliaji kuanza, msimu au promotion.`
            : `${prefix} Based on ${estimate.availabilityDays} in-stock days within ${estimate.observedDays} tracked days (${estimate.stockoutDays} stockout days) and open orders, consider ${estimate.suggestedOrderQuantity} ${mostUrgentStock.unit} (${packs} packs). It uses a ${estimate.leadTimeDays}-day lead time and ${estimate.safetyDays}-day safety buffer. It is a guide, not a forecast; it cannot infer demand missed before tracking began, seasonality, or promotions.`;
        }
        if (estimate?.hasEnoughHistory && estimate.hasConfiguredReorderPolicy && estimate.suggestedOrderQuantity === 0) return lang === "sw"
          ? `${prefix} Kwa lead time na buffer ulizoweka, stock iliyopo pamoja na order tayari zinatosha kwa sasa. Hakiki delivery; usiweke duplicate order bila sababu.`
          : `${prefix} Under the configured lead time and safety buffer, current stock plus open orders already cover the target. Verify delivery before placing a duplicate order.`;
        if (estimate && !estimate.hasEnoughHistory) return lang === "sw"
          ? `${prefix} Order zilizopo zimezingatiwa, lakini historia ya mauzo haitoshi kutoa kiasi salama cha kuagiza.`
          : `${prefix} Open orders are considered, but sales history is not strong enough for a safe order quantity.`;
        if (estimate && !estimate.hasConfiguredReorderPolicy) return lang === "sw"
          ? `${prefix} Weka lead time ya supplier na buffer ya usalama kwenye bidhaa ili kupata pendekezo la kiasi.`
          : `${prefix} Set the product’s supplier lead time and safety buffer to get a quantity recommendation.`;
        if (!estimate && stockSnapshot?.demandStatus !== "ready") return lang === "sw"
          ? `${prefix} Historia ya mauzo haipatikani kwa ruhusa za akaunti hii, kwa hiyo kiasi salama cha kuagiza hakiwezi kukadiriwa.`
          : `${prefix} Sales history is not available under this account’s permissions, so a safe order quantity cannot be estimated.`;
        if (!estimate) return lang === "sw"
          ? `${prefix} Hakuna historia ya kutosha ya mauzo ya karibuni kutoa kiasi cha kuagiza. Agizo lolote linahitaji kukaguliwa kwa mkono.`
          : `${prefix} There is not enough usable recent sales history to estimate an order quantity. Review any order manually.`;
        return lang === "sw"
          ? `${prefix} Order zilizopo zimezingatiwa. Kagua kabla ya kuagiza tena.`
          : `${prefix} Open orders are considered. Review before reordering.`;
      })(),
      action: lang === "sw" ? "Fungua inventory na agiza tena" : "Open inventory and reorder",
      href: `/inventory?search=${encodeURIComponent(mostUrgentStock.name)}&action=restock`,
      why: lang === "sw"
        ? "Stock ikiisha, mauzo husimama na mteja huenda kwa duka lingine."
        : "When stock runs out, sales stop and customers move to another shop.",
      impact: lang === "sw"
        ? "Kulinda mauzo ya bidhaa inayohitajika kabla wiki haijaisha."
        : "Protect sales from a needed item before the week ends.",
      conditionKey: `${mostUrgentStock.currentStock}:${mostUrgentStock.minimumStock}:${mostUrgentStock.onOrderQuantity ?? mostUrgentStock.onOrderStatus ?? 0}:${mostUrgentStock.stockRevisionAt ?? ""}`,
    });
  }

  if (debts?.summary.totalOwed) {
    const openDebt = debts.debts?.find((debt) => debt.status === "OPEN" || debt.status === "PARTIAL");
    const customer = openDebt?.customerName;
    const debtBalance = openDebt?.balance ?? debts.summary.totalOwed;
    const debtState = (debts.debts ?? [])
      .filter((debt) => debt.status === "OPEN" || debt.status === "PARTIAL")
      .map((debt) => `${debt.id ?? ""}:${Number(debt.balance)}:${debt.status}:${debt.dueDate ?? ""}`)
      .sort()
      .join("|");
    const overdueDays = Number(openDebt?.daysOverdue ?? 0);
    items.push({
      id: "debt",
      rank: 90,
      icon: HandCoins,
      tone: "bg-amber-50 text-amber-700",
      title: lang === "sw"
        ? `Fuatilia madeni ya ${formatTZS(debts.summary.totalOwed)}`
        : `Follow up on ${formatTZS(debts.summary.totalOwed)} in unpaid debt`,
      body: lang === "sw"
        ? `${customer ? `Anza na ${customer}; ` : ""}${openDebt?.dueDate && overdueDays > 0 ? `amechelewa siku ${overdueDays}, salio ${formatTZS(debtBalance)}. ` : ""}Kuna madeni ${debts.summary.openCount} ambayo bado hayajafungwa.`
        : `${customer ? `Start with ${customer}; ` : ""}${openDebt?.dueDate && overdueDays > 0 ? `${overdueDays} days overdue, balance ${formatTZS(debtBalance)}. ` : ""}${debts.summary.openCount} debt records are still open.`,
      action: lang === "sw" ? "Fungua madeni na rekodi malipo" : "Open debts and record payment",
      href: "/debts",
      why: lang === "sw"
        ? "Madeni yakikaa muda mrefu hupunguza cash ya kununua stock mpya."
        : "Old debts reduce the cash available to buy new stock.",
      impact: lang === "sw"
        ? "Kuongeza cash ya kununua stock au kulipa gharama za duka."
        : "Free up cash for stock purchases or shop expenses.",
      conditionKey: `${debts.summary.totalOwed}:${debts.summary.openCount}:${hashCondition(debtState)}`,
    });
  }

  const expenseTrend = getExpenseTrend(expenses?.daily || [], expenses?.businessDate || "");
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
      conditionKey: `${expenseTrend.current}:${expenseTrend.previous}:${expenseTrend.currentCount}:${expenseTrend.previousCount}`,
    });
  }

  const topProduct = productTrends?.products?.[0];
  if (topProduct?.name && topProduct.revenue30d > 0) {
    const trendText = topProduct.revenueChangePercent == null
      ? (lang === "sw" ? "hakuna msingi wa mwezi uliopita" : "no prior-period baseline")
      : `${topProduct.revenueChangePercent >= 0 ? "+" : ""}${topProduct.revenueChangePercent}% ${lang === "sw" ? "dhidi ya siku 30 zilizotangulia" : "vs the prior 30 days"}`;
    items.push({
      id: "top-product",
      rank: 60,
      icon: TrendingUp,
      tone: "bg-green-50 text-green-700",
      title: lang === "sw"
        ? `Promote ${topProduct.name}`
        : `Promote ${topProduct.name}`,
      body: lang === "sw"
        ? `Siku 30 zilizopita: ${formatTZS(topProduct.revenue30d)} na vipande ${topProduct.units30d}; ${trendText}.`
        : `Last 30 days: ${formatTZS(topProduct.revenue30d)} revenue and ${topProduct.units30d} units; ${trendText}.`,
      action: lang === "sw" ? "Tumia kama bidhaa ya kuvutia wateja" : "Use it as a customer magnet",
      href: `/inventory?search=${encodeURIComponent(topProduct.name)}&action=promote`,
      why: lang === "sw"
        ? "Bidhaa inayouza vizuri inaweza kuvuta wateja wanunue bidhaa nyingine pia."
        : "A strong seller can bring customers in and lift other basket items too.",
      impact: lang === "sw"
        ? "Kuongeza basket size kwa kuweka bidhaa inayopendwa mbele."
        : "Increase basket size by putting a proven seller in front.",
      conditionKey: `${topProduct.id}:${topProduct.revenue30d}:${topProduct.units30d}:${topProduct.previousRevenue30d}:${topProduct.previousUnits30d}`,
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
      conditionKey: String(dashboard.summary.pendingOrders),
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

function hashCondition(value: string) {
  // Condition keys are stored with recommendation history; hash the debt-state
  // summary instead of persisting customer balances or other personal details.
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ (code + index), 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function getExpenseTrend(expenses: Array<{ businessDate: string; amount: number; count: number }>, businessDate: string) {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(businessDate) ? Date.parse(`${businessDate}T00:00:00Z`) / 86400000 : NaN;
  return expenses.reduce(
    (totals, expense) => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(expense.businessDate) ? Date.parse(`${expense.businessDate}T00:00:00Z`) / 86400000 : NaN;
      const ageInBusinessDays = today - date;
      if (!Number.isFinite(ageInBusinessDays) || ageInBusinessDays < 0) return totals;
      if (ageInBusinessDays <= 6) { totals.current += Number(expense.amount) || 0; totals.currentCount += Number(expense.count) || 0; }
      if (ageInBusinessDays >= 7 && ageInBusinessDays <= 13) { totals.previous += Number(expense.amount) || 0; totals.previousCount += Number(expense.count) || 0; }
      return totals;
    },
    { current: 0, previous: 0, currentCount: 0, previousCount: 0 }
  );
}
