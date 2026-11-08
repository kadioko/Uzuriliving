"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { Plus, MessageCircle, RotateCcw, Check, X, Truck, Clock, ChevronDown, ChevronUp, PackagePlus, Download, FileImage, Search, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatAppDate } from "@/lib/timezone";

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
  buyingPrice: number | null;
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
  id: string;
  productId: string;
  product: { id: string; name: string; unit: string; imageUrl?: string | null; currentStock?: number; sellingPrice?: number | null };
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

interface OrderDraftItem {
  productId: string;
  quantity: number | "";
  note?: string | null;
  supplierId?: string;
  unitPrice?: number;
}

interface ReceiptDraftLine {
  productId: string;
  orderItemId: string | null;
  product: Product | OrderItem["product"];
  orderedQuantity: number;
  receivedQuantity: number | "";
  unitPrice?: number;
}

interface ReceiptRecord {
  id: string;
  receiptType: "INITIAL" | "CORRECTION";
  actualTotalAmount?: number | null;
  note?: string | null;
  createdAt: string;
  items: Array<{
    productId: string;
    orderedQuantity: number;
    receivedQuantity: number;
    stockAddedQuantity: number;
    unitPrice: number;
    note?: string | null;
    product?: { id: string; name: string; unit: string } | null;
  }>;
}

interface OrderRevisionSnapshot {
  supplierName?: string;
  note?: string | null;
  totalAmount?: number | null;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number | null;
    note?: string | null;
  }>;
}

interface OrderRevisionRecord {
  id: string;
  revisionNumber: number;
  action: "CREATED" | "EDITED";
  beforeSnapshot?: OrderRevisionSnapshot | null;
  afterSnapshot: OrderRevisionSnapshot;
  createdAt: string;
}

interface CorrectionDraftLine {
  productId: string;
  product: Product;
  receivedQuantity: number | "";
  stockAddedQuantity: number | "";
  unitPrice: number | "";
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
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [canViewOrderQuantities, setCanViewOrderQuantities] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierCatalog, setSupplierCatalog] = useState<SupplierCatalogProduct[]>([]);
  const [catalogImport, setCatalogImport] = useState<SupplierCatalogProduct | null>(null);
  const [retailPriceDraft, setRetailPriceDraft] = useState("");
  const [minimumStockDraft, setMinimumStockDraft] = useState("5");
  const [orderItems, setOrderItems] = useState<OrderDraftItem[]>([]);
  const [note, setNote] = useState("");
  const [orderGroupIdDraft, setOrderGroupIdDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState<{ message: string; whatsappUrl: string | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [receivingOrder, setReceivingOrder] = useState<Order | null>(null);
  const [receiptLines, setReceiptLines] = useState<ReceiptDraftLine[]>([]);
  const [receiptNote, setReceiptNote] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptAcknowledged, setReceiptAcknowledged] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptIdempotencyKey, setReceiptIdempotencyKey] = useState("");
  const [unexpectedProductId, setUnexpectedProductId] = useState("");
  const [unexpectedProductSearch, setUnexpectedProductSearch] = useState("");
  const [unexpectedQuantity, setUnexpectedQuantity] = useState<number | "">(1);
  const [correctionOrder, setCorrectionOrder] = useState<Order | null>(null);
  const [correctionLines, setCorrectionLines] = useState<CorrectionDraftLine[]>([]);
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionAcknowledged, setCorrectionAcknowledged] = useState(false);
  const [correctionProductId, setCorrectionProductId] = useState("");
  const [correctionProductSearch, setCorrectionProductSearch] = useState("");
  const [correctionReceivedQuantity, setCorrectionReceivedQuantity] = useState<number | "">(1);
  const [correctionStockAddedQuantity, setCorrectionStockAddedQuantity] = useState<number | "">(1);
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [correctionIdempotencyKey, setCorrectionIdempotencyKey] = useState("");
  const [receiptHistoryOrder, setReceiptHistoryOrder] = useState<Order | null>(null);
  const [receiptHistory, setReceiptHistory] = useState<ReceiptRecord[]>([]);
  const [receiptHistoryLoading, setReceiptHistoryLoading] = useState(false);
  const [revisionHistoryOrder, setRevisionHistoryOrder] = useState<Order | null>(null);
  const [revisionHistory, setRevisionHistory] = useState<OrderRevisionRecord[]>([]);
  const [revisionHistoryLoading, setRevisionHistoryLoading] = useState(false);

  useEffect(() => {
    api.get<{ user: { role: string; staff?: { role?: string; permissions?: { canManageStock?: boolean } } } }>("/auth/me")
      .then(({ user }) => {
        const isOwner = user.role === "ADMIN" || (user.role === "MERCHANT" && (!user.staff || user.staff.role === "OWNER"));
        setCanViewOrderQuantities(isOwner || Boolean(user.staff?.permissions?.canManageStock));
      })
      .catch(() => setCanViewOrderQuantities(false));
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const data = await api.get<{ orders: Order[] }>(`/orders${params}`);
      setOrders(data.orders);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void fetchOrders().catch((error) => toast(error instanceof Error ? error.message : t("common.error", lang), "error")); }, [fetchOrders, lang, toast]);

  async function fetchAllProducts() {
    const first = await api.get<{ products: Product[]; pagination?: { totalPages?: number } }>("/products?limit=1000&page=1");
    const pages = first.pagination?.totalPages || 1;
    if (pages <= 1) return first.products;
    const remaining = await Promise.all(Array.from({ length: pages - 1 }, (_, index) => api.get<{ products: Product[] }>(`/products?limit=1000&page=${index + 2}`)));
    return [first.products, ...remaining.map((page) => page.products)].flat();
  }

  useEffect(() => {
    Promise.all([
      api.get<{ suppliers: Supplier[] }>("/suppliers"),
      fetchAllProducts(),
    ]).then(([sd, pd]) => {
      setSuppliers(sd.suppliers);
      setProducts(pd);
    });
  }, []);

  const supplierProducts = products;
  const visibleSupplierProducts = supplierProducts.filter((product) => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return true;
    return `${product.name} ${product.supplier?.name || ""}`.toLowerCase().includes(query);
  });
  const selectedSupplierCount = new Set(orderItems.map((item) => {
    return supplierForItem(item);
  }).filter(Boolean)).size;
  const estimatedTotal = orderItems.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.productId);
    return sum + (item.unitPrice ?? product?.buyingPrice ?? 0) * (Number(item.quantity) || 0);
  }, 0);

  function supplierForItem(item: { productId: string; supplierId?: string }) {
    if (editingOrder) return editingOrder.supplier.id;
    const product = products.find((entry) => entry.id === item.productId);
    return product?.supplier?.id || item.supplierId || selectedSupplier;
  }

  function addItem(productId: string) {
    setOrderItems((prev) => {
      if (prev.find((i) => i.productId === productId)) return prev;
      const product = products.find((item) => item.id === productId);
      return [...prev, { productId, quantity: 1, note: product?.note || "", supplierId: editingOrder?.supplier.id || product?.supplier?.id || "", ...(product?.buyingPrice != null ? { unitPrice: product.buyingPrice } : {}) }];
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

  function updateItemQty(productId: string, value: string) {
    setOrderItems((prev) =>
      prev.map((i) => i.productId === productId ? { ...i, quantity: value === "" ? "" : Number(value) } : i)
    );
  }

  function updateItemNote(productId: string, note: string) {
    setOrderItems((prev) => prev.map((item) => item.productId === productId ? { ...item, note } : item));
  }

  function updateItemPrice(productId: string, value: string) {
    setOrderItems((prev) => prev.map((item) => item.productId === productId ? { ...item, unitPrice: value === "" ? undefined : Number(value) } : item));
  }

  function updateItemSupplier(productId: string, supplierId: string) {
    setOrderItems((prev) => prev.map((item) => item.productId === productId ? { ...item, supplierId } : item));
  }

  function removeItem(productId: string) {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function openEditOrder(order: Order) {
    setEditingOrder(order);
    setShowForm(true);
    setSelectedSupplier(order.supplier.id);
    setOrderItems(order.items.map((item) => ({ productId: item.productId, quantity: item.quantity, note: item.note || "", supplierId: order.supplier.id, unitPrice: item.unitPrice })));
    setNote(order.note || "");
    setProductSearch("");
    setSupplierCatalog([]);
  }

  async function deleteOrder(order: Order) {
    if (!confirm(lang === "sw" ? "Futa order hii? Hii haiwezi kurudishwa." : "Delete this order? This cannot be undone.")) return;
    try {
      await api.delete(`/orders/${order.id}`, lang);
      toast(lang === "sw" ? "Order imefutwa." : "Order deleted.", "success");
      await fetchOrders();
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    }
  }

  function fillLowStock() {
    const lowItems = supplierProducts
      .filter((p) => (!editingOrder || !p.supplier?.id || p.supplier.id === editingOrder.supplier.id) && p.isReorderable !== false && p.currentStock <= p.minimumStock && (p.onOrderQuantity ?? 0) < Math.max(p.minimumStock - p.currentStock, 1))
      .map((p) => ({
        productId: p.id,
        quantity: Math.max(p.minimumStock - p.currentStock + 5, 5),
        note: p.note || "",
        supplierId: editingOrder?.supplier.id || p.supplier?.id || selectedSupplier,
        ...(p.buyingPrice != null ? { unitPrice: p.buyingPrice } : {}),
      }));
    setOrderItems((current) => editingOrder ? [...current, ...lowItems.filter((item) => !current.some((existing) => existing.productId === item.productId))] : lowItems);
  }

  function openReceiveDialog(order: Order) {
    if (!order.items.length) {
      toast(lang === "sw" ? "Order hii haina bidhaa zilizohifadhiwa." : "This order has no saved products to reconcile.", "error");
      return;
    }
    setReceivingOrder(order);
    setReceiptLines(order.items.map((item) => ({
      productId: item.productId,
      orderItemId: item.id,
      product: item.product,
      orderedQuantity: item.quantity,
      receivedQuantity: item.quantity,
      unitPrice: item.unitPrice,
    })));
    setReceiptNote("");
    setReceiptAmount("");
    setReceiptAcknowledged(false);
    setReceiptIdempotencyKey(crypto.randomUUID());
    setUnexpectedProductId("");
    setUnexpectedProductSearch("");
    setUnexpectedQuantity(1);
  }

  function updateReceivedQuantity(productId: string, value: string) {
    setReceiptLines((current) => current.map((line) => line.productId === productId
      ? { ...line, receivedQuantity: value === "" ? "" : Number(value) }
      : line));
  }

  function addUnexpectedReceiptProduct() {
    const product = products.find((entry) => entry.id === unexpectedProductId);
    if (!product || receiptLines.some((line) => line.productId === product.id)) return;
    if (typeof unexpectedQuantity !== "number" || !Number.isInteger(unexpectedQuantity) || unexpectedQuantity < 1) {
      toast(lang === "sw" ? "Weka idadi halali iliyopokelewa." : "Enter a valid received quantity.", "error");
      return;
    }
    setReceiptLines((current) => [...current, {
      productId: product.id,
      orderItemId: null,
      product,
      orderedQuantity: 0,
      receivedQuantity: unexpectedQuantity,
      unitPrice: product.buyingPrice ?? undefined,
    }]);
    setUnexpectedProductId("");
    setUnexpectedProductSearch("");
    setUnexpectedQuantity(1);
  }

  function removeReceiptProduct(productId: string) {
    setReceiptLines((current) => current.filter((line) => line.productId !== productId || line.orderItemId !== null));
  }

  const receiptHasDifference = receiptLines.some((line) => line.receivedQuantity !== line.orderedQuantity);
  const unexpectedProductMatches = products.filter((product) => !receiptLines.some((line) => line.productId === product.id)
    && product.name.toLowerCase().includes(unexpectedProductSearch.trim().toLowerCase())).slice(0, 8);
  const correctionProductMatches = products.filter((product) => !correctionLines.some((line) => line.productId === product.id)
    && product.name.toLowerCase().includes(correctionProductSearch.trim().toLowerCase())).slice(0, 8);

  async function submitReceipt() {
    if (!receivingOrder) return;
    if (!receiptAcknowledged) {
      toast(lang === "sw" ? "Thibitisha kuwa umelinganisha bidhaa na mzigo." : "Confirm that you checked the goods against the order.", "error");
      return;
    }
    if (receiptLines.some((line) => typeof line.receivedQuantity !== "number"
      || !Number.isInteger(line.receivedQuantity)
      || line.receivedQuantity < (line.orderItemId ? 0 : 1))) {
      toast(lang === "sw" ? "Weka idadi halali kwa kila bidhaa." : "Enter a valid quantity for every product.", "error");
      return;
    }
    if (receiptHasDifference && receiptNote.trim().length < 5) {
      toast(lang === "sw" ? "Eleza tofauti ya bidhaa kabla ya kuthibitisha." : "Explain the order/delivery difference before confirming.", "error");
      return;
    }
    const actualTotalAmount = receiptAmount.trim() === "" ? null : Number(receiptAmount);
    if (receiptHasDifference && actualTotalAmount === null) {
      toast(lang === "sw" ? "Weka jumla halisi ya invoice kwa order yenye tofauti." : "Enter the full actual invoice total when received quantities differ.", "error");
      return;
    }
    if (actualTotalAmount !== null && (!Number.isInteger(actualTotalAmount) || actualTotalAmount < 0)) {
      toast(lang === "sw" ? "Weka gharama halisi kama namba kamili isiyo hasi." : "Enter the actual purchase total as a non-negative whole number.", "error");
      return;
    }
    setReceiptSaving(true);
    try {
      await api.patch("/orders/" + receivingOrder.id + "/confirm-delivery", {
        receivedItems: receiptLines.map((line) => ({
          productId: line.productId,
          orderItemId: line.orderItemId,
          orderedQuantity: line.orderedQuantity,
          ...(line.unitPrice == null ? {} : { expectedUnitPrice: line.unitPrice }),
          receivedQuantity: Number(line.receivedQuantity),
          ...(line.orderItemId === null ? { note: lang === "sw" ? "Bidhaa haikuwa kwenye order ya awali" : "Product was not on the original order" } : {}),
        })),
        actualTotalAmount,
        discrepancyNote: receiptNote.trim() || null,
        idempotencyKey: receiptIdempotencyKey,
      }, lang);
      setReceivingOrder(null);
      toast(lang === "sw" ? "Upokeaji umerekodiwa na stock imesasishwa." : "Receipt reconciled and stock updated.", "success");
      void fetchOrders().catch(() => toast(lang === "sw" ? "Upokeaji umehifadhiwa, lakini orodha imeshindwa kujisasisha." : "Receipt was saved, but the order list could not refresh.", "error"));
      void fetchAllProducts().then(setProducts).catch(() => toast(lang === "sw" ? "Upokeaji umehifadhiwa; pakia upya inventory kuona stock mpya." : "Receipt was saved; refresh inventory to see the updated stock.", "error"));
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    } finally {
      setReceiptSaving(false);
    }
  }

  function openCorrectionDialog(order: Order) {
    setCorrectionOrder(order);
    setCorrectionLines([]);
    setCorrectionNote("");
    setCorrectionAcknowledged(false);
    setCorrectionProductId("");
    setCorrectionProductSearch("");
    setCorrectionReceivedQuantity(1);
    setCorrectionStockAddedQuantity(1);
    setCorrectionIdempotencyKey(crypto.randomUUID());
  }

  function addCorrectionProduct() {
    const product = products.find((entry) => entry.id === correctionProductId);
    if (!product || correctionLines.some((line) => line.productId === product.id)) return;
    if (typeof correctionReceivedQuantity !== "number" || !Number.isInteger(correctionReceivedQuantity) || correctionReceivedQuantity < 1
      || typeof correctionStockAddedQuantity !== "number" || !Number.isInteger(correctionStockAddedQuantity) || correctionStockAddedQuantity < 0
      || correctionStockAddedQuantity > correctionReceivedQuantity) {
      toast(lang === "sw" ? "Weka idadi halali iliyopokelewa." : "Enter a valid received quantity.", "error");
      return;
    }
    setCorrectionLines((current) => [...current, {
      productId: product.id,
      product,
      receivedQuantity: correctionReceivedQuantity,
      stockAddedQuantity: correctionStockAddedQuantity,
      unitPrice: product.buyingPrice ?? 0,
    }]);
    setCorrectionProductId("");
    setCorrectionProductSearch("");
    setCorrectionReceivedQuantity(1);
    setCorrectionStockAddedQuantity(1);
  }

  async function submitCorrection() {
    if (!correctionOrder || correctionLines.length === 0) {
      toast(lang === "sw" ? "Ongeza bidhaa zilizopokelewa kwanza." : "Add at least one received product.", "error");
      return;
    }
    if (correctionNote.trim().length < 5) {
      toast(lang === "sw" ? "Eleza sababu ya marekebisho." : "Enter a reason for this correction.", "error");
      return;
    }
    if (!correctionAcknowledged) {
      toast(lang === "sw" ? "Thibitisha kuwa umehesabu stock iliyopo." : "Confirm that you physically counted the stock.", "error");
      return;
    }
    if (correctionLines.some((line) => typeof line.receivedQuantity !== "number" || !Number.isInteger(line.receivedQuantity) || line.receivedQuantity < 1
      || typeof line.stockAddedQuantity !== "number" || !Number.isInteger(line.stockAddedQuantity) || line.stockAddedQuantity < 0
      || line.stockAddedQuantity > line.receivedQuantity
      || typeof line.unitPrice !== "number" || !Number.isInteger(line.unitPrice) || line.unitPrice < 0)) {
      toast(lang === "sw" ? "Weka idadi na gharama halali kwa kila bidhaa." : "Enter a valid quantity and unit cost for every product.", "error");
      return;
    }
    setCorrectionSaving(true);
    try {
      await api.post("/orders/" + correctionOrder.id + "/receipt-corrections", {
        items: correctionLines.map(({ productId, receivedQuantity, stockAddedQuantity, unitPrice }) => ({
          productId,
          receivedQuantity: Number(receivedQuantity),
          stockAddedQuantity: Number(stockAddedQuantity),
          unitPrice: Number(unitPrice),
        })),
        note: correctionNote.trim(),
        idempotencyKey: correctionIdempotencyKey,
      }, lang);
      setCorrectionOrder(null);
      toast(lang === "sw" ? "Marekebisho ya stock yamehifadhiwa." : "Stock correction recorded.", "success");
      void fetchOrders().catch(() => undefined);
      void fetchAllProducts().then(setProducts).catch(() => undefined);
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    } finally {
      setCorrectionSaving(false);
    }
  }

  async function showReceiptHistory(order: Order) {
    setReceiptHistoryOrder(order);
    setReceiptHistory([]);
    setReceiptHistoryLoading(true);
    try {
      const data = await api.get<{ receipts: ReceiptRecord[] }>("/orders/" + order.id + "/receipts", lang);
      setReceiptHistory(data.receipts);
    } catch (error) {
      setReceiptHistoryOrder(null);
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    } finally {
      setReceiptHistoryLoading(false);
    }
  }

  async function showOrderRevisions(order: Order) {
    setRevisionHistoryOrder(order);
    setRevisionHistory([]);
    setRevisionHistoryLoading(true);
    try {
      const data = await api.get<{ revisions: OrderRevisionRecord[] }>("/orders/" + order.id + "/revisions", lang);
      setRevisionHistory(data.revisions);
    } catch (error) {
      setRevisionHistoryOrder(null);
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
    } finally {
      setRevisionHistoryLoading(false);
    }
  }

  async function handleCreate() {
    if (orderItems.length === 0) return;
    if (orderItems.some((item) => typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity < 1 || (item.unitPrice !== undefined && (!Number.isInteger(item.unitPrice) || item.unitPrice < 0)))) {
      toast(lang === "sw" ? "Weka idadi na bei halali kwa bidhaa zote." : "Enter valid whole-number quantities and unit prices for every product.", "error");
      return;
    }
    if (editingOrder && orderItems.some((item) => editingOrder.items.some((original) => original.productId === item.productId) && item.unitPrice === undefined)) {
      toast(lang === "sw" ? "Weka bei ya kila bidhaa iliyopo kwenye order." : "Enter a unit price for each existing order item.", "error");
      return;
    }
    const validItems = orderItems.map((item) => ({ ...item, quantity: Number(item.quantity) }));
    if (editingOrder) {
      setSaving(true);
      try {
        const { order: updated } = await api.patch<{ order: Order }>(`/orders/${editingOrder.id}`, { items: validItems, note: note || null }, lang);
        setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
        setShowForm(false);
        setEditingOrder(null);
        setOrderItems([]);
        setNote("");
        toast(lang === "sw" ? "Order imebadilishwa." : "Order updated.", "success");
        void fetchOrders().catch(() => toast(lang === "sw" ? "Order imehifadhiwa, lakini orodha imeshindwa kujisasisha." : "Order saved, but the list could not refresh.", "error"));
      } catch (error) {
        toast(error instanceof Error ? error.message : t("common.error", lang), "error");
      } finally {
        setSaving(false);
      }
      return;
    }
    const groups = new Map<string, typeof validItems>();
    for (const item of validItems) {
      const product = products.find((p) => p.id === item.productId);
      const supplierId = product ? supplierForItem(item) : "";
      if (!supplierId) {
        toast(lang === "sw" ? "Chagua supplier kwa bidhaa zote zisizo na supplier." : "Choose a supplier for products without one.", "error");
        return;
      }
      groups.set(supplierId, [...(groups.get(supplierId) || []), item]);
    }
    setSaving(true);
    try {
      const orderGroupId = orderGroupIdDraft || crypto.randomUUID();
      setOrderGroupIdDraft(orderGroupId);
      const created = await api.post<{ orders: Order[]; whatsappMessage: { message: string; whatsappUrl: string | null } }>("/orders/batch", {
        groups: [...groups.entries()].map(([supplierId, items]) => ({ supplierId, items })),
        note: note || undefined,
        orderGroupId,
      });
      const savedItemCount = created.orders.reduce((sum, order) => sum + order.items.length, 0);
      if (savedItemCount !== validItems.length) {
        await fetchOrders();
        throw new Error("The supplier order saved, but the returned product list did not match. Refresh and verify this order before continuing.");
      }
      setWhatsappMsg(created.whatsappMessage || null);
      setShowForm(false);
      setOrderItems([]);
      setNote("");
      setProductSearch("");
      setOrderGroupIdDraft("");
      toast(lang === "sw" ? created.orders.length + " supplier order zimeundwa." : created.orders.length + " supplier order" + (created.orders.length === 1 ? "" : "s") + " created.", "success");
      fetchOrders();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t("common.error", lang), "error");
    } finally {
      setSaving(false);
    }
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
        const order = orders.find((candidate) => candidate.id === orderId);
        if (order) openReceiveDialog(order);
        return;
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
    const date = formatAppDate(first.createdAt, lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short", year: "numeric" });
    return `<div class="order-sheet"><h1>Uzuri Living</h1><h2>Supplier order follow-up</h2><p><b>Suppliers:</b> ${batch.map((order) => escapeHtml(order.supplier.name)).join(", ")} &nbsp; <b>Order:</b> #${(first.orderGroupId || first.id).slice(-8).toUpperCase()} &nbsp; <b>Date:</b> ${date}</p><p class="staff-note">Staff copy · retail selling prices shown · supplier costs and order total are not shown.</p>${batch.map((order) => `<h3>${escapeHtml(order.supplier.name)} <span class="status">${escapeHtml(order.status.replaceAll("_", " "))}</span></h3><table><thead><tr><th>Product</th><th>Available stock</th><th>Order quantity</th><th>Retail selling price</th><th>Notes</th></tr></thead><tbody>${order.items.map((item) => `<tr><td class="product">${item.product.imageUrl ? `<img src="${escapeHtml(item.product.imageUrl)}" alt="" />` : ""}<span>${escapeHtml(item.product.name)}</span></td><td>${item.product.currentStock ?? "-"} ${escapeHtml(item.product.unit)}</td><td>${item.quantity} ${escapeHtml(item.product.unit)}</td><td>${item.product.sellingPrice == null ? "Not set" : formatTZS(item.product.sellingPrice)}</td><td>${escapeHtml(item.note || "")}</td></tr>`).join("")}</tbody></table>`).join("")}</div>`;
  }

  async function getFreshOrderBatch(batch: Order[]) {
    try {
      const latest = await Promise.all(batch.map(async (order) => (await api.get<{ order: Order }>("/orders/" + order.id, lang)).order));
      setOrders((current) => current.map((order) => latest.find((fresh) => fresh.id === order.id) || order));
      return latest;
    } catch (error) {
      toast(error instanceof Error ? error.message : t("common.error", lang), "error");
      return null;
    }
  }

  async function downloadPdf(batch: Order[]) {
    const popup = window.open("", "_blank", "width=850,height=700");
    if (!popup) { toast(lang === "sw" ? "Ruhusu pop-ups ili kuhifadhi PDF." : "Allow pop-ups to save the PDF.", "error"); return; }
    const latest = await getFreshOrderBatch(batch);
    if (!latest) { popup.close(); return; }
    batch = latest;
    const order = batch[0];
    popup.document.write(`<html><head><title>Order ${(order.orderGroupId || order.id).slice(-8).toUpperCase()}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#1f2937}.order-sheet{max-width:900px;margin:auto}h1{color:#b56600;margin-bottom:4px}h2{margin-top:0;font-size:20px}h3{margin:22px 0 4px}.staff-note{background:#f3f7f3;color:#365d45;border:1px solid #d5e7d8;border-radius:8px;padding:9px 12px;font-size:12px}.status{font-size:11px;background:#fff3d6;padding:4px 8px;border-radius:10px}table{border-collapse:collapse;width:100%;margin-top:6px}th,td{border:1px solid #d1d5db;padding:8px;text-align:left;font-size:12px}th{background:#fff3d6}.product{display:flex;align-items:center;gap:8px}.product img{height:48px;width:48px;object-fit:cover;border-radius:6px}hr{border:0;border-top:1px solid #e5e7eb}@media print{body{padding:8mm}}</style></head><body>${orderMarkup(batch)}</body></html>`);
    popup.document.close();
    await Promise.all([...popup.document.images].map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); })));
    popup.focus(); popup.print();
  }

  async function downloadJpg(batch: Order[]) {
    const latest = await getFreshOrderBatch(batch);
    if (!latest) return;
    batch = latest;
    const width = 1600;
    const pagePadding = 64;
    const rowHeight = 136;
    const supplierBlockHeight = (order: Order) => 70 + order.items.length * rowHeight;
    const height = 360 + batch.reduce((sum, order) => sum + supplierBlockHeight(order), 0) + 40;
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
    context.fillStyle = "#1f2937"; context.font = "bold 28px Arial"; context.fillText("Supplier order follow-up · staff copy", pagePadding + 32, 150);
    context.fillStyle = "#526b5a"; context.font = "18px Arial"; context.fillText("Retail selling prices only · supplier costs and order total hidden", pagePadding + 32, 180);
    context.fillStyle = "#64748b"; context.font = "20px Arial"; context.fillText(`Order #${(batch[0].orderGroupId || batch[0].id).slice(-8).toUpperCase()}`, pagePadding + 32, 222);
    const date = formatAppDate(batch[0].createdAt, lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short", year: "numeric" });
    context.fillText(date, width - pagePadding - 220, 222);
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
        wrapText(item.product.name, 530, 2).forEach((line, index) => context.fillText(line, pagePadding + 126, y + 43 + index * 27));
        context.fillStyle = "#64748b"; context.font = "17px Arial"; context.fillText(`Available in shop: ${item.product.currentStock ?? "-"} ${item.product.unit}`, pagePadding + 126, y + 96);
        context.fillStyle = "#64748b"; context.font = "bold 14px Arial"; context.fillText("ORDER QTY", pagePadding + 720, y + 33);
        context.fillStyle = "#b56600"; context.font = "bold 24px Arial"; context.fillText(`${item.quantity} ${item.product.unit}`, pagePadding + 720, y + 70);
        context.fillStyle = "#64748b"; context.font = "bold 14px Arial"; context.fillText("RETAIL PRICE", pagePadding + 885, y + 33);
        context.fillStyle = "#087f6b"; context.font = "bold 19px Arial"; context.fillText(item.product.sellingPrice == null ? "Not set" : formatTZS(item.product.sellingPrice), pagePadding + 885, y + 70);
        context.fillStyle = "#64748b"; context.font = "bold 14px Arial"; context.fillText("NOTE", pagePadding + 1085, y + 33);
        context.fillStyle = "#334155"; context.font = "16px Arial"; wrapText(item.note || "No note", 290, 3).forEach((line, index) => context.fillText(line, pagePadding + 1085, y + 62 + index * 22));
        y += rowHeight;
      }
      y += 8;
    }
    const link = document.createElement("a"); link.download = `uzuri-order-${(batch[0].orderGroupId || batch[0].id).slice(-8)}.jpg`; link.href = canvas.toDataURL("image/jpeg", 0.92); link.click();
  }

  const filtered = useMemo(() => {
    const query = orderSearch.trim().toLowerCase();
    return (statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter)).filter((order) => {
      if (!query) return true;
      const searchable = [
        order.id,
        order.orderGroupId,
        order.supplier.name,
        order.supplier.phone,
        order.note,
        ...order.items.flatMap((item) => [item.product.name, item.product.id, item.note]),
      ].filter(Boolean).join(" ").toLowerCase();
      return searchable.includes(query);
    });
  }, [orders, orderSearch, statusFilter]);
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
          {canViewOrderQuantities && <button onClick={() => { setEditingOrder(null); setShowForm(true); setOrderItems([]); setNote(""); setProductSearch(""); setSelectedSupplier(""); setSupplierCatalog([]); setOrderGroupIdDraft(crypto.randomUUID()); }}
            className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("orders.newOrder", lang)}</span>
          </button>}
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

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={orderSearch}
            onChange={(event) => setOrderSearch(event.target.value)}
            placeholder={lang === "sw" ? "Tafuta supplier, bidhaa, namba ya order..." : "Search supplier, product, order number..."}
            aria-label={lang === "sw" ? "Tafuta supplier orders" : "Search supplier orders"}
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          {orderSearch && (
            <button
              type="button"
              onClick={() => setOrderSearch("")}
              aria-label={lang === "sw" ? "Futa utafutaji" : "Clear search"}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 min-h-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">{t("common.loading", lang)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{orderSearch ? (lang === "sw" ? "Hakuna order inayolingana na utafutaji." : "No supplier orders match your search.") : t("orders.none", lang)}</p>
            {orderSearch && <button type="button" onClick={() => setOrderSearch("")} className="mt-3 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50 min-h-0">{lang === "sw" ? "Futa utafutaji" : "Clear search"}</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map(({ key: batchKey, orders: batch }) => {
              const order = batch[0];
              const hideOrderTotal = batch.some((item) => item.status === "OUT_FOR_DELIVERY");
              const allDelivered = batch.every((item) => item.status === "DELIVERED");
              const allCancelled = batch.every((item) => item.status === "CANCELLED");
              const statusLabels = [...new Set(batch.map((item) => t(`orders.status.${item.status}`, lang)))];
              return (
              <div key={batchKey} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-800">{batch.map((item) => item.supplier.name).join(" + ")}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${batch.length > 1 ? "bg-indigo-100 text-indigo-700" : STATUS_COLOR[order.status]}`}>
                        {batch.length > 1 ? `${batch.length} suppliers · ${statusLabels.join(" · ")}` : statusLabels[0]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      #{batchKey.slice(-8).toUpperCase()} •{" "}
                      {formatAppDate(order.createdAt, lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short" })}
                    </p>
                    {canViewOrderQuantities && !hideOrderTotal && batch.reduce((sum, item) => sum + (item.totalAmount || 0), 0) > 0 && (
                      <p className="text-sm font-bold text-brand-700 mt-1">{formatTZS(batch.reduce((sum, item) => sum + (item.totalAmount || 0), 0))}</p>
                    )}
                  </div>
                  <button onClick={() => setExpandedOrder(expandedOrder === batchKey ? null : batchKey)}
                    aria-label={`${expandedOrder === batchKey ? "Collapse" : "Expand"} order ${batch.map((item) => item.supplier.name).join(", ")}`}
                    className="text-gray-400 min-h-0">
                    {expandedOrder === batchKey ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {expandedOrder === batchKey && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {canViewOrderQuantities && <div className="space-y-3 mb-3">
                      {batch.map((supplierOrder) => <div key={supplierOrder.id} className="rounded-lg border border-gray-100 p-2">
                        <div className="mb-1 flex items-center justify-between"><p className="text-xs font-bold text-brand-700">{supplierOrder.supplier.name}</p><span className={`text-[11px] rounded-full px-2 py-0.5 font-semibold ${STATUS_COLOR[supplierOrder.status]}`}>{t(`orders.status.${supplierOrder.status}`, lang)}</span></div>
                        {supplierOrder.items.map((item) => <div key={`${supplierOrder.id}-${item.productId}`} className="flex items-center gap-3 border-b border-gray-100 py-2 text-sm last:border-0">
                          {item.product.imageUrl ? <img src={item.product.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-gray-200 object-cover" /> : <div className="h-10 w-10 rounded-lg bg-gray-100" />}
                          <span className="flex-1 text-gray-600">{item.product.name}<span className="block text-xs text-gray-400">Available: {item.product.currentStock ?? "-"} {item.product.unit}{item.note ? ` · ${item.note}` : ""}</span></span>
                          <span className="font-medium">{item.quantity} {item.product.unit}</span>
                        </div>)}
                      </div>)}
                    </div>}
                    {!canViewOrderQuantities && <div className="space-y-2 mb-3">{batch.map((supplierOrder) => <div key={supplierOrder.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs"><span className="font-medium text-gray-700">{supplierOrder.supplier.name}</span><span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_COLOR[supplierOrder.status]}`}>{t(`orders.status.${supplierOrder.status}`, lang)}</span></div>)}</div>}
                    {canViewOrderQuantities && batch.some((item) => item.note) && <p className="text-xs text-gray-400 italic mb-3">{batch.filter((item) => item.note).map((item) => `"${item.note}"`).join(" · ")}</p>}

                    {canViewOrderQuantities && <div className="flex flex-wrap gap-2">
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
                    </div>}
                    {canViewOrderQuantities && <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      {batch.map((supplierOrder) => <div key={supplierOrder.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="mr-auto font-semibold text-gray-700">{supplierOrder.supplier.name}</span><button onClick={() => void showOrderRevisions(supplierOrder)} className="rounded-lg bg-gray-50 px-3 py-1.5 font-semibold text-gray-700 ring-1 ring-gray-200 min-h-0">{lang === "sw" ? "Historia ya mabadiliko" : "Order change history"}</button>{["PENDING", "OUT_FOR_DELIVERY"].includes(supplierOrder.status) && <button onClick={() => openEditOrder(supplierOrder)} className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 font-semibold text-brand-700 min-h-0"><Edit2 className="h-3.5 w-3.5" /> Edit</button>}{supplierOrder.status === "PENDING" && <><button onClick={() => void deleteOrder(supplierOrder)} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 min-h-0"><Trash2 className="h-3.5 w-3.5" /> Delete</button><button onClick={() => void updateStatus(supplierOrder.id, "CONFIRMED")} className="rounded-lg bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 min-h-0">Confirm</button><button onClick={() => void updateStatus(supplierOrder.id, "CANCELLED")} className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700 min-h-0">Cancel</button></>}{supplierOrder.status === "CANCELLED" && <button onClick={() => void deleteOrder(supplierOrder)} className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 min-h-0"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}{supplierOrder.status === "CONFIRMED" && <><button onClick={() => void updateStatus(supplierOrder.id, "OUT_FOR_DELIVERY")} className="rounded-lg bg-purple-50 px-3 py-1.5 font-semibold text-purple-700 min-h-0">Mark out for delivery</button><button onClick={() => void updateStatus(supplierOrder.id, "CANCELLED")} className="rounded-lg bg-red-50 px-3 py-1.5 font-semibold text-red-700 min-h-0">Cancel</button></>}{supplierOrder.status === "OUT_FOR_DELIVERY" && <button onClick={() => void updateStatus(supplierOrder.id, "DELIVERED")} className="rounded-lg bg-green-50 px-3 py-1.5 font-semibold text-green-700 min-h-0"><Check className="mr-1 inline h-3.5 w-3.5" />Mark delivered</button>}</div>)}
                    </div>}
                    {canViewOrderQuantities && batch.some((supplierOrder) => supplierOrder.status === "DELIVERED") && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {batch.filter((supplierOrder) => supplierOrder.status === "DELIVERED").map((supplierOrder) => (
                          <div key={supplierOrder.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-green-100 bg-green-50/60 px-2 py-1.5 text-xs">
                            <span className="font-semibold text-green-900">{supplierOrder.supplier.name}</span>
                            <button onClick={() => void showReceiptHistory(supplierOrder)} className="rounded-md bg-white px-2.5 py-1.5 font-semibold text-gray-700 ring-1 ring-gray-200 min-h-0">
                              {lang === "sw" ? "Historia ya upokeaji" : "Receipt history"}
                            </button>
                            <button onClick={() => openCorrectionDialog(supplierOrder)} className="rounded-md bg-amber-100 px-2.5 py-1.5 font-semibold text-amber-900 min-h-0">
                              {lang === "sw" ? "Rekebisha stock iliyokosekana" : "Record missing received stock"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                <h3 className="text-lg font-bold text-gray-950">{editingOrder ? (lang === "sw" ? "Hariri order" : "Edit supplier order") : t("orders.newOrderTitle", lang)}</h3>
                <p className="mt-1 text-xs text-gray-500">{editingOrder ? (lang === "sw" ? "Sasisha bidhaa, idadi, bei, au maelezo kabla order haijafikishwa." : "Update products, quantities, unit prices, or notes before delivery is received.") : (lang === "sw" ? "Changanya bidhaa kutoka suppliers tofauti kwenye order moja." : "Combine products from different suppliers in one order batch.")}</p>
                {editingOrder?.status === "OUT_FOR_DELIVERY" && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{lang === "sw" ? "Mabadiliko hapa hubadilisha order iliyohifadhiwa. Bidhaa utakayoiondoa haitapokea stock utakapo-confirm delivery." : "Edits replace the saved order. A product removed here will not be included in stock when delivery is confirmed."}</p>}
              </div>
              <button onClick={() => { setShowForm(false); setEditingOrder(null); }} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-gray-500 shadow-sm transition hover:bg-white hover:text-gray-900 min-h-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-5 p-4 sm:p-5">
              <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"><Truck className="h-5 w-5" /></div>
                  <div><label className="block text-sm font-bold text-gray-900">{editingOrder ? (lang === "sw" ? "Supplier wa order hii" : "Supplier for this order") : (lang === "sw" ? "Supplier wa default" : "Default supplier")}</label><p className="mt-0.5 text-xs leading-5 text-gray-500">{editingOrder ? (lang === "sw" ? "Bidhaa zote unazoongeza hapa zitakuwa kwenye order ya supplier huyu." : "All products added here stay on this supplier's order.") : (lang === "sw" ? "Inatumika kwa bidhaa ambazo bado hazijaunganishwa na supplier." : "Used only for products that are not linked to a supplier yet.")}</p></div>
                </div>
                <select value={selectedSupplier} onChange={(e) => selectSupplier(e.target.value)} disabled={Boolean(editingOrder)}
                  className="w-full rounded-xl border border-brand-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500">
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
                        <span className="w-28 flex-shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-brand-700">{editingOrder?.supplier.name || p.supplier?.name || (selectedSupplier ? suppliers.find((s) => s.id === selectedSupplier)?.name : (lang === "sw" ? "Chagua supplier" : "Choose supplier"))}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-gray-800">{p.name}</span><span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.currentStock <= p.minimumStock ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>Available: {p.currentStock} {p.unit}</span></span>
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${inOrder ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-400 group-hover:bg-brand-100 group-hover:text-brand-700"}`}>{inOrder ? "✓" : "+"}</span>
                      </button>
                    );
                  })}
                </div>
                {orderItems.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-800">{lang === "sw" ? "Bidhaa ulizochagua" : "Selected products"}</p><p className="mt-0.5 text-[11px] text-brand-700">{orderItems.length} {lang === "sw" ? "bidhaa ·" : "products ·"} {selectedSupplierCount} {lang === "sw" ? "suppliers" : "suppliers"}</p></div>{editingOrder?.status !== "OUT_FOR_DELIVERY" && <p className="text-sm font-bold text-brand-800">{formatTZS(estimatedTotal)}</p>}</div>
                  <div className="space-y-2">
                    {orderItems.map((item) => {
                      const p = products.find((pr) => pr.id === item.productId);
                      const original = editingOrder?.items.find((entry) => entry.productId === item.productId);
                      const displayProduct = p || original?.product;
                      return (
                        <div key={item.productId} className="rounded-xl border border-brand-100 bg-white p-2.5 shadow-sm">
                          <div className="flex items-center gap-2">
                            {displayProduct?.imageUrl ? <img src={displayProduct.imageUrl} alt="" className="h-9 w-9 rounded-md border border-gray-200 object-cover" /> : <div className="h-9 w-9 rounded-md bg-gray-200" />}
                            {editingOrder ? <span className="w-24 flex-shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-brand-700">{editingOrder.supplier.name}</span> : p?.supplier?.name ? <span className="w-24 flex-shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-brand-700">{p.supplier.name}</span> : <select aria-label={`Supplier for ${p?.name || "product"}`} value={item.supplierId || ""} onChange={(event) => updateItemSupplier(item.productId, event.target.value)} className="w-28 flex-shrink-0 rounded-lg border border-brand-200 bg-brand-50 px-1.5 py-1.5 text-[10px] font-bold text-brand-800 outline-none focus:ring-2 focus:ring-brand-200"><option value="">{selectedSupplier ? suppliers.find((s) => s.id === selectedSupplier)?.name : "Assign supplier"}</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>}
                            <span className="flex-1 text-xs font-semibold text-gray-700">{displayProduct?.name || item.productId}<span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-normal text-gray-500">Available: {p?.currentStock ?? original?.product.currentStock ?? "-"} {displayProduct?.unit}</span></span>
                            <input aria-label={`Quantity for ${displayProduct?.name || "product"}`} type="number" value={item.quantity} min={1}
                              onChange={(e) => updateItemQty(item.productId, e.target.value)}
                              className="w-16 rounded-lg border border-brand-200 bg-brand-50 px-2 py-2 text-center text-xs font-bold text-brand-800 outline-none focus:ring-2 focus:ring-brand-200" />
                            <span className="text-[10px] font-semibold text-gray-400">{displayProduct?.unit}</span>
                            <button onClick={() => removeItem(item.productId)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-300 transition hover:bg-red-50 hover:text-red-500 min-h-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <label className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-gray-600">
                            {lang === "sw" ? "Bei ya kununua kwa moja (TZS)" : "Unit purchase price (TZS)"}
                            <input aria-label={`Unit purchase price for ${displayProduct?.name || "product"}`} type="number" min={0} step={1} value={item.unitPrice ?? ""} placeholder={p?.buyingPrice != null ? String(p.buyingPrice) : "0"} onChange={(event) => updateItemPrice(item.productId, event.target.value)} className="w-28 rounded-lg border border-brand-200 bg-brand-50 px-2 py-1.5 text-right text-xs font-semibold text-brand-800 outline-none focus:ring-2 focus:ring-brand-200" />
                          </label>
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
                <button onClick={() => { setShowForm(false); setEditingOrder(null); }} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">{t("common.cancel", lang)}</button>
                <button onClick={handleCreate} disabled={saving || orderItems.length === 0}
                  className="rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition hover:from-brand-700 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? "..." : editingOrder ? (lang === "sw" ? "Hifadhi mabadiliko" : "Save changes") : t("orders.submit", lang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {receivingOrder && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="receive-order-title" className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white p-4 sm:p-5">
              <div>
                <h2 id="receive-order-title" className="text-lg font-bold text-gray-950">{lang === "sw" ? "Linganisha mzigo uliopokelewa" : "Reconcile delivered goods"}</h2>
                <p className="mt-1 text-sm text-gray-600">{receivingOrder.supplier.name} · #{(receivingOrder.orderGroupId || receivingOrder.id).slice(-8).toUpperCase()}</p>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-gray-500">{lang === "sw" ? "Hesabu bidhaa ulizopokea. Stock itaongezwa kwa idadi halisi hapa tu baada ya kuthibitisha." : "Count the goods you physically received. Inventory will increase by the quantities entered here only after confirmation."}</p>
              </div>
              <button type="button" onClick={() => setReceivingOrder(null)} aria-label="Close receipt reconciliation" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-900">
                {lang === "sw" ? "Kiasi cha order ni rejea tu. Badilisha idadi kwa kile ulichohesabu, weka sifuri ikiwa haijafika, na ongeza bidhaa yoyote iliyoletwa lakini haipo kwenye order." : "The order quantity is a reference. Enter what you counted, use zero for an item not delivered, and add anything physically received but missing from the saved order."}
              </div>

              <div className="space-y-2">
                {receiptLines.map((line) => {
                  const mismatch = line.receivedQuantity !== line.orderedQuantity;
                  return (
                    <div key={line.productId} className={"flex items-center gap-3 rounded-xl border p-3 " + (mismatch ? "border-amber-200 bg-amber-50/50" : "border-gray-200 bg-white")}>
                      {line.product.imageUrl ? <img src={line.product.imageUrl} alt="" className="h-11 w-11 rounded-lg border border-gray-200 object-cover" /> : <div className="h-11 w-11 rounded-lg bg-gray-100" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{line.product.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {line.orderItemId === null ? (lang === "sw" ? "Haikuwepo kwenye order" : "Not on saved order") : (lang === "sw" ? "Imeagizwa: " : "Ordered: ") + line.orderedQuantity + " " + line.product.unit}
                          {line.orderItemId !== null && line.product.currentStock != null ? " · " + (lang === "sw" ? "Stock ya sasa: " : "Current stock: ") + line.product.currentStock : ""}
                        </p>
                      </div>
                      <label className="w-28 flex-shrink-0 text-[11px] font-semibold text-gray-600">
                        {lang === "sw" ? "Imepokelewa" : "Received"}
                        <input aria-label={"Received quantity for " + line.product.name} type="number" min={line.orderItemId === null ? 1 : 0} step={1} inputMode="numeric" value={line.receivedQuantity} onChange={(event) => updateReceivedQuantity(line.productId, event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2.5 py-2 text-center text-sm font-bold text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                      </label>
                      {line.orderItemId === null && <button type="button" onClick={() => removeReceiptProduct(line.productId)} aria-label={"Remove " + line.product.name} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
                <p className="text-sm font-bold text-gray-900">{lang === "sw" ? "Bidhaa imefika lakini haipo kwenye order?" : "Received an item missing from the order?"}</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_9rem_auto]">
                  <div className="relative min-w-0">
                    <input aria-label={lang === "sw" ? "Tafuta bidhaa iliyokosekana kwenye order" : "Search product missing from order"} value={unexpectedProductSearch} onChange={(event) => { setUnexpectedProductSearch(event.target.value); setUnexpectedProductId(""); }} placeholder={lang === "sw" ? "Tafuta bidhaa..." : "Search products..."} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                    {unexpectedProductSearch.trim().length >= 2 && !unexpectedProductId && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
                      {unexpectedProductMatches.length ? unexpectedProductMatches.map((product) => <button key={product.id} type="button" onClick={() => { setUnexpectedProductId(product.id); setUnexpectedProductSearch(product.name); }} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-amber-50"><span className="font-semibold text-gray-800">{product.name}</span><span className="ml-2 text-gray-500">{lang === "sw" ? "stock " : "stock "}{product.currentStock}</span></button>) : <p className="px-2.5 py-2 text-xs text-gray-500">{lang === "sw" ? "Hakuna bidhaa iliyopatikana." : "No matching product."}</p>}
                    </div>}
                    {unexpectedProductId && <p className="mt-1 truncate text-xs font-semibold text-amber-900">{lang === "sw" ? "Imechaguliwa: " : "Selected: "}{unexpectedProductSearch}</p>}
                  </div>
                  <input aria-label={lang === "sw" ? "Idadi ya bidhaa iliyokosekana" : "Quantity of unlisted product"} type="number" min={1} step={1} inputMode="numeric" value={unexpectedQuantity} onChange={(event) => setUnexpectedQuantity(event.target.value === "" ? "" : Number(event.target.value))} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
                  <button type="button" onClick={addUnexpectedReceiptProduct} disabled={!unexpectedProductId} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{lang === "sw" ? "Ongeza" : "Add item"}</button>
                </div>
              </div>

              {receiptHasDifference && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-bold text-amber-950">{lang === "sw" ? "Tofauti ya order na mzigo imeonekana" : "Order and delivery do not match"}</p>
                <p className="mt-1 text-xs leading-5 text-amber-900">{lang === "sw" ? "Eleza tofauti (bidhaa haikufika, idadi tofauti, bidhaa ya ziada, n.k.)." : "Explain the difference (missing item, short quantity, extra item, etc.)."}</p>
                <textarea aria-label={lang === "sw" ? "Sababu ya tofauti ya mzigo" : "Reason for delivery discrepancy"} value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} maxLength={500} rows={2} placeholder={lang === "sw" ? "Mfano: bidhaa 36 zilipokelewa lakini hazikuwepo kwenye order iliyohifadhiwa." : "Example: 36 units arrived, but this product was missing from the saved order."} className="mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-100" />
              </div>}

              <label className="block text-sm font-medium text-gray-700">
                {lang === "sw" ? "Jumla halisi ya invoice (TZS)" : "Full actual invoice total (TZS)"}
                <input aria-label={lang === "sw" ? "Jumla halisi ya manunuzi" : "Actual purchase total"} type="number" min={0} step={1} inputMode="numeric" value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <span className="mt-1 block text-[11px] font-normal text-gray-500">{receiptHasDifference ? (lang === "sw" ? "Kwa kuwa idadi inatofautiana, weka jumla yote ya invoice ikijumuisha bidhaa za ziada." : "Because quantities differ, enter the full invoice total, including any unlisted items.") : (lang === "sw" ? "Acha wazi kutumia jumla iliyohifadhiwa kwenye order." : "Leave blank to keep the saved order total.")}</span>
              </label>

              <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-700">
                <input type="checkbox" checked={receiptAcknowledged} onChange={(event) => setReceiptAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span>{lang === "sw" ? "Nimelinganisha idadi hizi na bidhaa nilizopokea kimwili." : "I checked these quantities against the goods physically received."}</span>
              </label>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t bg-white p-4 sm:flex-row sm:justify-end sm:p-5">
              <button type="button" onClick={() => setReceivingOrder(null)} disabled={receiptSaving} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{t("common.cancel", lang)}</button>
              <button type="button" onClick={() => void submitReceipt()} disabled={receiptSaving || !receiptAcknowledged || receiptLines.some((line) => typeof line.receivedQuantity !== "number" || !Number.isInteger(line.receivedQuantity) || line.receivedQuantity < (line.orderItemId ? 0 : 1)) || (receiptHasDifference && (receiptNote.trim().length < 5 || receiptAmount.trim() === "" || !Number.isInteger(Number(receiptAmount)) || Number(receiptAmount) < 0))} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {receiptSaving ? (lang === "sw" ? "Inahifadhi..." : "Saving...") : (lang === "sw" ? "Thibitisha na sasisha stock" : "Confirm receipt and update stock")}
              </button>
            </div>
          </section>
        </div>
      )}

      {correctionOrder && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="stock-correction-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h2 id="stock-correction-title" className="text-lg font-bold text-gray-950">{lang === "sw" ? "Rekodi stock iliyokosekana" : "Record missed received stock"}</h2>
                <p className="mt-1 text-sm text-gray-600">{correctionOrder.supplier.name} · #{(correctionOrder.orderGroupId || correctionOrder.id).slice(-8).toUpperCase()}</p>
              </div>
              <button type="button" onClick={() => setCorrectionOrder(null)} aria-label="Close stock correction" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-4">
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">{lang === "sw" ? "Tumia tu kama bidhaa zilipokelewa kweli lakini hazikuingia kwenye stock. Hesabu kwanza zilizopo dukani. Marekebisho haya yataongeza stock." : "Use this only for goods physically received but not added to stock. Count what is actually on hand first. This correction adds stock."}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]">
                <div className="relative min-w-0">
                  <input aria-label={lang === "sw" ? "Tafuta bidhaa ya kurekebisha stock" : "Search product for stock correction"} value={correctionProductSearch} onChange={(event) => { setCorrectionProductSearch(event.target.value); setCorrectionProductId(""); }} placeholder={lang === "sw" ? "Tafuta bidhaa..." : "Search products..."} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                  {correctionProductSearch.trim().length >= 2 && !correctionProductId && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl">
                    {correctionProductMatches.length ? correctionProductMatches.map((product) => <button key={product.id} type="button" onClick={() => { setCorrectionProductId(product.id); setCorrectionProductSearch(product.name); }} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-amber-50"><span className="font-semibold text-gray-800">{product.name}</span><span className="ml-2 text-gray-500">{lang === "sw" ? "stock " : "stock "}{product.currentStock}</span></button>) : <p className="px-2.5 py-2 text-xs text-gray-500">{lang === "sw" ? "Hakuna bidhaa iliyopatikana." : "No matching product."}</p>}
                  </div>}
                  {correctionProductId && <p className="mt-1 truncate text-xs font-semibold text-amber-900">{lang === "sw" ? "Imechaguliwa: " : "Selected: "}{correctionProductSearch}</p>}
                </div>
                <label className="text-[11px] font-semibold text-gray-600">{lang === "sw" ? "Idadi iliyopokelewa" : "Quantity received"}<input aria-label={lang === "sw" ? "Idadi iliyopokelewa" : "Quantity received"} type="number" min={1} step={1} inputMode="numeric" value={correctionReceivedQuantity} onChange={(event) => setCorrectionReceivedQuantity(event.target.value === "" ? "" : Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                <label className="text-[11px] font-semibold text-gray-600">{lang === "sw" ? "Ongeza dukani sasa" : "Add to stock now"}<input aria-label={lang === "sw" ? "Ongeza dukani sasa" : "Add to stock now"} type="number" min={0} step={1} inputMode="numeric" value={correctionStockAddedQuantity} onChange={(event) => setCorrectionStockAddedQuantity(event.target.value === "" ? "" : Number(event.target.value))} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></label>
                <button type="button" onClick={addCorrectionProduct} disabled={!correctionProductId} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{lang === "sw" ? "Ongeza" : "Add item"}</button>
              </div>
              {correctionLines.map((line) => <div key={line.productId} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3">
                {line.product.imageUrl ? <img src={line.product.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <div className="h-10 w-10 rounded-lg bg-gray-100" />}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800">{line.product.name}</span>
                <label className="w-24 text-[11px] font-semibold text-gray-600">{lang === "sw" ? "Imepokelewa" : "Received"}<input aria-label={"Received quantity for " + line.product.name} type="number" min={1} step={1} value={line.receivedQuantity} onChange={(event) => setCorrectionLines((current) => current.map((entry) => entry.productId === line.productId ? { ...entry, receivedQuantity: event.target.value === "" ? "" : Number(event.target.value) } : entry))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm" /></label>
                <label className="w-24 text-[11px] font-semibold text-gray-600">{lang === "sw" ? "Ongeza stock" : "Add to stock"}<input aria-label={"Stock quantity to add for " + line.product.name} type="number" min={0} step={1} value={line.stockAddedQuantity} onChange={(event) => setCorrectionLines((current) => current.map((entry) => entry.productId === line.productId ? { ...entry, stockAddedQuantity: event.target.value === "" ? "" : Number(event.target.value) } : entry))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm" /></label>
                <label className="w-28 text-[11px] font-semibold text-gray-600">{lang === "sw" ? "Gharama/moja" : "Cost/unit"}<input aria-label={"Correction unit cost for " + line.product.name} type="number" min={0} step={1} value={line.unitPrice} onChange={(event) => setCorrectionLines((current) => current.map((entry) => entry.productId === line.productId ? { ...entry, unitPrice: event.target.value === "" ? "" : Number(event.target.value) } : entry))} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm" /></label>
                <button type="button" onClick={() => setCorrectionLines((current) => current.filter((entry) => entry.productId !== line.productId))} aria-label={"Remove " + line.product.name} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
              </div>)}
              <p className="text-[11px] leading-5 text-gray-500">{lang === "sw" ? "Idadi iliyopokelewa hutumika kwenye historia ya manunuzi; ongeza dukani sasa ni stock iliyobaki baada ya mauzo au matumizi. Gharama huhesabiwa kwa idadi yote iliyopokelewa." : "Quantity received is recorded for purchase history; Add to stock now is only what remains after any sales or use. Purchase cost is calculated from the full received quantity."}</p>
              <label className="block text-sm font-medium text-gray-700">
                {lang === "sw" ? "Sababu (inahitajika)" : "Reason (required)"}
                <textarea aria-label={lang === "sw" ? "Sababu ya marekebisho" : "Correction reason"} value={correctionNote} onChange={(event) => setCorrectionNote(event.target.value)} maxLength={500} minLength={5} rows={2} placeholder={lang === "sw" ? "Mfano: bidhaa ilipokelewa kwenye order 238A7479 lakini haikuingizwa." : "Example: product arrived with order 238A7479 but was not recorded."} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </label>
              <label className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs leading-5 text-gray-700">
                <input type="checkbox" checked={correctionAcknowledged} onChange={(event) => setCorrectionAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <span>{lang === "sw" ? "Nimethibitisha idadi halisi iliyopokelewa na nimehesabu stock iliyopo kabla ya kuongeza." : "I confirmed the actual quantity received and physically counted current stock before adding anything."}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t p-4">
              <button type="button" onClick={() => setCorrectionOrder(null)} disabled={correctionSaving} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{t("common.cancel", lang)}</button>
              <button type="button" onClick={() => void submitCorrection()} disabled={correctionSaving || !correctionAcknowledged || !correctionLines.length || correctionNote.trim().length < 5 || correctionLines.some((line) => typeof line.receivedQuantity !== "number" || !Number.isInteger(line.receivedQuantity) || line.receivedQuantity < 1 || typeof line.stockAddedQuantity !== "number" || !Number.isInteger(line.stockAddedQuantity) || line.stockAddedQuantity < 0 || line.stockAddedQuantity > line.receivedQuantity || typeof line.unitPrice !== "number" || !Number.isInteger(line.unitPrice) || line.unitPrice < 0)} className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{correctionSaving ? (lang === "sw" ? "Inahifadhi..." : "Saving...") : (lang === "sw" ? "Hifadhi marekebisho" : "Save stock correction")}</button>
            </div>
          </section>
        </div>
      )}

      {receiptHistoryOrder && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="receipt-history-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h2 id="receipt-history-title" className="text-lg font-bold text-gray-950">{lang === "sw" ? "Historia ya upokeaji" : "Receipt history"}</h2>
                <p className="mt-1 text-sm text-gray-600">{receiptHistoryOrder.supplier.name} · #{(receiptHistoryOrder.orderGroupId || receiptHistoryOrder.id).slice(-8).toUpperCase()}</p>
              </div>
              <button type="button" onClick={() => setReceiptHistoryOrder(null)} aria-label="Close receipt history" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 p-4">
              {receiptHistoryLoading ? <p className="py-8 text-center text-sm text-gray-500">{t("common.loading", lang)}</p> : receiptHistory.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">{lang === "sw" ? "Order hii ilipokelewa kabla ya historia ya upokeaji kuanza kuhifadhiwa. Rekodi mpya zitaonekana hapa." : "This order was received before itemized receipt history was introduced. New receipts and corrections will appear here."}</p> : receiptHistory.map((receipt) => (
                <article key={receipt.id} className="rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2.5">
                    <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + (receipt.receiptType === "INITIAL" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-900")}>{receipt.receiptType === "INITIAL" ? (lang === "sw" ? "Upokeaji wa awali" : "Initial receipt") : (lang === "sw" ? "Marekebisho ya stock" : "Stock correction")}</span>
                    <span className="text-xs text-gray-500">{formatAppDate(receipt.createdAt, lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  {receipt.note && <p className="px-3 pt-3 text-xs leading-5 text-gray-600">{receipt.note}</p>}
                  <div className="divide-y divide-gray-100">
                    {receipt.items.map((item, index) => <div key={receipt.id + "-" + item.productId + "-" + index} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium text-gray-800">{item.product?.name || item.productId}</span>
                      <span className="text-right text-xs text-gray-600">{receipt.receiptType === "INITIAL" ? (lang === "sw" ? "Order " : "Order ") + item.orderedQuantity + " · " + (lang === "sw" ? "imepokelewa " : "received ") + item.receivedQuantity : (lang === "sw" ? "Imepokelewa " : "Received ") + item.receivedQuantity + " · " + (lang === "sw" ? "imeongezwa " : "added ") + item.stockAddedQuantity} {item.product?.unit || ""}</span>
                    </div>)}
                  </div>
                  {receipt.actualTotalAmount != null && <p className="border-t px-3 py-2 text-right text-xs font-bold text-brand-800">{receipt.receiptType === "INITIAL" ? (lang === "sw" ? "Jumla halisi: " : "Actual total: ") : (lang === "sw" ? "Gharama iliyorekebishwa: " : "Correction cost added: ")}{formatTZS(receipt.actualTotalAmount)}</p>}
                </article>
              ))}
            </div>
            <div className="flex justify-end border-t p-4"><button type="button" onClick={() => setReceiptHistoryOrder(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">{t("common.cancel", lang)}</button></div>
          </section>
        </div>
      )}

      {revisionHistoryOrder && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-2 sm:items-center sm:p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="order-revision-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b p-4">
              <div>
                <h2 id="order-revision-title" className="text-lg font-bold text-gray-950">{lang === "sw" ? "Historia ya mabadiliko ya order" : "Order change history"}</h2>
                <p className="mt-1 text-sm text-gray-600">{revisionHistoryOrder.supplier.name} · #{(revisionHistoryOrder.orderGroupId || revisionHistoryOrder.id).slice(-8).toUpperCase()}</p>
              </div>
              <button type="button" onClick={() => setRevisionHistoryOrder(null)} aria-label="Close order change history" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 p-4">
              {revisionHistoryLoading ? <p className="py-8 text-center text-sm text-gray-500">{t("common.loading", lang)}</p> : revisionHistory.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">{lang === "sw" ? "Hakuna historia ya awali iliyohifadhiwa kwa order hii. Mabadiliko yaliyofanywa baada ya kipengele hiki kuwashwa yataonekana hapa." : "No saved revision history exists for this order. Changes saved after this feature is enabled will appear here; older changes cannot be reconstructed."}</p>
              ) : revisionHistory.map((revision) => {
                const beforeItems = revision.beforeSnapshot?.items ?? [];
                const afterItems = revision.afterSnapshot.items ?? [];
                const removedItems = beforeItems.filter((item) => !afterItems.some((next) => next.productId === item.productId));
                const addedItems = afterItems.filter((item) => !beforeItems.some((previous) => previous.productId === item.productId));
                const changedItems = beforeItems.filter((item) => afterItems.some((next) => next.productId === item.productId && (next.quantity !== item.quantity || next.unitPrice !== item.unitPrice)));
                return (
                  <article key={revision.id} className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50 px-3 py-2.5">
                      <span className="text-sm font-bold text-gray-800">{revision.action === "CREATED" ? (lang === "sw" ? "Order imehifadhiwa" : "Order created") : (lang === "sw" ? "Mabadiliko " : "Edit ") + revision.revisionNumber}</span>
                      <span className="text-xs text-gray-500">{formatAppDate(revision.createdAt, lang === "sw" ? "sw-TZ" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                    </div>
                    {revision.beforeSnapshot && <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
                      {removedItems.map((item) => <span key={"removed-" + item.productId} className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800">{lang === "sw" ? "Imeondolewa: " : "Removed: "}{item.productName}</span>)}
                      {addedItems.map((item) => <span key={"added-" + item.productId} className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-800">{lang === "sw" ? "Imeongezwa: " : "Added: "}{item.productName}</span>)}
                      {changedItems.map((item) => <span key={"changed-" + item.productId} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">{lang === "sw" ? "Idadi/bei imebadilika: " : "Qty/price changed: "}{item.productName}</span>)}
                      {!removedItems.length && !addedItems.length && !changedItems.length && <span className="text-xs text-gray-500">{lang === "sw" ? "Hakuna bidhaa au bei iliyobadilika." : "No products or prices changed."}</span>}
                    </div>}
                    <div className="grid gap-3 p-3 sm:grid-cols-2">
                      {revision.beforeSnapshot && <div className="rounded-lg bg-gray-50 p-3">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-500">{lang === "sw" ? "Kabla" : "Before"}</p>
                        <div className="space-y-1.5">{beforeItems.map((item) => <div key={item.productId} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate text-gray-700">{item.productName} × {item.quantity}</span><span className="shrink-0 text-gray-500">{formatTZS(item.unitPrice ?? 0)}</span></div>)}</div>
                        {revisionHistoryOrder?.status !== "OUT_FOR_DELIVERY" && <p className="mt-2 border-t pt-2 text-right text-xs font-bold text-gray-700">{formatTZS(revision.beforeSnapshot.totalAmount ?? 0)}</p>}
                      </div>}
                      <div className="rounded-lg bg-green-50/60 p-3">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-green-800">{revision.beforeSnapshot ? (lang === "sw" ? "Baada ya mabadiliko" : "After edit") : (lang === "sw" ? "Order iliyohifadhiwa" : "Saved order")}</p>
                        <div className="space-y-1.5">{afterItems.map((item) => <div key={item.productId} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate text-gray-800">{item.productName} × {item.quantity}</span><span className="shrink-0 text-gray-600">{formatTZS(item.unitPrice ?? 0)}</span></div>)}</div>
                        {revisionHistoryOrder?.status !== "OUT_FOR_DELIVERY" && <p className="mt-2 border-t border-green-200 pt-2 text-right text-xs font-bold text-gray-800">{formatTZS(revision.afterSnapshot.totalAmount ?? 0)}</p>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="flex justify-end border-t p-4"><button type="button" onClick={() => setRevisionHistoryOrder(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">{t("common.cancel", lang)}</button></div>
          </section>
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
