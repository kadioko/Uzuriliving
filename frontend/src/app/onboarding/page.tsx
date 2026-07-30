"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Languages, MessageCircle, PackagePlus, Settings, Share2, ShoppingCart, Users } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { useLang } from "@/lib/i18n";

const steps = [
  {
    icon: Settings,
    href: "/settings",
    sw: "Kamilisha taarifa za duka",
    en: "Complete shop setup",
    swBody: "Weka jina la duka, eneo, aina ya biashara, lugha na mawasiliano.",
    enBody: "Set shop name, location, business type, language, and contact details.",
  },
  {
    icon: PackagePlus,
    href: "/inventory",
    sw: "Ongeza bidhaa za kwanza",
    en: "Add first products",
    swBody: "Weka bei ya kununua, bei ya kuuza, stock na kiwango cha chini.",
    enBody: "Add buying price, selling price, stock level, and low-stock threshold.",
  },
  {
    icon: Users,
    href: "/staff",
    sw: "Ongeza mfanyakazi wa kwanza",
    en: "Add first staff member",
    swBody: "Weka cashier au manager na PIN yake ili majukumu yasichanganyike.",
    enBody: "Add a cashier or manager with a PIN so responsibilities stay clear.",
  },
  {
    icon: ShoppingCart,
    href: "/sales",
    sw: "Rekodi mauzo ya kwanza",
    en: "Record first sale",
    swBody: "Jaribu mauzo ya cash, M-Pesa au credit ili dashboard ianze kusoma biashara.",
    enBody: "Try a cash, M-Pesa, or credit sale so the dashboard starts reading the business.",
  },
  {
    icon: Share2,
    href: "/catalog",
    sw: "Share catalog link",
    en: "Share catalog link",
    swBody: "Tumia catalog kupokea order kutoka kwa wateja bila kuandika kila bidhaa WhatsApp.",
    enBody: "Use the catalog to receive customer orders without typing every product on WhatsApp.",
  },
  {
    icon: Languages,
    href: "/pricing",
    sw: "Chagua mpango na lugha",
    en: "Set pricing and language",
    swBody: "Hakiki mpango unaofaa, kisha tumia Kiswahili au English kwenye app.",
    enBody: "Review the right plan, then run the app in Swahili or English.",
  },
];

export default function OnboardingPage() {
  const lang = useLang();
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem("uzuriliving_onboarding_done") || "{}"));
    } catch {
      setDone({});
    }
  }, []);

  function toggleDone(href: string) {
    setDone((current) => {
      const next = { ...current, [href]: !current[href] };
      localStorage.setItem("uzuriliving_onboarding_done", JSON.stringify(next));
      return next;
    });
  }

  const completeCount = steps.filter((step) => done[step.href]).length;
  const referralText = encodeURIComponent(
    lang === "sw"
      ? "Nimeanza kutumia Uzuri Living kufuatilia stock, mauzo na madeni ya duka. Kama una duka, jaribu hapa: https://www.uzuriliving.com/ au tuma WhatsApp kwa support: https://wa.me/255743910580?text=Habari%20Uzuri%20Living%2C%20nimeletwa%20na%20rafiki%20na%20nataka%20setup%20ya%20duka%20langu.%20Aina%20ya%20duka%3A%20"
      : "I started using Uzuri Living to track shop stock, sales, and customer debts. If you run a shop, try it here: https://www.uzuriliving.com/ or WhatsApp support: https://wa.me/255743910580?text=Hello%20Uzuri%20Living%2C%20a%20friend%20referred%20me%20and%20I%20want%20shop%20setup%20help.%20Shop%20type%3A%20"
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-2xl bg-brand-700 p-6 text-white">
          <p className="text-sm font-semibold text-brand-100">Uzuri Living</p>
          <h1 className="mt-2 text-2xl font-bold">
            {lang === "sw" ? "Anzisha duka lako kwa hatua 5" : "Set up your shop in 5 steps"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-100">
            {lang === "sw"
              ? "Ukimaliza hatua hizi, Uzuri Living itaweza kukuonyesha mauzo, stock, madeni, matumizi na mapendekezo ya AI."
              : "Once these steps are done, Uzuri Living can show sales, stock, debts, expenses, and AI recommendations."}
          </p>
          <div className="mt-4 h-2 rounded-full bg-white/20">
            <div className="h-2 rounded-full bg-white" style={{ width: `${Math.round((completeCount / steps.length) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs font-semibold text-brand-100">
            {lang === "sw" ? `${completeCount}/${steps.length} zimekamilika` : `${completeCount}/${steps.length} complete`}
          </p>
        </section>

        <div className="grid gap-3">
          {steps.map((step, index) => (
            <div
              key={step.href}
              className={`group flex items-start gap-4 rounded-xl border bg-white p-4 transition-colors ${done[step.href] ? "border-green-200" : "border-gray-200 hover:border-brand-300"}`}
            >
              <button
                type="button"
                onClick={() => toggleDone(step.href)}
                aria-label={done[step.href] ? "Mark incomplete" : "Mark complete"}
                className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border min-h-0 ${done[step.href] ? "border-green-600 bg-green-600 text-white" : "border-gray-300 text-transparent"}`}
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <step.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                  {lang === "sw" ? `Hatua ${index + 1}` : `Step ${index + 1}`}
                </p>
                <h2 className="mt-1 font-semibold text-gray-950">{lang === "sw" ? step.sw : step.en}</h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">{lang === "sw" ? step.swBody : step.enBody}</p>
              </div>
              <Link href={step.href} className="mt-1 inline-flex rounded-lg p-2 text-gray-300 hover:bg-brand-50 hover:text-brand-600">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <section className="rounded-xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700" />
            <p className="text-sm leading-6 text-green-900">
              {lang === "sw"
                ? "Tip: ukiwa na bidhaa na mauzo machache tu, AI Assistant itaanza kutoa ushauri wa kuagiza bidhaa, kufuatilia madeni na kupunguza gharama."
                : "Tip: with just a few products and sales, the AI Assistant starts giving advice on restocking, debt follow-up, and cost control."}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Share2 className="mt-0.5 h-5 w-5 text-brand-700" />
              <div>
                <h2 className="font-semibold text-gray-950">
                  {lang === "sw" ? "Mlete mfanyabiashara mwenzako" : "Refer another shop owner"}
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600">
                  {lang === "sw"
                    ? "Ukimaliza setup, share ujumbe huu kwa rafiki mwenye duka. Akirekodi mauzo 10, unaweza kupata wiki 1 bure."
                    : "After setup, share this message with a shop owner friend. If they record 10 sales, you can get 1 free week."}
                </p>
              </div>
            </div>
            <a
              href={`https://wa.me/?text=${referralText}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800"
            >
              <MessageCircle className="h-4 w-4" />
              {lang === "sw" ? "Share WhatsApp" : "Share on WhatsApp"}
            </a>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
