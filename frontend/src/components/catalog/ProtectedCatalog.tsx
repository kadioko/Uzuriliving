"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, LogOut, Search } from "lucide-react";
import { formatTZS } from "@/lib/api";
import { setLanguage, type Lang } from "@/lib/i18n";
import CatalogProductImage from "@/components/catalog/CatalogProductImage";
import LogoMark from "@/components/brand/LogoMark";

type Tier = "RETAIL" | "WHOLESALE";
type Product = { id: string; name: string; unit: string; currentStock: number; imageUrl?: string | null; price?: number | null; minimumQuantity?: number | null };
type Shop = { id: string; name: string; location: string; district?: string | null };

export default function ProtectedCatalog({ shop, products, lang }: { shop: Shop; products: Product[]; lang: Lang }) {
  const sw = lang === "sw";
  const [tier, setTier] = useState<Tier>("RETAIL");
  const [activeTier, setActiveTier] = useState<Tier | null>(null);
  const [privateProducts, setPrivateProducts] = useState<Product[]>([]);
  const [password, setPassword] = useState("");
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function readSession(expectedTier?: Tier | null) {
    const response = await fetch(`/api/public/catalog/${encodeURIComponent(shop.id)}`, { credentials: "include", cache: "no-store" });
    if (response.status === 401) { setActiveTier(null); setPrivateProducts([]); return false; }
    if (!response.ok) throw new Error(sw ? "Haikuwezekana kupata bei. Jaribu tena." : "Could not load prices. Please try again.");
    const result = await response.json() as { tier: Tier; products: Product[] };
    if (result.tier !== "RETAIL" && result.tier !== "WHOLESALE") throw new Error("Invalid catalogue session");
    if (expectedTier && result.tier !== expectedTier) { setActiveTier(null); setPrivateProducts([]); return false; }
    setTier(result.tier); setActiveTier(result.tier); setPrivateProducts(result.products);
    return true;
  }

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tier")?.toUpperCase();
    const expectedTier = requested === "RETAIL" || requested === "WHOLESALE" ? requested : null;
    if (expectedTier) setTier(expectedTier);
    let cancelled = false;
    // A failed check is surfaced; it must not look like a shop has no prices.
    setChecking(true);
    readSession(expectedTier).catch(() => { if (!cancelled) setError(sw ? "Haikuwezekana kuangalia ufikiaji wa catalog. Jaribu tena." : "Could not check catalogue access. Please try again."); }).finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [shop.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setBusy(true);
    try {
      const response = await fetch("/api/public/catalog/login", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ shopId: shop.id, tier, password }) });
      if (response.status === 401) { setError(sw ? "Password si sahihi. Muulize mwenye duka." : "Incorrect password. Please ask the shop owner."); return; }
      if (response.status === 429) { setError(sw ? "Majaribio ni mengi. Jaribu tena baada ya dakika 15." : "Too many attempts. Please try again in 15 minutes."); return; }
      if (!response.ok) throw new Error("login failed");
      setPassword("");
      if (!await readSession(tier)) setError(sw ? "Kifaa hakijahifadhi kuingia. Ruhusu cookies na ujaribu tena." : "Your browser did not keep the session. Allow cookies and try again.");
    } catch { setError(sw ? "Haikuwezekana kuingia. Hakikisha una mtandao na ujaribu tena." : "Could not sign in. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/catalog/logout", { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error("logout failed");
      setActiveTier(null); setPrivateProducts([]); setPassword("");
    } catch { setError(sw ? "Haikuwezekana kutoka. Jaribu tena." : "Could not sign out. Please try again."); }
    finally { setBusy(false); }
  }

  const visibleProducts = useMemo(() => (activeTier ? privateProducts : products).filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase())), [activeTier, privateProducts, products, query]);
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/catalog" aria-label={sw ? "Rudi kwenye catalog" : "Back to catalogue"} className="rounded-lg p-1 text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
          <LogoMark className="h-8 w-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-gray-900">{shop.name}</p><p className="truncate text-xs text-gray-500">{shop.location}{shop.district ? `, ${shop.district}` : ""}</p></div>
          <button type="button" onClick={() => setLanguage(sw ? "en" : "sw")} aria-label={sw ? "Change language to English" : "Badilisha lugha kuwa Kiswahili"} className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-brand-800">{sw ? "EN" : "SW"}</button>
          {activeTier && <button type="button" onClick={() => void logout()} disabled={busy} className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"><LogOut className="h-4 w-4" />{sw ? "Toka" : "Sign out"}</button>}
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {checking ? <p className="text-sm text-gray-500">{sw ? "Inaangalia ufikiaji..." : "Checking catalogue access..."}</p> : !activeTier ? (
          <section className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><LockKeyhole className="h-5 w-5" /></span><div><h1 className="font-bold text-gray-900">{sw ? "Ingia kuona bei" : "Sign in to view prices"}</h1><p className="mt-1 text-sm text-gray-600">{sw ? "Chagua aina ya mteja na uweke password uliyopewa na duka." : "Choose your customer type and enter the password from the shop."}</p></div></div>
            <form onSubmit={login} className="mt-4 space-y-3">
              <fieldset><legend className="mb-2 text-xs font-semibold text-gray-700">{sw ? "Aina ya mteja" : "Customer type"}</legend><div className="grid grid-cols-2 gap-2">{([['RETAIL', sw ? 'Rejareja' : 'Retail'], ['WHOLESALE', sw ? 'Jumla' : 'Wholesale']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={tier === value} onClick={() => { setTier(value); setPassword(""); setError(""); }} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${tier === value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-gray-200 text-gray-600"}`}>{label}</button>)}</div></fieldset>
              <label htmlFor="catalog-customer-password" className="block text-xs font-semibold text-gray-700">{sw ? "Password ya catalog" : "Catalogue password"}</label>
              <input id="catalog-customer-password" type="password" autoComplete="current-password" maxLength={72} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <button type="submit" disabled={busy || checking} className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? (sw ? "Inaingia..." : "Signing in...") : (sw ? "Ingia" : "Sign in")}</button>
            </form>
          </section>
        ) : <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">{activeTier === "RETAIL" ? (sw ? "Unaona bei za rejareja pekee." : "You are viewing retail prices only.") : (sw ? "Unaona bei za jumla pekee." : "You are viewing wholesale prices only.")} {sw ? "Catalog hii ni ya kuangalia tu." : "This catalogue is view-only."}</div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label={sw ? "Tafuta bidhaa" : "Search products"} placeholder={sw ? "Tafuta bidhaa" : "Search products"} className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm" /></div>
        {visibleProducts.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">{sw ? "Hakuna bidhaa zilizopatikana." : "No products found."}</p> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleProducts.map((product) => <article key={product.id} className="rounded-xl border border-gray-200 bg-white p-4"><CatalogProductImage src={product.imageUrl} name={product.name} lang={lang} heightClass="h-40" /><p className="text-sm font-semibold text-gray-900">{product.name}</p><p className="mt-1 text-xs text-gray-500">{product.currentStock} {product.unit} {sw ? "zipo" : "in stock"}</p>{activeTier ? <div className="mt-2 text-sm"><span className="text-gray-600">{activeTier === "RETAIL" ? (sw ? "Bei ya rejareja" : "Retail price") : (sw ? "Bei ya jumla" : "Wholesale price")}: </span><span className="font-bold text-brand-700">{product.price == null ? (sw ? "Uliza duka" : "Ask the shop") : formatTZS(product.price)}</span>{activeTier === "WHOLESALE" && product.minimumQuantity != null && <p className="mt-1 text-xs text-gray-500">{sw ? "Kuanzia" : "Minimum"} {product.minimumQuantity} {product.unit}</p>}</div> : <p className="mt-2 text-xs text-gray-500">{sw ? "Ingia kuona bei" : "Sign in to view prices"}</p>}</article>)}</div>}
      </main>
    </div>
  );
}
