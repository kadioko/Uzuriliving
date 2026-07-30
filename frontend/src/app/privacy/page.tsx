"use client";

import Link from "next/link";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { useLang } from "@/lib/i18n";

export default function PrivacyPage() {
  const lang = useLang();

  const sections = lang === "sw"
    ? [
        ["Taarifa tunazokusanya", "Tunakusanya jina, nambari ya simu, taarifa za duka, bidhaa, mauzo, matumizi, madeni, maagizo, na rekodi za matumizi ya mfumo."],
        ["Tunavyotumia taarifa", "Tunatumia taarifa hizi kuendesha akaunti yako, kuonyesha ripoti, kulinda mfumo, kuboresha huduma, na kuwasiliana kuhusu akaunti yako."],
        ["Ulinzi wa taarifa", "Tunatumia udhibiti wa ufikiaji, vidakuzi salama vya kuingia, na ukaguzi wa shughuli ili kupunguza matumizi yasiyoruhusiwa."],
        ["Ujumbe na washirika", "Vipengele kama WhatsApp au SMS vinaweza kutuma maelezo uliyochagua kupitia huduma za wahusika wengine."],
        ["Haki zako", "Unaweza kuomba kusahihisha, kuuza nje, au kufuta taarifa zako kwa kuwasiliana nasi kupitia nambari ya biashara iliyopo kwenye tovuti."],
      ]
    : [
        ["Information we collect", "We collect name, phone number, shop details, products, sales, expenses, debts, orders, and system activity records."],
        ["How we use information", "We use this information to run your account, show reports, protect the platform, improve the service, and contact you about your account."],
        ["Data protection", "We use access controls, secure login cookies, and activity auditing to reduce unauthorized use."],
        ["Messaging and partners", "Features such as WhatsApp or SMS may send information you choose through third-party services."],
        ["Your rights", "You can request correction, export, or deletion of your information by contacting us through the business number on the site."],
      ];

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">{lang === "sw" ? "Sera ya Faragha" : "Privacy Policy"}</h1>
          <p className="mt-3 text-sm text-gray-500">{lang === "sw" ? "Ilisasishwa Juni 7, 2026" : "Updated June 7, 2026"}</p>
        </div>
        <div className="space-y-6">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
              <p className="mt-2 leading-7 text-gray-600">{body}</p>
            </section>
          ))}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-950">{lang === "sw" ? "Kufuta akaunti na data" : "Account and data deletion"}</h2>
            <p className="mt-2 leading-7 text-gray-600">
              {lang === "sw"
                ? "Unaweza kuomba kufuta akaunti yako ya Uzuri Living au baadhi ya data yako kupitia ukurasa wetu wa ufutaji."
                : "You can request deletion of your Uzuri Living account or some of your data through our deletion request page."}
            </p>
            <Link href="/delete-account" className="mt-4 inline-flex rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">
              {lang === "sw" ? "Fungua ukurasa wa ufutaji" : "Open deletion request page"}
            </Link>
          </section>
        </div>
      </div>
    </PublicPageShell>
  );
}
