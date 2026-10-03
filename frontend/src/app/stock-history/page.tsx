"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import { History } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface Movement {
  id: string;
  type: "IN" | "RETURN";
  quantity: number;
  note?: string | null;
  createdAt: string;
  product?: { id: string; name: string; unit: string } | null;
  actor?: { id: string; name: string; phone?: string | null } | null;
}

interface CurrentUser {
  role: string;
  staff?: { role?: string } | null;
}

export default function StockHistoryPage() {
  const lang = useLang();
  const { toast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [type, setType] = useState<"ALL" | "IN" | "RETURN">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    api.get<{ user: CurrentUser }>("/auth/me")
      .then(({ user }) => setAllowed(user.role === "MERCHANT" && (!user.staff || user.staff.role === "OWNER")))
      .catch(() => setAllowed(false));
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    api.get<{ movements: Movement[] }>(`/stock/movements?type=${type}&limit=500`)
      .then((data) => { if (active) setMovements(data.movements ?? []); })
      .catch((error: unknown) => { if (active) toast(error instanceof Error ? error.message : (lang === "sw" ? "Imeshindikana kupakia historia ya stock." : "Could not load stock history."), "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [allowed, type, toast, lang]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return movements;
    return movements.filter((movement) => [movement.product?.name, movement.note, movement.actor?.name, movement.actor?.phone].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [movements, search]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl pb-24 lg:pb-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-brand-100 p-3 text-brand-700"><History className="h-6 w-6" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{lang === "sw" ? "Historia ya Stock" : "Stock History"}</h1>
            <p className="mt-1 text-sm text-gray-500">{lang === "sw" ? "Fuatilia stock iliyoingia na bidhaa zilizorudishwa." : "Track stock received into the shop and products returned by customers."}</p>
          </div>
        </div>

        {!allowed ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{lang === "sw" ? "Sehemu hii ni ya owner au admin pekee." : "This section is available to the owner or admin only."}</div>
        ) : (
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={lang === "sw" ? "Tafuta bidhaa, maelezo, au mtumiaji" : "Search product, note, or user"} className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              <select value={type} onChange={(event) => setType(event.target.value as typeof type)} aria-label={lang === "sw" ? "Aina ya stock" : "Stock history type"} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-500">
                <option value="ALL">{lang === "sw" ? "Zote: zimepokelewa na zilirudi" : "All received and returned"}</option>
                <option value="IN">{lang === "sw" ? "Stock iliyopokelewa" : "Received stock"}</option>
                <option value="RETURN">{lang === "sw" ? "Stock iliyorudishwa" : "Returned stock"}</option>
              </select>
            </div>
            <div className="mt-4 overflow-x-auto">
              {loading ? <p className="py-10 text-center text-sm text-gray-400">{t("common.loading", lang)}</p> : visible.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">{lang === "sw" ? "Hakuna historia ya kupokea au kurudisha stock." : "No received or returned stock has been recorded yet."}</p> : (
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead><tr className="border-b border-gray-100 text-gray-500"><th className="px-2 py-2 font-medium">{lang === "sw" ? "Bidhaa" : "Product"}</th><th className="px-2 py-2 font-medium">{lang === "sw" ? "Aina" : "Type"}</th><th className="px-2 py-2 font-medium">{lang === "sw" ? "Kiasi" : "Quantity"}</th><th className="px-2 py-2 font-medium">{lang === "sw" ? "Maelezo" : "Note"}</th><th className="px-2 py-2 font-medium">{lang === "sw" ? "Aliyeandika" : "Recorded by"}</th><th className="px-2 py-2 font-medium">{lang === "sw" ? "Tarehe" : "Date"}</th></tr></thead>
                  <tbody>{visible.map((movement) => <tr key={movement.id} className="border-b border-gray-50 last:border-0"><td className="px-2 py-2 font-medium text-gray-800">{movement.product?.name ?? "Unknown product"}</td><td className="px-2 py-2"><span className={`rounded-full px-2 py-1 font-semibold ${movement.type === "RETURN" ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>{movement.type === "RETURN" ? (lang === "sw" ? "Imerudi" : "Returned") : (lang === "sw" ? "Imeingia" : "Received")}</span></td><td className="px-2 py-2 font-semibold text-gray-800">+{movement.quantity} {movement.product?.unit ?? ""}</td><td className="max-w-56 truncate px-2 py-2 text-gray-600" title={movement.note ?? ""}>{movement.note || "—"}</td><td className="px-2 py-2 text-gray-600">{movement.actor?.name || movement.actor?.phone || (lang === "sw" ? "Historia ya zamani" : "Earlier record")}</td><td className="whitespace-nowrap px-2 py-2 text-gray-500">{new Date(movement.createdAt).toLocaleString(lang === "sw" ? "sw-TZ" : "en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
