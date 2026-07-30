"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Star, Zap, Shield, Phone } from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import ProductProofSection from "@/components/marketing/ProductProofSection";
import WhatsAppCTA from "@/components/marketing/WhatsAppCTA";
import { TextReveal } from "@/components/ui/cascade-text";
import { t, useLang, setLanguage as setAppLanguage, type Lang } from "@/lib/i18n";

type LocalizedText = Record<Lang, string>;

interface Plan {
  id: "FREE_TRIAL" | "BASIC" | "PRO";
  name: LocalizedText;
  price: number;
  period: LocalizedText;
  color: string;
  badge?: LocalizedText;
  features: LocalizedText[];
  bestFor: LocalizedText;
  cta: LocalizedText;
  highlight: boolean;
}

const plans: Plan[] = [
  {
    id: "FREE_TRIAL",
    name: { sw: "Jaribio Bure", en: "Free Trial" },
    price: 0,
    period: { sw: "siku 14", en: "14 days" },
    color: "border-gray-200",
    features: [
      { sw: "Hifadhi ya bidhaa kamili", en: "Full inventory management" },
      { sw: "Mauzo ya POS na online", en: "POS and online sales" },
      { sw: "Ripoti za msingi", en: "Basic reports" },
      { sw: "Maagizo ya wasambazaji", en: "Supplier orders" },
      { sw: "Kiswahili na English", en: "Swahili and English" },
    ],
    bestFor: { sw: "Duka linalotaka kujaribu mfumo kabla ya kulipia.", en: "A shop that wants to try the system before paying." },
    cta: { sw: "Anza Bure", en: "Start Free" },
    highlight: false,
  },
  {
    id: "BASIC",
    name: { sw: "Msingi", en: "Basic" },
    price: 15000,
    period: { sw: "kwa mwezi", en: "per month" },
    color: "border-brand-300",
    badge: { sw: "Maarufu", en: "Popular" },
    features: [
      { sw: "Kila kitu katika Jaribio", en: "Everything in Trial" },
      { sw: "Bidhaa zisizo na kikomo", en: "Unlimited products" },
      { sw: "Dashboard ya faida, mauzo na malipo", en: "Profit, sales, and payment dashboard" },
      { sw: "Export ya mauzo na inventory (CSV)", en: "Sales and inventory export (CSV)" },
      { sw: "Msaada wa WhatsApp", en: "WhatsApp support" },
    ],
    bestFor: { sw: "Duka moja lenye bidhaa, mauzo, madeni na matumizi ya kila siku.", en: "One shop tracking products, sales, debts, and daily expenses." },
    cta: { sw: "Chagua Msingi", en: "Choose Basic" },
    highlight: true,
  },
  {
    id: "PRO",
    name: { sw: "Pro", en: "Pro" },
    price: 35000,
    period: { sw: "kwa mwezi", en: "per month" },
    color: "border-purple-300",
    badge: { sw: "Bora Zaidi", en: "Best Value" },
    features: [
      { sw: "Kila kitu katika Msingi", en: "Everything in Basic" },
      { sw: "Akaunti nyingi za wafanyakazi na permissions", en: "Multiple staff accounts and permissions" },
      { sw: "Ufuatiliaji wa wafanyakazi na historia ya hatua za AI", en: "Staff oversight and AI action history" },
      { sw: "AI priority workflows za kila siku", en: "AI priority workflows for daily actions" },
      { sw: "Msaada wa kipaumbele WhatsApp", en: "Priority WhatsApp support" },
    ],
    bestFor: { sw: "Biashara inayokua yenye wafanyakazi, reports na AI assistant ya maamuzi ya kila siku.", en: "A growing business with staff, reports, and an AI assistant for daily decisions." },
    cta: { sw: "Chagua Pro", en: "Choose Pro" },
    highlight: false,
  },
];

const competitors = [
  {
    name: "Uzuri Living",
    price: { sw: "TZS 15,000/mwezi", en: "TZS 15,000/month" },
    highlight: true,
  },
  {
    name: "QuickBooks POS",
    price: { sw: "TZS 150,000+/mwezi", en: "TZS 150,000+/month" },
    highlight: false,
  },
  {
    name: "Tally",
    price: { sw: "TZS 80,000+/mwezi", en: "TZS 80,000+/month" },
    highlight: false,
  },
  {
    name: "iKhokha",
    price: { sw: "TZS 50,000+/mwezi", en: "TZS 50,000+/month" },
    highlight: false,
  },
];

const faqs = [
  {
    q: { sw: "Je, ninahitaji kadi ya benki kuanza?", en: "Do I need a bank card to start?" },
    a: { sw: "Hapana. Jaribu siku 14 bila malipo yoyote.", en: "No. Try free for 14 days with no payment required." },
  },
  {
    q: { sw: "Malipo yanafanywa vipi?", en: "How do I pay?" },
    a: { sw: "Kwanza tumia M-Pesa Lipa Number 52806296 jina Necuva Group Limited. Pili tumia Mix by Yas Lipa Number 18214626 jina Necuva. Au tuma pesa 0743910580, kisha weka reference au tuma WhatsApp.", en: "First use M-Pesa Lipa Number 52806296, name Necuva Group Limited. Second use Mix by Yas Lipa Number 18214626, name Necuva. Or send money to 0743910580, then submit the reference or WhatsApp proof." },
  },
  {
    q: { sw: "Ninaweza kubadilisha mpango?", en: "Can I upgrade or downgrade?" },
    a: { sw: "Ndiyo, wakati wowote. Tofauti itahesabiwa kulingana na muda uliobaki.", en: "Yes, anytime. The difference is prorated." },
  },
  {
    q: { sw: "Data yangu iko salama?", en: "Is my data safe?" },
    a: { sw: "Ndiyo. Data inahifadhiwa kwenye seva salama na ina backup.", en: "Yes. Your data is stored securely and backed up." },
  },
];

const copy = {
  home: { sw: "Nyumbani", en: "Home" },
  signIn: { sw: "Ingia", en: "Sign in" },
  freeBadge: { sw: "Jaribio la siku 14 BURE - hakuna kadi ya benki", en: "14-day FREE trial - no bank card needed" },
  title: { sw: "Bei Rahisi kwa Biashara ya Tanzania", en: "Simple Pricing for Tanzanian Businesses" },
  subtitle: { sw: "Hakuna gharama zilizofichwa. Chagua mpango unaolingana na duka lako.", en: "No hidden fees. Choose the plan that fits your shop." },
  free: { sw: "BURE", en: "FREE" },
  for: { sw: "kwa", en: "for" },
  comparison: { sw: "Uzuri Living dhidi ya washindani", en: "Uzuri Living compared to competitors" },
  app: { sw: "Programu", en: "App" },
  price: { sw: "Bei", en: "Price" },
  swahili: { sw: "Kiswahili", en: "Swahili" },
  tanzania: { sw: "Tanzania", en: "Tanzania" },
  us: { sw: "Sisi", en: "Us" },
  no: { sw: "Hapana", en: "No" },
  ctaTitle: { sw: "Anza Leo - Bure kwa Siku 14", en: "Start Today - Free for 14 Days" },
  ctaSubtitle: { sw: "Fungua akaunti bila kadi ya benki.", en: "Create an account with no bank card needed." },
  register: { sw: "Jisajili Bure", en: "Register Free" },
  contactSales: { sw: "Ongea WhatsApp", en: "Talk on WhatsApp" },
  bestFor: { sw: "Inafaa kwa", en: "Best for" },
  includes: { sw: "Inajumuisha", en: "Includes" },
};

function getPricingInitialLang(): Lang | null {
  if (typeof window === "undefined") {
    return null;
  }

  const requestedLang = new URLSearchParams(window.location.search).get("lang");
  return requestedLang === "sw" || requestedLang === "en" ? requestedLang : null;
}

export default function PricingPage() {
  const globalLang = useLang();
  const [selectedLang, setSelectedLang] = useState<Lang | null>(() => {
    return null;
  });
  const lang = selectedLang || globalLang;
  const formatTZS = (amount: number) => `TZS ${amount.toLocaleString("en-TZ")}`;

  useEffect(() => {
    const requestedLang = getPricingInitialLang();
    if (requestedLang) {
      setSelectedLang(requestedLang);
      setAppLanguage(requestedLang);
    }
  }, []);

  function updateLanguage(nextLang: Lang) {
    setSelectedLang(nextLang);
    setAppLanguage(nextLang);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white">
      <nav className="px-4 py-4 flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-xl font-bold text-brand-700">
          <LogoMark className="h-9 w-9 rounded-xl" />
          Uzuri Living
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            <Link
              href="/pricing?lang=sw"
              onClick={() => updateLanguage("sw")}
              className={`px-2 py-1 rounded-md text-xs font-semibold min-h-0 ${lang === "sw" ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {t("app.swahili", lang)}
            </Link>
            <Link
              href="/pricing?lang=en"
              onClick={() => updateLanguage("en")}
              className={`px-2 py-1 rounded-md text-xs font-semibold min-h-0 ${lang === "en" ? "bg-brand-600 text-white" : "text-gray-500 hover:text-gray-900"}`}
            >
              {t("app.english", lang)}
            </Link>
          </div>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">
            {copy.home[lang]}
          </Link>
          <Link href="/contact" className="hidden sm:inline text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5">
            {lang === "sw" ? "Mawasiliano" : "Contact"}
          </Link>
          <Link href="/" className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700">
            {copy.signIn[lang]}
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="text-center py-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Zap className="w-3 h-3" />
            {copy.freeBadge[lang]}
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            <TextReveal text={lang === "sw" ? "Bei Rahisi" : "Simple Pricing"} fontSize="inherit" hoverColor="#15803d" />
            <span className="block sm:inline">
              {lang === "sw" ? " kwa Biashara ya Tanzania" : " for Tanzanian Businesses"}
            </span>
          </h1>
          <p className="text-gray-500 text-sm">{copy.subtitle[lang]}</p>
        </div>

        <section className="mb-8 grid gap-3 rounded-2xl border border-green-200 bg-white p-4 shadow-sm md:grid-cols-3">
          {[
            ["M-Pesa Lipa", "52806296", "Necuva Group Limited"],
            ["Mix by Yas", "18214626", "Necuva"],
            [lang === "sw" ? "Tuma pesa / WhatsApp" : "Send money / WhatsApp", "0743910580", lang === "sw" ? "Tuma reference kwa admin" : "Send reference to admin"],
          ].map(([label, value, note], index) => (
            <div key={label} className="rounded-xl border border-green-100 bg-green-50 p-3 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-green-700">{index + 1}. {label}</p>
              <p className="mt-1 text-2xl font-black text-gray-950">{value}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{note}</p>
            </div>
          ))}
        </section>

        <div className="mb-12">
          <ProductProofSection />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border-2 ${plan.color} p-6 relative ${
                plan.highlight ? "shadow-lg shadow-brand-100" : ""
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    {plan.badge[lang]}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h2 className="text-lg font-bold text-gray-900">{plan.name[lang]}</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  <span className="font-semibold text-gray-700">{copy.bestFor[lang]}:</span> {plan.bestFor[lang]}
                </p>
              </div>

              <div className="mb-6">
                {plan.price === 0 ? (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">{copy.free[lang]}</span>
                    <p className="text-xs text-gray-500 mt-1">
                      {copy.for[lang]} {plan.period[lang]}
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-3xl font-bold text-gray-900">{formatTZS(plan.price)}</span>
                    <p className="text-xs text-gray-500 mt-1">{plan.period[lang]}</p>
                  </div>
                )}
              </div>

              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{copy.includes[lang]}</p>
              <ul className="space-y-2.5 mb-6">
                {plan.features.map((feature) => (
                  <li key={feature.en} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{feature[lang]}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-brand-600 text-white hover:bg-brand-700"
                    : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                }`}
              >
                {plan.cta[lang]}
              </Link>
              <a
                href={`https://wa.me/255743910580?text=${encodeURIComponent(`Nataka kujua kuhusu mpango wa ${plan.name.sw} wa Uzuri Living`)}`}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-green-300 hover:text-green-700"
              >
                <Phone className="h-4 w-4" />
                {copy.contactSales[lang]}
              </a>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-10">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-brand-600" />
            {copy.comparison[lang]}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-gray-600 font-medium">{copy.app[lang]}</th>
                  <th className="text-left py-2 text-gray-600 font-medium">{copy.price[lang]}</th>
                  <th className="text-left py-2 text-gray-600 font-medium">{copy.swahili[lang]}</th>
                  <th className="text-left py-2 text-gray-600 font-medium">{copy.tanzania[lang]}</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((competitor) => (
                  <tr key={competitor.name} className={`border-b border-gray-50 ${competitor.highlight ? "bg-brand-50" : ""}`}>
                    <td className="py-2 pr-4 font-medium text-gray-900">
                      {competitor.name}
                      {competitor.highlight && (
                        <span className="ml-2 text-xs bg-brand-600 text-white px-1.5 py-0.5 rounded">{copy.us[lang]}</span>
                      )}
                    </td>
                    <td className={`py-2 ${competitor.highlight ? "text-brand-700 font-bold" : "text-gray-600"}`}>
                      {competitor.price[lang]}
                    </td>
                    <td className="py-2">
                      {competitor.highlight ? <Check className="w-4 h-4 text-green-500" /> : <span className="text-red-400 text-xs">{copy.no[lang]}</span>}
                    </td>
                    <td className="py-2">
                      {competitor.highlight ? <Check className="w-4 h-4 text-green-500" /> : <span className="text-red-400 text-xs">{copy.no[lang]}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-10">
          <section className="bg-white rounded-2xl border border-green-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">{lang === "sw" ? "Jinsi ya kulipa" : "How payment works"}</h2>
            <p className="text-sm leading-6 text-gray-600">
              {lang === "sw"
                ? "Chagua plan, lipa kwa Lipa Number rasmi, kisha weka reference kwenye Billing au tuma screenshot WhatsApp. Admin atahakiki na kuactivate mpango wako."
                : "Choose a plan, pay through an official Lipa Number, then submit the reference in Billing or send a WhatsApp screenshot. Admin verifies and activates your plan."}
            </p>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                <p className="font-bold text-gray-950">1. M-Pesa Lipa Number: 52806296</p>
                <p className="text-gray-600">{lang === "sw" ? "Jina" : "Name"}: Necuva Group Limited</p>
              </div>
              <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                <p className="font-bold text-gray-950">2. Mix by Yas Lipa Number: 18214626</p>
                <p className="text-gray-600">{lang === "sw" ? "Jina" : "Name"}: Necuva</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <p className="font-bold text-gray-950">3. {lang === "sw" ? "Tuma pesa" : "Send money"}: 0743910580</p>
                <p className="text-gray-600">{lang === "sw" ? "Weka reference au tuma ujumbe WhatsApp 0743910580." : "Submit the reference or send a WhatsApp message to 0743910580."}</p>
              </div>
            </div>
            <Link href="/billing" className="mt-4 inline-flex rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white hover:bg-green-700">
              {lang === "sw" ? "Weka payment reference" : "Submit payment reference"}
            </Link>
          </section>
          <section className="bg-white rounded-2xl border border-brand-200 p-6">
            <h2 className="text-base font-bold text-gray-900 mb-2">{lang === "sw" ? "Kwa nini Uzuri Living" : "Why Uzuri Living"}</h2>
            <p className="text-sm leading-6 text-gray-600">
              {lang === "sw"
                ? "Uzuri Living si POS tu. Ni AI assistant inayokuambia cha kufanya: agiza bidhaa, fuatilia deni, punguza gharama, na promote bidhaa yenye margin."
                : "Uzuri Living is not just POS. It is an AI assistant that tells you what to do: restock, collect debt, reduce costs, and promote high-margin products."}
            </p>
            <Link href="/assistant" className="mt-4 inline-flex rounded-xl border border-brand-200 px-5 py-3 text-sm font-bold text-brand-700 hover:bg-brand-50">
              {lang === "sw" ? "Ona AI Assistant" : "See AI Assistant"}
            </Link>
          </section>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {faqs.map((faq) => (
            <div key={faq.q.en} className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-900 text-sm mb-2">{faq.q[lang]}</p>
              <p className="text-sm text-gray-700">{faq.a[lang]}</p>
            </div>
          ))}
        </div>

        <div className="bg-brand-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-xl font-bold mb-2">
            <TextReveal text={copy.ctaTitle[lang]} fontSize="inherit" hoverColor="#dcfce7" />
          </h2>
          <p className="text-brand-200 text-sm mb-6">{copy.ctaSubtitle[lang]}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="bg-white text-brand-700 font-bold px-6 py-3 rounded-xl hover:bg-brand-50 transition-colors"
            >
              {copy.register[lang]}
            </Link>
            <WhatsAppCTA
              intent="pricing"
              label="WhatsApp: +255 743 910 580"
              className="bg-green-500 hover:bg-green-600"
            />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <Link href="/about" className="hover:text-brand-700">{lang === "sw" ? "Kuhusu" : "About"}</Link>
          <Link href="/contact" className="hover:text-brand-700">{lang === "sw" ? "Mawasiliano" : "Contact"}</Link>
          <Link href="/help" className="hover:text-brand-700">{lang === "sw" ? "Msaada" : "Help"}</Link>
          <Link href="/demo" className="hover:text-brand-700">Demo</Link>
          <Link href="/terms" className="hover:text-brand-700">{lang === "sw" ? "Masharti" : "Terms"}</Link>
          <Link href="/privacy" className="hover:text-brand-700">{lang === "sw" ? "Faragha" : "Privacy"}</Link>
        </div>
      </div>
    </div>
  );
}
