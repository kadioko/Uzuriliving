"use client";

import Link from "next/link";
import { Clock, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import WhatsAppCTA from "@/components/marketing/WhatsAppCTA";
import { TextReveal } from "@/components/ui/cascade-text";
import { TheInfiniteGrid } from "@/components/ui/the-infinite-grid";
import { useLang } from "@/lib/i18n";

export default function ContactPage() {
  const lang = useLang();
  const whatsappSetupHref = `https://wa.me/255743910580?text=${encodeURIComponent(
    lang === "sw"
      ? "Habari Uzuri Living, nataka setup ya duka langu. Aina ya duka: "
      : "Hello Uzuri Living, I want help setting up my shop. Shop type: "
  )}`;
  const channels = [
    {
      Icon: MessageCircle,
      title: "WhatsApp",
      value: "+255 743 910 580",
      detail: lang === "sw" ? "Njia ya haraka kwa setup, malipo na support." : "Fastest for setup, payments, and support.",
      href: whatsappSetupHref,
    },
    {
      Icon: Phone,
      title: lang === "sw" ? "Simu" : "Phone",
      value: "+255 743 910 580",
      detail: lang === "sw" ? "Piga kwa maswali ya haraka ya biashara." : "Call for quick business questions.",
      href: "tel:+255743910580",
    },
    {
      Icon: Mail,
      title: "Email",
      value: "support@uzuriliving.com",
      detail: lang === "sw" ? "Tuma ujumbe rasmi au maelezo marefu." : "Send formal requests or longer details.",
      href: "mailto:support@uzuriliving.com",
    },
  ];

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <TheInfiniteGrid
          lang={lang}
          headline={lang === "sw" ? "Support ya Uzuri Living ipo karibu" : "Uzuri Living support is close"}
          body={lang === "sw"
            ? "Tuma swali, screenshot, payment reference au ombi la setup. Tutakusaidia bidhaa, mauzo, staff, catalog, billing na AI assistant."
            : "Send a question, screenshot, payment reference, or setup request. We help with products, sales, staff, catalog, billing, and the AI assistant."}
          primaryCta={{
            href: whatsappSetupHref,
            label: lang === "sw" ? "Tuma WhatsApp" : "Send WhatsApp",
          }}
          secondaryCta={{
            href: "mailto:support@uzuriliving.com",
            label: "Email support",
          }}
          features={channels.map(({ title, value, detail }) => ({
            title,
            description: `${value} - ${detail}`,
          }))}
        />
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <p className="text-sm font-semibold text-brand-700">
                <TextReveal text="Uzuri Living support" fontSize="inherit" hoverColor="#15803d" />
              </p>
              <h1 className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                {lang === "sw" ? "Wasiliana na watu wanaoelewa duka lako." : "Talk to people who understand your shop."}
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
                {lang === "sw"
                  ? "Tunakusaidia kuanza, kuchagua plan, kuweka bidhaa, kurekodi mauzo, staff, catalog na AI assistant."
                  : "We help with setup, pricing plans, products, sales, staff, catalog links, and the AI assistant."}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <WhatsAppCTA intent="contact" label="WhatsApp support" />
                <a href="mailto:support@uzuriliving.com" className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 hover:border-brand-300 hover:text-brand-800">
                  <Mail className="h-4 w-4" />
                  support@uzuriliving.com
                </a>
              </div>
            </div>
            <div className="border-t border-gray-100 bg-brand-900 p-6 text-white lg:border-l lg:border-t-0 sm:p-8 lg:p-10">
              <div className="grid gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <Clock className="h-5 w-5 text-brand-200" />
                  <p className="mt-3 text-sm font-semibold">{lang === "sw" ? "Majibu ya haraka" : "Fast responses"}</p>
                  <p className="mt-1 text-sm leading-6 text-brand-100">
                    {lang === "sw" ? "WhatsApp ndio njia bora kwa support ya leo." : "WhatsApp is the best channel for same-day support."}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <ShieldCheck className="h-5 w-5 text-brand-200" />
                  <p className="mt-3 text-sm font-semibold">{lang === "sw" ? "Kwa biashara Tanzania" : "For Tanzanian shops"}</p>
                  <p className="mt-1 text-sm leading-6 text-brand-100">
                    {lang === "sw" ? "Setup, malipo, madeni, bidhaa na staff kwa lugha unayopenda." : "Setup, payments, debts, products, and staff support in the language you prefer."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {channels.map(({ Icon, title, value, detail, href }) => (
            <a key={title} href={href} className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 font-semibold text-gray-950">{title}</p>
              <p className="mt-1 text-sm font-medium text-brand-700">{value}</p>
              <p className="mt-3 text-sm leading-6 text-gray-600">{detail}</p>
            </a>
          ))}
        </section>

        <section className="grid gap-4 rounded-3xl border border-green-200 bg-green-50 p-6 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <h2 className="text-lg font-bold text-green-950">{lang === "sw" ? "Built for shop owners in Tanzania" : "Built for Tanzanian shop owners"}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-green-900">
            {lang === "sw"
              ? "Tunasaidia duka kuanza haraka: bidhaa, mauzo, madeni, matumizi, staff, catalog na AI Assistant inayosema cha kufanya leo."
              : "We help shops get running fast: products, sales, debts, expenses, staff, catalog, and an AI Assistant that says what to do today."}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/help" className="inline-flex items-center justify-center rounded-xl bg-white px-5 py-3 text-sm font-bold text-green-800 hover:bg-green-100">
              {lang === "sw" ? "Soma msaada" : "Read help"}
            </Link>
            <WhatsAppCTA intent="contact" label={lang === "sw" ? "Nataka setup" : "I want setup"} />
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
