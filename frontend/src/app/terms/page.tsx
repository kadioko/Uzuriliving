"use client";

import PublicPageShell from "@/components/marketing/PublicPageShell";
import { useLang } from "@/lib/i18n";

export default function TermsPage() {
  const lang = useLang();

  const sections = lang === "sw"
    ? [
        ["Matumizi ya huduma", "Uzuri Living hutolewa kusaidia uendeshaji wa duka. Unawajibika kuhakikisha taarifa unazoingiza ni sahihi na unatumia mfumo kwa njia halali."],
        ["Akaunti na usalama", "Linda PIN yako na vifaa vyako. Tuarifu haraka ukihisi akaunti yako imetumika bila ruhusa."],
        ["Malipo na mipango", "Bei, muda wa majaribio, na huduma zilizopo zinaweza kuonyeshwa kwenye ukurasa wa bei. Mabadiliko yoyote muhimu yatawasilishwa kabla hayajaanza."],
        ["Upatikanaji", "Tunajitahidi kuweka huduma hewani, lakini mtandao, vifaa, au huduma za wahusika wengine zinaweza kuathiri upatikanaji."],
        ["Mipaka ya uwajibikaji", "Ripoti na mapendekezo ni zana za kusaidia maamuzi. Wewe unabaki na jukumu la mwisho la maamuzi ya biashara yako."],
      ]
    : [
        ["Use of service", "Uzuri Living is provided to help operate a shop. You are responsible for keeping entered information accurate and using the platform lawfully."],
        ["Account and security", "Protect your PIN and devices. Tell us quickly if you believe your account was used without permission."],
        ["Plans and payments", "Pricing, trial periods, and included services may be shown on the pricing page. Important changes will be communicated before they take effect."],
        ["Availability", "We work to keep the service online, but networks, devices, and third-party services can affect availability."],
        ["Limits of responsibility", "Reports and recommendations support decisions. You remain responsible for final business decisions."],
      ];

  return (
    <PublicPageShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-950">{lang === "sw" ? "Masharti ya Huduma" : "Terms of Service"}</h1>
          <p className="mt-3 text-sm text-gray-500">{lang === "sw" ? "Ilisasishwa Juni 7, 2026" : "Updated June 7, 2026"}</p>
        </div>
        <div className="space-y-6">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
              <p className="mt-2 leading-7 text-gray-600">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </PublicPageShell>
  );
}
