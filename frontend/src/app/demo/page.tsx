"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import ProductProofSection from "@/components/marketing/ProductProofSection";
import WhatsAppCTA from "@/components/marketing/WhatsAppCTA";
import { TextReveal } from "@/components/ui/cascade-text";
import { TheInfiniteGrid } from "@/components/ui/the-infinite-grid";
import { useLang } from "@/lib/i18n";

const accounts = [
  ["Merchant", "+255700000002", "Duka la Amina"],
  ["Cashier", "+255700000003", "Cashier demo"],
  ["Supplier", "+255700000001", "Jumla Traders"],
];

export default function DemoPage() {
  const lang = useLang();

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <TheInfiniteGrid
          lang={lang}
          headline={lang === "sw" ? "Jaribu demo kabla ya kuanza" : "Try the demo before you start"}
          body={lang === "sw"
            ? "Tumia akaunti za demo kuona mauzo, stock, maagizo, madeni, matumizi, staff, billing na AI Assistant. PIN zote ni 1234."
            : "Use demo accounts to see sales, stock, orders, debts, expenses, staff, billing, and the AI Assistant. All PINs are 1234."}
          primaryCta={{ href: "/", label: lang === "sw" ? "Fungua login" : "Open login" }}
          secondaryCta={{
            href: "https://wa.me/255743910580?text=Nataka%20setup%20baada%20ya%20demo%20ya%20Uzuri%20Living",
            label: lang === "sw" ? "Nataka setup" : "I want setup",
          }}
          features={[
            { title: "Merchant", description: lang === "sw" ? "Angalia duka kamili, dashboard, bidhaa na mauzo." : "Explore the full shop, dashboard, products, and sales." },
            { title: "Cashier", description: lang === "sw" ? "Jaribu role ya kuuza bila kubadilisha stock/settings." : "Try a sales role without stock/settings access." },
            { title: "Supplier", description: lang === "sw" ? "Ona upande wa supplier na bidhaa za jumla." : "See the supplier side and wholesale products." },
            { title: "AI Assistant", description: lang === "sw" ? "Fungua mapendekezo ya hatua za leo." : "Open the recommended actions for today." },
          ]}
        />
        <div>
          <h1 className="text-3xl font-bold text-gray-950">
            <TextReveal text={lang === "sw" ? "Demo ya Uzuri Living" : "Uzuri Living Demo"} hoverColor="#15803d" />
          </h1>
        </div>
        <section className="rounded-xl border border-brand-200 bg-brand-50 p-5">
          <h2 className="font-semibold text-brand-950">{lang === "sw" ? "Demo flows za kujaribu" : "Demo flows to try"}</h2>
          <div className="mt-3 grid gap-2 text-sm text-brand-900 sm:grid-cols-2">
            <p>{lang === "sw" ? "1. Rekodi sale, kisha angalia dashboard." : "1. Record a sale, then check the dashboard."}</p>
            <p>{lang === "sw" ? "2. Fungua AI Assistant uone hatua za leo." : "2. Open AI Assistant to see today's actions."}</p>
            <p>{lang === "sw" ? "3. Jaribu cashier kuona role limits." : "3. Try cashier to see role limits."}</p>
            <p>{lang === "sw" ? "4. Angalia Billing na payment reference." : "4. Check Billing and payment reference."}</p>
          </div>
        </section>
        <ProductProofSection />
        <div className="grid gap-3">
          {accounts.map(([role, phone, name]) => (
            <section key={phone} className="rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{role}</p>
              <h2 className="mt-1 font-semibold text-gray-950">{name}</h2>
              <p className="mt-1 text-sm text-gray-600">{phone} / 1234</p>
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700">
            {lang === "sw" ? "Fungua login" : "Open login"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <WhatsAppCTA intent="demo" label={lang === "sw" ? "Nataka setup baada ya demo" : "I want setup after demo"} />
        </div>
      </div>
    </PublicPageShell>
  );
}
