"use client";

import PublicPageShell from "@/components/marketing/PublicPageShell";
import WhatsAppCTA from "@/components/marketing/WhatsAppCTA";
import { TextReveal } from "@/components/ui/cascade-text";
import { TheInfiniteGrid } from "@/components/ui/the-infinite-grid";
import { useLang } from "@/lib/i18n";

export default function AboutPage() {
  const lang = useLang();

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <TheInfiniteGrid lang={lang} />

        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: lang === "sw" ? "Udhibiti" : "Control",
              body: lang === "sw" ? "Jua kinachouzwa, kinachobaki, na kinachohitaji kuagizwa." : "Know what sold, what remains, and what needs reordering.",
            },
            {
              title: lang === "sw" ? "Fedha" : "Money",
              body: lang === "sw" ? "Tenganisha mauzo, faida, matumizi, na madeni ya wateja." : "Separate sales, profit, expenses, and customer credit.",
            },
            {
              title: lang === "sw" ? "Msaidizi wa AI" : "AI assistant",
              body: lang === "sw" ? "Uzuri Living inalenga kukupa tahadhari na ushauri unaotokana na data ya duka lako." : "Uzuri Living is positioned to turn shop data into alerts and practical recommendations.",
            },
          ].map((item) => (
            <section key={item.title} className="rounded-lg border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-950">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.body}</p>
            </section>
          ))}
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700">
            <TextReveal text="Uzuri Living" fontSize="inherit" hoverColor="#15803d" />
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-normal text-gray-950">
            {lang === "sw" ? "Rubani wa duka lako la kila siku" : "The daily pilot for your shop"}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
            {lang === "sw"
              ? "Uzuri Living husaidia wafanyabiashara Tanzania kufuatilia bidhaa, mauzo, madeni, matumizi, maagizo na wafanyakazi kwa lugha wanayoitumia kazini."
              : "Uzuri Living helps Tanzanian merchants track inventory, sales, debts, expenses, orders, and staff in the language they use at work."}
          </p>
          <div className="mt-6">
            <WhatsAppCTA intent="about" label={lang === "sw" ? "Uliza kama inafaa duka langu" : "Ask if it fits my shop"} />
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
