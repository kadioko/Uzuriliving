"use client";

import { Mail, MessageCircle, ShieldCheck, Trash2 } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { useLang } from "@/lib/i18n";

export default function DeleteAccountPage() {
  const lang = useLang();

  const steps = lang === "sw"
    ? [
        "Tuma ombi lako kupitia support@uzuriliving.com au WhatsApp +255 743 910 580.",
        "Tumia nambari ya simu ya akaunti yako ya Uzuri Living na jina la duka ili tukuthibitishe.",
        "Andika kama unataka kufuta akaunti yote, duka lote, au sehemu fulani ya data.",
        "Tutathibitisha ombi na kukamilisha ufutaji ndani ya siku 30, isipokuwa data inayotakiwa kuhifadhiwa kisheria au kwa usalama.",
      ]
    : [
        "Send your request to support@uzuriliving.com or WhatsApp +255 743 910 580.",
        "Include the phone number on your Uzuri Living account and your shop name so we can verify you.",
        "Tell us whether you want the full account deleted, the full shop deleted, or only certain data deleted.",
        "We will verify the request and complete deletion within 30 days, except for data we must keep for legal, security, or fraud-prevention reasons.",
      ];

  const deletedData = lang === "sw"
    ? [
        "Akaunti ya mtumiaji na taarifa za kuingia",
        "Taarifa za duka na staff",
        "Bidhaa, stock, mauzo, madeni, matumizi na maagizo",
        "Catalog ya umma na mipangilio ya duka",
      ]
    : [
        "User account and login information",
        "Shop and staff information",
        "Products, stock, sales, debts, expenses, and orders",
        "Public catalog and shop settings",
      ];

  const retainedData = lang === "sw"
    ? [
        "Rekodi ndogo za usalama, audit, malipo, au kodi zinaweza kubaki kwa hadi siku 90 au muda unaohitajika kisheria.",
        "Backups za mfumo zinaweza kuchukua hadi siku 90 kusafishwa kikamilifu.",
        "Ujumbe uliotumwa kupitia WhatsApp, SMS, email, au huduma za wahusika wengine unaweza kubaki kwenye huduma hizo kulingana na sera zao.",
      ]
    : [
        "Limited security, audit, payment, or tax records may be retained for up to 90 days or longer where legally required.",
        "System backups may take up to 90 days to fully age out.",
        "Messages sent through WhatsApp, SMS, email, or other third-party services may remain with those services under their own policies.",
      ];

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700 ring-1 ring-red-100">
            <Trash2 className="h-6 w-6" />
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
            {lang === "sw" ? "Futa akaunti yako ya Uzuri Living" : "Delete your Uzuri Living account"}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-gray-600 sm:text-base">
            {lang === "sw"
              ? "Ukurasa huu unaeleza jinsi ya kuomba kufuta akaunti yako na data inayohusiana na Uzuri Living."
              : "This page explains how to request deletion of your Uzuri Living account and associated data."}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="mailto:support@uzuriliving.com?subject=Delete%20my%20Uzuri%20Living%20account" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">
              <Mail className="h-4 w-4" />
              support@uzuriliving.com
            </a>
            <a href="https://wa.me/255743910580?text=Hello%20Uzuri%20Living%2C%20I%20want%20to%20request%20account%20or%20data%20deletion." className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 hover:border-brand-300 hover:text-brand-800">
              <MessageCircle className="h-4 w-4" />
              WhatsApp +255 743 910 580
            </a>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">{lang === "sw" ? "Hatua za kuomba ufutaji" : "Steps to request deletion"}</h2>
            <ol className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-6 text-gray-600">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-100">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-gray-950">{lang === "sw" ? "Data inayofutwa" : "Data deleted"}</h2>
            <ul className="mt-4 space-y-3">
              {deletedData.map((item) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-gray-600">
                  <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-700" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-bold text-amber-950">{lang === "sw" ? "Data inayoweza kubaki kwa muda" : "Data that may be retained temporarily"}</h2>
          <ul className="mt-4 space-y-2">
            {retainedData.map((item) => (
              <li key={item} className="text-sm leading-6 text-amber-900">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-gray-950">{lang === "sw" ? "Ufutaji wa sehemu ya data" : "Partial data deletion"}</h2>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            {lang === "sw"
              ? "Unaweza kuomba kufuta baadhi ya data bila kufuta akaunti yote, kama bidhaa, staff, madeni, matumizi, maagizo, au catalog. Tuma ombi hilo kwa support@uzuriliving.com au WhatsApp na ueleze data unayotaka ifutwe."
              : "You can request deletion of some data without deleting the full account, such as products, staff, debts, expenses, orders, or catalog data. Send the request to support@uzuriliving.com or WhatsApp and describe the data you want deleted."}
          </p>
        </section>
      </div>
    </PublicPageShell>
  );
}
