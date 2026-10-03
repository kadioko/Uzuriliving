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
  status: "OPEN" | "OPENED" | "COMPLETED" | "DISMISSED";
  openedAt?: string | null;
  completedAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

function statusTone(status: AssistantAction["status"]) {
  if (status === "COMPLETED") return "bg-green-100 text-green-700";
  if (status === "DISMISSED") return "bg-gray-100 text-gray-600";
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
    api.get<{ actions: AssistantAction[] }>("/assistant/actions?limit=200", lang)
      .then((data) => setActions(data.actions))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [lang]);

  const completed = actions.filter((action) => action.status === "COMPLETED").length;
  const dismissed = actions.filter((action) => action.status === "DISMISSED").length;
  const opened = actions.filter((action) => action.status === "OPENED").length;

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
              {lang === "sw" ? "Ona hatua ulizofungua, kukamilisha au kuacha." : "See actions you opened, completed, or dismissed."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
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
                      </div>
                      <p className="mt-2 font-semibold text-gray-950">{action.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {lang === "sw" ? "Mwisho kubadilishwa" : "Last updated"} {formatAppDateTime(action.updatedAt)}
                      </p>
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
