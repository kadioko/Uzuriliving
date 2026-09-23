"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Printer, ScanLine, Tags } from "lucide-react";
import PublicPageShell from "@/components/marketing/PublicPageShell";
import { useLang } from "@/lib/i18n";

const steps = [
  { icon: Tags, title: "Add a stable product code", body: "Open Inventory, enter the manufacturer's EAN-13 or UPC-A, or generate an internal Code 128 code when no manufacturer code exists. Keep one code per sellable pack size." },
  { icon: ScanLine, title: "Test it in POS", body: "Use a keyboard-wedge scanner, the phone camera, or manual barcode entry. A successful scan adds the product to the cart and repeated scans increase quantity up to available stock." },
  { icon: Printer, title: "Print a test label first", body: "Open Barcode management → Labels, choose the fields and 40 × 30 mm default size, preview one label, print it at 100% scale, and scan it back before printing a batch." },
];

export default function BarcodeHelpPage() {
  const lang = useLang();
  return (
    <PublicPageShell>
      <div className="mx-auto max-w-4xl space-y-8">
        <Link href="/help" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" />{lang === "sw" ? "Rudi kwenye msaada" : "Back to Help"}</Link>
        <header><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-700">Uzuri Living</p><h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Barcode and label guide</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">A practical workflow for product codes, POS scanning, labels, and printer files.</p></header>
        <section className="grid gap-4 md:grid-cols-3">{steps.map(({ icon: Icon, title, body }, index) => <article key={title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><p className="mt-4 text-xs font-bold uppercase tracking-wide text-gray-400">Step {index + 1}</p><h2 className="mt-1 font-bold text-gray-950">{title}</h2><p className="mt-2 text-sm leading-6 text-gray-600">{body}</p></article>)}</section>
        <section className="rounded-2xl border border-brand-100 bg-brand-50 p-6"><h2 className="text-lg font-bold text-brand-950">Best printing settings</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-brand-900"><li>• Use 100% scale and disable browser headers and footers.</li><li>• Use the actual roll or label size; start with 40 × 30 mm.</li><li>• Keep a white quiet zone around the barcode and test one label before a batch.</li><li>• Use Browser/PDF for normal printing, or download ZPL/TSPL/ESC/POS-oriented files for an approved printer utility or bridge.</li></ul></section>
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-bold text-gray-950">When a scan fails</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{["Confirm the product is active and the code is saved.", "Check that a keyboard scanner sends Enter after the scan.", "Try camera or manual entry to separate product-data issues from scanner issues.", "For EAN-13 or UPC-A, check that the number has the correct number of digits."].map((item) => <p key={item} className="flex gap-2 text-sm leading-6 text-gray-600"><CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-brand-700" />{item}</p>)}</div></section>
        <Link href="/barcodes" className="inline-flex rounded-xl bg-brand-700 px-5 py-3 text-sm font-bold text-white hover:bg-brand-800">Open Barcode management</Link>
      </div>
    </PublicPageShell>
  );
}
