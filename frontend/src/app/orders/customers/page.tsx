"use client";
import { useState, useEffect, useCallback } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { Users, ChevronDown, ChevronUp, Phone, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { formatAppDate } from "@/lib/timezone";

interface CustomerOrderItem {
  quantity: number;
  unitPrice: number;
  pricingTier: string;
  product: { id: string; name: string; unit: string };
}

interface CustomerOrder {
  id: string;
  customerName: string;
  customerPhone: string;
  note?: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  items: CustomerOrderItem[];
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

const STATUS_FILTERS = [
  { v: "all", labelKey: "customerOrders.all" },
  { v: "PENDING", labelKey: "customerOrders.status.PENDING" },
  { v: "CONFIRMED", labelKey: "customerOrders.status.CONFIRMED" },
  { v: "OUT_FOR_DELIVERY", labelKey: "customerOrders.status.OUT_FOR_DELIVERY" },
  { v: "DELIVERED", labelKey: "customerOrders.status.DELIVERED" },
];

// Next allowed action for each status
const NEXT_ACTION: Record<string, { status: string; labelKey: string; color: string } | null> = {
  PENDING: { status: "CONFIRMED", labelKey: "customerOrders.confirm", color: "bg-blue-600 hover:bg-blue-700" },
  CONFIRMED: { status: "OUT_FOR_DELIVERY", labelKey: "customerOrders.dispatch", color: "bg-purple-600 hover:bg-purple-700" },
  OUT_FOR_DELIVERY: { status: "DELIVERED", labelKey: "customerOrders.deliver", color: "bg-green-600 hover:bg-green-700" },
  DELIVERED: null,
  CANCELLED: null,
};

export default function CustomerOrdersPage() {
  const lang = useLang();
  const { toast } = useToast();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    api
      .get<{ orders: CustomerOrder[] }>(`/customer-orders${params}`)
      .then((d) => setOrders(d.orders))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  async function updateStatus(orderId: string, newStatus: string) {
    if (newStatus === "CONFIRMED") {
      const ok = confirm(
        lang === "sw"
          ? "Thibitisha agizo? Hifadhi itapunguzwa kwa bidhaa zilizouliziwa."
          : "Confirm order? Stock will be reserved for the requested items."
      );
      if (!ok) return;
    }
    if (newStatus === "CANCELLED") {
      const ok = confirm(lang === "sw" ? "Futa agizo hili?" : "Cancel this order?");
      if (!ok) return;
    }
    setUpdating(orderId);
    try {
      await api.patch(`/customer-orders/${orderId}/status`, { status: newStatus });
      fetchOrders();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : t("common.error", lang), "error");
    } finally {
      setUpdating(null);
    }
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto pb-24 lg:pb-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-900">{t("customerOrders.title", lang)}</h1>
          <div className="text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {filtered.length}
          </div>
        </div>

        {/* Status filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {STATUS_FILTERS.map(({ v, labelKey }) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors min-h-0 ${
                statusFilter === v ? "bg-brand-600 text-white" : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {t(labelKey, lang)}
            </button>
          ))}
        </div>

        {/* Pending notice */}
        {statusFilter === "all" && orders.filter((o) => o.status === "PENDING").length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2.5 text-sm mb-4">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {orders.filter((o) => o.status === "PENDING").length}{" "}
              {lang === "sw" ? "maagizo mapya yanayosubiri uthibitisho" : "new orders awaiting confirmation"}
            </span>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">{t("common.loading", lang)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{t("customerOrders.none", lang)}</p>
            <p className="text-gray-400 text-xs mt-1">
              {lang === "sw"
                ? "Wateja wanaweza kuagiza kupitia katalogi yako ya umma."
                : "Customers can order via your public shop catalog."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const nextAction = NEXT_ACTION[order.status];
              return (
                <div key={order.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{order.customerName}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[order.status]}`}>
                          {t(`customerOrders.status.${order.status}`, lang)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <a href={`tel:${order.customerPhone}`} className="text-xs text-gray-500 hover:text-brand-600">
                          {order.customerPhone}
                        </a>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        #{order.id.slice(-8).toUpperCase()} •{" "}
                        {formatAppDate(order.createdAt, lang === "sw" ? "sw-TZ" : "en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-sm font-bold text-brand-700 mt-1">{formatTZS(order.totalAmount)}</p>
                    </div>
                    <button
                      onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                      className="text-gray-400 min-h-0"
                    >
                      {expanded === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {expanded === order.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="space-y-1.5 mb-3">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">{item.product.name}</span>
                            <span className="font-medium text-gray-800">
                              {item.quantity} {item.product.unit} — {formatTZS(item.unitPrice * item.quantity)}
                              {item.pricingTier === "WHOLESALE" && (
                                <span className="ml-1 text-xs text-blue-600">
                                  ({lang === "sw" ? "Jumla" : "Wholesale"})
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                      {order.note && (
                        <p className="text-xs text-gray-400 italic mb-3">"{order.note}"</p>
                      )}

                      {order.status === "PENDING" && (
                        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-3">
                          {t("customerOrders.stockWarning", lang)}
                        </p>
                      )}

                      <div className="flex gap-2 flex-wrap">
                        {nextAction && (
                          <button
                            onClick={() => updateStatus(order.id, nextAction.status)}
                            disabled={updating === order.id}
                            className={`${nextAction.color} disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors min-h-0`}
                          >
                            {updating === order.id ? "..." : t(nextAction.labelKey, lang)}
                          </button>
                        )}
                        {order.status !== "CANCELLED" && order.status !== "DELIVERED" && (
                          <button
                            onClick={() => updateStatus(order.id, "CANCELLED")}
                            disabled={updating === order.id}
                            className="bg-white border border-red-300 text-red-600 hover:bg-red-50 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors min-h-0"
                          >
                            {t("customerOrders.cancel", lang)}
                          </button>
                        )}
                        <a
                          href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-green-50 border border-green-300 text-green-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors min-h-0 inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
