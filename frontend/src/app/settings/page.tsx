"use client";
import { useState, useEffect } from "react";
import AppShell from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { t, useLang, setLanguage as setAppLanguage } from "@/lib/i18n";
import { Store, User, Lock, Globe, Check, ChevronDown, Bell, ScanLine } from "lucide-react";
import NotificationSettings from "@/components/notifications/NotificationSettings";

interface UserSettings {
  id: string;
  phone: string;
  name: string;
  role: string;
  language: string;
  isStaff?: boolean;
  staffRole?: string;
  staffPermissions?: { canManageBarcodeSettings?: boolean };
  shop?: {
    id: string;
    name: string;
    location: string;
    district?: string | null;
    category: string;
    isCatalogPublished: boolean;
  };
}

const SHOP_CATEGORIES = [
  { value: "grocery", sw: "Mboga na Vyakula", en: "Grocery" },
  { value: "pharmacy", sw: "Duka la Dawa", en: "Pharmacy" },
  { value: "beauty", sw: "Urembo", en: "Beauty & Cosmetics" },
  { value: "bar", sw: "Bar / Mgahawa", en: "Bar / Restaurant" },
  { value: "hardware", sw: "Vifaa vya Ujenzi", en: "Hardware" },
  { value: "electronics", sw: "Umeme / Simu", en: "Electronics" },
  { value: "clothing", sw: "Nguo", en: "Clothing" },
  { value: "general", sw: "Bidhaa Mchanganyiko", en: "General / Mixed" },
];

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
        <span className="text-brand-600">{icon}</span>
        <h2 className="font-semibold text-gray-800 text-sm">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function SuccessBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-3 py-2 text-sm">
      <Check className="w-4 h-4 flex-shrink-0" />
      {msg}
    </div>
  );
}

export default function SettingsPage() {
  const lang = useLang();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Shop form
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [shopDistrict, setShopDistrict] = useState("");
  const [shopCategory, setShopCategory] = useState("general");
  const [catalogPublished, setCatalogPublished] = useState(true);
  const [shopSaving, setShopSaving] = useState(false);
  const [shopMsg, setShopMsg] = useState("");
  const [shopError, setShopError] = useState("");

  // Profile form
  const [displayName, setDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");

  // PIN form
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMsg, setPinMsg] = useState("");
  const [pinError, setPinError] = useState("");
  const [barcodeSettings, setBarcodeSettings] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    api.get<{ settings: UserSettings }>("/settings")
      .then((d) => {
        const s = d.settings;
        setSettings(s);
        setDisplayName(s.name);
        if (s.shop) {
          setShopName(s.shop.name);
          setShopLocation(s.shop.location);
          setShopDistrict(s.shop.district || "");
          setShopCategory(s.shop.category);
          setCatalogPublished(s.shop.isCatalogPublished !== false);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    api.get<{ settings: Record<string, boolean> }>("/barcodes/settings").then((data) => setBarcodeSettings(data.settings)).catch(() => {});
  }, []);

  async function saveShop(e: React.FormEvent) {
    e.preventDefault();
    setShopError("");
    setShopMsg("");
    if (!shopName.trim() || !shopLocation.trim()) {
      setShopError(lang === "sw" ? "Jina na jiji lazima zijazwe" : "Shop name and city are required");
      return;
    }
    setShopSaving(true);
    try {
      await api.patch("/settings/shop", {
        name: shopName.trim(),
        location: shopLocation.trim(),
        district: shopDistrict.trim() || null,
        category: shopCategory,
        isCatalogPublished: catalogPublished,
      });
      setShopMsg(t("settings.saved", lang));
      setSettings((prev) => prev ? {
        ...prev,
        shop: prev.shop ? { ...prev.shop, name: shopName.trim(), location: shopLocation.trim(), district: shopDistrict.trim() || null, category: shopCategory, isCatalogPublished: catalogPublished } : prev.shop,
      } : prev);
      setTimeout(() => setShopMsg(""), 3000);
    } catch (err: unknown) {
      setShopError(err instanceof Error ? err.message : t("common.error", lang));
    } finally {
      setShopSaving(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError("");
    setProfileMsg("");
    if (!displayName.trim()) {
      setProfileError(lang === "sw" ? "Jina linahitajika" : "Name is required");
      return;
    }
    setProfileSaving(true);
    try {
      await api.patch("/settings/profile", { name: displayName.trim() });
      setProfileMsg(t("settings.saved", lang));
      setSettings((prev) => prev ? { ...prev, name: displayName.trim() } : prev);
      setTimeout(() => setProfileMsg(""), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : t("common.error", lang));
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    setPinMsg("");
    if (newPin !== confirmPin) {
      setPinError(t("settings.pinMismatch", lang));
      return;
    }
    if (!/^\d{4,8}$/.test(newPin)) {
      setPinError(t("auth.error.invalidPin", lang));
      return;
    }
    setPinSaving(true);
    try {
      await api.patch("/settings/pin", { currentPin, newPin });
      setPinMsg(t("settings.pinChanged", lang));
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setTimeout(() => setPinMsg(""), 3000);
    } catch (err: unknown) {
      setPinError(err instanceof Error ? err.message : t("common.error", lang));
    } finally {
      setPinSaving(false);
    }
  }

  async function changeLanguage(newLang: "sw" | "en") {
    setAppLanguage(newLang);
    try {
      await api.patch("/settings/language", { language: newLang });
    } catch {
      // language saved locally already
    }
  }

  async function toggleBarcodeSetting(key: string) {
    if (!barcodeSettings) return;
    const next = { ...barcodeSettings, [key]: !barcodeSettings[key] };
    setBarcodeSettings(next);
    try { await api.patch("/barcodes/settings", { [key]: next[key] }); } catch { setBarcodeSettings(barcodeSettings); }
  }

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
      <div className="max-w-2xl mx-auto pb-24 lg:pb-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">{t("settings.title", lang)}</h1>

        {/* Profile */}
        <SectionCard title={t("settings.profileSection", lang)} icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t("settings.phone", lang)}</p>
              <p className="font-medium text-gray-800">{settings?.phone}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t("settings.role", lang)}</p>
              <p className="font-medium text-gray-800 capitalize">
                {settings?.isStaff ? settings.staffRole?.replace("_", " ") : settings?.role === "MERCHANT" ? t("app.merchant", lang) : settings?.role === "SUPPLIER" ? t("app.supplier", lang) : settings?.role}
              </p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.displayName", lang)}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            {profileMsg && <SuccessBanner msg={profileMsg} />}
            {profileError && <p className="text-red-600 text-sm">{profileError}</p>}
            <button
              type="submit"
              disabled={profileSaving}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {profileSaving ? "..." : t("common.save", lang)}
            </button>
          </form>
        </SectionCard>

        {/* Shop Details — merchant only */}
        {settings?.role === "MERCHANT" && !settings.isStaff && settings.shop && (
          <SectionCard title={t("settings.shopSection", lang)} icon={<Store className="w-4 h-4" />}>
            <form onSubmit={saveShop} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.shopName", lang)}</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <input
                  type="checkbox"
                  checked={catalogPublished}
                  onChange={(event) => setCatalogPublished(event.target.checked)}
                  className="mt-0.5 h-5 w-5 rounded border-gray-300 text-brand-600"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-800">
                    {lang === "sw" ? "Onyesha duka kwenye catalog ya umma" : "Publish shop in the public catalog"}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                    {lang === "sw" ? "Zima hii wakati unasafisha bidhaa au bei kabla ya kushare link." : "Turn this off while cleaning products or prices before sharing your shop link."}
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.location", lang)}</label>
                  <input
                    type="text"
                    value={shopLocation}
                    onChange={(e) => setShopLocation(e.target.value)}
                    placeholder="Dar es Salaam"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.district", lang)}</label>
                  <input
                    type="text"
                    value={shopDistrict}
                    onChange={(e) => setShopDistrict(e.target.value)}
                    placeholder="Kariakoo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.category", lang)}</label>
                <div className="relative">
                  <select
                    value={shopCategory}
                    onChange={(e) => setShopCategory(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none bg-white"
                  >
                    {SHOP_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {lang === "sw" ? c.sw : c.en}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
              {shopMsg && <SuccessBanner msg={shopMsg} />}
              {shopError && <p className="text-red-600 text-sm">{shopError}</p>}
              <button
                type="submit"
                disabled={shopSaving}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {shopSaving ? "..." : t("common.save", lang)}
              </button>
            </form>
          </SectionCard>
        )}

        {settings?.role === "MERCHANT" && (
          <SectionCard title={lang === "sw" ? "Notifications" : "Notifications"} icon={<Bell className="w-4 h-4" />}>
            <NotificationSettings owner={!settings.isStaff} />
          </SectionCard>
        )}

        {barcodeSettings && settings?.role === "MERCHANT" && (!settings.isStaff || settings.staffPermissions?.canManageBarcodeSettings) && (
          <SectionCard title={lang === "sw" ? "Mipangilio ya Barcode" : "Barcode settings"} icon={<ScanLine className="w-4 h-4" />}>
            {[
              ["barcodeScanningEnabled", lang === "sw" ? "Ruhusu kuscan barcode" : "Enable barcode scanning"],
              ["bluetoothScannerEnabled", lang === "sw" ? "Ruhusu scanner ya Bluetooth/USB" : "Enable Bluetooth/USB scanners"],
              ["barcodeGenerationEnabled", lang === "sw" ? "Ruhusu kutengeneza barcode" : "Enable barcode generation"],
              ["barcodeAutoFocus", lang === "sw" ? "Lenga scanner moja kwa moja" : "Auto-focus scanner"],
              ["barcodeSuccessSound", lang === "sw" ? "Sauti baada ya scan" : "Play success sound"],
              ["barcodeVibrate", lang === "sw" ? "Tetemesha simu baada ya scan" : "Vibrate after scan"],
              ["barcodeAutoAddToCart", lang === "sw" ? "Ongeza cart moja kwa moja" : "Automatically add scanned products to cart"],
            ].map(([key, label]) => <label key={key} className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 last:border-0"><span className="text-sm text-gray-700">{label}</span><input type="checkbox" checked={Boolean(barcodeSettings[key])} onChange={() => toggleBarcodeSetting(key)} className="h-5 w-5 rounded border-gray-300 text-brand-600" /></label>)}
          </SectionCard>
        )}

        {/* Language */}
        <SectionCard title={t("settings.languageSection", lang)} icon={<Globe className="w-4 h-4" />}>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => changeLanguage("sw")}
              className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                lang === "sw" ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
              }`}
            >
              Kiswahili
            </button>
            <button
              type="button"
              onClick={() => changeLanguage("en")}
              className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                lang === "en" ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-600 border-gray-300 hover:border-brand-400"
              }`}
            >
              English
            </button>
          </div>
        </SectionCard>

        {/* Change PIN */}
        <SectionCard title={t("settings.pinSection", lang)} icon={<Lock className="w-4 h-4" />}>
          <form onSubmit={savePin} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.currentPin", lang)}</label>
              <input
                type="password"
                inputMode="numeric"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="••••"
                maxLength={8}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.newPin", lang)}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t("settings.confirmNewPin", lang)}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  placeholder="••••"
                  maxLength={8}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  required
                />
              </div>
            </div>
            {pinMsg && <SuccessBanner msg={pinMsg} />}
            {pinError && <p className="text-red-600 text-sm">{pinError}</p>}
            <button
              type="submit"
              disabled={pinSaving}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {pinSaving ? "..." : t("settings.pinSection", lang)}
            </button>
          </form>
        </SectionCard>
      </div>
    </AppShell>
  );
}
