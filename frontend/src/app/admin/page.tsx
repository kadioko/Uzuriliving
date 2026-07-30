"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { api, formatTZS } from "@/lib/api";
import {
  Users,
  Store,
  Package,
  ShoppingCart,
  Truck,
  ClipboardList,
  Search,
  Shield,
  AlertTriangle,
  Check,
  X,
  Clock,
  CheckCircle,
  MessageCircle,
  Trash2,
  ArrowRight,
  BadgeCheck,
  BellRing,
  CreditCard,
  RefreshCw,
} from "lucide-react";

interface AdminOverview {
  summary: {
    users: number;
    merchants: number;
    suppliers: number;
    admins: number;
    shops: number;
    products: number;
    sales: number;
    orders: number;
    debts: number;
    expenses: number;
    paidShops: number;
    auditLogs: number;
  };
  launchAnalytics?: {
    registrations: number;
    merchantShops: number;
    firstProductProgress: number;
    firstSaleProgress: number;
    firstDebtProgress: number;
    expenseTrackingProgress: number;
    paidShops: number;
    paymentsConfirmed7d: number;
  };
  onboardingAnalytics?: {
    totalShops: number;
    new: number;
    contacted: number;
    needsHelp: number;
    setupDone: number;
    activated: number;
    paid: number;
    converted: number;
    churnRisk: number;
    contactedShops: number;
    shopsWithNotes: number;
    recentlyContactedShops: number;
    followUpCoverage: number;
    noteCoverage: number;
  };
  marketingAnalytics?: {
    pageViews30d: number;
    whatsappClicks30d: number;
    registrationStarts30d: number;
    topSources: Array<{ source: string; registrations: number; activated: number }>;
  };
  assistantAnalytics?: {
    summary: {
      total: number;
      open: number;
      opened: number;
      completed: number;
      dismissed: number;
      completedRate: number;
      dismissedRate: number;
      openedRate: number;
    };
    topActions: Array<{ actionKey: string; count: number; title: string; href: string }>;
  };
  pushAnalytics?: {
    activeDevices: number;
    queued: number;
    retrying: number;
    sent30d: number;
    failed30d: number;
    shortcuts30d: Array<{ action: string; count: number }>;
  };
}

interface AdminUser {
  id: string;
  phone: string;
  name: string;
  role: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  language?: string;
  createdAt: string;
  shop?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
  isActive?: boolean;
  accountType?: "USER" | "STAFF";
}

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  method: string;
  path: string;
  ipAddress?: string;
  createdAt: string;
  user?: { id: string; name: string; phone: string; role: string } | null;
}

interface Report {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  adminNotes?: string;
  resolvedAt?: string;
  createdAt: string;
  user?: { id: string; name: string; phone: string; role: string; shop?: { id: string; name: string } | null } | null;
}

interface Subscription {
  id: string;
  name: string;
  plan: string;
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  validUntil?: string | null;
  isActive: boolean;
  computedStatus: string;
  daysLeft: number | null;
  reminderStage?: string | null;
  onboardingStatus: "NEW" | "CONTACTED" | "NEEDS_HELP" | "SETUP_DONE" | "ACTIVATED" | "PAID" | "CONVERTED" | "CHURN_RISK";
  lastContactedAt?: string | null;
  followUpNotes?: string | null;
  activation: {
    productCount: number;
    salesCount: number;
    orderCount: number;
    secondDayReturn: boolean;
    activated: boolean;
  };
  user?: { id: string; name: string; phone: string } | null;
  lastPayment?: { amount: number; method: string; reference?: string | null; paidAt: string } | null;
}

interface AdminMetric {
  label: string;
  value: number;
  tone: string;
}

interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  verificationStatus?: "UNVERIFIED" | "NEEDS_REVIEW" | "VERIFIED" | "REJECTED";
  verifiedAt?: string | null;
  adminNotes?: string | null;
  _count?: { products: number; orders: number };
}

interface SyncShopSummary {
  shop: { id: string; name: string; user?: { name: string; phone: string } | null };
  queued: number;
  synced: number;
  failed: number;
  removed: number;
  lastEventAt: string | null;
  recentFailures?: Array<{
    id: string;
    deviceId?: string | null;
    deviceLabel?: string | null;
    total?: number | null;
    message?: string | null;
    attempts: number;
    localId?: string | null;
    resolutionStatus?: "OPEN" | "CONTACTED" | "RESOLVED";
    resolutionNote?: string | null;
    contactedAt?: string | null;
    resolvedAt?: string | null;
    createdAt: string;
  }>;
}

interface AdminSyncEvent {
  id: string;
  shopId: string;
  deviceId?: string | null;
  deviceLabel?: string | null;
  status: "QUEUED" | "SYNCED" | "FAILED" | "REMOVED";
  total?: number | null;
  message?: string | null;
  attempts: number;
  localId?: string | null;
  resolutionStatus?: "OPEN" | "CONTACTED" | "RESOLVED";
  resolutionNote?: string | null;
  contactedAt?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  shop?: { id: string; name: string; user?: { name: string; phone: string } | null };
}

interface AdminSyncDeviceRow {
  shopId: string;
  deviceId?: string | null;
  deviceLabel?: string | null;
  status: "QUEUED" | "SYNCED" | "FAILED" | "REMOVED";
  _count: { id: number };
  _max: { createdAt: string | null };
}

interface BillingDraft {
  plan: "BASIC" | "PRO";
  months: string;
  amount: string;
  method: string;
  reference: string;
  note: string;
}

type Tab = "overview" | "users" | "audit" | "reset" | "reports" | "subscriptions" | "suppliers" | "sync";

async function optionalAdminLoad<T>(label: string, request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    console.warn(`Admin optional load failed: ${label}`, error);
    return fallback;
  }
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}

function MiniMetric({ label, value, tone }: AdminMetric) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  detail,
  value,
  tone,
  action,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  value: number;
  tone: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${tone}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/80">
            {icon}
          </div>
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="mt-1 text-xs leading-5 opacity-80">{detail}</p>
          </div>
        </div>
        <span className="text-2xl font-black">{value}</span>
      </div>
      <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold">
        {action}
        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [reportFilter, setReportFilter] = useState("OPEN");
  const [updatingReport, setUpdatingReport] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [syncSummaries, setSyncSummaries] = useState<SyncShopSummary[]>([]);
  const [syncEvents, setSyncEvents] = useState<AdminSyncEvent[]>([]);
  const [syncDevices, setSyncDevices] = useState<AdminSyncDeviceRow[]>([]);
  const [syncShopFilter, setSyncShopFilter] = useState("");
  const [syncDeviceFilter, setSyncDeviceFilter] = useState("");
  const [syncStatusFilter, setSyncStatusFilter] = useState("");
  const [loadingSyncEvents, setLoadingSyncEvents] = useState(false);
  const [subFilter, setSubFilter] = useState("ALL");
  const [updatingSub, setUpdatingSub] = useState<string | null>(null);
  const [updatingSupplier, setUpdatingSupplier] = useState<string | null>(null);
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>({});
  const [billingDrafts, setBillingDrafts] = useState<Record<string, BillingDraft>>({});
  const [supplierNotes, setSupplierNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  // User search / PIN reset
  const [searchPhone, setSearchPhone] = useState("");
  const [searchResult, setSearchResult] = useState<AdminUser | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [resetPin, setResetPin] = useState("");
  const [resetMsg, setResetMsg] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<{ user: { role: string } }>("/auth/me")
      .then(({ user }) => {
        if (user.role !== "ADMIN") throw new Error("Admin access required");
        return Promise.all([
      optionalAdminLoad<AdminOverview | null>("overview", api.get<AdminOverview>("/admin/overview"), null),
      optionalAdminLoad("users", api.get<{ users: AdminUser[] }>("/admin/users"), { users: [] }),
      optionalAdminLoad("audit logs", api.get<{ logs: AuditLog[] }>("/admin/audit-logs?limit=50"), { logs: [] }),
      optionalAdminLoad("reports", api.get<{ reports: Report[] }>("/reports/admin?limit=200"), { reports: [] }),
      optionalAdminLoad("subscriptions", api.get<{ shops: Subscription[] }>("/subscription/admin"), { shops: [] }),
      optionalAdminLoad("suppliers", api.get<{ suppliers: Supplier[] }>("/suppliers"), { suppliers: [] }),
      optionalAdminLoad("sync summary", api.get<{ shops: SyncShopSummary[] }>("/sync/admin/summary"), { shops: [] }),
      optionalAdminLoad("sync events", api.get<{ events: AdminSyncEvent[]; devices: AdminSyncDeviceRow[] }>("/sync/admin/events?limit=80"), { events: [], devices: [] }),
      optionalAdminLoad<NonNullable<AdminOverview["assistantAnalytics"]> | null>("assistant analytics", api.get<NonNullable<AdminOverview["assistantAnalytics"]>>("/assistant/admin/analytics"), null),
        ]);
      })
      .then(([ov, u, al, rp, sub, supplierData, syncData, syncEventsData, assistantAnalytics]) => {
        if (cancelled) return;
        setOverview(ov && assistantAnalytics ? { ...ov, assistantAnalytics } : ov);
        setUsers(u.users);
        setAuditLogs(al.logs);
        setReports(rp.reports);
        setSubscriptions(sub.shops);
        setSuppliers(supplierData.suppliers);
        setSyncSummaries(syncData.shops);
        setSyncEvents(syncEventsData.events);
        setSyncDevices(syncEventsData.devices);
        setFollowUpDrafts(Object.fromEntries(sub.shops.map((shop) => [shop.id, shop.followUpNotes || ""])));
        setSupplierNotes(Object.fromEntries(supplierData.suppliers.map((supplier) => [supplier.id, supplier.adminNotes || ""])));
      })
      .catch((error) => {
        if (!cancelled && error instanceof Error && !error.message.includes("Session expired")) console.error(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError("");
    setSearchResult(null);
    setResetMsg("");
    setResetError("");
    if (!searchPhone.trim()) return;
    setSearching(true);
    try {
      const data = await api.get<{ user: AdminUser }>(`/admin/users/search?phone=${encodeURIComponent(searchPhone.trim())}`);
      setSearchResult({ ...data.user, accountType: "USER" });
    } catch (err: unknown) {
      try {
        const data = await api.get<{ staff: AdminUser }>(`/admin/staff/search?phone=${encodeURIComponent(searchPhone.trim())}`);
        setSearchResult({ ...data.staff, accountType: "STAFF" });
      } catch {
        setSearchError(err instanceof Error ? err.message : "User or staff member not found");
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleResetPin(e: React.FormEvent) {
    e.preventDefault();
    if (!searchResult || !resetPin) return;
    if (!/^\d{4,8}$/.test(resetPin)) {
      setResetError("PIN must be 4-8 digits");
      return;
    }
    setResetting(true);
    setResetError("");
    setResetMsg("");
    try {
      const endpoint = searchResult.accountType === "STAFF"
        ? `/admin/staff/${searchResult.id}/reset-pin`
        : `/admin/users/${searchResult.id}/reset-pin`;
      await api.post(endpoint, { newPin: resetPin });
      setResetMsg(`PIN for ${searchResult.name} (${searchResult.phone}) has been reset.`);
      setResetPin("");
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  }

  async function handleUpdateReport(reportId: string, status: string, adminNotes?: string) {
    setUpdatingReport(reportId);
    try {
      const data = await api.patch<{ report: Report }>(`/reports/admin/${reportId}`, { status, adminNotes });
      setReports((prev) => prev.map((r) => (r.id === reportId ? data.report : r)));
    } catch (err: unknown) {
      console.error("Failed to update report:", err);
    } finally {
      setUpdatingReport(null);
    }
  }

  async function handleExtendTrial(shopId: string, days: number) {
    setUpdatingSub(shopId);
    try {
      await api.post(`/subscription/admin/${shopId}/extend-trial`, { days });
      await refreshSubscriptions();
    } catch (err) {
      console.error("Failed to extend trial:", err);
    } finally {
      setUpdatingSub(null);
    }
  }

  async function handleExtendSubscription(shop: Subscription, days: number) {
    setUpdatingSub(shop.id);
    try {
      await api.post(`/subscription/admin/${shop.id}/extend-subscription`, {
        days,
        plan: shop.plan === "PRO" ? "PRO" : "BASIC",
      });
      await refreshSubscriptions();
    } catch (err) {
      console.error("Failed to extend subscription:", err);
    } finally {
      setUpdatingSub(null);
    }
  }

  async function handleRemoveSubscription(shop: Subscription) {
    const confirmed = window.confirm(
      `Remove the paid subscription for ${shop.name}?\n\nThis will clear the active paid plan and paid valid-until date. The shop, customer account, products, sales, and payment history will stay in Uzuri Living.\n\nUse this only for reversals, mistakes, or support cases.`
    );
    if (!confirmed) return;

    setUpdatingSub(shop.id);
    try {
      await api.delete(`/subscription/admin/${shop.id}`);
      await refreshSubscriptions();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to remove subscription");
    } finally {
      setUpdatingSub(null);
    }
  }

  async function refreshSubscriptions() {
    const data = await api.get<{ shops: Subscription[] }>("/subscription/admin");
    setSubscriptions(data.shops);
    setFollowUpDrafts(Object.fromEntries(data.shops.map((shop) => [shop.id, shop.followUpNotes || ""])));
  }

  async function refreshSuppliers() {
    const data = await api.get<{ suppliers: Supplier[] }>("/suppliers");
    setSuppliers(data.suppliers);
    setSupplierNotes(Object.fromEntries(data.suppliers.map((supplier) => [supplier.id, supplier.adminNotes || ""])));
  }

  async function refreshSyncEvents(patch?: { shopId?: string; deviceId?: string; status?: string }) {
    const nextShopId = patch?.shopId ?? syncShopFilter;
    const nextDeviceId = patch?.deviceId ?? syncDeviceFilter;
    const nextStatus = patch?.status ?? syncStatusFilter;
    setLoadingSyncEvents(true);
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (nextShopId) params.set("shopId", nextShopId);
      if (nextDeviceId) params.set("deviceId", nextDeviceId);
      if (nextStatus) params.set("status", nextStatus);
      const data = await api.get<{ events: AdminSyncEvent[]; devices: AdminSyncDeviceRow[] }>(`/sync/admin/events?${params.toString()}`);
      setSyncEvents(data.events);
      setSyncDevices(data.devices);
    } finally {
      setLoadingSyncEvents(false);
    }
  }

  function openSyncHistory(shopId?: string, deviceId?: string) {
    const nextShop = shopId || "";
    const nextDevice = deviceId || "";
    setSyncShopFilter(nextShop);
    setSyncDeviceFilter(nextDevice);
    setSyncStatusFilter("");
    setTab("sync");
    refreshSyncEvents({ shopId: nextShop, deviceId: nextDevice, status: "" }).catch(console.error);
  }

  function displayDeviceLabel(deviceId?: string | null, label?: string | null, ownerName?: string | null) {
    if (label) return label;
    if (ownerName) return `${ownerName.split(" ")[0]} phone`;
    if (!deviceId) return "Unknown device";
    return `Device ${deviceId.slice(0, 6)}`;
  }

  async function handleUpdateSyncEvent(event: AdminSyncEvent, patch: { resolutionStatus?: "OPEN" | "CONTACTED" | "RESOLVED"; resolutionNote?: string }) {
    const data = await api.patch<{ event: AdminSyncEvent }>(`/sync/admin/events/${event.id}`, patch);
    setSyncEvents((prev) => prev.map((item) => (item.id === event.id ? data.event : item)));
    const summary = await api.get<{ shops: SyncShopSummary[] }>("/sync/admin/summary");
    setSyncSummaries(summary.shops);
  }

  async function handleSaveDeviceLabel(device: AdminSyncDeviceRow, label: string) {
    if (!device.deviceId || !label.trim()) return;
    await api.patch("/sync/admin/device-label", {
      shopId: device.shopId,
      deviceId: device.deviceId,
      deviceLabel: label.trim(),
    });
    await refreshSyncEvents();
    const summary = await api.get<{ shops: SyncShopSummary[] }>("/sync/admin/summary");
    setSyncSummaries(summary.shops);
  }

  function defaultBillingDraft(plan: "BASIC" | "PRO" = "BASIC"): BillingDraft {
    return {
      plan,
      months: "1",
      amount: plan === "PRO" ? "35000" : "15000",
      method: "MPESA",
      reference: "",
      note: "",
    };
  }

  function billingDraftFor(shop: Subscription) {
    return billingDrafts[shop.id] || defaultBillingDraft(shop.plan === "PRO" ? "PRO" : "BASIC");
  }

  function formatDate(value?: string | null) {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  function validityLabel(shop: Subscription) {
    if (!shop.isActive) return "Suspended";
    if (shop.plan === "LIFETIME") return "Lifetime access";
    if (shop.computedStatus === "trial") return `Trial until ${formatDate(shop.validUntil || shop.trialEndsAt)}`;
    if (shop.computedStatus === "active") return `Active until ${formatDate(shop.validUntil || shop.subscriptionEndsAt)}`;
    return shop.subscriptionEndsAt ? `Expired ${formatDate(shop.subscriptionEndsAt)}` : "No paid subscription";
  }

  function updateBillingDraft(shop: Subscription, patch: Partial<BillingDraft>) {
    setBillingDrafts((prev) => {
      const current = prev[shop.id] || defaultBillingDraft(shop.plan === "PRO" ? "PRO" : "BASIC");
      const next = { ...current, ...patch };
      if (patch.plan && !patch.amount) next.amount = patch.plan === "PRO" ? "35000" : "15000";
      return { ...prev, [shop.id]: next };
    });
  }

  async function handleRecordPayment(shop: Subscription, plan?: "BASIC" | "PRO", customDraft?: BillingDraft) {
    const draft = customDraft || (plan ? defaultBillingDraft(plan) : billingDraftFor(shop));
    const selectedPlan = plan || draft.plan;
    let reference = draft.reference.trim();
    if (!reference) {
      reference = window.prompt("Enter the M-Pesa, Mix by Yas, or transfer reference before confirming payment:")?.trim() || "";
    }
    if (!reference) return;
    setUpdatingSub(shop.id);
    try {
      await api.post(`/subscription/admin/${shop.id}/payments`, {
        plan: selectedPlan,
        months: Number(draft.months) || 1,
        amount: Number(draft.amount) || (selectedPlan === "PRO" ? 35000 : 15000),
        method: draft.method || "MPESA",
        reference,
        note: draft.note.trim() || "Marked paid by admin",
      });
      await refreshSubscriptions();
      setBillingDrafts((prev) => ({ ...prev, [shop.id]: defaultBillingDraft(selectedPlan) }));
    } catch (err) {
      console.error("Failed to record subscription payment:", err);
    } finally {
      setUpdatingSub(null);
    }
  }

  async function handleVerifyBillingReport(report: Report, plan: "BASIC" | "PRO") {
    const shopId = report.user?.shop?.id;
    if (!shopId) return;
    setUpdatingReport(report.id);
    try {
      const referenceMatch = report.description.match(/Reference:\s*([^\n]+)/i);
      await api.post(`/subscription/admin/${shopId}/payments`, {
        plan,
        months: 1,
        amount: plan === "PRO" ? 35000 : 15000,
        method: "MPESA",
        reference: referenceMatch?.[1]?.trim() || `REPORT-${report.id.slice(-6)}`,
        note: `Verified from billing report ${report.id}`,
        sourceReportId: report.id,
      });
      const data = await api.patch<{ report: Report }>(`/reports/admin/${report.id}`, {
        status: "RESOLVED",
        adminNotes: `Payment verified. Activated ${plan}.`,
      });
      setReports((prev) => prev.map((r) => (r.id === report.id ? data.report : r)));
      await refreshSubscriptions();
    } catch (err) {
      console.error("Failed to verify billing report:", err);
    } finally {
      setUpdatingReport(null);
    }
  }

  async function handleUpdateSupplier(supplier: Supplier, patch: Partial<Pick<Supplier, "verificationStatus" | "adminNotes">>) {
    setUpdatingSupplier(supplier.id);
    try {
      await api.patch(`/suppliers/${supplier.id}`, patch);
      await refreshSuppliers();
    } catch (err) {
      console.error("Failed to update supplier:", err);
    } finally {
      setUpdatingSupplier(null);
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    const relationship = user.shop?.name
      ? `\n\nThis will also remove shop data for ${user.shop.name}.`
      : user.supplier?.name
        ? `\n\nThis removes the supplier login for ${user.supplier.name}. The supplier profile stays available for product/order history.`
        : "";
    const confirmed = window.confirm(`Remove ${user.name} (${user.phone}) from Uzuri Living?${relationship}\n\nThis action cannot be undone.`);
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${user.id}`);
      setUsers((prev) => prev.filter((item) => item.id !== user.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to remove user");
    }
  }

  async function handleApproval(user: AdminUser, approvalStatus: "APPROVED" | "REJECTED") {
    setUpdatingUser(user.id);
    try {
      const data = await api.patch<{ user: AdminUser }>(`/admin/users/${user.id}/approval`, { approvalStatus });
      setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, ...data.user } : item));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update account approval");
    } finally {
      setUpdatingUser(null);
    }
  }

  async function handleDeleteSupplier(supplier: Supplier) {
    const orderCount = supplier._count?.orders || 0;
    const productCount = supplier._count?.products || 0;
    if (orderCount > 0) {
      window.alert("This supplier has order history, so Uzuri Living will not delete it. Reject the supplier instead to keep order records safe.");
      return;
    }
    const confirmed = window.confirm(
      `Remove supplier ${supplier.name} (${supplier.phone})?\n\n${productCount} product(s) will be detached from this supplier. Any linked supplier login will also be removed.\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    setUpdatingSupplier(supplier.id);
    try {
      await api.delete(`/suppliers/${supplier.id}`);
      await refreshSuppliers();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to remove supplier");
    } finally {
      setUpdatingSupplier(null);
    }
  }

  async function handleToggleShopActive(shop: Subscription) {
    setUpdatingSub(shop.id);
    try {
      await api.patch(`/subscription/admin/${shop.id}`, { isActive: !shop.isActive });
      await refreshSubscriptions();
    } catch (err) {
      console.error("Failed to update shop status:", err);
    } finally {
      setUpdatingSub(null);
    }
  }

  async function handleSetLifetime(shop: Subscription) {
    const confirmed = window.confirm(`Give ${shop.name} a Lifetime subscription?\n\nThis keeps the shop active permanently and does not require an expiry date.`);
    if (!confirmed) return;
    setUpdatingSub(shop.id);
    try {
      await api.patch(`/subscription/admin/${shop.id}`, { plan: "LIFETIME", subscriptionEndsAt: null, isActive: true });
      await refreshSubscriptions();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to assign Lifetime subscription");
    } finally {
      setUpdatingSub(null);
    }
  }

  async function handleUpdateFollowUp(
    shop: Subscription,
    patch: Partial<Pick<Subscription, "onboardingStatus" | "lastContactedAt" | "followUpNotes">>
  ) {
    setUpdatingSub(shop.id);
    try {
      await api.patch(`/subscription/admin/${shop.id}`, patch);
      await refreshSubscriptions();
    } catch (err) {
      console.error("Failed to update follow-up:", err);
    } finally {
      setUpdatingSub(null);
    }
  }

  function whatsappLeadHref(shop: Subscription) {
    const phone = shop.user?.phone?.replace(/[^\d]/g, "") || "";
    const text = encodeURIComponent(`Habari ${shop.user?.name || ""}, hapa ni Uzuri Living. Tunaweza kukusaidia kumalizia setup ya ${shop.name}: bidhaa 10, mauzo 10, na kurudi siku ya pili.`);
    return `https://wa.me/${phone}?text=${text}`;
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "reset", label: "PIN Reset" },
    { id: "audit", label: "Audit Log" },
    { id: "reports", label: "Reports" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "suppliers", label: "Suppliers" },
    { id: "sync", label: "Sync History" },
  ];
  const activeShops = subscriptions.filter((shop) => shop.computedStatus === "active").length;
  const trialShops = subscriptions.filter((shop) => shop.computedStatus === "trial").length;
  const unpaidShops = subscriptions.filter((shop) => shop.computedStatus === "expired").length;
  const suspendedShops = subscriptions.filter((shop) => shop.computedStatus === "suspended").length;
  const expiringTrials = subscriptions.filter((shop) => shop.computedStatus === "trial" && shop.daysLeft !== null && shop.daysLeft <= 3).length;
  const activatedTrials = subscriptions.filter((shop) => shop.activation?.activated).length;
  const supportIssues = reports.filter((report) => report.status === "OPEN" || report.status === "IN_PROGRESS").length;
  const billingIssues = reports.filter((report) => report.type === "BILLING" && report.status !== "RESOLVED").length;
  const suspiciousAuditLogs = auditLogs.filter((log) =>
    log.action.toLowerCase().includes("failed") ||
    log.action.toLowerCase().includes("error") ||
    log.path.includes("/auth/login")
  );
  const suspiciousErrors = suspiciousAuditLogs.length;
  const openReports = reports.filter((report) => report.status === "OPEN" || report.status === "IN_PROGRESS");
  const urgentReports = openReports.filter((report) => report.priority === "HIGH" || report.priority === "URGENT");
  const failedLogins = auditLogs.filter((log) => log.path.includes("/auth/login") && log.action.toLowerCase().includes("failed")).length;
  const failedSyncShops = syncSummaries.filter((shop) => shop.failed > 0).length;
  const failedSyncEvents = syncSummaries.reduce((sum, shop) => sum + shop.failed, 0);
  const stalledTrials = subscriptions.filter((shop) => !shop.activation?.activated && shop.computedStatus === "trial").length;
  const suppliersNeedingReview = suppliers.filter((supplier) => supplier.verificationStatus !== "VERIFIED").length;
  const verifiedSuppliers = suppliers.filter((supplier) => supplier.verificationStatus === "VERIFIED").length;
  const shopsNeedingFollowUp = subscriptions
    .filter((shop) =>
      shop.computedStatus === "expired" ||
      shop.computedStatus === "suspended" ||
      shop.onboardingStatus === "CHURN_RISK" ||
      shop.onboardingStatus === "NEEDS_HELP" ||
      (shop.computedStatus === "trial" && shop.daysLeft !== null && shop.daysLeft <= 3) ||
      (!shop.activation?.activated && shop.computedStatus === "trial")
    )
    .sort((a, b) => supportPriority(b) - supportPriority(a))
    .slice(0, 5);
  const paymentReviewQueue = reports
    .filter((report) => report.type === "BILLING" && report.status !== "RESOLVED" && report.status !== "REJECTED")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const latestAdminAction = auditLogs.find((log) => log.user?.role === "ADMIN") || auditLogs[0];
  const recentShopNotes = subscriptions
    .filter((shop) => shop.followUpNotes || shop.lastContactedAt)
    .sort((a, b) => new Date(b.lastContactedAt || b.validUntil || b.trialEndsAt || 0).getTime() - new Date(a.lastContactedAt || a.validUntil || a.trialEndsAt || 0).getTime())
    .slice(0, 4);

  function supportPriority(shop: Subscription) {
    if (shop.computedStatus === "suspended") return 100;
    if (shop.computedStatus === "expired") return 90;
    if (shop.onboardingStatus === "NEEDS_HELP") return 85;
    if (shop.onboardingStatus === "CHURN_RISK") return 80;
    if (shop.computedStatus === "trial" && shop.daysLeft !== null && shop.daysLeft <= 1) return 70;
    if (shop.computedStatus === "trial" && shop.daysLeft !== null && shop.daysLeft <= 3) return 60;
    if (!shop.activation?.activated) return 40;
    return 0;
  }

  function supportReason(shop: Subscription) {
    if (shop.computedStatus === "suspended") return "Suspended shop";
    if (shop.computedStatus === "expired") return "Unpaid or expired";
    if (shop.onboardingStatus === "NEEDS_HELP") return "Needs help";
    if (shop.onboardingStatus === "CHURN_RISK") return "Churn risk";
    if (shop.computedStatus === "trial" && shop.daysLeft !== null && shop.daysLeft <= 3) return `Trial ends in ${shop.daysLeft}d`;
    if (!shop.activation?.activated) return "Needs activation help";
    return "Follow up";
  }
  const filteredSubscriptions = subFilter === "ALL"
    ? subscriptions
    : subscriptions.filter((shop) => shop.computedStatus === subFilter);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto pb-24 lg:pb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>

        {/* Tab nav */}
        <div className="mb-6 flex w-full gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 sm:w-fit">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors min-h-0 ${
                tab === t.id ? "bg-white text-brand-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" && overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Users" value={overview.summary.users} icon={<Users className="w-4 h-4 text-blue-600" />} color="bg-blue-50" />
              <StatCard label="Merchants" value={overview.summary.merchants} icon={<Store className="w-4 h-4 text-brand-600" />} color="bg-brand-50" />
              <StatCard label="Suppliers" value={overview.summary.suppliers} icon={<Truck className="w-4 h-4 text-orange-600" />} color="bg-orange-50" />
              <StatCard label="Shops" value={overview.summary.shops} icon={<Store className="w-4 h-4 text-purple-600" />} color="bg-purple-50" />
              <StatCard label="Active Products" value={overview.summary.products} icon={<Package className="w-4 h-4 text-green-600" />} color="bg-green-50" />
              <StatCard label="Total Sales" value={overview.summary.sales} icon={<ShoppingCart className="w-4 h-4 text-sky-600" />} color="bg-sky-50" />
              <StatCard label="Supplier Orders" value={overview.summary.orders} icon={<ClipboardList className="w-4 h-4 text-indigo-600" />} color="bg-indigo-50" />
              <StatCard label="Audit Events" value={overview.summary.auditLogs} icon={<Shield className="w-4 h-4 text-gray-600" />} color="bg-gray-100" />
            </div>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <BellRing className="h-4 w-4 text-brand-700" />
                <h2 className="text-sm font-semibold text-gray-900">Push and Android activity</h2>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                <MiniMetric label="Active devices" value={overview.pushAnalytics?.activeDevices || 0} tone="border-brand-200 bg-brand-50 text-brand-800" />
                <MiniMetric label="Sent (30d)" value={overview.pushAnalytics?.sent30d || 0} tone="border-green-200 bg-green-50 text-green-800" />
                <MiniMetric label="Retrying" value={overview.pushAnalytics?.retrying || 0} tone="border-amber-200 bg-amber-50 text-amber-800" />
                <MiniMetric label="Failed (30d)" value={overview.pushAnalytics?.failed30d || 0} tone="border-red-200 bg-red-50 text-red-800" />
                <MiniMetric label="Queued" value={overview.pushAnalytics?.queued || 0} tone="border-gray-200 bg-gray-50 text-gray-800" />
              </div>
              {(overview.pushAnalytics?.shortcuts30d || []).length > 0 && <p className="mt-3 text-xs text-gray-600">Android shortcuts (30 days): {overview.pushAnalytics?.shortcuts30d.map((item) => `${item.action} ${item.count}`).join(" / ")}</p>}
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">Business Operations</h2>
                <span className="text-xs text-gray-400">Live support view</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MiniMetric label="Active shops" value={activeShops} tone="border-green-200 bg-green-50 text-green-800" />
                <MiniMetric label="Trials" value={trialShops} tone="border-yellow-200 bg-yellow-50 text-yellow-800" />
                <MiniMetric label="Trials <=3d" value={expiringTrials} tone="border-orange-200 bg-orange-50 text-orange-800" />
                <MiniMetric label="Activated" value={activatedTrials} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
                <MiniMetric label="Unpaid" value={unpaidShops} tone="border-red-200 bg-red-50 text-red-800" />
                <MiniMetric label="Suspended" value={suspendedShops} tone="border-gray-200 bg-gray-50 text-gray-800" />
                <MiniMetric label="Support issues" value={supportIssues} tone="border-blue-200 bg-blue-50 text-blue-800" />
                <MiniMetric label="Billing requests" value={billingIssues} tone="border-purple-200 bg-purple-50 text-purple-800" />
                <MiniMetric label="Suspicious errors" value={suspiciousErrors} tone="border-amber-200 bg-amber-50 text-amber-800" />
                <MiniMetric label="Failed logins" value={failedLogins} tone="border-red-200 bg-red-50 text-red-800" />
                <MiniMetric label="Failed sync shops" value={failedSyncShops} tone="border-red-200 bg-red-50 text-red-800" />
                <MiniMetric label="Suppliers review" value={suppliersNeedingReview} tone="border-orange-200 bg-orange-50 text-orange-800" />
                <MiniMetric label="Verified suppliers" value={verifiedSuppliers} tone="border-green-200 bg-green-50 text-green-800" />
              </div>
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Shops Needing Action Today</h2>
                  <p className="text-xs text-gray-500">A quick support command center for launch operations.</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                  {billingIssues + unpaidShops + suspendedShops + stalledTrials + failedSyncShops + suppliersNeedingReview + suspiciousErrors} signals
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <ActionCard
                  icon={<CreditCard className="h-5 w-5 text-purple-700" />}
                  title="Payment follow-up"
                  detail="Billing requests, unpaid shops, and suspended accounts that need confirmation or renewal."
                  value={billingIssues + unpaidShops + suspendedShops}
                  tone="border-purple-200 bg-purple-50 text-purple-900"
                  action="Open subscriptions"
                  onClick={() => setTab("subscriptions")}
                />
                <ActionCard
                  icon={<BellRing className="h-5 w-5 text-orange-700" />}
                  title="Trial activation"
                  detail="Trials ending soon or shops that still need product/sale setup help."
                  value={expiringTrials + stalledTrials}
                  tone="border-orange-200 bg-orange-50 text-orange-900"
                  action="Contact shops"
                  onClick={() => setTab("subscriptions")}
                />
                <ActionCard
                  icon={<BadgeCheck className="h-5 w-5 text-green-700" />}
                  title="Supplier verification"
                  detail="Suppliers waiting for admin review before they become trusted in the ecosystem."
                  value={suppliersNeedingReview}
                  tone="border-green-200 bg-green-50 text-green-900"
                  action="Verify suppliers"
                  onClick={() => setTab("suppliers")}
                />
                <ActionCard
                  icon={<RefreshCw className="h-5 w-5 text-red-700" />}
                  title="Offline sync watch"
                  detail="Shops with failed browser sync events that may need support before data feels stale."
                  value={failedSyncShops}
                  tone="border-red-200 bg-red-50 text-red-900"
                  action="Review sync issues"
                  onClick={() => setTab("overview")}
                />
                <ActionCard
                  icon={<AlertTriangle className="h-5 w-5 text-amber-700" />}
                  title="Suspicious errors"
                  detail="Recent failed login or error-looking audit events from the admin audit sample."
                  value={suspiciousErrors}
                  tone="border-amber-200 bg-amber-50 text-amber-900"
                  action="Open audit logs"
                  onClick={() => setTab("audit")}
                />
                <ActionCard
                  icon={<ClipboardList className="h-5 w-5 text-blue-700" />}
                  title="Open support reports"
                  detail="Merchant messages, billing reports, and issues that still need an admin decision."
                  value={openReports.length}
                  tone="border-blue-200 bg-blue-50 text-blue-900"
                  action="Open reports"
                  onClick={() => setTab("reports")}
                />
              </div>
            </section>
            <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-xl border border-purple-200 bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Payment Review Queue</h2>
                    <p className="text-xs text-gray-500">Billing reports waiting for admin confirmation and plan activation.</p>
                  </div>
                  <button onClick={() => setTab("reports")} className="rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-200">
                    Open reports
                  </button>
                </div>
                {paymentReviewQueue.length === 0 ? (
                  <div className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">No payment reports need review right now.</div>
                ) : (
                  <div className="space-y-2">
                    {paymentReviewQueue.map((report) => (
                      <div key={report.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-950">{report.user?.shop?.name || report.title}</p>
                            <p className="text-xs text-gray-500">{report.user?.name || "Merchant"} - {report.user?.phone || "No phone"}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-600">{report.description}</p>
                          </div>
                          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-purple-700">{report.status}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <button
                            onClick={() => handleVerifyBillingReport(report, "BASIC")}
                            disabled={updatingReport === report.id || !report.user?.shop?.id}
                            className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                          >
                            Confirm Basic
                          </button>
                          <button
                            onClick={() => handleVerifyBillingReport(report, "PRO")}
                            disabled={updatingReport === report.id || !report.user?.shop?.id}
                            className="rounded bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-50"
                          >
                            Confirm Pro
                          </button>
                          <button
                            onClick={() => handleUpdateReport(report.id, "IN_PROGRESS")}
                            disabled={updatingReport === report.id}
                            className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                          >
                            Mark contacted
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-gray-900">Last Admin Action</h2>
                  {latestAdminAction ? (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs">
                      <p className="font-mono font-semibold text-gray-900">{latestAdminAction.action}</p>
                      <p className="mt-1 font-mono text-gray-500">{latestAdminAction.method} {latestAdminAction.path}</p>
                      <p className="mt-1 text-gray-500">
                        {latestAdminAction.user ? `${latestAdminAction.user.name} (${latestAdminAction.user.phone})` : "System"} - {new Date(latestAdminAction.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">No admin actions recorded yet.</p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <h2 className="text-sm font-semibold text-gray-900">Notes History</h2>
                  {recentShopNotes.length === 0 ? (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">No saved shop notes yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {recentShopNotes.map((shop) => (
                        <div key={shop.id} className="rounded-lg bg-gray-50 p-3 text-xs">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-gray-950">{shop.name}</p>
                            <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-gray-600">{shop.onboardingStatus}</span>
                          </div>
                          <p className="mt-1 text-gray-600">{shop.followUpNotes || "Contact logged without notes."}</p>
                          <p className="mt-1 text-gray-400">Last contact: {shop.lastContactedAt ? new Date(shop.lastContactedAt).toLocaleDateString() : "not set"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Launch Analytics</h2>
                  <p className="text-xs text-gray-500">Core activation signals to watch while Uzuri Living is live.</p>
                </div>
                <span className="text-xs text-gray-400">Derived from app data</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MiniMetric label="Registrations" value={overview.launchAnalytics?.registrations || 0} tone="border-blue-200 bg-blue-50 text-blue-800" />
                <MiniMetric label="Shops created" value={overview.launchAnalytics?.merchantShops || 0} tone="border-brand-200 bg-brand-50 text-brand-800" />
                <MiniMetric label="Products added" value={overview.launchAnalytics?.firstProductProgress || 0} tone="border-green-200 bg-green-50 text-green-800" />
                <MiniMetric label="Sales recorded" value={overview.launchAnalytics?.firstSaleProgress || 0} tone="border-sky-200 bg-sky-50 text-sky-800" />
                <MiniMetric label="Debts tracked" value={overview.launchAnalytics?.firstDebtProgress || 0} tone="border-amber-200 bg-amber-50 text-amber-800" />
                <MiniMetric label="Expenses tracked" value={overview.launchAnalytics?.expenseTrackingProgress || 0} tone="border-orange-200 bg-orange-50 text-orange-800" />
                <MiniMetric label="Paid shops" value={overview.launchAnalytics?.paidShops || 0} tone="border-purple-200 bg-purple-50 text-purple-800" />
                <MiniMetric label="Payments 7d" value={overview.launchAnalytics?.paymentsConfirmed7d || 0} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
              </div>
            </section>
            <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-indigo-950">Campaign Funnel</h2>
                  <p className="text-xs text-indigo-800">Anonymous web interest, then registrations and activation by saved source.</p>
                </div>
                <span className="text-xs text-indigo-700">Last 30 days</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label="Page views" value={overview.marketingAnalytics?.pageViews30d || 0} tone="border-indigo-200 bg-white text-indigo-800" />
                <MiniMetric label="WhatsApp clicks" value={overview.marketingAnalytics?.whatsappClicks30d || 0} tone="border-green-200 bg-white text-green-800" />
                <MiniMetric label="Registration starts" value={overview.marketingAnalytics?.registrationStarts30d || 0} tone="border-blue-200 bg-white text-blue-800" />
              </div>
              {(overview.marketingAnalytics?.topSources || []).length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.marketingAnalytics?.topSources.map((source) => (
                    <div key={source.source} className="rounded-lg border border-indigo-100 bg-white p-3 text-xs text-gray-700">
                      <p className="font-bold text-gray-950">{source.source}</p>
                      <p className="mt-1">{source.registrations} registrations Â· {source.activated} activated</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Onboarding Follow-up Analytics</h2>
                  <p className="text-xs text-gray-500">Shows whether admin follow-up is moving shops toward setup, payment, and conversion.</p>
                </div>
                <button onClick={() => setTab("subscriptions")} className="rounded-lg bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-200">
                  Manage follow-up
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                <MiniMetric label="New shops" value={overview.onboardingAnalytics?.new || 0} tone="border-gray-200 bg-gray-50 text-gray-800" />
                <MiniMetric label="Contacted" value={overview.onboardingAnalytics?.contacted || 0} tone="border-blue-200 bg-blue-50 text-blue-800" />
                <MiniMetric label="Needs help" value={overview.onboardingAnalytics?.needsHelp || 0} tone="border-amber-200 bg-amber-50 text-amber-800" />
                <MiniMetric label="Setup done" value={overview.onboardingAnalytics?.setupDone || 0} tone="border-green-200 bg-green-50 text-green-800" />
                <MiniMetric label="Activated" value={overview.onboardingAnalytics?.activated || 0} tone="border-emerald-200 bg-emerald-50 text-emerald-800" />
                <MiniMetric label="Paid" value={overview.onboardingAnalytics?.paid || 0} tone="border-purple-200 bg-purple-50 text-purple-800" />
                <MiniMetric label="Converted" value={overview.onboardingAnalytics?.converted || 0} tone="border-brand-200 bg-brand-50 text-brand-800" />
                <MiniMetric label="Churn risk" value={overview.onboardingAnalytics?.churnRisk || 0} tone="border-red-200 bg-red-50 text-red-800" />
                <MiniMetric label="Contact 7d" value={overview.onboardingAnalytics?.recentlyContactedShops || 0} tone="border-sky-200 bg-sky-50 text-sky-800" />
                <MiniMetric label="Notes saved" value={overview.onboardingAnalytics?.shopsWithNotes || 0} tone="border-indigo-200 bg-indigo-50 text-indigo-800" />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">Follow-up coverage</p>
                  <p className="mt-1">{overview.onboardingAnalytics?.followUpCoverage || 0}% of shops have been contacted at least once.</p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                  <p className="font-semibold text-gray-900">Notes coverage</p>
                  <p className="mt-1">{overview.onboardingAnalytics?.noteCoverage || 0}% of shops have saved support notes.</p>
                </div>
              </div>
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Assistant Action Analytics</h2>
                  <p className="text-xs text-gray-500">Tracks whether AI recommendations are opened, completed, or dismissed.</p>
                </div>
                <span className="text-xs text-gray-400">Last 30 days</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MiniMetric label="Tracked actions" value={overview.assistantAnalytics?.summary.total || 0} tone="border-brand-200 bg-brand-50 text-brand-800" />
                <MiniMetric label="Opened rate" value={overview.assistantAnalytics?.summary.openedRate || 0} tone="border-blue-200 bg-blue-50 text-blue-800" />
                <MiniMetric label="Completed rate" value={overview.assistantAnalytics?.summary.completedRate || 0} tone="border-green-200 bg-green-50 text-green-800" />
                <MiniMetric label="Dismissed rate" value={overview.assistantAnalytics?.summary.dismissedRate || 0} tone="border-gray-200 bg-gray-50 text-gray-800" />
              </div>
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top action types</p>
                {(overview.assistantAnalytics?.topActions || []).length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No assistant actions tracked yet.</p>
                ) : (
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {overview.assistantAnalytics?.topActions.slice(0, 6).map((action) => (
                      <div key={action.actionKey} className="rounded-lg bg-white px-3 py-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-gray-900">{action.title}</p>
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 font-bold text-brand-700">{action.count}</span>
                        </div>
                        <p className="mt-1 font-mono text-[11px] text-gray-400">{action.actionKey}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Support Queue</h2>
                  <p className="text-xs text-gray-500">Prioritized shops and reports that need admin attention today.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setTab("subscriptions")} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                    Open subscriptions
                  </button>
                  <button onClick={() => setTab("reports")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Open reports
                  </button>
                  <button onClick={() => setTab("suppliers")} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                    Verify suppliers
                  </button>
                </div>
              </div>
              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next shops to contact</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-500">{shopsNeedingFollowUp.length}</span>
                  </div>
                  {shopsNeedingFollowUp.length === 0 ? (
                    <p className="rounded-lg bg-white px-3 py-4 text-sm text-gray-500">No urgent shop follow-ups right now.</p>
                  ) : (
                    <div className="space-y-2">
                      {shopsNeedingFollowUp.map((shop) => (
                        <div key={shop.id} className="rounded-lg bg-white p-3 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{shop.name}</p>
                              <p className="text-xs text-gray-500">{shop.user?.name || "Owner"} - {shop.user?.phone || "No phone"}</p>
                              <p className="mt-1 text-xs font-semibold text-amber-700">{supportReason(shop)}</p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <a href={whatsappLeadHref(shop)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200">
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </a>
                              <button onClick={() => setTab("subscriptions")} className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200">
                                View
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-500">
                            <span>Products {shop.activation?.productCount || 0}/10</span>
                            <span>Sales {shop.activation?.salesCount || 0}/10</span>
                            <span>Last contact {shop.lastContactedAt ? new Date(shop.lastContactedAt).toLocaleDateString() : "never"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-2">
                  <MiniMetric label="High-priority reports" value={urgentReports.length} tone="border-red-200 bg-red-50 text-red-800" />
                  <MiniMetric label="Open reports" value={openReports.length} tone="border-blue-200 bg-blue-50 text-blue-800" />
                  <MiniMetric label="Stalled trials" value={stalledTrials} tone="border-orange-200 bg-orange-50 text-orange-800" />
                  <MiniMetric label="Needs billing action" value={billingIssues + unpaidShops + suspendedShops} tone="border-purple-200 bg-purple-50 text-purple-800" />
                  <MiniMetric label="Suppliers to verify" value={suppliersNeedingReview} tone="border-amber-200 bg-amber-50 text-amber-800" />
                  <MiniMetric label="Failed sync events" value={failedSyncEvents} tone="border-red-200 bg-red-50 text-red-800" />
                </div>
              </div>
            </section>
            {syncSummaries.some((item) => item.failed > 0) && (
              <section className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-red-950">Offline Sync Watchlist</h2>
                    <p className="text-xs text-red-700">Shops with failed browser sync events in the last 7 days.</p>
                  </div>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {syncSummaries.filter((item) => item.failed > 0).slice(0, 6).map((item) => (
                    <div key={item.shop.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-950">{item.shop.name}</p>
                          <p className="text-xs text-gray-500">{item.shop.user?.name || "Owner"} - {item.shop.user?.phone || "No phone"}</p>
                        </div>
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{item.failed} failed</span>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">Queued {item.queued} - Synced {item.synced} - Last {item.lastEventAt ? new Date(item.lastEventAt).toLocaleString() : "-"}</p>
                      {item.recentFailures?.[0] && (
                        <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-800">
                          <p className="font-semibold">Last failure: {item.recentFailures[0].message || "No message recorded"}</p>
                          <p className="mt-0.5 text-red-700">
                            {displayDeviceLabel(item.recentFailures[0].deviceId, item.recentFailures[0].deviceLabel, item.shop.user?.name)} - {item.recentFailures[0].resolutionStatus || "OPEN"} - Attempts {item.recentFailures[0].attempts} - {item.recentFailures[0].total ? formatTZS(item.recentFailures[0].total) : "No total"} - {new Date(item.recentFailures[0].createdAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {item.shop.user?.phone && (
                        <a href={`https://wa.me/${item.shop.user.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-green-100 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-200">
                          <MessageCircle className="h-3 w-3" /> Contact owner
                        </a>
                      )}
                      <button
                        onClick={() => openSyncHistory(item.shop.id)}
                        className="ml-2 mt-2 inline-flex items-center gap-1 rounded-lg bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                      >
                        View history
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {suspiciousAuditLogs.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-amber-950">Suspicious / Error Watchlist</h2>
                    <p className="text-xs text-amber-800">Recent login, failed, or error-looking audit events from the last audit sample.</p>
                  </div>
                  <button onClick={() => setTab("audit")} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200">
                    Open audit logs
                  </button>
                </div>
                <div className="grid gap-2 lg:grid-cols-2">
                  {suspiciousAuditLogs.slice(0, 6).map((log) => (
                    <div key={log.id} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                      <div className="flex flex-col gap-1">
                        <p className="font-mono text-xs font-semibold text-gray-900">{log.action}</p>
                        <p className="font-mono text-[11px] text-gray-500">{log.method} {log.path}</p>
                        <p className="text-xs text-gray-500">
                          {log.user ? `${log.user.name} (${log.user.phone})` : "Unknown user"} - {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* USERS */}
        {tab === "users" && (
          <div className="space-y-4">
            {users.filter((user) => user.approvalStatus === "PENDING").length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-amber-950">Pending account approvals</h2>
                    <p className="text-xs text-amber-800">Review new merchant and supplier registrations before they can sign in.</p>
                  </div>
                  <span className="rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">{users.filter((user) => user.approvalStatus === "PENDING").length} waiting</span>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {users.filter((user) => user.approvalStatus === "PENDING").map((user) => (
                    <div key={user.id} className="flex flex-col gap-3 rounded-lg border border-amber-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-semibold text-gray-950">{user.name}</p><p className="text-xs text-gray-500">{user.phone} · {user.role} · {user.shop?.name || user.supplier?.name || "No business profile"}</p></div>
                      <div className="flex gap-2"><button onClick={() => handleApproval(user, "APPROVED")} disabled={updatingUser === user.id} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-50">Approve</button><button onClick={() => handleApproval(user, "REJECTED")} disabled={updatingUser === user.id} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200 disabled:opacity-50">Reject</button></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 text-sm">All Users ({users.length})</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Phone</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Role</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Approval</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Shop / Supplier</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Subscription</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Joined</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-2.5 text-gray-600 font-mono text-xs">{u.phone}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.role === "ADMIN" ? "bg-red-100 text-red-700"
                          : u.role === "MERCHANT" ? "bg-brand-100 text-brand-700"
                          : "bg-orange-100 text-orange-700"
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${u.approvalStatus === "APPROVED" ? "bg-green-100 text-green-700" : u.approvalStatus === "REJECTED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>{u.approvalStatus || "APPROVED"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">
                        {u.shop?.name || u.supplier?.name || "-"}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {(() => {
                          const subscription = u.shop ? subscriptions.find((item) => item.id === u.shop?.id) : null;
                          if (!subscription) return <span className="text-gray-400">Not applicable</span>;
                          return (
                            <button type="button" onClick={() => setTab("subscriptions")} className="text-left hover:underline">
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${subscription.plan === "LIFETIME" ? "bg-amber-100 text-amber-800" : subscription.computedStatus === "active" ? "bg-green-100 text-green-700" : subscription.computedStatus === "trial" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                                {subscription.plan}
                              </span>
                              <span className="ml-1 text-gray-500">{subscription.computedStatus}</span>
                            </button>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => handleDeleteUser(u)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}

        {/* PIN RESET */}
        {tab === "reset" && (
          <div className="max-w-md space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>Only reset PINs for users who have verified their identity. All resets are audit-logged.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              <h2 className="font-semibold text-gray-800 text-sm">Find User by Phone</h2>
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    placeholder="+255 7XX XXX XXX"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="bg-brand-600 text-white text-sm px-3 py-2 rounded-lg disabled:opacity-60"
                >
                  {searching ? "..." : "Find"}
                </button>
              </form>
              {searchError && (
                <p className="text-red-600 text-sm flex items-center gap-1.5"><X className="w-3.5 h-3.5" />{searchError}</p>
              )}

              {searchResult && (
                <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-brand-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{searchResult.name}</p>
                      <p className="text-xs text-gray-500">
                        {searchResult.phone} - {searchResult.role}
                        {searchResult.accountType === "STAFF" ? " (Staff)" : ""}
                      </p>
                      {searchResult.shop && <p className="text-xs text-gray-400">{searchResult.shop.name}</p>}
                    </div>
                  </div>

                  <form onSubmit={handleResetPin} className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">New PIN (4-8 digits)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={resetPin}
                        onChange={(e) => setResetPin(e.target.value)}
                        placeholder="â€¢â€¢â€¢â€¢"
                        maxLength={8}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>
                    {resetMsg && (
                      <p className="text-green-700 text-sm flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
                        <Check className="w-3.5 h-3.5" />{resetMsg}
                      </p>
                    )}
                    {resetError && <p className="text-red-600 text-sm">{resetError}</p>}
                    <button
                      type="submit"
                      disabled={resetting}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                    >
                      {resetting ? "Resetting..." : "Reset PIN"}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIT LOG */}
        {tab === "audit" && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="font-semibold text-gray-800 text-sm">Recent Audit Events (last 50)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Action</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">User</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Path</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{log.action}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-600">
                        {log.user ? `${log.user.name} (${log.user.phone})` : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                        {log.method} {log.path}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {new Date(log.createdAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {tab === "reports" && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {["OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED", "ALL"].map((s) => (
                <button
                  key={s}
                  onClick={() => setReportFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    reportFilter === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s} ({s === "ALL" ? reports.length : reports.filter((r) => r.status === s).length})
                </button>
              ))}
            </div>
            <div className="space-y-3">
              {(reportFilter === "ALL" ? reports : reports.filter((r) => r.status === reportFilter)).length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500 text-sm">
                  No reports in this category
                </div>
              ) : (
                (reportFilter === "ALL" ? reports : reports.filter((r) => r.status === reportFilter)).map((report) => (
                  <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            report.priority === "URGENT" ? "bg-red-100 text-red-700" :
                            report.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                            report.priority === "MEDIUM" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{report.priority}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${report.type === "BILLING" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>{report.type}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            report.status === "OPEN" ? "bg-blue-100 text-blue-700" :
                            report.status === "IN_PROGRESS" ? "bg-yellow-100 text-yellow-700" :
                            report.status === "RESOLVED" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>{report.status}</span>
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">{report.title}</h3>
                        <p className="text-xs text-gray-600 mt-1">{report.description}</p>
                        {report.user && (
                          <p className="text-xs text-gray-500 mt-1">
                            From: {report.user.name} ({report.user.phone}) - {report.user.role}
                            {report.user.shop?.name ? ` - ${report.user.shop.name}` : ""}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">{new Date(report.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    {report.adminNotes && (
                      <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                        <p className="text-xs text-blue-800"><strong>Note:</strong> {report.adminNotes}</p>
                      </div>
                    )}
                    {report.status !== "RESOLVED" && report.status !== "REJECTED" && (
                      <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
                        {report.status === "OPEN" && (
                          <button
                            onClick={() => handleUpdateReport(report.id, "IN_PROGRESS")}
                            disabled={updatingReport === report.id}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium hover:bg-yellow-200 disabled:opacity-50"
                          >
                            Mark In Progress
                          </button>
                        )}
                        {report.type === "BILLING" && report.user?.shop?.id && (
                          <>
                            <button
                              onClick={() => handleVerifyBillingReport(report, "BASIC")}
                              disabled={updatingReport === report.id}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                            >
                              Verify Basic
                            </button>
                            <button
                              onClick={() => handleVerifyBillingReport(report, "PRO")}
                              disabled={updatingReport === report.id}
                              className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                            >
                              Verify Pro
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleUpdateReport(report.id, "RESOLVED")}
                          disabled={updatingReport === report.id}
                          className="px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleUpdateReport(report.id, "REJECTED")}
                          disabled={updatingReport === report.id}
                          className="px-3 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SUBSCRIPTIONS */}
        {tab === "subscriptions" && (
          <div>
            <div className="flex gap-2 mb-4 flex-wrap">
              {["ALL", "trial", "active", "expired", "suspended"].map((s) => (
                <button
                  key={s}
                  onClick={() => setSubFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    subFilter === s ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {s.toUpperCase()} ({s === "ALL" ? subscriptions.length : subscriptions.filter((x) => x.computedStatus === s).length})
                </button>
              ))}
            </div>
            <section className="mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-brand-950">Plan & renewal controls</h2>
                  <p className="text-xs text-brand-800">Set a shop plan, record M-Pesa/manual payment, and renew for 1-24 months.</p>
                </div>
                <span className="text-xs font-semibold text-brand-700">{filteredSubscriptions.length} shops shown</span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {filteredSubscriptions.length === 0 ? (
                  <div className="rounded-lg bg-white p-4 text-sm text-gray-500">No shops match this filter.</div>
                ) : filteredSubscriptions.map((shop) => {
                  const draft = billingDraftFor(shop);
                  return (
                    <div key={shop.id} className="rounded-lg border border-brand-100 bg-white p-3 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-950">{shop.name}</p>
                          <p className="text-xs text-gray-500">{shop.user?.name || "Owner"} - {shop.user?.phone || "No phone"}</p>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            shop.computedStatus === "active" ? "bg-green-100 text-green-700" :
                            shop.computedStatus === "trial" ? "bg-yellow-100 text-yellow-700" :
                            shop.computedStatus === "expired" ? "bg-red-100 text-red-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>{shop.computedStatus}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${shop.plan === "LIFETIME" ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-700"}`}>{shop.plan}</span>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 text-xs text-gray-600 sm:grid-cols-3">
                        <div>
                          <p className="font-semibold text-gray-900">{validityLabel(shop)}</p>
                          <p>{shop.daysLeft !== null ? `${shop.daysLeft} day(s) left` : "No expiry date set"}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Paid subscription</p>
                          <p>{shop.subscriptionEndsAt ? `Until ${formatDate(shop.subscriptionEndsAt)}` : "Not active yet"}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">Trial</p>
                          <p>{shop.trialEndsAt ? `Until ${formatDate(shop.trialEndsAt)}` : "No trial date"}</p>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-6">
                        <select
                          value={draft.plan}
                          onChange={(e) => updateBillingDraft(shop, { plan: e.target.value as "BASIC" | "PRO" })}
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-semibold sm:col-span-1"
                        >
                          <option value="BASIC">Basic</option>
                          <option value="PRO">Pro</option>
                        </select>
                        <input
                          value={draft.months}
                          onChange={(e) => updateBillingDraft(shop, { months: e.target.value })}
                          type="number"
                          min="1"
                          max="24"
                          inputMode="numeric"
                          placeholder="Months"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs sm:col-span-1"
                        />
                        <input
                          value={draft.amount}
                          onChange={(e) => updateBillingDraft(shop, { amount: e.target.value })}
                          type="number"
                          min="1"
                          inputMode="numeric"
                          placeholder="Amount"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs sm:col-span-1"
                        />
                        <select
                          value={draft.method}
                          onChange={(e) => updateBillingDraft(shop, { method: e.target.value })}
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs sm:col-span-1"
                        >
                          <option value="MPESA">M-Pesa</option>
                          <option value="MANUAL">Manual</option>
                          <option value="BANK">Bank</option>
                          <option value="CASH">Cash</option>
                        </select>
                        <input
                          value={draft.reference}
                          onChange={(e) => updateBillingDraft(shop, { reference: e.target.value })}
                          placeholder="Reference"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs sm:col-span-2"
                        />
                        <input
                          value={draft.note}
                          onChange={(e) => updateBillingDraft(shop, { note: e.target.value })}
                          placeholder="Admin note"
                          className="rounded-lg border border-gray-300 px-2 py-2 text-xs sm:col-span-4"
                        />
                        <button
                          onClick={() => handleRecordPayment(shop, undefined, draft)}
                          disabled={updatingSub === shop.id}
                          className="rounded-lg bg-brand-700 px-3 py-2 text-xs font-bold text-white hover:bg-brand-800 disabled:opacity-50 sm:col-span-2"
                        >
                          {updatingSub === shop.id ? "Saving..." : "Activate / Renew"}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button onClick={() => handleRecordPayment(shop, "BASIC")} disabled={updatingSub === shop.id} className="rounded bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-50">
                          Quick Basic 1mo
                        </button>
                        <button onClick={() => handleRecordPayment(shop, "PRO")} disabled={updatingSub === shop.id} className="rounded bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-200 disabled:opacity-50">
                          Quick Pro 1mo
                        </button>
                        <button onClick={() => handleExtendTrial(shop.id, 14)} disabled={updatingSub === shop.id} className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                          +14d trial
                        </button>
                        <button onClick={() => handleExtendSubscription(shop, 30)} disabled={updatingSub === shop.id} className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50">
                          +30d paid
                        </button>
                        <button onClick={() => handleSetLifetime(shop)} disabled={updatingSub === shop.id || shop.plan === "LIFETIME"} className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:opacity-50">
                          {shop.plan === "LIFETIME" ? "Lifetime active" : "Give Lifetime"}
                        </button>
                        <button onClick={() => handleToggleShopActive(shop)} disabled={updatingSub === shop.id} className={`rounded px-2 py-1 text-xs font-semibold disabled:opacity-50 ${shop.isActive ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                          {shop.isActive ? "Suspend" : "Activate shop"}
                        </button>
                        <button onClick={() => handleRemoveSubscription(shop)} disabled={updatingSub === shop.id || !shop.subscriptionEndsAt} className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50">
                          Remove paid plan
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Last payment: {shop.lastPayment ? `${formatTZS(shop.lastPayment.amount)} ${shop.lastPayment.method} on ${formatDate(shop.lastPayment.paidAt)}` : "None"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50 px-4 py-2">
                <p className="text-xs font-semibold text-gray-700">Subscription detail table</p>
                <p className="text-xs text-gray-500">Scroll right to see validity, notes, payment and actions</p>
              </div>
              <div className="max-w-full overflow-x-auto">
              <table className="min-w-[1280px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Shop</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Owner</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Plan</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Valid Until</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Activation</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Follow-up</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Last Payment</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubscriptions.map((shop) => (
                    <tr key={shop.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{shop.name}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{shop.user?.name}<br />{shop.user?.phone}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          shop.plan === "PRO" ? "bg-purple-100 text-purple-700" :
                          shop.plan === "BASIC" ? "bg-blue-100 text-blue-700" :
                          shop.plan === "LIFETIME" ? "bg-amber-100 text-amber-800" :
                          "bg-gray-100 text-gray-600"
                        }`}>{shop.plan}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          shop.computedStatus === "active" ? "bg-green-100 text-green-700" :
                          shop.computedStatus === "trial" ? "bg-yellow-100 text-yellow-700" :
                          shop.computedStatus === "expired" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>{shop.computedStatus}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-800">{formatDate(shop.validUntil || shop.subscriptionEndsAt || shop.trialEndsAt)}</p>
                          <p>{shop.daysLeft !== null ? `${shop.daysLeft}d left` : "-"}</p>
                          {shop.subscriptionEndsAt && (
                            <p className="text-gray-400">Paid: {formatDate(shop.subscriptionEndsAt)}</p>
                          )}
                          {shop.reminderStage && (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              {shop.reminderStage.replaceAll("_", " ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="space-y-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                            shop.activation?.activated ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                          }`}>
                            {shop.activation?.activated ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                            {shop.activation?.activated ? "Activated" : "In progress"}
                          </span>
                          <div className="grid gap-1 text-gray-500">
                            <span className={shop.activation?.productCount >= 10 ? "text-green-700" : ""}>
                              Products: {shop.activation?.productCount || 0}/10
                            </span>
                            <span className={shop.activation?.salesCount >= 10 ? "text-green-700" : ""}>
                              Sales: {shop.activation?.salesCount || 0}/10
                            </span>
                            <span className={shop.activation?.secondDayReturn ? "text-green-700" : ""}>
                              2nd day: {shop.activation?.secondDayReturn ? "yes" : "no"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="min-w-[220px] space-y-2">
                          <select
                            value={shop.onboardingStatus}
                            onChange={(e) => handleUpdateFollowUp(shop, { onboardingStatus: e.target.value as Subscription["onboardingStatus"] })}
                            disabled={updatingSub === shop.id}
                            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700"
                          >
                            <option value="NEW">NEW</option>
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="NEEDS_HELP">NEEDS HELP</option>
                            <option value="SETUP_DONE">SETUP DONE</option>
                            <option value="ACTIVATED">ACTIVATED</option>
                            <option value="PAID">PAID</option>
                            <option value="CONVERTED">CONVERTED</option>
                            <option value="CHURN_RISK">CHURN RISK</option>
                          </select>
                          <p className="text-gray-500">
                            Last contact: {shop.lastContactedAt ? new Date(shop.lastContactedAt).toLocaleDateString() : "never"}
                          </p>
                          <textarea
                            value={followUpDrafts[shop.id] || ""}
                            onChange={(e) => setFollowUpDrafts((prev) => ({ ...prev, [shop.id]: e.target.value }))}
                            placeholder="Notes: owner objection, next action, setup status..."
                            className="h-16 w-full resize-none rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => handleUpdateFollowUp(shop, { lastContactedAt: new Date().toISOString() })}
                              disabled={updatingSub === shop.id}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 disabled:opacity-50"
                            >
                              Contacted today
                            </button>
                            <button
                              onClick={() => handleUpdateFollowUp(shop, { followUpNotes: followUpDrafts[shop.id] || "" })}
                              disabled={updatingSub === shop.id}
                              className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                            >
                              Save notes
                            </button>
                            {shop.user?.phone && (
                              <a
                                href={whatsappLeadHref(shop)}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 text-brand-700 rounded text-xs font-medium hover:bg-brand-200"
                              >
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </a>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">
                        {shop.lastPayment ? (
                          <div>
                            <p className="font-semibold text-gray-800">{formatTZS(shop.lastPayment.amount)} {shop.lastPayment.method}</p>
                            <p className="text-gray-400">{formatDate(shop.lastPayment.paidAt)}</p>
                            {shop.lastPayment.reference && <p className="font-mono text-[10px] text-gray-400">{shop.lastPayment.reference}</p>}
                          </div>
                        ) : "None"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => handleRecordPayment(shop, "BASIC")}
                            disabled={updatingSub === shop.id}
                            className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 disabled:opacity-50"
                          >
                            Paid Basic
                          </button>
                          <button
                            onClick={() => handleRecordPayment(shop, "PRO")}
                            disabled={updatingSub === shop.id}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium hover:bg-purple-200 disabled:opacity-50"
                          >
                            Paid Pro
                          </button>
                          <button
                            onClick={() => handleExtendTrial(shop.id, 14)}
                            disabled={updatingSub === shop.id}
                            className="px-2 py-1 bg-brand-100 text-brand-700 rounded text-xs font-medium hover:bg-brand-200 disabled:opacity-50"
                          >
                            +14d trial
                          </button>
                          <button
                            onClick={() => handleExtendSubscription(shop, 30)}
                            disabled={updatingSub === shop.id}
                            className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-medium hover:bg-emerald-200 disabled:opacity-50"
                          >
                            +30d paid
                          </button>
                          <button
                            onClick={() => handleToggleShopActive(shop)}
                            disabled={updatingSub === shop.id}
                            className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                              shop.isActive ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {shop.isActive ? "Suspend" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleRemoveSubscription(shop)}
                            disabled={updatingSub === shop.id || !shop.subscriptionEndsAt}
                            className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 disabled:opacity-50"
                          >
                            Remove paid plan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
        )}

        {/* SYNC HISTORY */}
        {tab === "sync" && (
          <div className="space-y-4">
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Offline Sync History</h2>
                  <p className="text-xs text-gray-500">Drill into queued, synced, failed, and removed offline sales by shop and device.</p>
                </div>
                <button
                  onClick={() => refreshSyncEvents().catch(console.error)}
                  disabled={loadingSyncEvents}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingSyncEvents ? "animate-spin" : ""}`} />
                  Refresh
                </button>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <select
                  value={syncShopFilter}
                  onChange={(e) => {
                    setSyncShopFilter(e.target.value);
                    refreshSyncEvents({ shopId: e.target.value }).catch(console.error);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">All shops</option>
                  {subscriptions.map((shop) => (
                    <option key={shop.id} value={shop.id}>{shop.name}</option>
                  ))}
                </select>
                <input
                  value={syncDeviceFilter}
                  onChange={(e) => setSyncDeviceFilter(e.target.value)}
                  onBlur={() => refreshSyncEvents().catch(console.error)}
                  placeholder="Device ID"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <select
                  value={syncStatusFilter}
                  onChange={(e) => {
                    setSyncStatusFilter(e.target.value);
                    refreshSyncEvents({ status: e.target.value }).catch(console.error);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="QUEUED">Queued</option>
                  <option value="SYNCED">Synced</option>
                  <option value="FAILED">Failed</option>
                  <option value="REMOVED">Removed</option>
                </select>
                <button
                  onClick={() => {
                    setSyncShopFilter("");
                    setSyncDeviceFilter("");
                    setSyncStatusFilter("");
                    refreshSyncEvents({ shopId: "", deviceId: "", status: "" }).catch(console.error);
                  }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Clear filters
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-gray-900">Device Rollup</h2>
                <span className="text-xs text-gray-400">{syncDevices.length} rows</span>
              </div>
              {syncDevices.length === 0 ? (
                <p className="rounded-lg bg-gray-50 px-3 py-4 text-sm text-gray-500">No sync device events found for this filter.</p>
              ) : (
                <div className="max-w-full overflow-x-auto">
                  <table className="min-w-[760px] w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Shop</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Device</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Events</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Last seen</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {syncDevices.map((device, index) => {
                        const shop = subscriptions.find((item) => item.id === device.shopId);
                        const deviceLabel = displayDeviceLabel(device.deviceId, device.deviceLabel, shop?.user?.name);
                        return (
                          <tr key={`${device.shopId}-${device.deviceId || "unknown"}-${device.status}-${index}`} className="border-b border-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{shop?.name || device.shopId}</td>
                            <td className="px-3 py-2">
                              <p className="text-xs font-semibold text-gray-800">{deviceLabel}</p>
                              <p className="font-mono text-[11px] text-gray-400">{device.deviceId || "unknown"}</p>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                device.status === "FAILED" ? "bg-red-100 text-red-700" :
                                device.status === "SYNCED" ? "bg-green-100 text-green-700" :
                                device.status === "QUEUED" ? "bg-amber-100 text-amber-700" :
                                "bg-gray-100 text-gray-700"
                              }`}>{device.status}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{device._count.id}</td>
                            <td className="px-3 py-2 text-xs text-gray-500">{device._max.createdAt ? new Date(device._max.createdAt).toLocaleString() : "-"}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <button
                                  onClick={() => openSyncHistory(device.shopId, device.deviceId || "")}
                                  className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                                >
                                  Filter
                                </button>
                                <button
                                  onClick={() => {
                                    const nextLabel = window.prompt("Device label", deviceLabel);
                                    if (nextLabel) handleSaveDeviceLabel(device, nextLabel).catch(console.error);
                                  }}
                                  disabled={!device.deviceId}
                                  className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-200 disabled:opacity-50"
                                >
                                  Label
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Event Timeline</h2>
                <span className="text-xs text-gray-400">{syncEvents.length} events</span>
              </div>
              {syncEvents.length === 0 ? (
                <p className="p-6 text-sm text-gray-500">No sync events found for this filter.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {syncEvents.map((event) => (
                    <div key={event.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-950">{event.shop?.name || event.shopId}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            event.status === "FAILED" ? "bg-red-100 text-red-700" :
                            event.status === "SYNCED" ? "bg-green-100 text-green-700" :
                              event.status === "QUEUED" ? "bg-amber-100 text-amber-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>{event.status}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            event.resolutionStatus === "RESOLVED" ? "bg-green-100 text-green-700" :
                            event.resolutionStatus === "CONTACTED" ? "bg-blue-100 text-blue-700" :
                            "bg-red-100 text-red-700"
                          }`}>{event.resolutionStatus || "OPEN"}</span>
                          <span className="text-xs font-semibold text-gray-500">
                            {displayDeviceLabel(event.deviceId, event.deviceLabel, event.shop?.user?.name)}
                          </span>
                          <span className="font-mono text-[11px] text-gray-400">{event.deviceId || "unknown device"}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{event.message || "No message recorded"}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          Owner: {event.shop?.user?.name || "Unknown"} {event.shop?.user?.phone ? `- ${event.shop.user.phone}` : ""} - Local sale: {event.localId || "-"}
                        </p>
                        {event.resolutionNote && <p className="mt-1 rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-600">Note: {event.resolutionNote}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(["OPEN", "CONTACTED", "RESOLVED"] as const).map((status) => (
                            <button
                              key={status}
                              onClick={() => handleUpdateSyncEvent(event, { resolutionStatus: status }).catch(console.error)}
                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                status === "RESOLVED" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                                status === "CONTACTED" ? "bg-blue-100 text-blue-700 hover:bg-blue-200" :
                                "bg-red-100 text-red-700 hover:bg-red-200"
                              }`}
                            >
                              {status === "CONTACTED" ? "Contacted" : status === "RESOLVED" ? "Resolved" : "Open"}
                            </button>
                          ))}
                          <button
                            onClick={() => {
                              const note = window.prompt("Sync support note", event.resolutionNote || "");
                              if (note !== null) handleUpdateSyncEvent(event, { resolutionNote: note }).catch(console.error);
                            }}
                            className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                          >
                            Note
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 lg:text-right">
                        <p className="font-semibold text-gray-800">{event.total ? formatTZS(event.total) : "No total"}</p>
                        <p>Attempts {event.attempts}</p>
                        <p>{new Date(event.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* SUPPLIERS */}
        {tab === "suppliers" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MiniMetric label="Total suppliers" value={suppliers.length} tone="border-gray-200 bg-gray-50 text-gray-800" />
              <MiniMetric label="Verified" value={verifiedSuppliers} tone="border-green-200 bg-green-50 text-green-800" />
              <MiniMetric label="Needs review" value={suppliers.filter((s) => s.verificationStatus === "NEEDS_REVIEW" || s.verificationStatus === "UNVERIFIED").length} tone="border-amber-200 bg-amber-50 text-amber-800" />
              <MiniMetric label="Rejected" value={suppliers.filter((s) => s.verificationStatus === "REJECTED").length} tone="border-red-200 bg-red-50 text-red-800" />
            </div>
            {suppliers.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                No suppliers have been added yet.
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div key={supplier.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-950">{supplier.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          supplier.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" :
                          supplier.verificationStatus === "REJECTED" ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {supplier.verificationStatus || "UNVERIFIED"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">{supplier.phone} {supplier.address ? `- ${supplier.address}` : ""}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Products {supplier._count?.products || 0} - Orders {supplier._count?.orders || 0}
                        {supplier.verifiedAt ? ` - Verified ${new Date(supplier.verifiedAt).toLocaleDateString()}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <a href={`https://wa.me/${supplier.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-200">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                      {(["VERIFIED", "NEEDS_REVIEW", "REJECTED"] as const).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleUpdateSupplier(supplier, { verificationStatus: status })}
                          disabled={updatingSupplier === supplier.id}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                            status === "VERIFIED" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                            status === "REJECTED" ? "bg-red-100 text-red-700 hover:bg-red-200" :
                            "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          }`}
                        >
                          {status === "VERIFIED" ? "Verify" : status === "REJECTED" ? "Reject" : "Needs review"}
                        </button>
                      ))}
                      <button
                        onClick={() => handleDeleteSupplier(supplier)}
                        disabled={updatingSupplier === supplier.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <textarea
                      value={supplierNotes[supplier.id] || ""}
                      onChange={(e) => setSupplierNotes((prev) => ({ ...prev, [supplier.id]: e.target.value }))}
                      placeholder="Supplier notes: areas served, delivery terms, owner contact, issue history..."
                      className="min-h-16 resize-none rounded-lg border border-gray-200 px-3 py-2 text-xs"
                    />
                    <button
                      onClick={() => handleUpdateSupplier(supplier, { adminNotes: supplierNotes[supplier.id] || "" })}
                      disabled={updatingSupplier === supplier.id}
                      className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                    >
                      Save notes
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
