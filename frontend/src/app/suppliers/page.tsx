"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { Plus, Phone, MapPin, Package, X, Edit2, Truck, CheckCircle, ShieldCheck } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  verificationStatus?: "UNVERIFIED" | "NEEDS_REVIEW" | "VERIFIED" | "REJECTED";
  verifiedAt?: string | null;
  adminNotes?: string | null;
  canEdit?: boolean;
  _count?: { products: number; orders: number; catalogProducts?: number };
}

interface CurrentUser {
  role: string;
  staff?: { role?: string };
  shop?: { ownerSupplierManagementEnabled?: boolean } | null;
}

export default function SuppliersPage() {
  const lang = useLang();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<CurrentUser | null>(null);

  function fetchSuppliers() {
    setLoading(true);
    api.get<{ suppliers: Supplier[] }>("/suppliers")
      .then((d) => setSuppliers(d.suppliers))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchSuppliers();
    api.get<{ user: CurrentUser }>("/auth/me").then((data) => setUser(data.user)).catch(() => null);
  }, []);

  function openAdd() {
    setEditSupplier(null);
    setForm({ name: "", phone: "", address: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(s: Supplier) {
    setEditSupplier(s);
    setForm({ name: s.name, phone: s.phone, address: s.address || "" });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name || !form.phone) {
      setError(t("suppliers.validationError", lang));
      return;
    }
    setSaving(true);
    try {
      if (editSupplier) {
        await api.patch(`/suppliers/${editSupplier.id}`, form);
      } else {
        await api.post("/suppliers", form);
      }
      setShowForm(false);
      fetchSuppliers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error", lang));
    } finally {
      setSaving(false);
    }
  }

  const FIELDS = [
    { labelKey: "suppliers.companyName", key: "name", placeholder: "Jumla Traders Ltd", type: "text" },
    { labelKey: "suppliers.phoneNumber", key: "phone", placeholder: "+255 7XX XXX XXX", type: "tel" },
    { labelKey: "suppliers.address", key: "address", placeholder: "Kariakoo, Dar es Salaam", type: "text" },
  ] as const;
  const isAdmin = user?.role === "ADMIN";
  const canManageOwnerSuppliers = Boolean(user && user.role === "MERCHANT" && (!user.staff || user.staff.role === "OWNER") && user.shop?.ownerSupplierManagementEnabled);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24 lg:pb-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">{t("suppliers.title", lang)}</h1>
          {canManageOwnerSuppliers && <button onClick={openAdd}
            className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t("suppliers.addBtn", lang)}</span>
          </button>}
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">{t("common.loading", lang)}</div>
        ) : suppliers.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">{t("suppliers.none", lang)}</p>
            <p className="text-gray-400 text-sm mt-1">{t("suppliers.addFirst", lang)}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suppliers.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        s.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" :
                        s.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {s.verificationStatus === "VERIFIED" ? <CheckCircle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                        {s.verificationStatus === "VERIFIED"
                          ? (lang === "sw" ? "Imethibitishwa" : "Verified")
                          : s.verificationStatus === "REJECTED"
                            ? (lang === "sw" ? "Haijapitishwa" : "Rejected")
                            : (lang === "sw" ? "Inahitaji ukaguzi" : "Needs review")}
                      </span>
                      {s.verifiedAt && <span className="text-xs text-gray-400">{new Date(s.verifiedAt).toLocaleDateString()}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                      <Phone className="w-3.5 h-3.5" />
                      <a href={`tel:${s.phone}`} className="hover:text-brand-600">{s.phone}</a>
                    </div>
                    {s.address && (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{s.address}</span>
                      </div>
                    )}
                    {s._count && (
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Package className="w-3 h-3" />
                          <span>{s._count.products} {t("suppliers.productsCount", lang)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Truck className="w-3 h-3" />
                          <span>{s._count.orders} {t("suppliers.ordersCount", lang)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Package className="w-3 h-3" />
                          <span>{s._count.catalogProducts || 0} catalog</span>
                        </div>
                      </div>
                    )}
                    {isAdmin && s.adminNotes && (
                      <p className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-600">{s.adminNotes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <a href={`https://wa.me/${s.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors min-h-0" title="WhatsApp">
                      <Phone className="w-4 h-4" />
                    </a>
                    {canManageOwnerSuppliers && s.canEdit && (
                      <button onClick={() => openEdit(s)}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors min-h-0"
                        aria-label={lang === "sw" ? "Hariri supplier" : "Edit supplier"}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {(isAdmin || canManageOwnerSuppliers) && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    {(["VERIFIED", "NEEDS_REVIEW", "REJECTED"] as const).map((status) => (
                      <button
                        key={status}
                        onClick={async () => {
                          await api.patch(`/suppliers/${s.id}`, { verificationStatus: status });
                          fetchSuppliers();
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          status === "VERIFIED" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                          status === "REJECTED" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                          "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        }`}
                      >
                        {status === "VERIFIED" ? "Verify" : status === "REJECTED" ? "Reject" : "Needs review"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-gray-900">
                {editSupplier ? t("suppliers.editTitle", lang) : t("suppliers.newTitle", lang)}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 min-h-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-2">{error}</p>}
              {FIELDS.map(({ labelKey, key, placeholder, type }) => (
                <div key={key}>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">{t(labelKey, lang)}</label>
                  <input type={type} value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm">
                  {t("common.cancel", lang)}
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 bg-brand-600 text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
                  {saving ? "..." : t("common.save", lang)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
