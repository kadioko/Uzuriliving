"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import {
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Package,
  X,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  Trash2,
  ScanLine,
  Printer,
} from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { BarcodeScanner } from "@/components/barcode/BarcodeScanner";
import { BarcodeLabel } from "@/components/barcode/BarcodeLabel";

interface Product {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  wholesalePrice?: number | null;
  wholesaleMinQty?: number | null;
  currentStock: number;
  minimumStock: number;
  isActive: boolean;
  expiryDate?: string | null;
  doesNotExpire: boolean;
  supplier?: { id: string; name: string; phone: string };
  barcode?: string | null;
  barcodeType?: string | null;
  barcodeGenerated?: boolean;
  imageUrl?: string | null;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
}

interface OwnerSupplierUser {
  role: string;
  staff?: { role?: string; permissions?: { canViewReports?: boolean } };
  shop?: { ownerSupplierManagementEnabled?: boolean } | null;
}

function expiryStatus(p: Product, lang: string): { label: string; color: string } | null {
  if (p.doesNotExpire) return { label: lang === "en" ? "Does not expire" : "Haiishi muda", color: "bg-gray-100 text-gray-500" };
  if (!p.expiryDate) return null;
  const now = new Date();
  const exp = new Date(p.expiryDate);
  const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: lang === "en" ? "Expired" : "Imekwisha muda", color: "bg-red-100 text-red-700" };
  if (daysLeft <= 30) return {
    label: lang === "en" ? `Expires in ${daysLeft} days` : `Inaisha siku ${daysLeft}`,
    color: "bg-orange-100 text-orange-700",
  };
  return { label: exp.toLocaleDateString(lang === "sw" ? "sw-TZ" : "en-US", { day: "2-digit", month: "short", year: "numeric" }), color: "bg-green-100 text-green-700" };
}

export default function InventoryPage() {
  const lang = useLang();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("search") || "";
  });
  const [assistantAction] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("action") || "";
  });
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "", sku: "", unit: "pcs", buyingPrice: "", sellingPrice: "",
    wholesalePrice: "", wholesaleMinQty: "",
    currentStock: "0", minimumStock: "5", supplierId: "",
    expiryDate: "", doesNotExpire: false, barcode: "", barcodeType: "", generateBarcode: false,
  });
  const [adjustForm, setAdjustForm] = useState({ type: "IN", quantity: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const latestLoad = useRef(0);
  const mutationInFlight = useRef(false);
  const [canViewFinancials, setCanViewFinancials] = useState(true);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [stockCount, setStockCount] = useState<{ id: string; items: Array<{ id: string; expected: number; counted: number; product: { id: string; name: string; barcode?: string | null; unit: string } }> } | null>(null);
  const [stockCountScannerOpen, setStockCountScannerOpen] = useState(false);
const [stockCountCode, setStockCountCode] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showQuickSupplier, setShowQuickSupplier] = useState(false);
  const [quickSupplier, setQuickSupplier] = useState({ name: "", phone: "", address: "" });
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);
  const [canManageOwnerSuppliers, setCanManageOwnerSuppliers] = useState(false);

  const MAX_PRODUCT_IMAGE_BYTES = 1 * 1024 * 1024;
  const MAX_PRODUCT_IMAGE_DIMENSION = 2400;

  const fetchProducts = useCallback(async () => {
    const requestId = ++latestLoad.current;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("limit", "1000");
      const data = await api.get<{ products: Product[] }>(`/products?${params}`);
      if (requestId !== latestLoad.current) return;
      let list = data.products;
      if (lowStockOnly) list = list.filter((p) => p.currentStock <= p.minimumStock);
      setProducts(list);
    } catch (value: unknown) {
      if (requestId === latestLoad.current) {
        toast(value instanceof Error ? value.message : (lang === "sw" ? "Imeshindikana kupakia bidhaa." : "Could not load products."), "error");
      }
    } finally {
      if (requestId === latestLoad.current) setLoading(false);
    }
  }, [search, lowStockOnly, toast, lang]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "add") {
      openAdd();
      setForm((current) => ({ ...current, barcode: params.get("barcode") || "" }));
    }
  // Intentional one-time handoff from the POS unknown-barcode prompt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    api.get<{ user: OwnerSupplierUser }>("/auth/me")
      .then((data) => {
        setCanViewFinancials(data.user.role !== "MERCHANT" || !data.user.staff || Boolean(data.user.staff.permissions?.canViewReports));
        setCanManageOwnerSuppliers(Boolean(data.user.role === "MERCHANT" && (!data.user.staff || data.user.staff.role === "OWNER") && data.user.shop?.ownerSupplierManagementEnabled));
      })
      .catch(() => setCanViewFinancials(false));
    api.get<{ suppliers: Supplier[] }>("/suppliers").then((d) => setSuppliers(d.suppliers));
    api.get<{ count: NonNullable<typeof stockCount> | null }>("/stock-counts").then((data) => { if (data.count) setStockCount(data.count); }).catch(() => {});
  }, []);

  function openAdd() {
    setEditProduct(null);
    setForm({ name: "", sku: "", unit: "pcs", buyingPrice: "", sellingPrice: "", wholesalePrice: "", wholesaleMinQty: "", currentStock: "0", minimumStock: "5", supplierId: "", expiryDate: "", doesNotExpire: false, barcode: "", barcodeType: "", generateBarcode: false });
    setError("");
    setSelectedImage(null);
    setImagePreview(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setForm({
      name: p.name, sku: p.sku || "", unit: p.unit,
      buyingPrice: p.buyingPrice == null ? "" : String(p.buyingPrice), sellingPrice: String(p.sellingPrice),
      wholesalePrice: p.wholesalePrice != null ? String(p.wholesalePrice) : "",
      wholesaleMinQty: p.wholesaleMinQty != null ? String(p.wholesaleMinQty) : "",
      currentStock: String(p.currentStock), minimumStock: String(p.minimumStock),
      supplierId: p.supplier?.id || "",
      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : "",
      doesNotExpire: p.doesNotExpire,
      barcode: p.barcode || "", barcodeType: p.barcodeType || "", generateBarcode: false,
    });
    setSelectedImage(null);
    setImagePreview(p.imageUrl || null);
    setError("");
    setShowForm(true);
  }

  async function handleImageChange(file: File | undefined) {
    if (!file) return;
    if (![
      "image/jpeg",
      "image/png",
      "image/webp",
    ].includes(file.type)) {
      setError(lang === "sw" ? "Tumia picha ya JPG, PNG, au WebP." : "Use a JPG, PNG, or WebP image.");
      return;
    }
    if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
      setError(lang === "sw" ? "Picha lazima iwe chini ya MB 1." : "The image must be 1 MB or smaller.");
      return;
    }
    const preview = URL.createObjectURL(file);
    const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const image = new window.Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = preview;
    });
    if (!dimensions || dimensions.width > MAX_PRODUCT_IMAGE_DIMENSION || dimensions.height > MAX_PRODUCT_IMAGE_DIMENSION) {
      URL.revokeObjectURL(preview);
      setError(lang === "sw" ? "Picha iwe na upana na urefu wa chini ya px 2400." : "Image width and height must each be 2400 px or smaller.");
      return;
    }
    setSelectedImage(file);
    setImagePreview(preview);
    setError("");
  }

  async function uploadProductImage(productId: string, file: File) {
    const upload = await api.post<{ signedUrl: string; publicUrl: string }>("/storage/upload-url", {
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      scope: "product",
    });
    const response = await fetch(upload.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type, "x-upsert": "true" },
      body: file,
    });
    if (!response.ok) throw new Error(lang === "sw" ? "Picha haikuweza kupakiwa." : "The product image could not be uploaded.");
    return api.patch<{ product: Product }>(`/products/${productId}`, { imageUrl: upload.publicUrl });
  }

  async function handleSave() {
    if (mutationInFlight.current) return;
    setError("");
    if (!form.name.trim() || (canViewFinancials && form.buyingPrice === "") || form.sellingPrice === "") {
      setError(t("inventory.fieldRequired", lang));
      return;
    }
    const numericFields = [form.sellingPrice, form.currentStock, form.minimumStock, ...(canViewFinancials ? [form.buyingPrice] : [])];
    if (numericFields.some((value) => !Number.isInteger(Number(value)) || Number(value) < 0)) {
      setError(lang === "sw" ? "Bei na idadi ziwe namba kamili zisizo hasi." : "Prices and quantities must be whole, non-negative numbers.");
      return;
    }
    if (form.wholesalePrice !== "" && (!Number.isInteger(Number(form.wholesalePrice)) || Number(form.wholesalePrice) < 0)) {
      setError(lang === "sw" ? "Bei ya jumla iwe namba kamili isiyo hasi." : "Wholesale price must be a whole, non-negative number.");
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    try {
      const body = {
        name: form.name, sku: form.sku || undefined, unit: form.unit,
        ...(canViewFinancials ? { buyingPrice: Number(form.buyingPrice) } : {}), sellingPrice: Number(form.sellingPrice),
        wholesalePrice: form.wholesalePrice === "" ? null : Number(form.wholesalePrice),
        wholesaleMinQty: form.wholesaleMinQty === "" ? null : Number(form.wholesaleMinQty),
        currentStock: Number(form.currentStock), minimumStock: Number(form.minimumStock),
        supplierId: form.supplierId || undefined,
        doesNotExpire: form.doesNotExpire,
        expiryDate: form.doesNotExpire ? null : (form.expiryDate || null),
        barcode: form.barcode || null,
        barcodeType: form.barcodeType || undefined,
        generateBarcode: form.generateBarcode,
      };
      const response = editProduct
        ? await api.patch<{ product: Product }>(`/products/${editProduct.id}`, body)
        : await api.post<{ product: Product }>("/products", body);
      let savedProduct = response.product;
      if (selectedImage) {
        const imageResponse = await uploadProductImage(savedProduct.id, selectedImage);
        savedProduct = imageResponse.product;
      }
      if (editProduct) {
        setProducts((current) => current.map((product) => product.id === editProduct.id ? savedProduct : product));
      } else {
        setProducts((current) => [savedProduct, ...current]);
      }
      setSelectedImage(null);
      setImagePreview(null);
      setShowForm(false);
      toast(editProduct ? (lang === "sw" ? "Bidhaa imebadilishwa." : "Product updated.") : (lang === "sw" ? "Bidhaa imeongezwa." : "Product added."), "success");
      await fetchProducts();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error", lang));
    } finally {
      setSaving(false);
      mutationInFlight.current = false;
    }
  }

  async function handleAdjust() {
    if (mutationInFlight.current) return;
    if (!adjustProduct || adjustForm.quantity === "") return;
    if (!Number.isInteger(Number(adjustForm.quantity)) || Number(adjustForm.quantity) < 0 || (adjustForm.type !== "ADJUSTMENT" && Number(adjustForm.quantity) === 0)) {
      toast(lang === "sw" ? "Weka idadi sahihi ya namba kamili." : "Enter a valid whole quantity.", "error");
      return;
    }
    mutationInFlight.current = true;
    setSaving(true);
    try {
      const response = await api.post<{ product: Product }>("/stock/adjust", {
        productId: adjustProduct.id,
        type: adjustForm.type,
        quantity: Number(adjustForm.quantity),
        note: adjustForm.note || undefined,
      });
      setProducts((current) => current.map((product) => product.id === response.product.id ? response.product : product));
      setAdjustProduct(null);
      toast(lang === "sw" ? "Stock imebadilishwa." : "Stock updated.", "success");
      await fetchProducts();
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t("common.error", lang), "error");
    } finally {
      setSaving(false);
      mutationInFlight.current = false;
    }
  }

  async function handleQuickSupplierSave() {
    if (!quickSupplier.name.trim() || !quickSupplier.phone.trim()) return;
    setSavingQuickSupplier(true);
    try {
      const data = await api.post<{ supplier: Supplier }>("/suppliers", quickSupplier);
      setSuppliers((current) => [...current, data.supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, supplierId: data.supplier.id }));
      setQuickSupplier({ name: "", phone: "", address: "" });
      setShowQuickSupplier(false);
    } catch (value: unknown) {
      setError(value instanceof Error ? value.message : (lang === "sw" ? "Imeshindikana kuongeza supplier." : "Could not add supplier."));
    } finally {
      setSavingQuickSupplier(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteProduct) return;
    if (mutationInFlight.current) return;
    mutationInFlight.current = true;
    setSaving(true);
    try {
      await api.delete(`/products/${deleteProduct.id}`, lang);
      setProducts((prev) => prev.filter((p) => p.id !== deleteProduct.id));
      setDeleteProduct(null);
      toast(t("inventory.deleted", lang), "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : t("common.error", lang), "error");
    } finally {
      setSaving(false);
      mutationInFlight.current = false;
    }
  }

  async function startStockCount() {
    try {
      const data = await api.post<{ count: NonNullable<typeof stockCount> }>("/stock-counts", {});
      setStockCount(data.count);
      toast(lang === "sw" ? "Uhesabuji umeanza. Scan bidhaa." : "Stock count started. Scan items.", "success");
    } catch (error: unknown) { toast(error instanceof Error ? error.message : "Could not start stock count", "error"); }
  }

  async function scanStockCount(barcode: string) {
    if (!stockCount) return;
    try {
      const data = await api.post<{ item: { productId: string; counted: number } }>(`/stock-counts/${stockCount.id}/scan`, { barcode });
      setStockCount((current) => current ? { ...current, items: current.items.map((item) => item.product.id === data.item.productId ? { ...item, counted: data.item.counted } : item) } : current);
      setStockCountCode(""); setStockCountScannerOpen(false);
      if (navigator.vibrate) navigator.vibrate(50);
    } catch (error: unknown) { toast(error instanceof Error ? error.message : "Barcode not found", "error"); }
  }

  async function finishStockCount(applyAdjustments: boolean) {
    if (!stockCount) return;
    try {
      await api.post(`/stock-counts/${stockCount.id}/finish`, { applyAdjustments });
      setStockCount(null); await fetchProducts();
      toast(applyAdjustments ? (lang === "sw" ? "Tofauti za stock zimetumika." : "Stock differences applied.") : (lang === "sw" ? "Uhesabuji umekamilika." : "Stock count completed."), "success");
    } catch (error: unknown) { toast(error instanceof Error ? error.message : "Could not finish stock count", "error"); }
  }

  const margin = (p: Product) =>
    p.sellingPrice > 0 ? (((p.sellingPrice - p.buyingPrice) / p.sellingPrice) * 100).toFixed(0) : "0";

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto pb-24 lg:pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">{t("inventory.title", lang)}</h1>
          <div className="flex gap-2">{canViewFinancials && <button onClick={startStockCount} aria-label="Start stock count" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600" title="Stock count"><ScanLine className="h-4 w-4" /></button>}{canViewFinancials && <button onClick={openAdd} aria-label={t("inventory.addProduct", lang)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"><Plus className="w-4 h-4" /><span className="hidden sm:inline">{t("inventory.addProduct", lang)}</span></button>}</div>
        </div>

        {stockCount && <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-brand-950">{lang === "sw" ? "Uhesabuji wa stock unaendelea" : "Stock count in progress"}</p><p className="text-xs text-brand-700">{stockCount.items.reduce((sum, item) => sum + item.counted, 0)} {lang === "sw" ? "zimescanwa" : "scanned"}</p></div><button onClick={() => setStockCountScannerOpen(true)} className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Scan</button></div><div className="mt-3 flex gap-2"><input value={stockCountCode} onChange={(event) => setStockCountCode(event.target.value)} onKeyDown={(event) => event.key === "Enter" && scanStockCount(stockCountCode)} placeholder="Barcode" className="min-w-0 flex-1 rounded-lg border border-brand-200 px-3 py-2 text-sm" /><button onClick={() => scanStockCount(stockCountCode)} className="rounded-lg border border-brand-300 px-3 text-sm font-semibold text-brand-800">Add</button></div><div className="mt-3 max-h-32 overflow-y-auto text-xs">{stockCount.items.filter((item) => item.counted > 0).map((item) => <div key={item.id} className="flex justify-between border-t border-brand-100 py-1"><span>{item.product.name}</span><span>{item.expected} / {item.counted} ({item.counted - item.expected >= 0 ? "+" : ""}{item.counted - item.expected})</span></div>)}</div><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => finishStockCount(false)} className="rounded-lg border border-brand-300 py-2 text-sm font-semibold text-brand-800">{lang === "sw" ? "Maliza bila kubadili" : "Finish only"}</button><button onClick={() => finishStockCount(true)} className="rounded-lg bg-brand-700 py-2 text-sm font-semibold text-white">{lang === "sw" ? "Tumia tofauti" : "Apply differences"}</button></div></div>}

        {assistantAction && (
          <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm text-brand-900">
            <p className="font-semibold">
              {assistantAction === "restock"
                ? (lang === "sw" ? "Uzuri Living imekufungua kwenye bidhaa ya kuagiza tena." : "Uzuri Living opened the product that needs restocking.")
                : (lang === "sw" ? "Uzuri Living imekufungua kwenye bidhaa ya kupromote." : "Uzuri Living opened the product to promote.")}
            </p>
            <p className="mt-1 text-xs text-brand-700">
              {assistantAction === "restock"
                ? (lang === "sw" ? "Tumia kuongeza stock, kuunganisha supplier, au kurekebisha minimum stock." : "Use adjust stock, link a supplier, or update minimum stock.")
                : (lang === "sw" ? "Hakiki bei, margin, na stock kabla ya kuiweka mbele kwa wateja." : "Check price, margin, and stock before featuring it for customers.")}
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t("inventory.search", lang)}
              placeholder={t("inventory.search", lang)}
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              lowStockOnly
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-white border-gray-300 text-gray-600"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("inventory.lowStockOnly", lang)}</span>
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: t("inventory.allProducts", lang), value: products.length },
            { label: t("inventory.lowStockCount", lang), value: products.filter((p) => p.currentStock <= p.minimumStock && p.currentStock > 0).length, color: "text-amber-600" },
            { label: t("inventory.outOfStockCount", lang), value: products.filter((p) => p.currentStock === 0).length, color: "text-red-600" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
              <p className={`text-lg font-bold ${stat.color || "text-gray-900"}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Product list */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">{t("common.loading", lang)}</div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t("inventory.noProducts", lang)}</p>
            <p className="text-gray-400 text-sm mt-1">{t("inventory.noProductsHint", lang)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((p) => {
              const isLow = p.currentStock <= p.minimumStock && p.currentStock > 0;
              const isOut = p.currentStock === 0;
              const expiry = expiryStatus(p, lang);
              const isExpired = expiry?.color === "bg-red-100 text-red-700";
              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-xl border p-4 ${
                    isExpired ? "border-red-300" :
                    isOut ? "border-red-200" :
                    isLow ? "border-amber-200" :
                    "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="mr-3 h-16 w-16 flex-shrink-0 rounded-xl border border-gray-200 object-cover" />
                    ) : (
                      <div className="mr-3 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-300"><Package className="h-6 w-6" /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                        {isOut && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                            {t("inventory.outOfStockBadge", lang)}
                          </span>
                        )}
                        {isLow && !isOut && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                            {t("inventory.lowStockBadge", lang)}
                          </span>
                        )}
                        {expiry && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${expiry.color}`}>
                            <CalendarClock className="w-3 h-3" />
                            {expiry.label}
                          </span>
                        )}
                      </div>
                      {p.supplier && (
                        <p className="text-xs text-gray-400 mt-0.5">{p.supplier.name}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div>
                          <p className="text-xs text-gray-400">{t("inventory.stock", lang)}</p>
                          <p className={`text-sm font-bold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-gray-800"}`}>
                            {p.currentStock} {p.unit}
                          </p>
                        </div>
                        {canViewFinancials && <div>
                          <p className="text-xs text-gray-400">{t("inventory.buyingPrice", lang)}</p>
                          <p className="text-sm font-medium text-gray-700">{p.buyingPrice == null ? "-" : formatTZS(p.buyingPrice)}</p>
                        </div>}
                        <div>
                          <p className="text-xs text-gray-400">{t("inventory.sellingPrice", lang)}</p>
                          <p className="text-sm font-medium text-brand-700">{formatTZS(p.sellingPrice)}</p>
                        </div>
                        {canViewFinancials && <div>
                          <p className="text-xs text-gray-400">{t("inventory.marginLabel", lang)}</p>
                          <p className="text-sm font-medium text-green-600">{margin(p)}%</p>
                        </div>}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {p.barcode && <button onClick={() => setLabelProduct(p)} aria-label={`Print label for ${p.name}`} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" title="Print barcode"><Printer className="h-4 w-4" /></button>}
                      <button
                        onClick={() => {
                          setAdjustProduct(p);
                          setAdjustForm({ type: "IN", quantity: "", note: "" });
                        }}
                        aria-label={`${t("inventory.adjustStock", lang)} ${p.name}`}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors min-h-0"
                        title={t("inventory.adjustStock", lang)}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        aria-label={`${t("inventory.editTitle", lang)} ${p.name}`}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-0"
                        title={t("common.edit", lang)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteProduct(p)}
                        disabled={saving}
                        aria-label={`${t("inventory.deleteProduct", lang)} ${p.name}`}
                        className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 min-h-0"
                        title={t("inventory.deleteProduct", lang)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      {showForm && (
        <Modal title={editProduct ? t("inventory.editTitle", lang) : t("inventory.addTitle", lang)} onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
            <Field label={t("inventory.nameLabel", lang)}>
              <input aria-label={t("inventory.nameLabel", lang)} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={INPUT} placeholder={t("inventory.namePlaceholder", lang)} />
            </Field>
            <Field label={lang === "sw" ? "Picha ya bidhaa" : "Product image"}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => void handleImageChange(event.target.files?.[0])}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700"
              />
              <p className="mt-1 text-xs text-gray-500">JPG, PNG, WebP · max 1 MB · max 2400 × 2400 px</p>
              {imagePreview && <img src={imagePreview} alt="Product preview" className="mt-2 h-24 w-24 rounded-xl border border-gray-200 object-cover" />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("inventory.skuLabel", lang)}>
                <input aria-label={t("inventory.skuLabel", lang)} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className={INPUT} placeholder="UNG001" />
              </Field>
              <Field label={t("inventory.unitLabel", lang)}>
                <select aria-label={t("inventory.unitLabel", lang)} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={INPUT}>
                  {["pcs", "kg", "litre", "box", "crate", "bag", "pkt", "bar"].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Barcode</p><button onClick={() => setBarcodeScannerOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"><ScanLine className="h-4 w-4" />Scan</button></div>
              <input value={form.barcode} disabled={form.generateBarcode} onChange={(e) => setForm({ ...form, barcode: e.target.value.toUpperCase() })} placeholder="EAN, UPC, or DP00000001" className={INPUT} />
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.generateBarcode} onChange={(e) => setForm({ ...form, generateBarcode: e.target.checked, barcode: e.target.checked ? "" : form.barcode })} />Generate Uzuri Living barcode</label>
              {form.barcode && <BarcodeLabel value={form.barcode} name={form.name || "Product"} price={form.sellingPrice ? formatTZS(Number(form.sellingPrice)) : undefined} className="max-w-[240px] border" />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {canViewFinancials && <Field label={t("inventory.buyingPriceLabel", lang)}>
                <input aria-label={t("inventory.buyingPriceLabel", lang)} type="number" min="0" step="1" value={form.buyingPrice} onChange={(e) => setForm({ ...form, buyingPrice: e.target.value })}
                  className={INPUT} placeholder="2800" />
              </Field>}
              <Field label={t("inventory.sellingPriceLabel", lang)}>
                <input aria-label={t("inventory.sellingPriceLabel", lang)} type="number" min="0" step="1" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                  className={INPUT} placeholder="3200" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("inventory.currentStockLabel", lang)}>
                <input aria-label={t("inventory.currentStockLabel", lang)} type="number" min="0" step="1" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  className={INPUT} placeholder="0" />
              </Field>
              <Field label={t("inventory.minimumStockLabel", lang)}>
                <input aria-label={t("inventory.minimumStockLabel", lang)} type="number" min="0" step="1" value={form.minimumStock} onChange={(e) => setForm({ ...form, minimumStock: e.target.value })}
                  className={INPUT} placeholder="5" />
              </Field>
            </div>
            {/* Wholesale section */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{t("inventory.wholesaleSection", lang)}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("inventory.wholesalePriceLabel", lang)}>
                  <input aria-label={t("inventory.wholesalePriceLabel", lang)} type="number" min="0" step="1" value={form.wholesalePrice}
                    onChange={(e) => setForm({ ...form, wholesalePrice: e.target.value })}
                    className={INPUT} placeholder="2900" />
                </Field>
                <Field label={t("inventory.wholesaleMinQtyLabel", lang)}>
                  <input aria-label={t("inventory.wholesaleMinQtyLabel", lang)} type="number" min="1" step="1" value={form.wholesaleMinQty}
                    onChange={(e) => setForm({ ...form, wholesaleMinQty: e.target.value })}
                    className={INPUT} placeholder="5" />
                </Field>
              </div>
            </div>

            <Field label={t("inventory.supplierLabel", lang)}>
              <select aria-label={t("inventory.supplierLabel", lang)} value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} className={INPUT}>
                <option value="">{t("inventory.selectSupplier", lang)}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {canManageOwnerSuppliers && <button type="button" onClick={() => setShowQuickSupplier(true)} className="mt-2 text-xs font-semibold text-brand-700 hover:text-brand-800">
                + {lang === "sw" ? "Ongeza supplier mpya" : "Add new supplier"}
              </button>}
            </Field>

            {/* Expiry section */}
            <div className="border border-gray-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5" /> {t("inventory.expirySection", lang)}
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  aria-label={t("inventory.doesNotExpire", lang)}
                  checked={form.doesNotExpire}
                  onChange={(e) => setForm({ ...form, doesNotExpire: e.target.checked, expiryDate: "" })}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600"
                />
                <span className="text-sm text-gray-700">{t("inventory.doesNotExpire", lang)}</span>
              </label>
              {!form.doesNotExpire && (
                <Field label={t("inventory.expiryDateLabel", lang)}>
                  <input
                    type="date"
                    aria-label={t("inventory.expiryDateLabel", lang)}
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                    className={INPUT}
                  />
                </Field>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium">
                {t("common.cancel", lang)}
              </button>
              <button aria-label={t("common.save", lang)} onClick={handleSave} disabled={saving} className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? t("inventory.saving", lang) : t("common.save", lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Product Confirmation */}
      {deleteProduct && (
        <Modal title={t("inventory.deleteProduct", lang)} onClose={() => setDeleteProduct(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white text-red-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-red-950">
                    {lang === "sw" ? `Futa/fiche ${deleteProduct.name}?` : `Delete/hide ${deleteProduct.name}?`}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-red-800">
                    {lang === "sw"
                      ? "Haitaonekana tena kwenye inventory au mauzo mapya. Historia ya mauzo ya zamani itabaki salama."
                      : "It will no longer appear in inventory or new sales. Existing sales history will stay safe."}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteProduct(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600"
              >
                {t("common.cancel", lang)}
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={saving}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? t("inventory.saving", lang) : t("inventory.deleteProduct", lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Adjust Stock Modal */}
      {adjustProduct && (
        <Modal title={`${t("inventory.adjustStock", lang)}: ${adjustProduct.name}`} onClose={() => setAdjustProduct(null)}>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {t("inventory.currentStockOf", lang)} <strong>{adjustProduct.currentStock} {adjustProduct.unit}</strong>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { v: "IN", labelKey: "inventory.adjustIn", icon: <ArrowUp className="w-4 h-4" />, color: "green" },
                { v: "OUT", labelKey: "inventory.adjustOut", icon: <ArrowDown className="w-4 h-4" />, color: "red" },
                { v: "ADJUSTMENT", labelKey: "inventory.adjustSet", icon: <Edit2 className="w-4 h-4" />, color: "blue" },
              ].map(({ v, labelKey, icon, color }) => (
                <button
                  key={v}
                  onClick={() => setAdjustForm({ ...adjustForm, type: v })}
                  aria-label={t(labelKey, lang)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-medium transition-colors min-h-0 ${
                    adjustForm.type === v
                      ? `bg-${color}-50 border-${color}-300 text-${color}-700`
                      : "border-gray-200 text-gray-500"
                  }`}
                >
                  {icon}{t(labelKey, lang)}
                </button>
              ))}
            </div>
            <Field label={adjustForm.type === "ADJUSTMENT" ? t("inventory.adjustNewQty", lang) : t("inventory.adjustQty", lang)}>
              <input aria-label={adjustForm.type === "ADJUSTMENT" ? t("inventory.adjustNewQty", lang) : t("inventory.adjustQty", lang)} type="number" min="0" step="1" value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                className={INPUT} placeholder="0" />
            </Field>
            <Field label={t("inventory.adjustNote", lang)}>
              <input aria-label={t("inventory.adjustNote", lang)} value={adjustForm.note}
                onChange={(e) => setAdjustForm({ ...adjustForm, note: e.target.value })}
                className={INPUT} placeholder={t("inventory.adjustNotePlaceholder", lang)} />
            </Field>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setAdjustProduct(null)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-medium">
                {t("common.cancel", lang)}
              </button>
              <button aria-label={t("common.save", lang)} onClick={handleAdjust} disabled={saving || adjustForm.quantity === ""}
                className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                {saving ? "..." : t("common.save", lang)}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showQuickSupplier && <Modal title={lang === "sw" ? "Ongeza supplier" : "Add supplier"} onClose={() => setShowQuickSupplier(false)}>
        <div className="space-y-3">
          <Field label={lang === "sw" ? "Jina la kampuni" : "Company name"}><input className={INPUT} value={quickSupplier.name} onChange={(e) => setQuickSupplier({ ...quickSupplier, name: e.target.value })} /></Field>
          <Field label={lang === "sw" ? "Nambari ya simu" : "Phone number"}><input className={INPUT} type="tel" value={quickSupplier.phone} onChange={(e) => setQuickSupplier({ ...quickSupplier, phone: e.target.value })} /></Field>
          <Field label={lang === "sw" ? "Anwani" : "Address"}><input className={INPUT} value={quickSupplier.address} onChange={(e) => setQuickSupplier({ ...quickSupplier, address: e.target.value })} /></Field>
          <div className="flex gap-2 pt-2"><button type="button" onClick={() => setShowQuickSupplier(false)} className="flex-1 border border-gray-300 py-2.5 rounded-lg text-sm">{t("common.cancel", lang)}</button><button type="button" onClick={handleQuickSupplierSave} disabled={savingQuickSupplier || !quickSupplier.name.trim() || !quickSupplier.phone.trim()} className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50">{savingQuickSupplier ? "..." : t("common.save", lang)}</button></div>
        </div>
      </Modal>}
      {barcodeScannerOpen && <BarcodeScanner onClose={() => setBarcodeScannerOpen(false)} onDetected={(barcode) => { setForm({ ...form, barcode: barcode.toUpperCase(), generateBarcode: false }); setBarcodeScannerOpen(false); }} />}
      {stockCountScannerOpen && <BarcodeScanner onClose={() => setStockCountScannerOpen(false)} onDetected={scanStockCount} />}
      {labelProduct?.barcode && <Modal title="Barcode label" onClose={() => setLabelProduct(null)}><div className="space-y-4"><BarcodeLabel value={labelProduct.barcode} name={labelProduct.name} price={formatTZS(labelProduct.sellingPrice)} className="border" /><button onClick={() => window.print()} className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white">Print label</button></div></Modal>}
    </AppShell>
  );
}

const INPUT = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-h-0"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
