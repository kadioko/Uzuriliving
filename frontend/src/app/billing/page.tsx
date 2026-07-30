"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { CheckCircle2, MessageCircle, ReceiptText, Send, Smartphone } from "lucide-react";

interface SubscriptionStatus {
  plan: string;
  isActive: boolean;
  status: string;
  trialActive?: boolean;
  subActive?: boolean;
  daysLeft: number | null;
  trialEndsAt?: string | null;
  subscriptionEndsAt?: string | null;
  reminderStage?: string | null;
}

const plans = [
  { id: "BASIC", amount: 15000, label: "Basic", includes: "Sales, stock, debts, expenses, catalog" },
  { id: "PRO", amount: 35000, label: "Pro", includes: "Everything in Basic plus staff, reports, AI priority workflows" },
];

const paymentOptions = [
  {
    id: "MPESA_LIPA",
    title: "M-Pesa Lipa Number",
    value: "52806296",
    name: "Necuva Group Limited",
  },
  {
    id: "MIX_YAS_LIPA",
    title: "Mix by Yas Lipa Number",
    value: "18214626",
    name: "Necuva",
  },
  {
    id: "SEND_MONEY",
    title: "Send Money",
    value: "0743910580",
    name: "Uzuri Living support",
  },
];

interface BillingReport {
  id: string;
  title: string;
  status: string;
  adminNotes?: string | null;
  createdAt: string;
}

export default function BillingPage() {
  const lang = useLang();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [plan, setPlan] = useState("BASIC");
  const [paymentOption, setPaymentOption] = useState(paymentOptions[0].id);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [reports, setReports] = useState<BillingReport[]>([]);
  const selectedPlan = plans.find((item) => item.id === plan) || plans[0];
  const subscriptionActive = Boolean(status?.isActive && (status?.trialActive || status?.subActive || status?.status === "active"));

  useEffect(() => {
    api.get<SubscriptionStatus>("/subscription/status", lang).then(setStatus).catch(() => null);
    api.get<{ reports: BillingReport[] }>("/reports/my?type=BILLING&limit=5", lang).then((data) => setReports(data.reports)).catch(() => null);
  }, [lang]);

  async function submitReference(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!reference.trim()) {
      setMessage(lang === "sw" ? "Weka reference au namba ya muamala." : "Enter the payment reference or transaction number.");
      return;
    }
    const selectedPaymentOption = paymentOptions.find((item) => item.id === paymentOption) || paymentOptions[0];
    await api.post("/reports", {
      type: "BILLING",
      priority: "HIGH",
      title: `Subscription payment ${plan} ${reference.trim()}`,
      description: `Plan: ${plan}\nAmount: ${formatTZS(selectedPlan.amount)}\nPayment option: ${selectedPaymentOption.title} ${selectedPaymentOption.value} (${selectedPaymentOption.name})\nReference: ${reference.trim()}\nNote: ${note.trim() || "-"}`,
    }, lang);
    setReference("");
    setNote("");
    const latest = await api.get<{ reports: BillingReport[] }>("/reports/my?type=BILLING&limit=5", lang).catch(() => null);
    if (latest) setReports(latest.reports);
    setMessage(lang === "sw" ? "Tumepokea reference. Admin atahakiki na kuactivate mpango." : "Reference received. Admin will verify and activate the plan.");
  }

  const selectedPaymentOption = paymentOptions.find((item) => item.id === paymentOption) || paymentOptions[0];
  const waText = encodeURIComponent(`Uzuri Living payment\nPlan: ${plan}\nAmount: ${formatTZS(selectedPlan.amount)}\nPaid via: ${selectedPaymentOption.title} ${selectedPaymentOption.value}\nReference: ${reference || "(nitaweka baada ya kulipa)"}`);
  const reminderCopy: Record<string, string> = {
    DUE_7_DAYS: lang === "sw" ? "Plan yako inaisha ndani ya siku 7. Lipa mapema ili huduma isiingiliwe." : "Your plan ends in 7 days. Pay early to avoid interruption.",
    DUE_3_DAYS: lang === "sw" ? "Plan yako inaisha ndani ya siku 3. Tuma malipo na reference." : "Your plan ends in 3 days. Send payment and submit the reference.",
    DUE_1_DAY: lang === "sw" ? "Plan yako inaisha kesho au leo. Lipa sasa ili duka lisizuiwe." : "Your plan ends today or tomorrow. Pay now to keep the shop active.",
    EXPIRED: lang === "sw" ? "Subscription imeisha. Admin akithibitisha malipo, duka litarudi active." : "Subscription expired. Once admin verifies payment, the shop becomes active again.",
    SUSPENDED: lang === "sw" ? "Duka limesimamishwa. Wasiliana na support ili kulirudisha." : "Shop is suspended. Contact support to reactivate it.",
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-5 pb-24 lg:pb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-950">{lang === "sw" ? "Malipo na usajili" : "Billing and subscription"}</h1>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            {lang === "sw"
              ? "Lipia kwa Lipa Number au tuma pesa, weka reference, kisha admin atahakiki na kuactivate mpango wako."
              : "Pay by Lipa Number or send money, submit the reference, and an admin will verify and activate your plan."}
          </p>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{lang === "sw" ? "Mpango" : "Plan"}</p>
            <p className="mt-1 text-lg font-bold text-gray-950">{status?.plan || "FREE_TRIAL"}</p>
            <p className="text-xs text-gray-500">{status?.status || "checking"}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{lang === "sw" ? "Hali" : "Status"}</p>
            <p className={`mt-1 text-lg font-bold ${subscriptionActive ? "text-green-700" : "text-red-700"}`}>
              {subscriptionActive ? (lang === "sw" ? "Active" : "Active") : (lang === "sw" ? "Inahitaji malipo" : "Payment needed")}
            </p>
            <p className="text-xs text-gray-500">{status?.daysLeft !== null && status?.daysLeft !== undefined ? `${status.daysLeft} days left` : "-"}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <MessageCircle className="h-5 w-5 text-green-700" />
            <p className="mt-2 text-sm font-semibold text-green-950">WhatsApp +255 743 910 580</p>
            <a href={`https://wa.me/255743910580?text=${waText}`} className="mt-2 inline-flex text-sm font-bold text-green-800 hover:text-green-950">
              {lang === "sw" ? "Tuma ujumbe" : "Send message"}
            </a>
          </div>
        </section>

        {status?.reminderStage && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>{lang === "sw" ? "Kumbusho:" : "Reminder:"}</strong> {reminderCopy[status.reminderStage] || status.reminderStage}
          </section>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          {[
            [lang === "sw" ? "1. Chagua njia ya kulipa" : "1. Choose payment option", lang === "sw" ? "Tumia M-Pesa Lipa, Mix by Yas Lipa, au tuma pesa." : "Use M-Pesa Lipa, Mix by Yas Lipa, or send money."],
            [lang === "sw" ? "2. Weka reference" : "2. Submit reference", lang === "sw" ? "Weka namba ya muamala au tuma screenshot WhatsApp." : "Enter the transaction reference or send a screenshot on WhatsApp."],
            [lang === "sw" ? "3. Admin anaactivate" : "3. Admin activates", lang === "sw" ? "Baada ya kuthibitisha, plan yako inaanza." : "After verification, your plan becomes active."],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-950">{title}</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-5 w-5 text-brand-700" />
            <div>
              <h2 className="font-semibold text-gray-950">{lang === "sw" ? "Njia rasmi za kulipa" : "Official payment options"}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {lang === "sw"
                  ? "Tumia njia hizi kwa mpangilio huu. Baada ya kulipa, weka reference hapa chini au tuma screenshot/ujumbe WhatsApp kwenda 0743910580."
                  : "Use these options in this order. After paying, submit the reference below or send a screenshot/message on WhatsApp to 0743910580."}
              </p>
              <div className="mt-3 grid gap-2">
                {paymentOptions.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPaymentOption(option.id)}
                    className={`rounded-lg border p-3 text-left text-sm ${paymentOption === option.id ? "border-green-500 bg-green-50" : "border-gray-200 bg-white"}`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{index + 1}</span>
                    <span className="ml-2 font-bold text-gray-950">{option.title}</span>
                    <span className="mt-1 block text-lg font-black text-gray-950">{option.value}</span>
                    <span className="block text-xs leading-5 text-gray-500">{lang === "sw" ? "Jina" : "Name"}: {option.name}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {plans.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlan(item.id)}
                    className={`rounded-lg border p-3 text-left text-sm ${plan === item.id ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"}`}
                  >
                    <span className="font-bold text-gray-950">{item.label}</span>
                    <span className="ml-2 text-gray-600">{formatTZS(item.amount)}/month</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">{item.includes}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={submitReference} className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-brand-700" />
            <h2 className="font-semibold text-gray-950">{lang === "sw" ? "Weka payment reference" : "Submit payment reference"}</h2>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-950">
            <strong>{lang === "sw" ? "Ulichagua" : "Selected"}:</strong> {selectedPaymentOption.title} {selectedPaymentOption.value} - {selectedPaymentOption.name}
          </div>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={lang === "sw" ? "Mfano: QF123ABC45" : "Example: QF123ABC45"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={lang === "sw" ? "Maelezo ya ziada, hiari" : "Extra note, optional"}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${message.includes("received") || message.includes("Tumepokea") ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
              {message}
            </p>
          )}
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white hover:bg-brand-700">
            <Send className="h-4 w-4" />
            {lang === "sw" ? "Tuma kwa admin" : "Send to admin"}
          </button>
        </form>

        {reports.length > 0 && (
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="font-semibold text-gray-950">{lang === "sw" ? "Maombi ya malipo" : "Payment requests"}</h2>
            <div className="mt-3 grid gap-2">
              {reports.map((report) => (
                <div key={report.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900">{report.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      report.status === "RESOLVED" ? "bg-green-100 text-green-700" :
                      report.status === "REJECTED" ? "bg-red-100 text-red-700" :
                      "bg-amber-100 text-amber-700"
                    }`}>{report.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{new Date(report.createdAt).toLocaleString()}</p>
                  {report.adminNotes && <p className="mt-1 text-xs text-gray-600">{report.adminNotes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
          <div className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <p>
              {lang === "sw"
                ? "Admin ataona ombi hili kwenye Reports, atalinganisha reference ya M-Pesa, kisha ataweka Paid Basic/Pro kwenye Admin > Subscriptions."
                : "Admin sees this request in Reports, matches the M-Pesa reference, then marks Paid Basic/Pro in Admin > Subscriptions."}
            </p>
          </div>
        </section>

        <Link href="/pricing" className="inline-flex text-sm font-semibold text-brand-700 hover:text-brand-900">
          {lang === "sw" ? "Angalia bei zote" : "View all pricing"}
        </Link>
      </div>
    </AppShell>
  );
}
