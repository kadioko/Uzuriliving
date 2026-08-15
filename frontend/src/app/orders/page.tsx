"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { Plus, MessageCircle, RotateCcw, Check, X, Truck, Clock, ChevronDown, ChevronUp, PackagePlus } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Supplier {
  id: string;
  name: string;
  phone: string;
}

interface SupplierCatalogProduct {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  price: number;
  minOrderQty: number;
  note?: string | null;
}

interface SupplierDetails {
  id: string;
  name: string;
  catalogProducts: SupplierCatalogProduct[];
}

interface Product {
  id: string;
  name: string;
  unit: string;
  buyingPrice: number;
  currentStock: number;
  minimumStock: number;
  onOrderQuantity?: number;
  isReorderable: boolean;
  note?: string | null;
  supplier?: { id: string };
  supplierCatalogProductId?: string | null;
}

interface OrderItem {
  productId: string;
  product: { id: string; name: string; unit: string };
  quantity: number;
  note?: string | null;
  unitPrice?: number;
}

interface Order {
  id: string;
  status: string;
  totalAmount?: number;
  note?: string;
  createdAt: string;
  supplier: { id: string; name: string; phone: string };
  items: OrderItem[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export default function OrdersPage() {
  const lang = useLang();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierCatalog, setSupplierCatalog] = useState<SupplierCatalogProduct[]>([]);
  const [catalogImport, setCatalogImport] = useState<SupplierCatalogProduct | null>(null);
  const [retailPriceDraft, setRetailPriceDraft] = useState("");
  const [minimumStockDraft, setMinimumStockDraft] = useState("5");
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number; note?: string | null }[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState<{ message: string; whatsappUrl: string | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const data = await api.get<{ orders: Order[] }>(`/orders${params}`);
    setOrders(data.orders);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    Promise.all([
      api.get<{ suppliers: Supplier[] }>("/suppliers"),
      api.get<{ products: Product[] }>("/products"),
    ]).then(([sd, pd]) => {
      setSuppliers(sd.suppliers);
      setProducts(pd.products);
    });
  }, []);

  const supplierProducts = selectedSupplier
    ? products.filter((p) => p.supplier?.id === selectedSupplier || !p.supplier)
    : products;

  function addItem(productId: string) {
    setOrderItems((prev) => {
      if (prev.find((i) => i.productId === productId)) return prev;
      const product = products.find((item) => item.id === productId);
      return [...prev, { productId, quantity: 1, note: product?.note || "" }];
    });
  }

  async function selectSupplier(supplierId: string) {
    setSelectedSupplier(supplierId);
    setSupplierCatalog([]);
    if (!supplierId) return;
    try {
      const data = await api.get<{ supplier: SupplierDetails }>(`/suppliers/${supplierId}`);
      setSupplierCatalog(data.supplier.catalogProducts || []);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    }
  }

  function openCatalogImport(product: SupplierCatalogProduct) {
    setCatalogImport(product);
    setRetailPriceDraft(String(product.price));
    setMinimumStockDraft("5");
  }

  async function importCatalogProduct() {
    if (!catalogImport || !selectedSupplier) return;
    const sellingPrice = Number(retailPriceDraft);
    const minimumStock = Number(minimumStockDraft);
    if (!Number.isInteger(sellingPrice) || sellingPrice < 0 || !Number.isInteger(minimumStock) || minimumStock < 0) {
      toast(lang === "sw" ? "Weka bei na kiwango cha stock kwa namba kamili." : "Enter whole-number selling price and minimum stock.", "error");
      return;
    }
    setSaving(true);
    try {
      const data = await api.post<{ product: Product }>(`/suppliers/${selectedSupplier}/catalog/${catalogImport.id}/import`, { sellingPrice, minimumStock });
      setProducts((current) => {
        const withoutCurrent = current.filter((product) => product.id !== data.product.id);
        return [...withoutCurrent, data.product];
      });
      addItem(data.product.id);
      setCatalogImport(null);
      toast(lang === "sw" ? "Bidhaa imeongezwa kwenye inventory na order." : "Product added to inventory and this order.", "success");
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    } finally {
      setSaving(false);
    }
  }

  function updateItemQty(productId: string, qty: number) {
    setOrderItems((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, quantity: Math.max(1, qty) } : i)
    );
  }

  function updateItemNote(productId: string, note: string) {
    setOrderItems((prev) => prev.map((item) => item.productId === productId ? { ...item, note } : item));
  }

  function removeItem(productId: string) {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function fillLowStock() {
    const lowItems = supplierProducts
      .filter((p) => p.isReorderable !== false && p.currentStock <= p.minimumStock && (p.onOrderQuantity ?? 0) < Math.max(p.minimumStock - p.currentStock, 1))
      .map((p) => ({
        productId: p.id,
        quantity: Math.max(p.minimumStock - p.currentStock + 5, 5),
        note: p.note || "",
      }));
    setOrderItems(lowItems);
  }

  async function handleCreate() {
    if (!selectedSupplier || orderItems.length === 0) return;
    setSaving(true);
    try {
      const data = await api.post<{ order: Order; whatsappMessage: { message: string; whatsappUrl: string | null } }>("/orders", {
        supplierId: selectedSupplier,
        items: orderItems,
        note: note || undefined,
      });
      setWhatsappMsg(data.whatsappMessage);
      setShowForm(false);
      setOrderItems([]);
      setNote("");
      fetchOrders();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t("common.error", lang), "error");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelivery(orderId: string) {
    if (!confirm(t("orders.confirmDeliveryPrompt", lang))) return;
    await api.patch(`/orders/${orderId}/confirm-delivery`, {});
    fetchOrders();
  }

  async function handleReorder(orderId: string) {
    const data = await api.post<{ order: Order; whatsappMessage: { message: string; whatsappUrl: string | null } }>(
      `/orders/${orderId}/reorder`, {}
    );
    setWhatsappMsg(data.whatsappMessage);
    fetchOrders();
  }

  async function showWhatsApp(orderId: string) {
    const data = await api.get<{ whatsappMessage: { message: string; whatsappUrl: string | null } }>(`/orders/${orderId}`);
    setWhatsappMsg(data.whatsappMessage);
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  const STATUS_FILTERS = [
    { v: "all", labelKey: "orders.all" },
    { v: "PENDING", labelKey: "orders.status.PENDING" },
    { v: "CONFIRMED", labelKey: "orders.status.CONFIRMED" },
    { v: "OUT_FOR_DELIVERY", labelKey: "orders.status.OUT_FOR_DELIVERY" },
    { v: "DELIVERED", labelKey: "orders.status.DELIVERED" },
  ];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24 lg:pb-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">{t("orders.title", lang)}</h1>
          <button onClick={() => { setShowForm(true); setOrderItems([]); setNote(""); setSelectedSupplier(""); setSupplierCatalog([]); }}
            className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("orders.newOrder", lang)}</span>
          </button>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {STATUS_FILTERS.map(({ v, labelKey }) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-0 ${
                statusFilter === v ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600"
              }`}>
              {t(labelKey, lang)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">{t("common.loading", lang)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{t("orders.none", lang)}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{order.supplier.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>
                        {t(`orders.status.${order.status}`, lang)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      #{order.id.slice(-8).toUpperCase()} •{" "}
                      {new Date(order.createdAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short" })}
                    </p>
                    {order.totalAmount && (
                      <p className="text-sm font-bold text-brand-700 mt-1">{formatTZS(order.totalAmount)}</p>
                    )}
                  </div>
                  <button onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="text-gray-400 min-h-0">
                    {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {expandedOrder === order.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="space-y-1 mb-3">
                      {order.items.map((item) => (
                        <div key={item.productId} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.product.name}</span>
                          <span className="font-medium">{item.quantity} {item.product.unit}</span>
                        </div>
                      ))}
                    </div>
                    {order.note && <p className="text-xs text-gray-400 italic mb-3">"{order.note}"</p>}

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => showWhatsApp(order.id)}
                        className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium min-h-0">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      {order.status === "DELIVERED" || order.status === "CANCELLED" ? (
                        <button onClick={() => handleReorder(order.id)}
                          className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-medium min-h-0">
                          <RotateCcw className="w-3.5 h-3.5" /> {t("orders.reorder", lang)}
                        </button>
                      ) : null}
                      {(order.status === "CONFIRMED" || order.status === "OUT_FOR_DELIVERY") && (
                        <button onClick={() => confirmDelivery(order.id)}
                          className="flex items-center gap-1.5 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-3 py-1.5 rounded-lg font-medium min-h-0">
                          <Check className="w-3.5 h-3.5" /> {t("orders.confirmDelivery", lang)}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Order Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">{t("orders.newOrderTitle", lang)}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 min-h-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t("orders.supplierLabel", lang)}</label>
                <select value={selectedSupplier} onChange={(e) => selectSupplier(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">{t("orders.selectSupplier", lang)}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">{t("orders.productsLabel", lang)}</label>
                  <button onClick={fillLowStock}
                    className="text-xs text-brand-600 hover:underline min-h-0 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {t("orders.fillLowStock", lang)}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-2">
                  {supplierProducts.map((p) => {
                    const inOrder = orderItems.find((i) => i.productId === p.id);
                    return (
                      <button key={p.id} onClick={() => addItem(p.id)}
                        className={`text-left p-2 rounded-lg border text-xs transition-all ${inOrder ? "border-brand-400 bg-brand-50" : "border-gray-200 hover:border-brand-300"}`}>
                        <p className="font-medium text-gray-800">{p.name}</p>
                        <p className="text-gray-400">{p.currentStock} {t("orders.remaining", lang)}</p>
                      </button>
                    );
                  })}
                </div>
                {orderItems.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {orderItems.map((item) => {
                      const p = products.find((pr) => pr.id === item.productId);
                      return (
                        <div key={item.productId} className="bg-gray-50 rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <span className="flex-1 text-xs font-medium text-gray-700">{p?.name}</span>
                            <input type="number" value={item.quantity} min={1}
                              onChange={(e) => updateItemQty(item.productId, Number(e.target.value))}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center focus:outline-none" />
                            <span className="text-xs text-gray-400">{p?.unit}</span>
                            <button onClick={() => removeItem(item.productId)} className="text-gray-300 hover:text-red-400 min-h-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input value={item.note || ""} onChange={(e) => updateItemNote(item.productId, e.target.value)} maxLength={500}
                            placeholder={lang === "sw" ? "Maelezo ya order hii (rangi, discount, n.k.)" : "Notes for this order (colour, discount, etc.)"}
                            className="mt-2 w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedSupplier && supplierCatalog.length > 0 && (
                <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <PackagePlus className="h-4 w-4 text-brand-700" />
                    <p className="text-xs font-semibold text-brand-900">{lang === "sw" ? "Bidhaa za catalog ya supplier" : "Supplier catalog products"}</p>
                  </div>
                  <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {supplierCatalog.map((product) => (
                      <button key={product.id} type="button" onClick={() => openCatalogImport(product)} className="rounded-lg border border-brand-100 bg-white p-2 text-left hover:border-brand-400">
                        <p className="text-xs font-semibold text-gray-900">{product.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatTZS(product.price)} / {product.unit} - {product.minOrderQty}+ {lang === "sw" ? "kwa order" : "per order"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">{t("orders.noteLabel", lang)}</label>
                <input value={note} onChange={(e) => setNote(e.target.value)}
                  placeholder={t("orders.notePlaceholder", lang)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm">{t("common.cancel", lang)}</button>
                <button onClick={handleCreate} disabled={saving || !selectedSupplier || orderItems.length === 0}
                  className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                  {saving ? "..." : t("orders.submit", lang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal */}
      {whatsappMsg && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" /> {t("orders.whatsappTitle", lang)}
              </h3>
              <button onClick={() => setWhatsappMsg(null)} className="text-gray-400 min-h-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              <pre className="bg-gray-50 rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap mb-4 font-sans max-h-48 overflow-y-auto">
                {whatsappMsg.message}
              </pre>
              <div className="flex gap-2">
                <button onClick={() => navigator.clipboard.writeText(whatsappMsg.message)}
                  className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm">
                  {t("orders.copyMessage", lang)}
                </button>
                {whatsappMsg.whatsappUrl && (
                  <a href={whatsappMsg.whatsappUrl} target="_blank" rel="noreferrer"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-medium text-center flex items-center justify-center gap-2">
                    <MessageCircle className="w-4 h-4" /> {t("orders.openWhatsApp", lang)}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {catalogImport && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="font-semibold text-gray-950">{catalogImport.name}</h3>
                <p className="text-xs text-gray-500">{lang === "sw" ? "Gharama ya supplier" : "Supplier cost"}: {formatTZS(catalogImport.price)} / {catalogImport.unit}</p>
              </div>
              <button type="button" onClick={() => setCatalogImport(null)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <label className="block text-sm font-medium text-gray-700">
                {lang === "sw" ? "Bei yako ya kuuza (TZS)" : "Your retail price (TZS)"}
                <input value={retailPriceDraft} onChange={(event) => setRetailPriceDraft(event.target.value)} type="number" min="0" step="1" inputMode="numeric" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                {lang === "sw" ? "Kiwango cha tahadhari ya stock" : "Low-stock alert level"}
                <input value={minimumStockDraft} onChange={(event) => setMinimumStockDraft(event.target.value)} type="number" min="0" step="1" inputMode="numeric" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <p className="text-xs leading-5 text-gray-500">{lang === "sw" ? "Bidhaa itaongezwa kwenye inventory yako ikiwa na stock sifuri, kisha itaongezwa kwenye order hii. Stock itaingia ukithibitisha delivery." : "This adds a zero-stock item to your inventory and to this order. Stock is added only when delivery is confirmed."}</p>
              <button type="button" disabled={saving} onClick={importCatalogProduct} className="min-h-11 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {saving ? "..." : (lang === "sw" ? "Ongeza kwenye inventory na order" : "Add to inventory and order")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
