"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { Plus, MessageCircle, RotateCcw, Check, X, Truck, Clock, ChevronDown, ChevronUp, PackagePlus, Download, FileImage, Search } from "lucide-react";
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
  imageUrl?: string | null;
  supplier?: { id: string; name?: string; phone?: string };
  supplierCatalogProductId?: string | null;
}

interface OrderItem {
  productId: string;
  product: { id: string; name: string; unit: string; imageUrl?: string | null; currentStock?: number };
  quantity: number;
  note?: string | null;
  unitPrice?: number;
}

interface Order {
  id: string;
  orderGroupId?: string | null;
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
  const [productSearch, setProductSearch] = useState("");

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

  const supplierProducts = products;
  const visibleSupplierProducts = supplierProducts.filter((product) => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return true;
    return `${product.name} ${product.supplier?.name || ""}`.toLowerCase().includes(query);
  });
  const selectedSupplierCount = new Set(orderItems.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return product ? supplierForProduct(product) : "";
  }).filter(Boolean)).size;
  const estimatedTotal = orderItems.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return sum + (product?.buyingPrice || 0) * item.quantity;
  }, 0);

  function supplierForProduct(product: Product) {
    return product.supplier?.id || selectedSupplier;
  }

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
    if (orderItems.length === 0) return;
    const groups = new Map<string, typeof orderItems>();
    for (const item of orderItems) {
      const product = products.find((p) => p.id === item.productId);
      const supplierId = product ? supplierForProduct(product) : "";
      if (!supplierId) {
        toast(lang === "sw" ? "Chagua supplier kwa bidhaa zote zisizo na supplier." : "Choose a supplier for products without one.", "error");
        return;
      }
      groups.set(supplierId, [...(groups.get(supplierId) || []), item]);
    }
    setSaving(true);
    try {
      const orderGroupId = crypto.randomUUID();
      const created = await Promise.all([...groups.entries()].map(async ([supplierId, items]) => {
        return api.post<{ order: Order; whatsappMessage: { message: string; whatsappUrl: string | null } }>("/orders", {
          supplierId, items, note: note || undefined, orderGroupId,
        });
      }));
      setWhatsappMsg(created[0]?.whatsappMessage || null);
      setShowForm(false);
      setOrderItems([]);
      setNote("");
      setProductSearch("");
      toast(lang === "sw" ? `${created.length} supplier order zimeundwa.` : `${created.length} supplier order${created.length === 1 ? "" : "s"} created.`, "success");
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

  async function updateStatus(orderId: string, status: string) {
    try {
      if (status === "DELIVERED") {
        if (!confirm(t("orders.confirmDeliveryPrompt", lang))) return;
        await api.patch(`/orders/${orderId}/confirm-delivery`, {});
      } else {
        await api.patch(`/orders/${orderId}`, { status });
      }
      toast(lang === "sw" ? "Hali ya order imebadilishwa." : "Order status updated.", "success");
      await fetchOrders();
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    }
  }

  function escapeHtml(value: string) {
    return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[char] || char));
  }

  function orderMarkup(batch: Order[]) {
    const first = batch[0];
    const date = new Date(first.createdAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short", year: "numeric" });
    return `<div class="order-sheet"><h1>Uzuri Living</h1><h2>Supplier order follow-up</h2><p><b>Suppliers:</b> ${batch.map((order) => escapeHtml(order.supplier.name)).join(", ")} &nbsp; <b>Order:</b> #${(first.orderGroupId || first.id).slice(-8).toUpperCase()} &nbsp; <b>Date:</b> ${date}</p>${batch.map((order) => `<h3>${escapeHtml(order.supplier.name)} <span class="status">${escapeHtml(order.status)}</span></h3><table><thead><tr><th>Product</th><th>Available stock</th><th>Order quantity</th><th>Notes</th></tr></thead><tbody>${order.items.map((item) => `<tr><td class="product">${item.product.imageUrl ? `<img src="${item.product.imageUrl}" alt="" />` : ""}<span>${escapeHtml(item.product.name)}</span></td><td>${item.product.currentStock ?? "-"} ${escapeHtml(item.product.unit)}</td><td>${item.quantity} ${escapeHtml(item.product.unit)}</td><td>${escapeHtml(item.note || "")}</td></tr>`).join("")}</tbody></table>`).join("")}<h3>Total: ${formatTZS(batch.reduce((sum, order) => sum + (order.totalAmount || 0), 0))}</h3></div>`;
  }

  async function downloadPdf(batch: Order[]) {
    const order = batch[0];
    const popup = window.open("", "_blank", "width=850,height=700");
    if (!popup) { toast(lang === "sw" ? "Ruhusu pop-ups ili kuhifadhi PDF." : "Allow pop-ups to save the PDF.", "error"); return; }
    popup.document.write(`<html><head><title>Order ${(order.orderGroupId || order.id).slice(-8).toUpperCase()}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1f2937}.order-sheet{max-width:760px;margin:auto}h1{color:#b56600;margin-bottom:4px}h2{margin-top:0;font-size:20px}h3{margin:22px 0 4px}.status{font-size:11px;background:#fff3d6;padding:4px 8px;border-radius:10px}table{border-collapse:collapse;width:100%;margin-top:6px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;font-size:12px}th{background:#fff3d6}.product{display:flex;align-items:center;gap:8px}.product img{height:48px;width:48px;object-fit:cover;border-radius:6px}hr{border:0;border-top:1px solid #e5e7eb}</style></head><body>${orderMarkup(batch)}</body></html>`);
    popup.document.close();
    await Promise.all([...popup.document.images].map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
    popup.focus(); popup.print();
  }

  async function downloadJpg(batch: Order[]) {
    const width = 1400;
    const pagePadding = 64;
    const rowHeight = 136;
    const supplierBlockHeight = (order: Order) => 70 + order.items.length * rowHeight;
    const height = 360 + batch.reduce((sum, order) => sum + supplierBlockHeight(order), 0) + 110;
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    const wrapText = (text: string, maxWidth: number, maxLines = 2) => {
      const words = text.trim().split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (context.measureText(next).width <= maxWidth || !line) line = next;
        else { lines.push(line); line = word; }
        if (lines.length === maxLines) break;
      }
      if (lines.length < maxLines && line) lines.push(line);
      if (words.length && lines.length === maxLines && !lines[maxLines - 1].endsWith("…")) lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(1, lines[maxLines - 1].length - 1))}…`;
      return lines;
    };
    const drawRounded = (x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string) => {
      context.beginPath(); context.roundRect(x, y, w, h, radius); context.fillStyle = fill; context.fill();
      if (stroke) { context.strokeStyle = stroke; context.stroke(); }
    };
    const loadImage = (url: string) => new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = url;
    });
    context.fillStyle = "#fffaf0"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#d47f00"; context.fillRect(0, 0, canvas.width, 18);
    drawRounded(pagePadding, 48, width - pagePadding * 2, 220, 24, "#ffffff", "#f1dfb7");
    context.fillStyle = "#b56600"; context.font = "bold 42px Arial"; context.fillText("Uzuri Living", pagePadding + 32, 105);
    context.fillStyle = "#1f2937"; context.font = "bold 28px Arial"; context.fillText("Supplier order follow-up", pagePadding + 32, 150);
    context.fillStyle = "#64748b"; context.font = "20px Arial"; context.fillText(`Order #${(batch[0].orderGroupId || batch[0].id).slice(-8).toUpperCase()}`, pagePadding + 32, 194);
    const date = new Date(batch[0].createdAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short", year: "numeric" });
    context.fillText(date, width - pagePadding - 220, 194);
    const supplierText = batch.map((order) => order.supplier.name).join(", ");
    context.font = "bold 18px Arial"; context.fillStyle = "#854b08"; context.fillText("SUPPLIERS", width - pagePadding - 360, 90);
    context.font = "18px Arial"; context.fillStyle = "#334155"; wrapText(supplierText, 330, 3).forEach((line, index) => context.fillText(line, width - pagePadding - 360, 120 + index * 27));
    let y = 308;
    for (const order of batch) {
      drawRounded(pagePadding, y, width - pagePadding * 2, 48, 14, "#fff0c9");
      context.fillStyle = "#854b08"; context.font = "bold 21px Arial"; context.fillText(order.supplier.name, pagePadding + 18, y + 31);
      context.fillStyle = "#6b7280"; context.font = "bold 15px Arial"; context.fillText(order.status.replaceAll("_", " "), width - pagePadding - 190, y + 30);
      y += 62;
      for (const item of order.items) {
        drawRounded(pagePadding, y, width - pagePadding * 2, rowHeight - 10, 16, "#ffffff", "#eadfca");
        if (item.product.imageUrl) {
          const image = await loadImage(item.product.imageUrl);
          if (image) { context.save(); context.beginPath(); context.roundRect(pagePadding + 16, y + 16, 88, 88, 12); context.clip(); context.drawImage(image, pagePadding + 16, y + 16, 88, 88); context.restore(); }
        }
        context.fillStyle = "#1f2937"; context.font = "bold 21px Arial";
        wrapText(item.product.name, 510, 2).forEach((line, index) => context.fillText(line, pagePadding + 126, y + 43 + index * 27));
        context.fillStyle = "#64748b"; context.font = "17px Arial"; context.fillText(`Available in shop: ${item.product.currentStock ?? "-"} ${item.product.unit}`, pagePadding + 126, y + 96);
        context.fillStyle = "#64748b"; context.font = "bold 15px Arial"; context.fillText("ORDER QUANTITY", pagePadding + 760, y + 33);
        context.fillStyle = "#b56600"; context.font = "bold 26px Arial"; context.fillText(`${item.quantity} ${item.product.unit}`, pagePadding + 760, y + 70);
        context.fillStyle = "#64748b"; context.font = "bold 15px Arial"; context.fillText("NOTE", pagePadding + 1000, y + 33);
        context.fillStyle = "#334155"; context.font = "16px Arial"; wrapText(item.note || "No note", 250, 3).forEach((line, index) => context.fillText(line, pagePadding + 1000, y + 62 + index * 22));
        y += rowHeight;
      }
      y += 8;
    }
    drawRounded(pagePadding, y, width - pagePadding * 2, 70, 16, "#102a43");
    context.fillStyle = "#ffffff"; context.font = "bold 22px Arial"; context.fillText("Estimated total", pagePadding + 24, y + 44);
    context.textAlign = "right"; context.font = "bold 28px Arial"; context.fillText(formatTZS(batch.reduce((sum, order) => sum + (order.totalAmount || 0), 0)), width - pagePadding - 24, y + 45); context.textAlign = "left";
    const link = document.createElement("a"); link.download = `uzuri-order-${(batch[0].orderGroupId || batch[0].id).slice(-8)}.jpg`; link.href = canvas.toDataURL("image/jpeg", 0.92); link.click();
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);
  const grouped = useMemo(() => {
    const batches = new Map<string, Order[]>();
    for (const order of filtered) {
      const key = order.orderGroupId || order.id;
      batches.set(key, [...(batches.get(key) || []), order]);
    }
    return [...batches.entries()].map(([key, batch]) => ({ key, orders: batch }));
  }, [filtered]);

  const STATUS_FILTERS = [
    { v: "all", labelKey: "orders.all" },
    { v: "PENDING", labelKey: "orders.status.PENDING" },
    { v: "CONFIRMED", labelKey: "orders.status.CONFIRMED" },
    { v: "OUT_FOR_DELIVERY", labelKey: "orders.status.OUT_FOR_DELIVERY" },
    { v: "DELIVERED", labelKey: "orders.status.DELIVERED" },
    { v: "CANCELLED", labelKey: "orders.status.CANCELLED" },
  ];

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24 lg:pb-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">{t("orders.title", lang)}</h1>
          <button onClick={() => { setShowForm(true); setOrderItems([]); setNote(""); setProductSearch(""); setSelectedSupplier(""); setSupplierCatalog([]); }}
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
            {grouped.map(({ key: batchKey, orders: batch }) => {
              const order = batch[0];
              const allDelivered = batch.every((item) => item.status === "DELIVERED");
              const allCancelled = batch.every((item) => item.status === "CANCELLED");
              return (
              <div key={batchKey} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{batch.map((item) => item.supplier.name).join(" + ")}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${batch.length > 1 ? "bg-indigo-100 text-indigo-700" : STATUS_COLOR[order.status]}`}>
                        {batch.length > 1 ? (lang === "sw" ? `${batch.length} suppliers` : `${batch.length} suppliers`) : t(`orders.status.${order.status}`, lang)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      #{batchKey.slice(-8).toUpperCase()} •{" "}
                      {new Date(order.createdAt).toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short" })}
                    </p>
                    {batch.reduce((sum, item) => sum + (item.totalAmount || 0), 0) > 0 && (
                      <p className="text-sm font-bold text-brand-700 mt-1">{formatTZS(batch.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}</p>
                    )}
                  </div>
                  <button onClick={() => setExpandedOrder(expandedOrder === batchKey ? null : batchKey)}
                    className="text-gray-400 min-h-0">
                    {expandedOrder === batchKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {expandedOrder === batchKey && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="space-y-3 mb-3">
                      {batch.map((supplierOrder) => <div key={supplierOrder.id} className="rounded-lg border border-gray-100 p-2">
                        <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold text-brand-700">{supplierOrder.supplier.name}</p><span className={`text-[11px] rounded-full px-2 py-0.5 font-semibold ${STATUS_COLOR[supplierOrder.status]}`}>{t(`orders.status.${supplierOrder.status}`, lang)}</span></div>
                        {supplierOrder.items.map((item) => <div key={`${supplierOrder.id}-${item.productId}`} className="flex items-center gap-3 border-b border-gray-100 py-2 text-sm last:border-0">
                          {item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-gray-200 object-cover" /> : <div className="h-10 w-10 rounded-lg bg-gray-100" />}
                          <span className="flex-1 text-gray-600">{item.product.name}<span className="block text-xs text-gray-400">Available: {item.product.currentStock ?? "-"} {item.product.unit}{item.note ? ` · ${item.note}` : ""}</span></span>
                          <span className="font-medium">{item.quantity} {item.product.unit}</span>
                        </div>)}
                      </div>)}
                    </div>
                    {batch.some((item) => item.note) && <p className="text-xs text-gray-400 italic mb-3">{batch.filter((item) => item.note).map((item) => `"${item.note}"`).join(" · ")}</p>}

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => showWhatsApp(order.id)}
                        className="flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg font-medium min-h-0">
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </button>
                      <button onClick={() => void downloadPdf(batch)} className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-medium min-h-0"><Download className="w-3.5 h-3.5" /> PDF</button>
                      <button onClick={() => void downloadJpg(batch)} className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg font-medium min-h-0"><FileImage className="w-3.5 h-3.5" /> JPG</button>
                      {allDelivered || allCancelled ? (
                        <button onClick={() => handleReorder(order.id)}
                          className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-medium min-h-0">
                          <RotateCcw className="w-3.5 h-3.5" /> {t("orders.reorder", lang)}
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      {batch.map((supplierOrder) => <div key={supplierOrder.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="mr-auto font-semibold text-gray-700">{supplierOrder.supplier.name}</span>{supplierOrder.status === "PENDING" && <><button onClick={() => void updateStatus(supplierOrder.id, "CONFIRMED")} className="rounded-lg bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 min-h-0">Confirm</button><button onClick={() => void updateStatus(supplierOrder.id, "CANCELLED")} className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700 min-h-0">Cancel</button></>}{supplierOrder.status === "CONFIRMED" && <><button onClick={() => void updateStatus(supplierOrder.id, "OUT_FOR_DELIVERY")} className="rounded-lg bg-purple-50 px-3 py-1.5 font-semibold text-purple-700 min-h-0">Mark out for delivery</button><button onClick={() => void updateStatus(supplierOrder.id, "CANCELLED")} className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700 min-h-0">Cancel</button></>}{supplierOrder.status === "OUT_FOR_DELIVERY" && <button onClick={() => void updateStatus(supplierOrder.id, "DELIVERED")} className="rounded-lg bg-green-50 px-3 py-1.5 font-semibold text-green-700 min-h-0"><Check className="mr-1 inline h-3.5 w-3.5" />Mark delivered</button>}</div>)}
                    </div>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Order Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-3xl bg-[#fffdf8] shadow-2xl ring-1 ring-black/5">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-100 bg-gradient-to-r from-[#fff4d7] via-white to-[#e9f8f5] p-5">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-700">{lang === "sw" ? "Ununuzi wa supplier" : "Supplier purchasing"}</p>
                <h3 className="text-lg font-bold text-gray-950">{t("orders.newOrderTitle", lang)}</h3>
                <p className="mt-1 text-xs text-gray-500">{lang === "sw" ? "Changanya bidhaa kutoka suppliers tofauti kwenye order moja." : "Combine products from different suppliers in one order batch."}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-900 min-h-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-5 p-4 sm:p-5">
              <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Truck className="h-5 w-5" /></div>
                  <div><label className="block text-sm font-bold text-gray-900">{lang === "sw" ? "Supplier wa default" : "Default supplier"}</label><p className="mt-0.5 text-xs leading-5 text-gray-500">{lang === "sw" ? "Inatumika kwa bidhaa ambazo bado hazijaunganishwa na supplier." : "Used only for products that are not linked to a supplier yet."}</p></div>
                </div>
                <select value={selectedSupplier} onChange={(e) => selectSupplier(e.target.value)}
                  className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="">{t("orders.selectSupplier", lang)}</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>)}
                </select>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><label className="block text-sm font-bold text-gray-900">{t("orders.productsLabel", lang)}</label><p className="mt-0.5 text-xs text-gray-500">{lang === "sw" ? "Chagua bidhaa za kuagiza na angalia stock iliyopo." : "Choose products to order and check current stock."}</p></div>
                  <button onClick={fillLowStock}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-2 text-[11px] font-bold text-brand-700 transition hover:bg-brand-100 min-h-0">
                    <Clock className="h-3.5 w-3.5" /> {t("orders.fillLowStock", lang)}
                  </button>
                </div>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={lang === "sw" ? "Tafuta bidhaa au supplier..." : "Search products or suppliers..."} className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100" />
                </div>
                <div className="mb-2 flex items-center justify-between text-[11px] text-gray-400"><span>{visibleSupplierProducts.length} {lang === "sw" ? "bidhaa zinaonekana" : "products showing"}</span><span>{lang === "sw" ? "Bonyeza kuongeza" : "Tap a product to add"}</span></div>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {visibleSupplierProducts.map((p) => {
                    const inOrder = orderItems.find((i) => i.productId === p.id);
                    return (
                      <button key={p.id} onClick={() => addItem(p.id)}
                        className={`group flex w-full items-center gap-3 rounded-xl border p-2.5 text-left text-xs transition-all ${inOrder ? "border-brand-400 bg-brand-50 shadow-sm" : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm"}`}>
                        {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl border border-gray-200 object-cover" /> : <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-300"><PackagePlus className="h-5 w-5" /></div>}
                        <span className="w-28 flex-shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-brand-700">{p.supplier?.name || (selectedSupplier ? suppliers.find((s) => s.id === selectedSupplier)?.name : (lang === "sw" ? "Chagua supplier" : "Choose supplier"))}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-gray-800">{p.name}</span><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.currentStock <= p.minimumStock ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>Available: {p.currentStock} {p.unit}</span></span>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${inOrder ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400 group-hover:bg-brand-100 group-hover:text-brand-700"}`}>{inOrder ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
                {orderItems.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-800">{lang === "sw" ? "Bidhaa ulizochagua" : "Selected products"}</p><p className="mt-0.5 text-[11px] text-brand-700">{orderItems.length} {lang === "sw" ? "bidhaa ·" : "products ·"} {selectedSupplierCount} {lang === "sw" ? "suppliers" : "suppliers"}</p></div><p className="text-sm font-bold text-brand-800">{formatTZS(estimatedTotal)}</p></div>
                  <div className="space-y-2">
                    {orderItems.map((item) => {
                      const p = products.find((pr) => pr.id === item.productId);
                      return (
                        <div key={item.productId} className="rounded-xl border border-brand-100 bg-white p-2.5 shadow-sm">
                          <div className="flex items-center gap-2">
                            {p?.imageUrl ? <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-md border border-gray-200 object-cover" /> : <div className="h-9 w-9 rounded-md bg-gray-200" />}
                            <span className="w-24 flex-shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-brand-700">{p?.supplier?.name || suppliers.find((s) => s.id === selectedSupplier)?.name || "Supplier"}</span>
                            <span className="flex-1 text-xs font-semibold text-gray-700">{p?.name}<span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-normal text-gray-500">Available: {p?.currentStock ?? "-"} {p?.unit}</span></span>
                            <input aria-label={`Quantity for ${p?.name || "product"}`} type="number" value={item.quantity} min={1}
                              onChange={(e) => updateItemQty(item.productId, Number(e.target.value))}
                              className="w-16 rounded-lg border border-brand-200 bg-brand-50 px-2 py-2 text-center text-xs font-bold text-brand-800 outline-none focus:ring-2 focus:ring-brand-200" />
                            <span className="text-[10px] font-semibold text-gray-400">{p?.unit}</span>
                            <button onClick={() => removeItem(item.productId)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition hover:bg-red-50 hover:text-red-500 min-h-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <input value={item.note || ""} onChange={(e) => updateItemNote(item.productId, e.target.value)} maxLength={500}
                            placeholder={lang === "sw" ? "Maelezo ya order hii (rangi, discount, n.k.)" : "Notes for this order (colour, discount, etc.)"}
                            className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs outline-none transition focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100" />
                        </div>
                      );
                    })}
                  </div>
                  </div>
                )}
              </div>

              {selectedSupplier && supplierCatalog.length > 0 && (
                <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700"><PackagePlus className="h-4 w-4" /></div>
                    <div><p className="text-sm font-bold text-teal-950">{lang === "sw" ? "Bidhaa za catalog ya supplier" : "Supplier catalog products"}</p><p className="text-[11px] text-teal-700">{lang === "sw" ? "Ongeza bidhaa mpya kutoka kwenye catalog." : "Add a new product from this supplier catalog."}</p></div>
                  </div>
                  <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                    {supplierCatalog.map((product) => (
                      <button key={product.id} type="button" onClick={() => openCatalogImport(product)} className="rounded-xl border border-teal-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400">
                        <p className="text-xs font-semibold text-gray-900">{product.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatTZS(product.price)} / {product.unit} - {product.minOrderQty}+ {lang === "sw" ? "kwa order" : "per order"}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <label className="mb-2 block text-sm font-bold text-gray-900">{t("orders.noteLabel", lang)}</label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
                  placeholder={t("orders.notePlaceholder", lang)}
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none transition focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-100" />
              </div>

              <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center gap-3 border-t border-gray-200 bg-white/95 p-4 backdrop-blur sm:-mx-5 sm:-mb-5 sm:p-5">
                <div className="mr-auto hidden sm:block"><p className="text-xs font-bold text-gray-800">{orderItems.length ? `${orderItems.length} ${lang === "sw" ? "bidhaa tayari" : "products ready"}` : (lang === "sw" ? "Chagua bidhaa kuanza" : "Select products to begin")}</p><p className="text-[11px] text-gray-400">{selectedSupplierCount} {lang === "sw" ? "suppliers" : "suppliers"}</p></div>
                <button onClick={() => setShowForm(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">{t("common.cancel", lang)}</button>
                <button onClick={handleCreate} disabled={saving || orderItems.length === 0}
                  className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:from-brand-700 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
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
