"use client";

import Image from "next/image";
import { Bot, ClipboardList, CreditCard, MessageCircle, PackageCheck, ReceiptText } from "lucide-react";
import { useLang } from "@/lib/i18n";

const proofCards = [
  {
    icon: ReceiptText,
    title: { sw: "Mauzo / POS", en: "Sales / POS" },
    body: { sw: "Rekodi mauzo kwa cash, M-Pesa, benki au credit.", en: "Record sales by cash, M-Pesa, bank, or credit." },
    rows: ["Sukari 1kg - TZS 3,200", "Maziwa fresh - TZS 2,500", "Faida: TZS 1,100"],
  },
  {
    icon: PackageCheck,
    title: { sw: "Stock", en: "Inventory" },
    body: { sw: "Ona bidhaa zilizo chini ya kiwango na agiza mapema.", en: "Spot low-stock products and reorder early." },
    rows: ["Mafuta 1L - 4 left", "Mchele 5kg - 2 left", "Alert: agiza leo"],
  },
  {
    icon: CreditCard,
    title: { sw: "Madeni", en: "Debts" },
    body: { sw: "Fuatilia deni la mteja na uweke malipo yakirudi.", en: "Track customer credit and mark payments when collected." },
    rows: ["Asha - TZS 18,000", "Salum - TZS 7,500", "Status: partial"],
  },
  {
    icon: MessageCircle,
    title: { sw: "Order za supplier", en: "Supplier orders" },
    body: { sw: "Tengeneza order na ujumbe tayari kutuma WhatsApp.", en: "Create an order with a WhatsApp-ready supplier message." },
    rows: ["Jumla Traders", "Bidhaa 6", "Tuma WhatsApp"],
  },
  {
    icon: Bot,
    title: { sw: "AI Assistant", en: "AI Assistant" },
    body: { sw: "Pata hatua za leo: agiza, fuatilia deni, punguza gharama.", en: "See today's actions: restock, collect debt, reduce costs." },
    rows: ["1. Agiza sukari", "2. Fuata deni la Asha", "3. Promote bidhaa yenye margin"],
  },
];

export default function ProductProofSection({ compact = false }: { compact?: boolean }) {
  const lang = useLang();

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="grid gap-7 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-bold text-brand-700">Uzuri Living</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
            {lang === "sw" ? "Ona kazi halisi kabla ya kuanza." : "See the real workflows before you start."}
          </h2>
          <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
            {lang === "sw"
              ? "Uzuri Living si bei tu. Hizi ndizo sehemu ambazo mfanyabiashara hutumia kila siku: dashboard, mauzo, stock, madeni, supplier orders na AI Assistant."
              : "Uzuri Living is more than pricing. These are the daily workflows a shop owner uses: dashboard, sales, inventory, debts, supplier orders, and the AI Assistant."}
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 p-3">
            <Image
              src="/marketing/phone-dashboard.png"
              alt={lang === "sw" ? "Screenshot ya dashboard ya Uzuri Living" : "Uzuri Living dashboard screenshot"}
              width={640}
              height={1138}
              className="h-72 w-full rounded-xl object-cover object-top sm:h-80"
            />
          </div>
        </div>

        <div className={`grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
          {proofCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.title.en} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-100">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-950">{card.title[lang]}</h3>
                    <p className="mt-1 text-sm leading-5 text-gray-600">{card.body[lang]}</p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                  {card.rows.map((row) => (
                    <div key={row} className="flex items-center gap-2 border-b border-gray-100 py-2 text-xs font-semibold text-gray-700 last:border-b-0">
                      <ClipboardList className="h-3.5 w-3.5 flex-shrink-0 text-brand-600" />
                      <span>{row}</span>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
