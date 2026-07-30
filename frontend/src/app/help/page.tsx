"use client";

import Link from "next/link";
import { BookOpen, CheckCircle2, MessageCircle, Search, Sparkles } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import ProductProofSection from "@/components/marketing/ProductProofSection";
import WhatsAppCTA from "@/components/marketing/WhatsAppCTA";
import { TextReveal } from "@/components/ui/cascade-text";
import { TheInfiniteGrid } from "@/components/ui/the-infinite-grid";
import { useLang } from "@/lib/i18n";

export default function HelpPage() {
  const lang = useLang();
  const faqs = [
    [lang === "sw" ? "Ninaanzaje?" : "How do I start?", lang === "sw" ? "Jisajili, kamilisha duka, ongeza bidhaa chache, kisha rekodi mauzo ya kwanza." : "Register, complete shop setup, add a few products, then record your first sale."],
    [lang === "sw" ? "Nawezaje kushare catalog?" : "How do I share the catalog?", lang === "sw" ? "Fungua Catalog, chagua duka lako, kisha tuma link kwa WhatsApp au mitandao mingine." : "Open Catalog, choose your shop, then send the link on WhatsApp or other channels."],
    [lang === "sw" ? "Staff wanaingiaje?" : "How do staff sign in?", lang === "sw" ? "Owner anaongeza staff, simu na PIN kwenye ukurasa wa Staff. Staff hutumia simu na PIN kuingia." : "The owner adds staff, phone, and PIN on the Staff page. Staff use that phone and PIN to sign in."],
    [lang === "sw" ? "Offline inafanya kazi?" : "Does offline work?", lang === "sw" ? "Ukurasa wa Sales unaweza kuhifadhi mauzo kwenye browser ukiwa offline na kuyasawazisha internet ikirudi. Kagua sync history kwa hitilafu za stock." : "The Sales page can save sales locally while offline and sync them when internet returns. Check sync history for stock conflict errors."],
    [lang === "sw" ? "Ninalipaje subscription?" : "How do I pay for subscription?", lang === "sw" ? "Njia ya kwanza: M-Pesa Lipa Number 52806296 jina Necuva Group Limited. Njia ya pili: Mix by Yas Lipa Number 18214626 jina Necuva. Njia ya tatu: tuma pesa 0743910580. Baada ya kulipa, weka reference kwenye Billing au tuma WhatsApp 0743910580." : "First option: M-Pesa Lipa Number 52806296, name Necuva Group Limited. Second option: Mix by Yas Lipa Number 18214626, name Necuva. Third option: send money to 0743910580. After paying, submit the reference in Billing or WhatsApp 0743910580."],
    [lang === "sw" ? "Nitajuaje malipo yamekubaliwa?" : "How do I know payment was confirmed?", lang === "sw" ? "Billing inaonyesha maombi yako ya malipo na status. Admin akithibitisha, plan itaonekana active." : "Billing shows your payment requests and status. Once admin confirms, your plan shows active."],
    [lang === "sw" ? "AI Assistant inanisaidiaje?" : "How does the AI Assistant help?", lang === "sw" ? "Inapanga hatua za leo kama kuagiza bidhaa, kufuatilia madeni, kupunguza gharama na kushughulikia order." : "It ranks today's actions like restocking, following up debts, reducing costs, and handling orders."],
    [lang === "sw" ? "Nafutaje akaunti yangu?" : "How do I delete my account?", lang === "sw" ? "Fungua ukurasa wa Delete Account kuona hatua, aina ya data inayofutwa, na muda wa retention." : "Open the Delete Account page to see the steps, deleted data types, and retention period."],
  ];
  const walkthrough = [
    [lang === "sw" ? "Setup" : "Setup", lang === "sw" ? "Weka jina la duka, lugha, na mawasiliano." : "Set shop name, language, and contact details."],
    [lang === "sw" ? "Bidhaa" : "Products", lang === "sw" ? "Ongeza stock, bei ya kununua, bei ya kuuza, na supplier." : "Add stock, buying price, selling price, and supplier."],
    [lang === "sw" ? "Mauzo" : "Sales", lang === "sw" ? "Rekodi cash, M-Pesa, bank, au credit sale kwa simu." : "Record cash, M-Pesa, bank, or credit sales from the phone."],
    [lang === "sw" ? "Hatua za AI" : "AI actions", lang === "sw" ? "Fungua Assistant kuona cha kufanya leo." : "Open Assistant to see what to do today."],
  ];
  const aiThinking = [
    [
      lang === "sw" ? "1. Inasoma data" : "1. Reads shop data",
      lang === "sw" ? "Mauzo, stock, madeni, matumizi, order na staff activity." : "Sales, stock, debts, expenses, orders, and staff activity.",
    ],
    [
      lang === "sw" ? "2. Inatafuta hatari" : "2. Finds risk",
      lang === "sw" ? "Bidhaa kuisha, deni kukaa muda mrefu, matumizi kupanda, au siku bila mauzo." : "Low stock, old debts, rising expenses, or quiet sales days.",
    ],
    [
      lang === "sw" ? "3. Inapanga kipaumbele" : "3. Ranks priority",
      lang === "sw" ? "Kinachoweza kuathiri cash, faida au uaminifu wa mteja huja kwanza." : "Anything affecting cash, profit, or customer trust comes first.",
    ],
    [
      lang === "sw" ? "4. Inapendekeza hatua" : "4. Suggests action",
      lang === "sw" ? "Fuatilia deni, agiza bidhaa, punguza gharama au shughulikia order." : "Collect debt, restock, reduce costs, or handle pending orders.",
    ],
  ];

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <TheInfiniteGrid
          lang={lang}
          headline={lang === "sw" ? "Pata msaada wa kuendesha duka vizuri" : "Get help running your shop better"}
          body={lang === "sw"
            ? "Majibu ya haraka kwa setup, catalog, staff, offline sales, malipo na AI assistant. Ukikwama, WhatsApp support ipo karibu."
            : "Quick answers for setup, catalog links, staff, offline sales, payments, and the AI assistant. If you get stuck, WhatsApp support is close."}
          primaryCta={{ href: "/contact", label: lang === "sw" ? "Ongea na support" : "Talk to support" }}
          secondaryCta={{
            href: "https://wa.me/255743910580?text=Nahitaji%20msaada%20wa%20Uzuri%20Living",
            label: "WhatsApp support",
          }}
          features={walkthrough.map(([title, body]) => ({ title, description: body }))}
        />
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-center">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <BookOpen className="h-6 w-6" />
              </div>
              <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                <TextReveal text={lang === "sw" ? "Msaada" : "Help"} hoverColor="#15803d" />
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                {lang === "sw" ? "Majibu ya haraka kwa setup, catalog, staff, offline sales, malipo na AI assistant." : "Quick answers for setup, catalog links, staff, offline sales, payments, and the AI assistant."}
              </p>
            </div>
            <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
              <Sparkles className="h-5 w-5 text-brand-700" />
              <p className="mt-3 font-semibold text-brand-950">{lang === "sw" ? "Unakwama?" : "Stuck?"}</p>
              <p className="mt-2 text-sm leading-6 text-brand-900">
                {lang === "sw" ? "Tuma screenshot au swali kwa WhatsApp, tutakuongoza hatua kwa hatua." : "Send a screenshot or question on WhatsApp and we will guide you step by step."}
              </p>
              <WhatsAppCTA intent="help" label="WhatsApp support" className="mt-4 w-full" />
            </div>
          </div>
        </section>

        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Search className="h-5 w-5 flex-shrink-0 text-gray-400" />
          <p className="text-sm text-gray-600">
            {lang === "sw" ? "Maswali muhimu zaidi ya Uzuri Living yapo hapa chini." : "The most important Uzuri Living questions are answered below."}
          </p>
        </div>

        <ProductProofSection compact />

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-gray-950">{lang === "sw" ? "Product walkthrough ya haraka" : "Quick product walkthrough"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            {walkthrough.map(([title, body], index) => (
              <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">{index + 1}</span>
                <h3 className="mt-3 text-sm font-semibold text-gray-950">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-gray-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="bg-brand-900 p-6 text-white sm:p-8">
              <Sparkles className="h-6 w-6 text-brand-100" />
              <h2 className="mt-4 text-2xl font-black tracking-tight">
                <TextReveal
                  text={lang === "sw" ? "Jinsi Uzuri Living AI inavyofikiri" : "How Uzuri Living AI thinks"}
                  fontSize="inherit"
                  hoverColor="#bbf7d0"
                />
              </h2>
              <p className="mt-4 text-sm leading-6 text-brand-100">
                {lang === "sw"
                  ? "Lengo si kukuonyesha ripoti tu. Lengo ni kukuambia hatua inayofuata ili duka lisikwame."
                  : "The goal is not just to show reports. The goal is to tell you the next action before the shop gets stuck."}
              </p>
              <Link href="/assistant" className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-800 hover:bg-brand-50">
                {lang === "sw" ? "Fungua AI Assistant" : "Open AI Assistant"}
              </Link>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
              {aiThinking.map(([title, body]) => (
                <div key={title} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <h3 className="text-sm font-bold text-gray-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <section key={q} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-700" />
                <h2 className="font-semibold leading-6 text-gray-950">{q}</h2>
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-600">{a}</p>
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-gray-600">
            {lang === "sw" ? "Bado unahitaji msaada? Tupo tayari kukusaidia kuifanya Uzuri Living iwe tayari kwa duka lako." : "Still need help? We are ready to help make Uzuri Living work for your shop."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/contact" className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">
            {lang === "sw" ? "Ongea na support" : "Talk to support"}
          </Link>
          <WhatsAppCTA intent="help" label="WhatsApp +255 743 910 580" />
          </div>
        </div>
      </div>
    </PublicPageShell>
  );
}
