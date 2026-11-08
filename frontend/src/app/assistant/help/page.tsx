"use client";

import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { useLang } from "@/lib/i18n";
import { ArrowLeft, BadgeInfo, CircleHelp, Clock3, Database, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";

export default function AssistantHelpPage() {
  const lang = useLang();
  const sw = lang === "sw";
  const questionGroups = [
    {
      title: sw ? "Vipaumbele vya leo na mabadiliko" : "Today’s priorities and changes",
      description: sw ? "Muhtasari uliopangwa kwa hatari na kulinganisha kipindi na kilichotangulia." : "A ranked brief of urgent shop signals, or a comparison with the immediately previous period.",
      questions: [
        ["What needs my attention today?", "Nini kinahitaji kipaumbele leo?"],
        ["What changed this week, and what drove it?", "Nini kimebadilika wiki hii?"],
      ],
    },
    {
      title: sw ? "Mauzo, faida na makusanyo" : "Sales, profit, and collections",
      description: sw ? "Tofautisha mauzo yaliyorekodiwa, faida ghafi na fedha zilizokusanywa." : "Separate recorded sales, gross profit, and money collected—they are different measures.",
      questions: [
        ["What were my sales this month?", "Mauzo ya mwezi huu ni kiasi gani?"],
        ["Which products made the most gross profit this month?", "Bidhaa gani zimeleta faida ghafi zaidi mwezi huu?"],
        ["How much did we actually collect versus record in sales this month?", "Tumekusanya kiasi gani dhidi ya mauzo yaliyorekodiwa mwezi huu?"],
        ["How are sales performing against my monthly target?", "Lengo la mwezi la mauzo likoje?"],
      ],
    },
    {
      title: sw ? "Bidhaa na stock" : "Products and stock",
      description: sw ? "Tafuta bidhaa zisizouzwa au zinazoweza kuishiwa; makadirio hutegemea historia na tarehe ya delivery inayojulikana." : "Find dormant products or possible run-outs. Estimates depend on enough stock/sales history and a known delivery date or lead time.",
      questions: [
        ["Which products have had no sales in the last 30 days?", "Bidhaa gani hazijauzwa siku 30 zilizopita?"],
        ["Which products have had no sales in the last 60 days?", "Bidhaa gani hazijauzwa siku 60 zilizopita?"],
        ["Which products have had no sales in the last 90 days?", "Bidhaa gani hazijauzwa siku 90 zilizopita?"],
        ["Which products are likely to run out before the next delivery?", "Bidhaa gani zinaweza kuisha kabla ya delivery inayofuata?"],
      ],
    },
    {
      title: sw ? "Order za supplier na upokeaji" : "Supplier orders and receiving",
      description: sw ? "Angalia order zilizo wazi, tarehe zilizopita, na tofauti kati ya idadi iliyoagizwa na iliyopokelewa." : "Review open orders, missed expected dates, and differences between quantities ordered and received.",
      questions: [
        ["Which supplier orders are late or still awaiting delivery?", "Order gani za supplier zimechelewa au zinasubiri delivery?"],
        ["Which supplier deliveries had quantity differences?", "Delivery gani za supplier zilikuwa na tofauti ya idadi?"],
      ],
    },
    {
      title: sw ? "Muda wenye mauzo mengi" : "Busy sales times",
      description: sw ? "Huonyesha siku na saa za duka zenye mauzo mengi ikiwa kuna historia ya kutosha." : "Shows the shop-local weekdays and hours with the most recorded sales when there is enough history.",
      questions: [
        ["Which days or hours are busiest?", "Siku au saa gani zina mauzo mengi zaidi?"],
      ],
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 pb-24 lg:pb-6">
        <div>
          <Link href="/assistant" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900">
            <ArrowLeft className="h-4 w-4" />
            {sw ? "Rudi kwa AI Assistant" : "Back to AI Assistant"}
          </Link>
          <header className="mt-4 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-brand-600 p-3 text-white"><CircleHelp className="h-6 w-6" /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">Uzuri Living</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{sw ? "Jinsi ya kutumia AI Assistant" : "How to use the AI Assistant"}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                  {sw ? "Uliza kwa lugha ya kawaida kuhusu duka lako. Taja muda unaotaka, kisha tumia chanzo, tarehe na viungo vilivyo kwenye jibu kuthibitisha namba." : "Ask in plain English or Kiswahili about your shop. Specify the period, then use the source, dates, and links in each answer to verify the numbers."}
                </p>
              </div>
            </div>
          </header>
        </div>

        <section aria-label={sw ? "Aina za maswali" : "Question types"} className="grid gap-4 md:grid-cols-2">
          {questionGroups.map((group) => (
            <article key={group.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-bold text-gray-950">{group.title}</h2>
              <p className="mt-1 text-sm leading-5 text-gray-600">{group.description}</p>
              <ul className="mt-4 space-y-2">
                {group.questions.map(([en, swQuestion]) => (
                  <li key={en} className="flex gap-2 rounded-xl bg-gray-50 p-3 text-sm leading-5 text-gray-800">
                    <MessageSquareText className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-700" />
                    <span>“{sw ? swQuestion : en}”</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <Clock3 className="h-5 w-5 text-blue-700" />
            <h2 className="mt-3 font-bold text-blue-950">{sw ? "Taja kipindi" : "Specify the period"}</h2>
            <p className="mt-2 text-sm leading-6 text-blue-900">{sw ? "Tumia leo, wiki hii, mwezi huu, siku 30/60/90 zilizopita, au tarehe maalum pale inapowezekana." : "Use today, this week, this month, the last 30/60/90 days, or a specific date range where supported."}</p>
          </article>
          <article className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <Database className="h-5 w-5 text-amber-700" />
            <h2 className="mt-3 font-bold text-amber-950">{sw ? "Angalia ukamilifu wa data" : "Check data coverage"}</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">{sw ? "Mauzo ambayo hayajasawazishwa, gharama za kununua zilizokosekana, au vyanzo visivyopatikana vinaweza kuathiri jibu; angalia tahadhari za jibu." : "Unsynced sales, missing buying costs, or unavailable sources can affect an answer; read its evidence and warnings."}</p>
          </article>
          <article className="rounded-2xl border border-green-100 bg-green-50 p-5">
            <ShieldCheck className="h-5 w-5 text-green-700" />
            <h2 className="mt-3 font-bold text-green-950">{sw ? "Majibu yana mipaka salama" : "Answers have safe boundaries"}</h2>
            <p className="mt-2 text-sm leading-6 text-green-900">{sw ? "Msaidizi hutumia hesabu za mfumo, hauhifadhi mabadiliko, na huonyesha tu data ambayo ruhusa zako zinakuruhusu kuona. Swali lisilo wazi linaweza kukuomba uchague kipimo." : "The assistant uses deterministic calculations, does not change records, and only shows data your permissions allow. Ambiguous questions may ask you to choose a measure."}</p>
          </article>
        </section>

        <aside className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-900 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-100" />
            <div>
              <h2 className="font-bold">{sw ? "Uko tayari kuuliza?" : "Ready to ask?"}</h2>
              <p className="mt-1 text-sm leading-5 text-brand-100">{sw ? "Chagua mfano au andika swali lako kwenye AI Assistant." : "Pick an example or type your question in the AI Assistant."}</p>
            </div>
          </div>
          <Link href="/assistant" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-900 hover:bg-brand-50">
            {sw ? "Fungua AI Assistant" : "Open AI Assistant"}
            <BadgeInfo className="h-4 w-4" />
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
