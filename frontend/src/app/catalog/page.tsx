"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowLeft, Store, Package, Share2, MessageCircle, ExternalLink } from "lucide-react";
import { api, formatTZS } from "@/lib/api";
import { t, useLang, setLanguage as setAppLanguage } from "@/lib/i18n";
import LogoMark from "@/components/brand/LogoMark";

interface Shop {
  id: string;
  name: string;
  location: string;
  district?: string | null;
  category: string;
  productCount: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  unit: string;
  sellingPrice: number;
  wholesalePrice?: number | null;
  wholesaleMinQty?: number | null;
  currentStock: number;
  shop: { id: string; name: string; location: string; category: string };
}

export default function CatalogPage() {
  const lang = useLang();
  const [shops, setShops] = useState<Shop[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [shopId, setShopId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    api.get<{ shops: Shop[] }>("/public/shops").then((d) => setShops(d.shops)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (shopId) params.set("shopId", shopId);
    if (search) params.set("search", search);
    params.set("limit", "60");
    const q = params.toString();
    api
      .get<{ products: CatalogProduct[]; pagination?: { hasMore: boolean } }>(`/public/products${q ? `?${q}` : ""}`)
      .then((d) => { setProducts(d.products); setHasMore(Boolean(d.pagination?.hasMore)); })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [shopId, search]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: "60", offset: String(products.length) });
      if (shopId) params.set("shopId", shopId);
      if (search) params.set("search", search);
      const data = await api.get<{ products: CatalogProduct[]; pagination?: { hasMore: boolean } }>(`/public/products?${params}`);
      setProducts((current) => [...current, ...data.products]);
      setHasMore(Boolean(data.pagination?.hasMore));
    } finally {
      setLoadingMore(false);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<string, { shop: CatalogProduct["shop"]; items: CatalogProduct[] }> = {};
    for (const p of products) {
      if (!map[p.shop.id]) map[p.shop.id] = { shop: p.shop, items: [] };
      map[p.shop.id].items.push(p);
    }
    return Object.values(map);
  }, [products]);

  const sampleLinks = shops.slice(0, 3);
  const hasNoMarketplace = !loading && shops.length === 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            aria-label={t("catalog.backToLogin", lang)}
            className="text-gray-500 hover:text-gray-800 min-h-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <LogoMark className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-900 truncate">{t("catalog.title", lang)}</p>
              <p className="text-xs text-gray-500 truncate">{t("catalog.subtitle", lang)}</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setAppLanguage("sw")}
              className={`px-2 py-1 rounded-md text-xs font-semibold min-h-0 ${lang === "sw" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}
            >
              {t("app.swahili", lang)}
            </button>
            <button
              onClick={() => setAppLanguage("en")}
              className={`px-2 py-1 rounded-md text-xs font-semibold min-h-0 ${lang === "en" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}
            >
              {t("app.english", lang)}
            </button>
          </div>
          <button
            onClick={() => setAppLanguage(lang === "sw" ? "en" : "sw")}
            aria-label={lang === "sw" ? "Change language to English" : "Badilisha lugha kuwa Kiswahili"}
            className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-gray-100 px-2 text-xs font-bold text-brand-800 sm:hidden"
          >
            {lang === "sw" ? "EN" : "SW"}
          </button>
          <Link
            href="/"
            className="text-xs sm:text-sm font-semibold text-brand-700 hover:underline whitespace-nowrap"
          >
            {t("catalog.loginCta", lang)}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-12">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-950">{lang === "sw" ? "Bidhaa za maduka" : "Shop products near you"}</h1>
          <p className="mt-1 text-sm text-gray-600">{lang === "sw" ? "Tafuta bidhaa kutoka maduka yanayotumia Uzuri Living." : "Browse products from shops that use Uzuri Living."}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("catalog.search", lang)}
              placeholder={t("catalog.search", lang)}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            aria-label={t("catalog.filterShop", lang)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-0 sm:min-w-[220px]"
          >
            <option value="">{t("catalog.allShops", lang)}</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.productCount})
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">{t("common.loading", lang)}</div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 sm:p-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                {hasNoMarketplace ? <Store className="h-7 w-7" /> : <Package className="h-7 w-7" />}
              </div>
              <h1 className="text-xl font-bold text-gray-950">
                {hasNoMarketplace
                  ? lang === "sw" ? "Hakuna maduka ya umma bado" : "No public shops yet"
                  : t("catalog.noProducts", lang)}
              </h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {hasNoMarketplace
                  ? lang === "sw"
                    ? "Uzuri Living huonyesha bidhaa hapa pale mfanyabiashara anapoongeza bidhaa na kushare link ya catalog yake."
                    : "Uzuri Living shows products here once a merchant adds inventory and shares their catalog link."
                  : lang === "sw"
                    ? "Jaribu kuondoa utafutaji au uchague duka jingine. Bidhaa zinaweza kuwa zimeisha au hazijawekwa hadharani."
                    : "Try clearing the search or choosing another shop. Products may be out of stock or not public yet."}
              </p>

              <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
                {[
                  [Share2, lang === "sw" ? "Mfanyabiashara anaingia" : "Merchant signs in", lang === "sw" ? "Anaongeza bidhaa na bei zake." : "They add products and prices."],
                  [ExternalLink, lang === "sw" ? "Anashare link" : "They share a link", lang === "sw" ? "Kila duka lina ukurasa wake wa catalog." : "Every shop gets its own catalog page."],
                  [MessageCircle, lang === "sw" ? "Mteja anaagiza" : "Customer orders", lang === "sw" ? "Agizo linaingia kwenye dashboard." : "The order lands in the dashboard."],
                ].map(([Icon, title, body]) => (
                  <div key={String(title)} className="rounded-xl bg-gray-50 p-4">
                    <Icon className="mb-3 h-5 w-5 text-brand-700" />
                    <p className="text-sm font-semibold text-gray-950">{title as string}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{body as string}</p>
                  </div>
                ))}
              </div>

              {sampleLinks.length > 0 && (
                <div className="mt-6 rounded-xl bg-brand-50 p-4 text-left">
                  <p className="text-sm font-semibold text-gray-950">{lang === "sw" ? "Angalia maduka haya" : "Browse these shops"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sampleLinks.map((shop) => (
                      <Link
                        key={shop.id}
                        href={`/catalog/${shop.id}`}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-700 shadow-sm hover:text-brand-900"
                      >
                        {shop.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/?view=register" className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white hover:bg-brand-700">
                  {lang === "sw" ? "Fungua duka lako" : "Create your shop"}
                </Link>
                <a href="https://wa.me/255743910580" className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold text-gray-700 hover:border-green-400 hover:text-green-700">
                  WhatsApp: +255 743 910 580
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(({ shop, items }) => (
              <section key={shop.id}>
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-4 h-4 text-brand-600" />
                  <h2 className="font-semibold text-gray-900 text-sm">{shop.name}</h2>
                  <span className="text-xs text-gray-400">- {shop.location}</span>
                  <Link href={`/catalog/${shop.id}`} className="ml-auto text-xs font-semibold text-brand-700 hover:underline whitespace-nowrap">
                    {t("catalog.viewShop", lang)}
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((p) => (
                    <article
                      key={p.id}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 transition-colors"
                    >
                      <p className="font-medium text-gray-900 text-sm leading-tight">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {p.currentStock} {p.unit} {t("catalog.inStock", lang)}
                      </p>
                      <div className="mt-3 space-y-0.5">
                        <p className="text-sm">
                          <span className="text-gray-500">{t("catalog.retail", lang)}: </span>
                          <span className="font-bold text-brand-700">{formatTZS(p.sellingPrice)}</span>
                          <span className="text-gray-400"> / {p.unit}</span>
                        </p>
                        {p.wholesalePrice != null && (
                          <p className="text-xs text-gray-600">
                            {t("catalog.wholesale", lang)}:{" "}
                            <span className="font-semibold text-gray-800">{formatTZS(p.wholesalePrice)}</span>
                            {p.wholesaleMinQty != null && (
                              <span className="text-gray-400">
                                {" "}
                                ({t("catalog.from", lang)} {p.wholesaleMinQty}+)
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
            {hasMore && (
              <div className="flex justify-center pt-2">
                <button onClick={loadMore} disabled={loadingMore} className="min-h-11 rounded-lg border border-brand-300 bg-white px-5 py-2 text-sm font-bold text-brand-800 disabled:opacity-60">
                  {loadingMore ? t("common.loading", lang) : (lang === "sw" ? "Onyesha bidhaa zaidi" : "Load more products")}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
