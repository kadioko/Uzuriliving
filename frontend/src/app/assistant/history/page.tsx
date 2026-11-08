"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { formatAppDateTime } from "@/lib/timezone";
import { ArrowLeft, CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";

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
  observedOutcome?: { type: string; beforeUnits: number; afterUnits: number; changeUnits: number; observedAt: string; attribution: "not-established" } | null;
  createdAt: string;
  updatedAt: string;
  dismissReason?: string | null;
  snoozedUntil?: string | null;
  events?: Array<{ eventType: string; createdAt: string; reason?: string | null; snoozedUntil?: string | null }>;
}

function statusTone(status: AssistantAction["status"]) {
  if (status === "COMPLETED") return "bg-green-100 text-green-700";
  if (status === "DISMISSED") return "bg-gray-100 text-gray-600";
  if (status === "SNOOZED") return "bg-amber-100 text-amber-800";
  if (status === "OPENED") return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}

function statusIcon(status: AssistantAction["status"]) {
  if (status === "COMPLETED") return CheckCircle2;
  if (status === "DISMISSED") return XCircle;
  return Clock;
}

export default function AssistantHistoryPage() {
  const lang = useLang();
  const [actions, setActions] = useState<AssistantAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ actions: AssistantAction[] }>("/assistant/actions?days=90&limit=200", lang)
      .then((data) => setActions(data.actions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lang]);

  const completed = actions.filter((action) => action.events?.some((event) => event.eventType === "COMPLETED") ?? action.status === "COMPLETED").length;
  const dismissed = actions.filter((action) => action.events?.some((event) => event.eventType === "DISMISSED") ?? action.status === "DISMISSED").length;
  const opened = actions.filter((action) => action.events?.some((event) => event.eventType === "OPENED") ?? action.status === "OPENED").length;
  const snoozed = actions.filter((action) => action.events?.some((event) => event.eventType === "SNOOZED") ?? action.status === "SNOOZED").length;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/assistant" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800">
              <ArrowLeft className="h-4 w-4" />
              {lang === "sw" ? "Rudi kwenye AI" : "Back to AI"}
            </Link>
            <h1 className="text-xl font-bold text-gray-950">{lang === "sw" ? "Historia ya Hatua za AI" : "AI Action History"}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {lang === "sw" ? "Ona kila pendekezo na mabadiliko yake. Tukio lililokamilishwa halimaanishi kuwa biashara ilisababishwa kubadilika nalo." : "Review each recommendation and its event history. A completed action does not prove the recommendation caused a business result."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
            <div className="rounded-xl bg-brand-50 px-3 py-2 text-brand-800">
              <p className="text-lg font-black">{actions.length}</p>
              <p>{lang === "sw" ? "Matukio ya mapendekezo" : "Occurrences shown"}</p>
            </div>
            <div className="rounded-xl bg-green-50 px-3 py-2 text-green-800">
              <p className="text-lg font-black">{completed}</p>
              <p>{lang === "sw" ? "Zimefanyika" : "Done"}</p>
            </div>
            <div className="rounded-xl bg-blue-50 px-3 py-2 text-blue-800">
              <p className="text-lg font-black">{opened}</p>
              <p>{lang === "sw" ? "Zimefunguliwa" : "Opened"}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2 text-gray-700">
              <p className="text-lg font-black">{dismissed}</p>
              <p>{lang === "sw" ? "Zimeachwa" : "Dismissed"}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
              <p className="text-lg font-black">{snoozed}</p>
              <p>{lang === "sw" ? "Zimesitishwa" : "Snoozed"}</p>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">{lang === "sw" ? "Inapakia..." : "Loading..."}</div>
          ) : actions.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">
              {lang === "sw" ? "Bado hakuna historia. Fungua au kamilisha hatua kwenye AI Assistant." : "No action history yet. Open or complete actions from the AI Assistant."}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {actions.map((action) => {
                const Icon = statusIcon(action.status);
                return (
                  <div key={action.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(action.status)}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {action.status}
                        </span>
                        <span className="font-mono text-[11px] text-gray-400">{action.actionKey}</span>
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">{lang === "sw" ? "Imeonyeshwa" : "Shown"}</span>
                      </div>
                      <p className="mt-2 font-semibold text-gray-950">{action.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {lang === "sw" ? "Siku ya biashara" : "Business day"} {action.businessDate} · {lang === "sw" ? "Ilionyeshwa" : "Shown"} {formatAppDateTime(action.shownAt)} · {lang === "sw" ? "Mwisho kubadilishwa" : "Last updated"} {formatAppDateTime(action.updatedAt)}
                      </p>
                      {(action.dismissReason || action.snoozedUntil) && <p className="mt-2 text-xs text-gray-600">{action.dismissReason === "ALREADY_HANDLED" ? (lang === "sw" ? "Sababu: Tayari imeshughulikiwa" : "Reason: Already handled") : action.dismissReason === "NOT_RELEVANT" ? (lang === "sw" ? "Sababu: Haifai" : "Reason: Not relevant") : action.dismissReason === "NOT_NOW" ? (lang === "sw" ? "Sababu: Si sasa" : "Reason: Not now") : ""}{action.snoozedUntil ? ` · ${lang === "sw" ? "Hadi" : "Until"} ${action.snoozedUntil}` : ""}</p>}
                      {action.events?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{action.events.map((event, index) => <span key={`${event.eventType}-${event.createdAt}-${index}`} className="rounded-full bg-gray-100 px-2 py-1 text-[10px] text-gray-600">{event.eventType === "RESTORED" ? (lang === "sw" ? "Imerejeshwa" : "Restored") : event.eventType === "SNOOZED" ? (lang === "sw" ? "Imesitishwa" : "Snoozed") : event.eventType} · {formatAppDateTime(event.createdAt)}{event.reason ? ` · ${event.reason.toLowerCase().replaceAll("_", " ")}` : ""}</span>)}</div> : null}
                      {action.observedOutcome?.type === "stock-level-change" && (
                        <p className="mt-2 rounded-lg bg-blue-50 p-2 text-xs text-blue-900">
                          {lang === "sw"
                            ? `Stock ilibadilika kutoka ${action.observedOutcome.beforeUnits} hadi ${action.observedOutcome.afterUnits} baada ya pendekezo kuonyeshwa (${action.observedOutcome.changeUnits >= 0 ? "+" : ""}${action.observedOutcome.changeUnits}). Huu ni mabadiliko yaliyoonekana tu; hayathibitishi kuwa pendekezo limesababisha mabadiliko.`
                            : `Stock changed from ${action.observedOutcome.beforeUnits} to ${action.observedOutcome.afterUnits} after the recommendation was shown (${action.observedOutcome.changeUnits >= 0 ? "+" : ""}${action.observedOutcome.changeUnits}). This is an observed change only; it does not prove the recommendation caused it.`}
                        </p>
                      )}
                    </div>
                    <Link href={action.href} className="inline-flex items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      {lang === "sw" ? "Fungua" : "Open"}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
