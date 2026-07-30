"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { MessageCircle } from "lucide-react";

interface Debt {
  id: string;
  customerName: string | null;
  customerPhone: string;
  amount: number;
  amountPaid: number;
  status: "OPEN" | "PARTIAL" | "PAID" | "CANCELLED";
  dueDate: string | null;
  note: string | null;
  payments?: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    paymentRef?: string | null;
    note?: string | null;
    createdAt: string;
  }>;
}

const INPUT = "rounded-xl border border-gray-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm";

export default function DebtsPage() {
  const lang = useLang();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [summary, setSummary] = useState({ openCount: 0, totalOwed: 0 });
  const [form, setForm] = useState({ customerName: "", customerPhone: "", amount: "", dueDate: "", note: "" });
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, string>>({});
  const [assistantPrefill, setAssistantPrefill] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ debts: Debt[]; summary: { openCount: number; totalOwed: number } }>("/debts", lang);
      setDebts(data.debts);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const customerName = params.get("customer") || "";
    const customerPhone = params.get("phone") || "";
    const amount = params.get("amount") || "";
    const note = params.get("note") || "";
    if (!customerName && !customerPhone && !amount && !note) return;
    setAssistantPrefill(true);
    setForm((prev) => ({
      ...prev,
      customerName: customerName || prev.customerName,
      customerPhone: customerPhone || prev.customerPhone,
      amount: amount || prev.amount,
      note: note || prev.note,
    }));
  }, []);

  async function addDebt(event: React.FormEvent) {
    event.preventDefault();
    await api.post("/debts", { ...form, amount: Number(form.amount) }, lang);
    setForm({ customerName: "", customerPhone: "", amount: "", dueDate: "", note: "" });
    setAssistantPrefill(false);
    await load();
  }

  async function recordPayment(debt: Debt, amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    await api.post(`/debts/${debt.id}/payments`, { amount }, lang);
    setPaymentDrafts((prev) => ({ ...prev, [debt.id]: "" }));
    await load();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-950">{lang === "sw" ? "Ufuatiliaji wa Madeni" : "Debt Tracking"}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {lang === "sw" ? "Fuatilia wateja waliokopa na malipo yao." : "Track customer credit and repayments."}
            </p>
          </div>
          <div className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <strong>{formatTZS(summary.totalOwed)}</strong> {lang === "sw" ? "bado kulipwa" : "still owed"} - {summary.openCount}
          </div>
        </div>

        {assistantPrefill && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <p className="font-semibold">
              {lang === "sw" ? "Uzuri Living imejaza deni hili kwa ajili ya ufuatiliaji." : "Uzuri Living prefilled this debt follow-up."}
            </p>
            <p className="mt-1 text-xs text-brand-700">
              {lang === "sw" ? "Hakiki taarifa, rekodi malipo, au tuma WhatsApp kwa mteja." : "Review the details, record a payment, or WhatsApp the customer."}
            </p>
          </div>
        )}

        <form onSubmit={addDebt} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-6">
          <input className={`${INPUT} md:col-span-2`} placeholder={lang === "sw" ? "Jina la mteja" : "Customer name"} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <input className={`${INPUT} md:col-span-2`} required placeholder={lang === "sw" ? "Simu" : "Phone"} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
          <input className={INPUT} required type="number" min="1" inputMode="numeric" placeholder={lang === "sw" ? "Kiasi" : "Amount"} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className={INPUT} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          <input className={`${INPUT} md:col-span-4`} placeholder={lang === "sw" ? "Maelezo (hiari)" : "Note (optional)"} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 md:col-span-2">
            {lang === "sw" ? "Ongeza" : "Add"}
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="p-6 text-sm text-gray-500">{lang === "sw" ? "Inapakia..." : "Loading..."}</div>
          ) : debts.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">{lang === "sw" ? "Hakuna madeni bado." : "No debts yet."}</div>
          ) : debts.map((debt) => {
            const balance = debt.amount - debt.amountPaid;
            return (
              <div key={debt.id} className="grid gap-3 border-b border-gray-100 p-4 last:border-b-0 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <p className="font-semibold text-gray-950">{debt.customerName || debt.customerPhone}</p>
                  <p className="text-sm text-gray-500">{debt.customerPhone} - {debt.status}</p>
                  {debt.note && <p className="mt-1 text-xs text-gray-500">{debt.note}</p>}
                  {debt.payments && debt.payments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {debt.payments.slice(0, 3).map((payment) => (
                        <span key={payment.id} className="rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
                          {formatTZS(payment.amount)} {payment.paymentMethod} - {new Date(payment.createdAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US")}
                        </span>
                      ))}
                    </div>
                  )}
                  {debt.dueDate && (
                    <p className="mt-1 text-xs text-amber-700">
                      {lang === "sw" ? "Mwisho" : "Due"} {new Date(debt.dueDate).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US")}
                    </p>
                  )}
                </div>
                <div className="text-sm lg:text-right">
                  <p className="font-semibold text-gray-950">{formatTZS(balance)}</p>
                  <p className="text-gray-500">{formatTZS(debt.amountPaid)} {lang === "sw" ? "imelipwa" : "paid"}</p>
                </div>
                {balance > 0 && debt.status !== "CANCELLED" && (
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      value={paymentDrafts[debt.id] || ""}
                      onChange={(e) => setPaymentDrafts((prev) => ({ ...prev, [debt.id]: e.target.value }))}
                      type="number"
                      min="1"
                      max={balance}
                      inputMode="numeric"
                      placeholder={lang === "sw" ? "Kiasi kilicholipwa" : "Amount paid"}
                      className={INPUT}
                    />
                    <button onClick={() => recordPayment(debt, Number(paymentDrafts[debt.id] || 0))} className="rounded-xl bg-brand-600 px-3 py-3 text-sm font-semibold text-white hover:bg-brand-700">
                      {lang === "sw" ? "Rekodi" : "Record"}
                    </button>
                    <button onClick={() => recordPayment(debt, balance)} className="rounded-xl border border-brand-600 px-3 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                      {lang === "sw" ? "Lipa yote" : "All paid"}
                    </button>
                    <a
                      href={`https://wa.me/${debt.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(lang === "sw" ? `Habari, kumbusho la deni lako ${formatTZS(balance)}.` : `Hello, reminder for your outstanding balance ${formatTZS(balance)}.`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 rounded-xl bg-green-100 px-3 py-3 text-sm font-semibold text-green-700 hover:bg-green-200 sm:col-span-3"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
