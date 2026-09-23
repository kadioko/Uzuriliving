"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Barcode, Check, ClipboardList, Printer, RefreshCw, ScanLine, Search, Tags } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { BarcodeLabel } from "@/components/barcode/BarcodeLabel";
import { api, formatTZS } from "@/lib/api";
import { DEFAULT_LABEL_TEMPLATE, LABEL_FIELD_OPTIONS, type LabelField, type LabelPriceMode, type LabelTemplate, type PrinterProfile, type PrinterProtocol } from "@/lib/labels/types";
import { renderPrinterFile } from "@/lib/labels/printers";
import { useLang } from "@/lib/i18n";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  barcodeType?: string | null;
  unit?: string | null;
  sellingPrice: number;
  wholesalePrice?: number | null;
  currentStock?: number;
};
type Report = { withoutBarcodes: Array<{ id: string; name: string; currentStock: number }>; mostScanned: Array<{ barcode: string; scans: number; product: Product | null }>; duplicateAttempts: number };
type Scan = { id: string; barcode: string; context: string; found: boolean; createdAt: string; product?: { id: string; name: string } | null };
type SavedTemplate = LabelTemplate & { isDefault?: boolean };

const SIZE_PRESETS = [
  { label: "40 × 30 mm", widthMm: 40, heightMm: 30 },
  { label: "48 × 30 mm", widthMm: 48, heightMm: 30 },
  { label: "62 × 30 mm", widthMm: 62, heightMm: 30 },
  { label: "80 × 40 mm", widthMm: 80, heightMm: 40 },
];

const FIELD_PRESETS: Array<{ label: string; sw: string; fields: LabelField[] }> = [
  { label: "Name + price + barcode", sw: "Jina + bei + barcode", fields: ["name", "price", "barcode"] },
  { label: "Name + barcode", sw: "Jina + barcode", fields: ["name", "barcode"] },
  { label: "Name + price", sw: "Jina + bei", fields: ["name", "price"] },
  { label: "Barcode only", sw: "Barcode pekee", fields: ["barcode"] },
];

export default function BarcodesPage() {
  const lang = useLang();
  const [tab, setTab] = useState<"overview" | "labels" | "history">("overview");
  const [report, setReport] = useState<Report | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [template, setTemplate] = useState<LabelTemplate>(DEFAULT_LABEL_TEMPLATE);
  const [productSearch, setProductSearch] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>([]);
  const [activePrinterId, setActivePrinterId] = useState("");
  const [templateName, setTemplateName] = useState("Product 40 × 30 mm");
  const [printerName, setPrinterName] = useState("Browser printing");
  const [printerProtocol, setPrinterProtocol] = useState<PrinterProtocol>("BROWSER");
  const [profileMessage, setProfileMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [reportData, productData, historyData, templateData, profileData] = await Promise.all([
        api.get<Report>("/barcodes/report"),
        api.get<{ products: Product[] }>("/products?limit=1000"),
        api.get<{ scans: Scan[] }>("/barcodes/history?limit=50"),
        api.get<{ templates: SavedTemplate[] }>("/barcodes/label-templates").catch(() => ({ templates: [] as SavedTemplate[] })),
        api.get<{ profiles: PrinterProfile[] }>("/barcodes/printer-profiles").catch(() => ({ profiles: [] as PrinterProfile[] })),
      ]);
      setReport(reportData);
      setProducts(productData.products);
      setScans(historyData.scans);
      setSavedTemplates(templateData.templates ?? []);
      setPrinterProfiles(profileData.profiles ?? []);
      const defaultTemplate = (templateData.templates ?? []).find((item) => item.isDefault) ?? templateData.templates?.[0];
      if (defaultTemplate) {
        setTemplate({ ...defaultTemplate, fields: defaultTemplate.fields as LabelField[] });
        setTemplateName(defaultTemplate.name);
      }
      const defaultProfile = (profileData.profiles ?? []).find((item) => item.isDefault) ?? profileData.profiles?.[0];
      if (defaultProfile) setActivePrinterId(defaultProfile.id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return products.filter((product) => !query || `${product.name} ${product.sku || ""} ${product.barcode || ""}`.toLowerCase().includes(query));
  }, [products, productSearch]);

  const printProducts = useMemo(
    () => products.flatMap((product) => Array.from({ length: Math.min(selected[product.id] || 0, 100) }, () => product)),
    [products, selected],
  );
  const previewProduct = products.find((product) => selected[product.id] > 0) || filteredProducts[0] || products[0];

  const toggleLabel = (id: string) => setSelected((current) => ({ ...current, [id]: current[id] ? 0 : 1 }));
  const setQuantity = (id: string, value: string) => setSelected((current) => ({ ...current, [id]: Math.max(0, Math.min(100, Number(value) || 0)) }));
  const setSize = (widthMm: number, heightMm: number) => setTemplate((current) => ({ ...current, widthMm, heightMm }));
  const setFields = (fields: LabelField[]) => setTemplate((current) => ({ ...current, fields }));
  const toggleField = (field: LabelField) => setTemplate((current) => ({ ...current, fields: current.fields.includes(field) ? current.fields.length > 1 ? current.fields.filter((item) => item !== field) : current.fields : [...current.fields, field] }));
  const copyBarcode = async (value: string) => { try { await navigator.clipboard.writeText(value); } catch {} };

  const labelPrice = (product: Product) => {
    const amount = template.priceMode === "WHOLESALE" ? product.wholesalePrice : product.sellingPrice;
    return amount == null ? undefined : formatTZS(amount);
  };

  const resetTemplate = () => setTemplate({ ...DEFAULT_LABEL_TEMPLATE, fields: [...DEFAULT_LABEL_TEMPLATE.fields] });

  const chooseTemplate = (id: string) => {
    const saved = savedTemplates.find((item) => item.id === id);
    if (!saved) return;
    setTemplate({ ...saved, fields: saved.fields as LabelField[] });
    setTemplateName(saved.name);
  };

  const selectedPrinter = printerProfiles.find((profile) => profile.id === activePrinterId);
  const exportLabels = () => {
    if (!selectedPrinter || selectedPrinter.protocol === "BROWSER") {
      window.print();
      return;
    }
    const output = renderPrinterFile(selectedPrinter.protocol, printProducts, template);
    const blob = new Blob([output.content], { type: output.mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uzuri-labels-${selectedPrinter.protocol.toLowerCase()}.${output.extension}`;
    link.click();
    URL.revokeObjectURL(url);
    setProfileMessage(`Downloaded ${selectedPrinter.protocol} printer commands. Send the file through the printer's approved utility or print bridge.`);
  };

  const saveTemplate = async () => {
    try {
      const data = await api.post<{ template: SavedTemplate }>("/barcodes/label-templates", { ...template, name: templateName.trim() || template.name, isDefault: true });
      setSavedTemplates((current) => [data.template, ...current.filter((item) => item.id !== data.template.id)]);
      setTemplate({ ...data.template, fields: data.template.fields as LabelField[] });
      setTemplateName(data.template.name);
      setProfileMessage("Label template saved for this shop.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Unable to save label template.");
    }
  };

  const savePrinterProfile = async () => {
    try {
      const data = await api.post<{ profile: PrinterProfile }>("/barcodes/printer-profiles", { name: printerName.trim() || "Printer profile", protocol: printerProtocol, connection: printerProtocol === "BROWSER" ? "BROWSER" : "DOWNLOAD", isDefault: true });
      setPrinterProfiles((current) => [data.profile, ...current.filter((item) => item.id !== data.profile.id)]);
      setActivePrinterId(data.profile.id);
      setProfileMessage("Printer profile saved for this shop.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Unable to save printer profile.");
    }
  };

  return <AppShell><div className="mx-auto max-w-5xl pb-24 lg:pb-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-bold text-gray-950">{lang === "sw" ? "Usimamizi wa Barcode" : "Barcode management"}</h1><p className="mt-1 text-sm text-gray-600">{lang === "sw" ? "Scan, tengeneza, chapisha na fuatilia barcode za duka." : "Scan, generate, print, and track your shop barcodes."}</p></div><button onClick={load} className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-600" title="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
    <div className="mb-5 grid grid-cols-3 rounded-lg bg-gray-100 p-1">{[["overview", ClipboardList, lang === "sw" ? "Muhtasari" : "Overview"], ["labels", Tags, lang === "sw" ? "Labels" : "Labels"], ["history", ScanLine, lang === "sw" ? "Historia" : "History"]].map(([value, Icon, label]) => <button key={String(value)} onClick={() => setTab(value as typeof tab)} className={`flex min-h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold ${tab === value ? "bg-white text-brand-700 shadow-sm" : "text-gray-600"}`}><Icon className="h-4 w-4" />{label as string}</button>)}</div>
    {loading && !report ? <div className="py-16 text-center text-gray-500">Loading barcodes...</div> : <>
      {tab === "overview" && <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Stat label={lang === "sw" ? "Bila barcode" : "Without barcodes"} value={report?.withoutBarcodes.length || 0} tone="amber" /><Stat label={lang === "sw" ? "Majaribio duplicate" : "Duplicate attempts"} value={report?.duplicateAttempts || 0} tone="red" /><Stat label={lang === "sw" ? "Zilizoscanwa" : "Scanned products"} value={report?.mostScanned.length || 0} tone="green" /></div>
        <section className="rounded-lg border border-gray-200 bg-white"><div className="flex items-center justify-between border-b border-gray-100 px-4 py-3"><div><h2 className="font-semibold text-gray-950">{lang === "sw" ? "Bidhaa zisizo na barcode" : "Products without barcodes"}</h2><p className="text-xs text-gray-500">{lang === "sw" ? "Zipe barcode ili ziwe rahisi kuscan." : "Add a barcode so they are ready to scan."}</p></div><Barcode className="h-5 w-5 text-amber-600" /></div>{report?.withoutBarcodes.length ? <div className="divide-y divide-gray-100">{report.withoutBarcodes.map((product) => <div key={product.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{product.name}</p><p className="text-xs text-gray-500">{product.currentStock} in stock</p></div><Link href={`/inventory?search=${encodeURIComponent(product.name)}`} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white">{lang === "sw" ? "Ongeza" : "Add barcode"}</Link></div>)}</div> : <div className="p-8 text-center text-sm text-gray-500">{lang === "sw" ? "Bidhaa zote zina barcode." : "Every active product has a barcode."}</div>}</section>
        <section className="rounded-lg border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-3"><h2 className="font-semibold text-gray-950">{lang === "sw" ? "Zinazotumika zaidi" : "Most scanned"}</h2></div>{report?.mostScanned.length ? <div className="divide-y divide-gray-100">{report.mostScanned.map((item) => <div key={item.barcode} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-gray-800">{item.product?.name || item.barcode}</p><button onClick={() => copyBarcode(item.barcode)} className="font-mono text-xs text-gray-500">{item.barcode}</button></div><span className="rounded-full bg-green-50 px-2 py-1 text-xs font-bold text-green-700">{item.scans} scans</span></div>)}</div> : <div className="p-8 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna scan zilizorekodiwa bado." : "No scans recorded yet."}</div>}</section>
      </div>}
      {tab === "labels" && <div className="space-y-4">
        <section className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-950">{lang === "sw" ? "Chapisha labels" : "Print labels"}</h2><p className="text-xs text-gray-500">{lang === "sw" ? "Chagua bidhaa, muonekano, ukubwa na idadi." : "Choose products, fields, size, and copies."}</p></div><button disabled={!printProducts.length} onClick={exportLabels} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"><Printer className="h-4 w-4" />{selectedPrinter && selectedPrinter.protocol !== "BROWSER" ? "Download printer file" : "Print"} ({printProducts.length})</button></div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_280px]">
            <div className="space-y-3">
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{lang === "sw" ? "Muundo wa label" : "Label content"}</p><div className="grid gap-2 sm:grid-cols-2">{FIELD_PRESETS.map((preset) => <button key={preset.label} type="button" onClick={() => setFields(preset.fields)} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold ${JSON.stringify(template.fields) === JSON.stringify(preset.fields) ? "border-brand-400 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"}`}><span>{lang === "sw" ? preset.sw : preset.label}</span>{JSON.stringify(template.fields) === JSON.stringify(preset.fields) && <Check className="h-4 w-4" />}</button>)}</div></div>
              <div className="rounded-lg border border-gray-200 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{lang === "sw" ? "Sehemu maalum" : "Custom fields"}</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{LABEL_FIELD_OPTIONS.map((field) => <label key={field.value} className="flex items-center gap-2 text-xs text-gray-700"><input type="checkbox" checked={template.fields.includes(field.value)} onChange={() => toggleField(field.value)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />{lang === "sw" ? field.sw : field.label}</label>)}</div>{template.fields.includes("custom") && <input value={template.customText} onChange={(event) => setTemplate((current) => ({ ...current, customText: event.target.value }))} placeholder={lang === "sw" ? "Maandishi ya ziada" : "Custom label text"} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />}</div>
              <div className="flex flex-wrap items-center gap-2"><label className="text-xs font-semibold text-gray-600">{lang === "sw" ? "Bei" : "Price"}</label><select value={template.priceMode} onChange={(event) => setTemplate((current) => ({ ...current, priceMode: event.target.value as LabelPriceMode }))} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs"><option value="RETAIL">{lang === "sw" ? "Rejareja" : "Retail"}</option><option value="WHOLESALE">{lang === "sw" ? "Jumla" : "Wholesale"}</option></select><button type="button" onClick={resetTemplate} className="ml-auto text-xs font-semibold text-brand-700">{lang === "sw" ? "Rudisha default" : "Reset defaults"}</button></div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{lang === "sw" ? "Hifadhi muundo na printer" : "Save template and printer"}</p><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs text-gray-600">Template name<input value={templateName} onChange={(event) => setTemplateName(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-gray-600">Saved template<select value={savedTemplates.some((item) => item.id === template.id) ? template.id : ""} onChange={(event) => chooseTemplate(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"><option value="">Current unsaved template</option>{savedTemplates.map((saved) => <option key={saved.id} value={saved.id}>{saved.name}</option>)}</select></label><label className="text-xs text-gray-600">Printer profile<select value={activePrinterId} onChange={(event) => setActivePrinterId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm"><option value="">Browser print / Save as PDF</option>{printerProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name} ({profile.protocol})</option>)}</select></label></div><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={saveTemplate} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">Save label template</button><input value={printerName} onChange={(event) => setPrinterName(event.target.value)} placeholder="Printer name" className="min-w-[150px] flex-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm" /><select value={printerProtocol} onChange={(event) => setPrinterProtocol(event.target.value as PrinterProtocol)} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-xs"><option value="BROWSER">Browser/PDF</option><option value="ZPL">ZPL download</option><option value="TSPL">TSPL download</option><option value="ESCPOS">ESC/POS hex</option></select><button type="button" onClick={savePrinterProfile} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">Save printer</button></div>{profileMessage && <p className="mt-2 text-xs text-gray-600">{profileMessage}</p>}</div>
            </div>
            <div className="rounded-xl border border-brand-100 bg-brand-50 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-800">{lang === "sw" ? "Ukubwa wa label" : "Label size"}</p><div className="grid grid-cols-2 gap-2">{SIZE_PRESETS.map((size) => <button key={size.label} type="button" onClick={() => setSize(size.widthMm, size.heightMm)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${template.widthMm === size.widthMm && template.heightMm === size.heightMm ? "border-brand-500 bg-white text-brand-800" : "border-brand-100 bg-brand-100/50 text-brand-700"}`}>{size.label}</button>)}</div><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs text-gray-600">Width (mm)<input type="number" min="20" max="200" value={template.widthMm} onChange={(event) => setTemplate((current) => ({ ...current, widthMm: Math.max(20, Math.min(200, Number(event.target.value) || 20)) }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm" /></label><label className="text-xs text-gray-600">Height (mm)<input type="number" min="15" max="150" value={template.heightMm} onChange={(event) => setTemplate((current) => ({ ...current, heightMm: Math.max(15, Math.min(150, Number(event.target.value) || 15)) }))} className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm" /></label></div><div className="mt-4 border-t border-brand-100 pt-3"><p className="mb-2 text-xs font-semibold text-brand-800">Preview</p>{previewProduct ? <BarcodeLabel value={previewProduct.barcode} barcodeType={previewProduct.barcodeType} name={previewProduct.name} price={labelPrice(previewProduct)} sku={previewProduct.sku} unit={previewProduct.unit} customText={template.customText} fields={template.fields} widthMm={template.widthMm} heightMm={template.heightMm} className="mx-auto border border-brand-200 shadow-sm" /> : <p className="py-8 text-center text-xs text-gray-500">{lang === "sw" ? "Chagua bidhaa kuona preview." : "Select a product to see a preview."}</p>}</div></div>
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white"><div className="border-b border-gray-100 p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={lang === "sw" ? "Tafuta bidhaa, SKU au barcode" : "Search product, SKU, or barcode"} className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" /></div><p className="mt-2 text-xs text-gray-500">{filteredProducts.length} of {products.length} products · max 100 copies each</p></div><div className="divide-y divide-gray-100">{filteredProducts.map((product) => <div key={product.id} className="flex items-center gap-3 px-4 py-3"><input type="checkbox" checked={Boolean(selected[product.id])} onChange={() => toggleLabel(product.id)} className="h-5 w-5 rounded border-gray-300 text-brand-600" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-800">{product.name}</p><p className="font-mono text-xs text-gray-500">{product.barcode || "No barcode"}{product.sku ? ` · ${product.sku}` : ""}</p></div><input aria-label={`Label quantity for ${product.name}`} type="number" min="0" max="100" value={selected[product.id] || ""} onChange={(event) => setQuantity(product.id, event.target.value)} className="w-16 rounded-lg border border-gray-300 px-2 py-2 text-sm" placeholder="0" /></div>)}</div>{!filteredProducts.length && <div className="p-10 text-center text-sm text-gray-500">{lang === "sw" ? "Hakuna bidhaa zinazolingana." : "No matching products."}</div>}</section>
        <div className="print-labels hidden print:grid print:grid-cols-2 print:gap-2">{printProducts.map((product, index) => <BarcodeLabel key={`${product.id}-${index}`} value={product.barcode} barcodeType={product.barcodeType} name={product.name} price={labelPrice(product)} sku={product.sku} unit={product.unit} customText={template.customText} fields={template.fields} widthMm={template.widthMm} heightMm={template.heightMm} className="label-print-item border border-gray-300" />)}</div>
      </div>}
      {tab === "history" && <section className="overflow-hidden rounded-lg border border-gray-200 bg-white"><div className="border-b border-gray-100 px-4 py-3"><h2 className="font-semibold text-gray-950">{lang === "sw" ? "Historia ya scan" : "Barcode scan history"}</h2></div>{scans.length ? <div className="divide-y divide-gray-100">{scans.map((scan) => <div key={scan.id} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-gray-800">{scan.product?.name || scan.barcode}</p><p className="font-mono text-xs text-gray-500">{scan.barcode} · {scan.context}</p></div><div className="text-right"><p className={`text-xs font-bold ${scan.found ? "text-green-700" : "text-red-700"}`}>{scan.found ? "FOUND" : "NOT FOUND"}</p><p className="text-xs text-gray-400">{new Date(scan.createdAt).toLocaleString()}</p></div></div>)}</div> : <div className="p-10 text-center text-sm text-gray-500"><Search className="mx-auto mb-2 h-6 w-6" />{lang === "sw" ? "Hakuna scan bado." : "No barcode scans yet."}</div>}</section>}
    </>}
  </div></AppShell>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "amber" | "red" | "green" }) {
  const colors = { amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700", green: "bg-green-50 text-green-700" };
  return <div className={`rounded-lg p-4 ${colors[tone]}`}><p className="text-xs font-semibold">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}
