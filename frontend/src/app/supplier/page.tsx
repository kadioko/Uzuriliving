"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, formatTZS } from "@/lib/api";
import { LogOut, Check, X, Truck, ChevronDown, ChevronUp, Package, Plus, ArrowLeft, Edit2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import LogoMark from "@/components/brand/LogoMark";
import { setLanguage, useLang, type Lang } from "@/lib/i18n";

interface Order {
  id: string;
  status: string;
  totalAmount?: number;
  note?: string;
  createdAt: string;
  shop: { name: string; location: string; district?: string };
  items: Array<{ product: { name: string; unit: string }; quantity: number }>;
}

interface DashboardData {
  ordersByStatus: Record<string, number>;
  pendingOrders: Order[];
}

interface CurrentUser {
  role: string;
  language?: Lang;
}

interface SupplierProduct {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  price: number;
  minOrderQty: number;
  note?: string | null;
  isAvailable: boolean;
}

const emptyProductForm = { name: "", sku: "", unit: "pcs", price: "", minOrderQty: "1", note: "" };

const copy = {
  title: { sw: "Uzuri Living - Msambazaji", en: "Uzuri Living - Supplier" },
  subtitle: { sw: "Portal ya Wasambazaji", en: "Supplier Portal" },
  backAdmin: { sw: "Rudi Admin", en: "Back to Admin" },
  logout: { sw: "Toka", en: "Log out" },
  productsTitle: { sw: "Bidhaa za supplier", en: "Supplier products" },
  productsHint: { sw: "Ongeza bidhaa zako zinazopatikana kwa maduka kuagiza.", en: "Add products available for shops to order." },
  add: { sw: "Ongeza", en: "Add" },
  noProducts: { sw: "Hakuna bidhaa bado. Ongeza bidhaa za catalog ya supplier.", en: "No products yet. Add supplier catalog products." },
  available: { sw: "Inapatikana", en: "Available" },
  hidden: { sw: "Imefichwa", en: "Hidden" },
  minOrder: { sw: "Agizo dogo", en: "Min order" },
  edit: { sw: "Hariri", en: "Edit" },
  hide: { sw: "Ficha", en: "Hide" },
  show: { sw: "Onyesha", en: "Show" },
  all: { sw: "Yote", en: "All" },
  pending: { sw: "Zinazosubiri", en: "Pending" },
  confirmed: { sw: "Zilizothibitishwa", en: "Confirmed" },
  outForDelivery: { sw: "Zinakwenda", en: "Out for delivery" },
  delivered: { sw: "Zimepokelewa", en: "Delivered" },
  cancelled: { sw: "Imefutwa", en: "Cancelled" },
  noOrders: { sw: "Hakuna maagizo", en: "No orders" },
  waitingMerchant: { sw: "Inasubiri uthibitisho wa mpokeaji", en: "Waiting for merchant delivery confirmation" },
  rejectOrder: { sw: "Kataa Agizo", en: "Reject order" },
  updating: { sw: "Inasasisha...", en: "Updating..." },
  saveProductSuccess: { sw: "Bidhaa imehifadhiwa", en: "Product saved" },
  saveProductError: { sw: "Imeshindikana kuhifadhi bidhaa", en: "Could not save product" },
  validProductError: { sw: "Weka jina na bei sahihi ya bidhaa", en: "Enter a valid product name and price" },
  toggleProductError: { sw: "Imeshindikana kubadili bidhaa", en: "Could not update product" },
  genericError: { sw: "Hitilafu imetokea", en: "Something went wrong" },
  formAdd: { sw: "Ongeza bidhaa", en: "Add product" },
  formEdit: { sw: "Hariri bidhaa", en: "Edit product" },
  productName: { sw: "Jina la bidhaa", en: "Product name" },
  productPlaceholder: { sw: "Mfano: Unga wa Sembe 25kg", en: "Example: Maize Flour 25kg" },
  price: { sw: "Bei", en: "Price" },
  unit: { sw: "Unit", en: "Unit" },
  skuOptional: { sw: "SKU hiari", en: "SKU optional" },
  noteOptional: { sw: "Maelezo hiari", en: "Optional note" },
  notePlaceholder: { sw: "Mfano: Bei ya jumla, delivery, size...", en: "Example: wholesale price, delivery, size..." },
  cancel: { sw: "Ghairi", en: "Cancel" },
  save: { sw: "Hifadhi", en: "Save" },
  saving: { sw: "Inahifadhi...", en: "Saving..." },
  language: { sw: "Lugha", en: "Language" },
};

export default function SupplierPortal() {
  const router = useRouter();
  const { toast } = useToast();
  const lang = useLang();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [updating, setUpdating] = useState<string | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SupplierProduct | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [productForm, setProductForm] = useState(emptyProductForm);

  useEffect(() => {
    Promise.all([
      api.get<{ user: CurrentUser }>("/auth/me"),
      api.get<DashboardData>("/suppliers/portal/dashboard"),
      api.get<{ orders: Order[] }>("/suppliers/portal/orders"),
      api.get<{ products: SupplierProduct[] }>("/suppliers/portal/products"),
    ])
      .then(([me, d, o, p]) => {
        setUser(me.user);
        if (me.user.language === "sw" || me.user.language === "en") {
          setLanguage(me.user.language);
        }
        setDashboard(d);
        setOrders(o.orders);
        setProducts(p.products);
      })
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [router]);

  const statusLabel: Record<string, string> = {
    PENDING: copy.pending[lang],
    CONFIRMED: copy.confirmed[lang],
    OUT_FOR_DELIVERY: copy.outForDelivery[lang],
    DELIVERED: copy.delivered[lang],
    CANCELLED: copy.cancelled[lang],
  };

  // Supplier advances orders up to OUT_FOR_DELIVERY only.
  // The merchant confirms delivery, which also restocks their inventory.
  const statusNext: Record<string, { action: string; label: string; color: string }> = {
    PENDING: { action: "CONFIRMED", label: lang === "sw" ? "Thibitisha" : "Confirm", color: "bg-blue-600" },
    CONFIRMED: { action: "OUT_FOR_DELIVERY", label: lang === "sw" ? "Safirishwa" : "Mark out for delivery", color: "bg-purple-600" },
  };

  async function updateStatus(orderId: string, status: string) {
    setUpdating(orderId);
    try {
      await api.patch(`/suppliers/portal/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : copy.genericError[lang], "error");
    } finally {
      setUpdating(null);
    }
  }

  async function changeLanguage(nextLang: Lang) {
    setLanguage(nextLang);
    setUser((current) => current ? { ...current, language: nextLang } : current);
    try {
      await api.patch("/auth/language", { language: nextLang });
    } catch {
      toast(copy.genericError[nextLang], "error");
    }
  }

  async function logout() {
    try { await api.post("/auth/logout", {}); } catch {}
    clearToken();
    router.push("/");
  }

  function openNewProduct() {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setShowProductForm(true);
  }

  function openEditProduct(product: SupplierProduct) {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku || "",
      unit: product.unit,
      price: String(product.price),
      minOrderQty: String(product.minOrderQty),
      note: product.note || "",
    });
    setShowProductForm(true);
  }

  async function saveProduct() {
    if (!productForm.name.trim() || Number(productForm.price) < 0 || productForm.price === "") {
      toast(copy.validProductError[lang], "error");
      return;
    }
    setSavingProduct(true);
    try {
      const body = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim() || undefined,
        unit: productForm.unit.trim() || "pcs",
        price: Number(productForm.price),
        minOrderQty: Number(productForm.minOrderQty) || 1,
        note: productForm.note.trim() || undefined,
      };
      if (editingProduct) {
        const data = await api.patch<{ product: SupplierProduct }>(`/suppliers/portal/products/${editingProduct.id}`, body);
        setProducts((prev) => prev.map((item) => item.id === editingProduct.id ? data.product : item));
      } else {
        const data = await api.post<{ product: SupplierProduct }>("/suppliers/portal/products", body);
        setProducts((prev) => [data.product, ...prev]);
      }
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm(emptyProductForm);
      toast(copy.saveProductSuccess[lang], "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : copy.saveProductError[lang], "error");
    } finally {
      setSavingProduct(false);
    }
  }

  async function toggleProduct(product: SupplierProduct) {
    try {
      const data = await api.patch<{ product: SupplierProduct }>(`/suppliers/portal/products/${product.id}`, { isAvailable: !product.isAvailable });
      setProducts((prev) => prev.map((item) => item.id === product.id ? data.product : item));
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : copy.toggleProductError[lang], "error");
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);
  const isAdmin = user?.role === "ADMIN";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-brand-800 text-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 rounded-xl bg-white shadow-sm" />
            <div>
              <p className="font-bold">{copy.title[lang]}</p>
              <p className="text-brand-300 text-xs">{copy.subtitle[lang]}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-brand-600 bg-brand-900/40 p-0.5" title={copy.language[lang]}>
              {(["sw", "en"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => changeLanguage(option)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold ${lang === option ? "bg-white text-brand-800" : "text-brand-200 hover:text-white"}`}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => isAdmin ? router.push("/admin") : logout()}
              className="flex items-center gap-1.5 text-brand-300 hover:text-white text-sm min-h-0">
              {isAdmin ? <ArrowLeft className="w-4 h-4" /> : <LogOut className="w-4 h-4" />} {isAdmin ? copy.backAdmin[lang] : copy.logout[lang]}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 pb-10">
        {/* Stats */}
        {dashboard && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: copy.pending[lang], value: dashboard.ordersByStatus["PENDING"] || 0, color: "text-yellow-600" },
              { label: copy.confirmed[lang], value: dashboard.ordersByStatus["CONFIRMED"] || 0, color: "text-blue-600" },
              { label: copy.outForDelivery[lang], value: dashboard.ordersByStatus["OUT_FOR_DELIVERY"] || 0, color: "text-purple-600" },
              { label: copy.delivered[lang], value: dashboard.ordersByStatus["DELIVERED"] || 0, color: "text-green-600" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-gray-900"><Package className="h-4 w-4 text-brand-700" /> {copy.productsTitle[lang]}</h2>
              <p className="text-xs text-gray-500">{copy.productsHint[lang]}</p>
            </div>
            <button onClick={openNewProduct} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
              <Plus className="h-4 w-4" /> {copy.add[lang]}
            </button>
          </div>
          {products.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
              {copy.noProducts[lang]}
            </div>
          ) : (
            <div className="grid gap-2">
              {products.map((product) => (
                <div key={product.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${product.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                          {product.isAvailable ? copy.available[lang] : copy.hidden[lang]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-brand-700">{formatTZS(product.price)} / {product.unit}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {copy.minOrder[lang]} {product.minOrderQty} {product.unit}{product.sku ? ` - SKU ${product.sku}` : ""}
                      </p>
                      {product.note && <p className="mt-1 text-xs text-gray-500">{product.note}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => openEditProduct(product)} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:text-brand-700">
                        <Edit2 className="h-3.5 w-3.5" /> {copy.edit[lang]}
                      </button>
                      <button onClick={() => toggleProduct(product)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${product.isAvailable ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                        {product.isAvailable ? copy.hide[lang] : copy.show[lang]}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {[
            { v: "all", label: copy.all[lang] },
            { v: "PENDING", label: copy.pending[lang] },
            { v: "CONFIRMED", label: copy.confirmed[lang] },
            { v: "OUT_FOR_DELIVERY", label: copy.outForDelivery[lang] },
            { v: "DELIVERED", label: copy.delivered[lang] },
          ].map(({ v, label }) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium min-h-0 ${
                statusFilter === v ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Orders */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{copy.noOrders[lang]}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const nextAction = statusNext[order.status];
              return (
                <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{order.shop.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          order.status === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          order.status === "CONFIRMED" ? "bg-blue-100 text-blue-700" :
                          order.status === "OUT_FOR_DELIVERY" ? "bg-purple-100 text-purple-700" :
                          order.status === "DELIVERED" ? "bg-green-100 text-green-700" :
                          "bg-gray-100 text-gray-500"
                        }`}>
                          {statusLabel[order.status]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {order.shop.location}{order.shop.district ? `, ${order.shop.district}` : ""} â€¢{" "}
                        #{order.id.slice(-6).toUpperCase()}
                      </p>
                      {order.totalAmount && (
                        <p className="text-sm font-bold text-brand-700 mt-1">{formatTZS(order.totalAmount)}</p>
                      )}
                    </div>
                    <button onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                      aria-label={`${expanded === order.id ? "Collapse" : "Expand"} order ${order.shop.name}`}
                      className="text-gray-400 min-h-0">
                      {expanded === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {expanded === order.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="space-y-1 mb-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{item.product.name}</span>
                            <span className="font-medium">{item.quantity} {item.product.unit}</span>
                          </div>
                        ))}
                      </div>
                      {order.note && <p className="text-xs text-gray-400 italic mb-3">"{order.note}"</p>}

                      {nextAction && (
                        <button
                          onClick={() => updateStatus(order.id, nextAction.action)}
                          disabled={updating === order.id}
                          aria-label={`${nextAction.label} ${order.shop.name}`}
                          className={`w-full ${nextAction.color} text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-2`}
                        >
                          {updating === order.id ? (
                            copy.updating[lang]
                          ) : (
                            <>
                              <Check className="w-4 h-4" />
                              {nextAction.label}
                            </>
                          )}
                        </button>
                      )}

                      {order.status === "OUT_FOR_DELIVERY" && (
                        <p className="text-xs text-gray-400 text-center mt-2">
                          {copy.waitingMerchant[lang]}
                        </p>
                      )}
                      {order.status === "PENDING" && (
                        <button onClick={() => updateStatus(order.id, "CANCELLED")}
                          aria-label={`${copy.rejectOrder[lang]} ${order.shop.name}`}
                          className="w-full mt-2 border border-red-200 text-red-600 py-2 rounded-lg text-sm hover:bg-red-50 flex items-center justify-center gap-2">
                          <X className="w-3.5 h-3.5" /> {copy.rejectOrder[lang]}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {showProductForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="font-semibold text-gray-900">{editingProduct ? copy.formEdit[lang] : copy.formAdd[lang]}</h3>
              <button onClick={() => setShowProductForm(false)} className="text-gray-400 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{copy.productName[lang]}</label>
                <input
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder={copy.productPlaceholder[lang]}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{copy.price[lang]}</label>
                  <input
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    type="number"
                    min="0"
                    inputMode="numeric"
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{copy.unit[lang]}</label>
                  <input
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    placeholder="pcs, box, kg"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{copy.minOrder[lang]}</label>
                  <input
                    value={productForm.minOrderQty}
                    onChange={(e) => setProductForm({ ...productForm, minOrderQty: e.target.value })}
                    type="number"
                    min="1"
                    inputMode="numeric"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">{copy.skuOptional[lang]}</label>
                  <input
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="Code"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{copy.noteOptional[lang]}</label>
                <textarea
                  value={productForm.note}
                  onChange={(e) => setProductForm({ ...productForm, note: e.target.value })}
                  rows={3}
                  placeholder={copy.notePlaceholder[lang]}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowProductForm(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-semibold text-gray-700">
                  {copy.cancel[lang]}
                </button>
                <button onClick={saveProduct} disabled={savingProduct} className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {savingProduct ? copy.saving[lang] : copy.save[lang]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
