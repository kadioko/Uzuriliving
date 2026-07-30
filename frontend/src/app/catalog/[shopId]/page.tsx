"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Store,
  CheckCircle,
} from "lucide-react";
import { api, formatTZS } from "@/lib/api";
import { t, useLang, setLanguage as setAppLanguage } from "@/lib/i18n";
import LogoMark from "@/components/brand/LogoMark";

interface ShopInfo {
  id: string;
  name: string;
  location: string;
  district?: string | null;
  category: string;
  phone?: string;
  productCount: number;
}

interface Product {
  id: string;
  name: string;
  unit: string;
  sellingPrice: number;
  wholesalePrice?: number | null;
  wholesaleMinQty?: number | null;
  currentStock: number;
  imageUrl?: string | null;
}

interface CartItem {
  productId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  pricingTier: "RETAIL" | "WHOLESALE";
  currentStock: number;
}

type View = "shop" | "cart" | "checkout" | "success";

function waLink(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export default function ShopPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const lang = useLang();

  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [view, setView] = useState<View>("shop");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [shopWaUrl, setShopWaUrl] = useState("");

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    api
      .get<{ shop: ShopInfo; products: Product[] }>(`/public/shops/${shopId}`)
      .then((d) => {
        setShop(d.shop);
        setProducts(d.products);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [shopId]);

  function addToCart(product: Product, tier: "RETAIL" | "WHOLESALE") {
    const unitPrice =
      tier === "WHOLESALE" && product.wholesalePrice != null
        ? product.wholesalePrice
        : product.sellingPrice;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id && i.pricingTier === tier);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id && i.pricingTier === tier
            ? { ...i, quantity: Math.min(i.quantity + 1, i.currentStock) }
            : i
        );
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, unit: product.unit, quantity: 1, unitPrice, pricingTier: tier, currentStock: product.currentStock },
      ];
    });
  }

  function updateQty(productId: string, tier: string, delta: number) {
    setCart((prev) =>
      prev
        .map((i) =>
          i.productId === productId && i.pricingTier === tier
            ? { ...i, quantity: Math.max(0, Math.min(i.quantity + delta, i.currentStock)) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  }

  function removeItem(productId: string, tier: string) {
    setCart((prev) => prev.filter((i) => !(i.productId === productId && i.pricingTier === tier)));
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    [cart]
  );
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  async function submitOrder() {
    if (!customerName.trim()) { setOrderError(t("catalog.nameRequired", lang)); return; }
    if (!customerPhone.trim()) { setOrderError(t("catalog.phoneRequired", lang)); return; }
    setOrderError("");
    setSubmitting(true);
    try {
      const result = await api.post<{ order: { id: string; totalAmount: number }; shopWhatsAppUrl?: string }>(
        "/public/orders",
        {
          shopId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          note: orderNote.trim() || undefined,
          items: cart.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            pricingTier: i.pricingTier,
          })),
        }
      );
      setOrderId(result.order.id);
      setShopWaUrl(result.shopWhatsAppUrl || (shop?.phone ? waLink(shop.phone) : ""));
      setView("success");
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : t("catalog.orderError", lang));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        {t("common.loading", lang)}
      </div>
    );
  }

  if (notFound || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Store className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">{t("catalog.shopNotFound", lang)}</p>
        <Link href="/catalog" className="text-brand-700 text-sm hover:underline">
          {t("catalog.backToCatalog", lang)}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/catalog" aria-label={t("catalog.backToCatalog", lang)} className="text-gray-500 hover:text-gray-800 min-h-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <LogoMark className="h-8 w-8 rounded-lg flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-sm text-gray-900 truncate">{shop.name}</p>
              <p className="text-xs text-gray-500 truncate">{shop.location}{shop.district ? `, ${shop.district}` : ""}</p>
            </div>
          </div>
          <div className="hidden sm:flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setAppLanguage("sw")} className={`px-2 py-1 rounded-md text-xs font-semibold min-h-0 ${lang === "sw" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}>{t("app.swahili", lang)}</button>
            <button onClick={() => setAppLanguage("en")} className={`px-2 py-1 rounded-md text-xs font-semibold min-h-0 ${lang === "en" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"}`}>{t("app.english", lang)}</button>
          </div>
          {shop.phone && (
            <a
              href={waLink(shop.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t("catalog.contactWhatsApp", lang)}</span>
            </a>
          )}
          {cart.length > 0 && (
            <button
              onClick={() => setView("cart")}
              className="relative flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">{t("catalog.cart", lang)}</span>
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 pb-24">
        {/* Shop view */}
        {view === "shop" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.length === 0 ? (
              <div className="col-span-full text-center py-16 text-gray-400 text-sm">
                {t("catalog.noProducts", lang)}
              </div>
            ) : (
              products.map((p) => (
                <article key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 transition-colors flex flex-col">
                  <div className="mb-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Store className="h-10 w-10 text-gray-300" aria-hidden="true" />
                    )}
                  </div>
                  <p className="font-medium text-gray-900 text-sm leading-tight">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{p.currentStock} {p.unit} {t("catalog.inStock", lang)}</p>
                  <div className="mt-2 space-y-0.5 flex-1">
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
                          <span className="text-gray-400"> ({t("catalog.from", lang)} {p.wholesaleMinQty}+)</span>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => addToCart(p, "RETAIL")}
                      className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold py-1.5 rounded-lg"
                    >
                      {t("catalog.addToCart", lang)}
                    </button>
                    {p.wholesalePrice != null && (
                      <button
                        onClick={() => addToCart(p, "WHOLESALE")}
                        title={t("catalog.wholesale", lang)}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold px-2 py-1.5 rounded-lg"
                      >
                        {t("sales.wholesale", lang)}
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        )}

        {/* Cart view */}
        {view === "cart" && (
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">{t("catalog.cart", lang)}</h2>
              <button onClick={() => setView("shop")} className="text-sm text-gray-500 hover:text-gray-800">
                {t("catalog.backToShop", lang)}
              </button>
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">{t("catalog.cartEmpty", lang)}</div>
            ) : (
              <>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.pricingTier}`} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatTZS(item.unitPrice)} / {item.unit}
                          {item.pricingTier === "WHOLESALE" && (
                            <span className="ml-1 bg-blue-100 text-blue-700 px-1 rounded text-xs">{t("sales.wholesale", lang)}</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(item.productId, item.pricingTier, -1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => updateQty(item.productId, item.pricingTier, 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-gray-900 w-20 text-right">{formatTZS(item.unitPrice * item.quantity)}</p>
                      <button onClick={() => removeItem(item.productId, item.pricingTier)} className="text-red-400 hover:text-red-600 ml-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                  <div className="flex justify-between text-sm font-bold text-gray-900">
                    <span>{t("catalog.cartTotal", lang)}</span>
                    <span>{formatTZS(cartTotal)}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setCart([]); setView("shop"); }}
                    className="flex-1 border border-gray-300 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50"
                  >
                    {t("catalog.clearCart", lang)}
                  </button>
                  <button
                    onClick={() => setView("checkout")}
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl"
                  >
                    {t("catalog.checkout", lang)}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Checkout view */}
        {view === "checkout" && (
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">{t("catalog.checkout", lang)}</h2>
              <button onClick={() => setView("cart")} className="text-sm text-gray-500 hover:text-gray-800">
                {t("catalog.backToShop", lang)}
              </button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t("catalog.customerName", lang)}</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Amina Hassan"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t("catalog.customerPhone", lang)}</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+255712345678"
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{t("catalog.orderNote", lang)}</label>
                <textarea
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  rows={2}
                  placeholder="..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>{t("catalog.cartTotal", lang)}</span>
                <span>{formatTZS(cartTotal)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{cartCount} {t("catalog.items", lang)}</p>
            </div>
            {orderError && <p className="text-red-600 text-sm mb-3">{orderError}</p>}
            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm"
            >
              {submitting ? t("catalog.placingOrder", lang) : t("catalog.placeOrder", lang)}
            </button>
          </div>
        )}

        {/* Success view */}
        {view === "success" && (
          <div className="max-w-lg mx-auto text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t("catalog.orderSuccess", lang)}</h2>
            <p className="text-gray-500 text-sm mb-1">{t("catalog.orderRef", lang)}: <span className="font-mono font-semibold">#{orderId.slice(-8).toUpperCase()}</span></p>
            <p className="text-gray-500 text-sm mb-8">{t("catalog.orderSuccessMsg", lang)}</p>
            <div className="flex flex-col gap-3">
              {shopWaUrl && (
                <a
                  href={shopWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl text-sm"
                >
                  <MessageCircle className="w-5 h-5" />
                  {t("catalog.contactShopNow", lang)}
                </a>
              )}
              <Link href="/catalog" className="flex items-center justify-center gap-2 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl text-sm hover:bg-gray-50">
                {t("catalog.backToCatalog", lang)}
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Sticky cart bar (shop view only) */}
      {view === "shop" && cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-20">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <div className="flex-1 text-sm">
              <span className="font-semibold text-gray-900">{cartCount} {t("catalog.items", lang)}</span>
              <span className="text-gray-400 ml-2">— {formatTZS(cartTotal)}</span>
            </div>
            <button
              onClick={() => setView("cart")}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              {t("catalog.cart", lang)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
