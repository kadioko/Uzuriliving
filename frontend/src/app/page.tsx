"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, getFriendlyErrorMessage } from "@/lib/api";
import {
  ArrowRight,
  BadgeDollarSign,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  Menu,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  ReceiptText,
  Store,
  X,
} from "lucide-react";
import LogoMark from "@/components/brand/LogoMark";
import WhatsAppCTA from "@/components/marketing/WhatsAppCTA";
import { TextReveal } from "@/components/ui/cascade-text";
import { t, useLang, setLanguage as setAppLanguage } from "@/lib/i18n";
import clsx from "clsx";
import { getAttribution, trackMarketingEvent } from "@/lib/marketing";

function normalizePhone(value: string): string {
  return value.replace(/[\s()-]/g, "").trim();
}

const TANZANIA_PREFIX = "+255";

function withTanzaniaPrefix(value: string): string {
  const compact = value.replace(/[^\d+]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith(TANZANIA_PREFIX)) return compact;
  const digits = compact.replace(/\D/g, "");
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.startsWith("255")) return `+${digits}`;
  if (digits.startsWith("0")) return `${TANZANIA_PREFIX}${digits.slice(1)}`;
  return `${TANZANIA_PREFIX}${digits}`;
}

function isValidPhone(value: string): boolean {
  return /^\+?[1-9]\d{8,14}$/.test(normalizePhone(value));
}

function isValidPin(value: string): boolean {
  return /^\d{4,8}$/.test(value.trim());
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

const heroFeatures = [
  {
    icon: PackageCheck,
    sw: "Jua stock iliyobaki kabla haijaisha.",
    en: "Know what stock is left before it runs out.",
  },
  {
    icon: ReceiptText,
    sw: "Rekodi mauzo, madeni, matumizi na faida.",
    en: "Record sales, debts, expenses, and profit.",
  },
  {
    icon: MessageCircle,
    sw: "Tengeneza order ya supplier tayari kwa WhatsApp.",
    en: "Create supplier orders ready for WhatsApp.",
  },
];

const heroProofPoints = [
  { sw: "AI inapanga kipaumbele cha leo", en: "AI ranks today's priorities" },
  { sw: "Mauzo, stock, madeni na matumizi", en: "Sales, stock, debts, and expenses" },
  { sw: "Imejengwa kwa maduka Tanzania", en: "Built for Tanzanian shops" },
];

const publicNav = [
  { href: "/pricing", sw: "Bei", en: "Pricing" },
  { href: "/catalog", sw: "Catalog", en: "Catalog" },
  { href: "/help", sw: "Msaada", en: "Help" },
  { href: "/contact", sw: "Mawasiliano", en: "Contact" },
  { href: "/about", sw: "Kuhusu", en: "About" },
  { href: "/demo", sw: "Demo", en: "Demo" },
];

type View = "login" | "register" | "forgot";

export function LoginPageContent({ initialView = "login" }: { initialView?: View }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = useLang();
  const [view, setView] = useState<View>(initialView);

  // Login / Register fields
  const [phone, setPhone] = useState(TANZANIA_PREFIX);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [shopDistrict, setShopDistrict] = useState("");
  const [shopCategory, setShopCategory] = useState("general");
  const [role, setRole] = useState<"MERCHANT" | "SUPPLIER">("MERCHANT");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // PIN recovery fields
  const [forgotPhone, setForgotPhone] = useState(TANZANIA_PREFIX);
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPin, setForgotNewPin] = useState("");
  const [forgotStep, setForgotStep] = useState<"phone" | "code">("phone");
  const [forgotMsg, setForgotMsg] = useState("");

  useEffect(() => {
    if (initialView !== "login") {
      return;
    }

    const requestedView = searchParams.get("view");
    if (requestedView === "register" || requestedView === "forgot") {
      setView(requestedView);
    }
  }, [initialView, searchParams]);

  function resetForms() {
    setError("");
    setForgotMsg("");
    setForgotStep("phone");
    setForgotPhone(TANZANIA_PREFIX);
    setForgotCode("");
    setForgotNewPin("");
  }

  function switchView(v: View) {
    resetForms();
    setView(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const normalizedPhone = normalizePhone(phone);
    const normalizedPin = pin.trim();
    const normalizedName = name.trim();

    if (!isValidPhone(normalizedPhone)) {
      setError(t("auth.error.invalidPhone", lang));
      return;
    }

    if (!isValidPin(normalizedPin)) {
      setError(t("auth.error.invalidPin", lang));
      return;
    }

    if (view === "register" && !normalizedName) {
      setError(t("auth.error.nameRequired", lang));
      return;
    }

    setLoading(true);

    try {
      const endpoint = view === "register" ? "/auth/register" : "/auth/login";
      const body =
        view === "register"
          ? {
              phone: normalizedPhone,
              pin: normalizedPin,
              name: normalizedName,
              role,
              shopName: shopName.trim() || undefined,
              shopLocation: shopLocation.trim() || undefined,
              shopDistrict: shopDistrict.trim() || undefined,
              shopCategory,
              acquisition: getAttribution(),
            }
          : { phone: normalizedPhone, pin: normalizedPin };

      const data = await api.post<{
        user: {
          role: string;
          staff?: {
            permissions?: {
              canSell?: boolean;
              canManageStock?: boolean;
              canManageStaff?: boolean;
              canViewReports?: boolean;
            };
          };
        };
      }>(endpoint, body, lang);

      if (data.user.role === "SUPPLIER") {
        router.push("/supplier");
      } else if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else if (view === "register" && data.user.role === "MERCHANT") {
        router.push("/onboarding");
      } else if (data.user.staff) {
        const permissions = data.user.staff.permissions || {};
        if (permissions.canViewReports) router.push("/dashboard");
        else if (permissions.canSell) router.push("/sales");
        else if (permissions.canManageStock) router.push("/inventory");
        else router.push("/reports");
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? getFriendlyErrorMessage(err.message, lang) : t("auth.error", lang));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotRequest(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setForgotMsg("");
    const normalizedPhone = normalizePhone(forgotPhone);
    if (!isValidPhone(normalizedPhone)) {
      setError(t("auth.error.invalidPhone", lang));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/otp/request", { phone: normalizedPhone }, lang);
      setForgotMsg(lang === "sw" ? "Nambari ya uthibitisho imetumwa kwa simu yako." : "A verification code has been sent to your phone.");
      setForgotStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.error", lang));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const normalizedPhone = normalizePhone(forgotPhone);
    if (!isValidPin(forgotNewPin.trim())) {
      setError(t("auth.error.invalidPin", lang));
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/otp/verify-reset", { phone: normalizedPhone, code: forgotCode.trim(), newPin: forgotNewPin.trim() }, lang);
      setForgotMsg(lang === "sw" ? "PIN imebadilishwa. Ingia na PIN mpya." : "PIN reset successfully. Log in with your new PIN.");
      setTimeout(() => switchView("login"), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.error", lang));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#102a43_0%,#1f6f78_44%,#0c1f33_100%)] px-4 py-3 lg:px-8 lg:py-4">
      <header className="sticky top-3 z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 rounded-2xl border border-white/15 bg-[#163d5c]/90 p-3 text-white shadow-xl shadow-black/15 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/logo/uzuriliving-logo.svg"
            alt="Uzuri Living"
            width={40}
            height={40}
            className="h-10 w-10 rounded-xl bg-white/10 shadow-sm ring-1 ring-white/20"
          />
          <div>
            <p className="text-sm font-bold leading-tight">Uzuri Living</p>
            <p className="text-xs text-brand-100">Merchant OS - Tanzania</p>
          </div>
        </Link>

        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex rounded-xl bg-white/10 p-1 text-sm font-semibold text-brand-50">
            {publicNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="min-h-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-center transition-colors hover:bg-white/15 hover:text-white md:px-3"
              >
                {lang === "sw" ? item.sw : item.en}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1">
              <button
                type="button"
                onClick={() => setAppLanguage("sw")}
                className={clsx(
                  "min-h-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
                  lang === "sw" ? "bg-white text-brand-800 shadow-sm" : "text-brand-50 hover:bg-white/10"
                )}
              >
                SW
              </button>
              <button
                type="button"
                onClick={() => setAppLanguage("en")}
                className={clsx(
                  "min-h-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors",
                  lang === "en" ? "bg-white text-brand-800 shadow-sm" : "text-brand-50 hover:bg-white/10"
                )}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={() => switchView("register")}
              className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-800 shadow-sm transition-colors hover:bg-brand-50"
            >
              {lang === "sw" ? "Anza bure" : "Start free"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setAppLanguage(lang === "sw" ? "en" : "sw")}
            className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-white/10 px-2 text-xs font-bold text-white hover:bg-white/15"
            aria-label={lang === "sw" ? "Change language to English" : "Badilisha lugha kuwa Kiswahili"}
          >
            {lang === "sw" ? "EN" : "SW"}
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-800 shadow-sm"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileNavOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-white/15 bg-[#163d5c] p-3 shadow-xl md:hidden">
            <nav className="grid grid-cols-2 gap-1 text-sm font-semibold text-brand-50">
              {publicNav.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)} className="rounded-lg px-3 py-3 hover:bg-white/15">
                  {lang === "sw" ? item.sw : item.en}
                </Link>
              ))}
            </nav>
            <button type="button" onClick={() => { setMobileNavOpen(false); switchView("register"); }} className="mt-3 min-h-11 w-full rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-800">
              {lang === "sw" ? "Anza bure" : "Start free"}
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-7 py-6 lg:grid-cols-[1.08fr_420px] lg:gap-8 lg:py-8">
        <section className="text-white">
          <div className="hidden items-center gap-3 lg:flex">
            <LogoMark className="h-12 w-12 rounded-2xl bg-white shadow-lg" />
            <div>
              <p className="text-2xl font-bold tracking-tight">
                <TextReveal text="Uzuri Living" hoverColor="#dcfce7" staggerDelay={18} />
              </p>
              <p className="text-sm font-medium text-brand-100">Merchant OS - Tanzania</p>
            </div>
          </div>

          <div className="mt-5 max-w-2xl lg:mt-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200/30 bg-amber-100 px-3 py-1.5 text-xs font-bold uppercase tracking-normal text-[#713f12] shadow-sm">
              <BadgeDollarSign className="h-4 w-4" />
              {lang === "sw" ? "AI assistant ya duka" : "AI shop assistant"}
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
              {lang === "sw"
                ? "Mfumo wa duka kwenye simu."
                : "Your shop system on your phone."}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-brand-50 sm:text-lg">
              {lang === "sw"
                ? "Uzuri Living husaidia wafanyabiashara Tanzania kujua bidhaa zilizobaki, faida ya leo, madeni ya wateja na muda wa kuagiza tena kwa Kiswahili."
                : "Uzuri Living helps Tanzanian merchants track what is in stock, today's profit, customer debts, and when to reorder in Swahili or English."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {heroProofPoints.map((point) => (
              <span
                key={point.en}
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-brand-50"
              >
                {lang === "sw" ? point.sw : point.en}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              onClick={() => trackMarketingEvent("registration_started", { placement: "hero" })}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-brand-800 shadow-lg shadow-black/10 transition-colors hover:bg-brand-50"
            >
              {lang === "sw" ? "Anza bure siku 14" : "Start free for 14 days"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <WhatsAppCTA intent="setup" variant="light" />
          </div>

          <div className="mt-8 hidden max-w-2xl gap-3 sm:grid sm:grid-cols-3">
            {heroFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.en} className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                  <Icon className="h-5 w-5 text-brand-100" />
                  <p className="mt-3 text-sm font-semibold leading-5 text-white">
                    {lang === "sw" ? feature.sw : feature.en}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 hidden sm:block">
            <div className="inline-block rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <BadgeDollarSign className="h-5 w-5 text-brand-100" />
              <p className="mt-3 text-sm font-bold text-white">TZS 15,000/month</p>
              <p className="mt-1 text-xs leading-5 text-brand-100">
                {lang === "sw" ? "Baada ya jaribio la bure." : "After the free trial."}
              </p>
            </div>
          </div>
        </section>

        <div className="w-full max-w-sm justify-self-center lg:justify-self-end">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* ===== FORGOT PIN VIEW ===== */}
          {view === "forgot" && (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">
                {lang === "sw" ? "Rudisha PIN" : "Reset PIN"}
              </h2>
              <p className="text-gray-500 text-sm mb-5">
                {lang === "sw"
                  ? "Tutakutumia nambari ya uthibitisho kwa simu yako."
                  : "We'll send a verification code to your phone."}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
              )}
              {forgotMsg && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm">{forgotMsg}</div>
              )}

              {forgotStep === "phone" ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.phone", lang)}</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={forgotPhone}
                        onChange={(e) => setForgotPhone(withTanzaniaPrefix(e.target.value))}
                        placeholder="+255 7XX XXX XXX or +country code"
                        className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? "..." : lang === "sw" ? "Tuma Nambari" : "Send Code"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotReset} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {lang === "sw" ? "Nambari ya Uthibitisho (SMS)" : "Verification Code (SMS)"}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={forgotCode}
                      onChange={(e) => setForgotCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {lang === "sw" ? "PIN Mpya" : "New PIN"}
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={forgotNewPin}
                      onChange={(e) => setForgotNewPin(e.target.value)}
                      placeholder="PIN"
                      maxLength={8}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {loading ? "..." : lang === "sw" ? "Badilisha PIN" : "Reset PIN"}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setForgotStep("phone")}
                    className="w-full text-gray-500 text-sm hover:underline min-h-0"
                  >
                    {lang === "sw" ? "Tuma tena nambari" : "Resend code"}
                  </button>
                </form>
              )}

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => switchView("login")}
                  className="text-brand-600 text-sm hover:underline min-h-0"
                >
                  {lang === "sw" ? "Rudi kwenye kuingia" : "Back to login"}
                </button>
              </div>
            </>
          )}

          {/* ===== LOGIN / REGISTER VIEW ===== */}
          {view !== "forgot" && (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">
                {view === "register" ? t("auth.register", lang) : t("auth.welcome", lang)}
              </h2>
              <p className="text-gray-500 text-sm mb-6">
                {view === "register" ? t("auth.createAccount", lang) : t("auth.enterShop", lang)}
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {view === "register" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.yourName", lang)}</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Mama Amina"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.iAm", lang)}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setRole("MERCHANT")}
                          className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                            role === "MERCHANT"
                              ? "bg-brand-600 text-white border-brand-600"
                              : "bg-white text-gray-600 border-gray-300"
                          }`}
                        >
                          {t("app.merchant", lang)}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRole("SUPPLIER")}
                          className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                            role === "SUPPLIER"
                              ? "bg-brand-600 text-white border-brand-600"
                              : "bg-white text-gray-600 border-gray-300"
                          }`}
                        >
                          {t("app.supplier", lang)}
                        </button>
                      </div>
                    </div>

                    {role === "MERCHANT" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.shopName", lang)}</label>
                          <input
                            type="text"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="Duka la Amina"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {lang === "sw" ? "Jiji / Mji" : "City / Town"}
                          </label>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={shopLocation}
                              onChange={(e) => setShopLocation(e.target.value)}
                              placeholder="Dar es Salaam"
                              className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {lang === "sw" ? "Mtaa / Wilaya (hiari)" : "District / Area (optional)"}
                          </label>
                          <input
                            type="text"
                            value={shopDistrict}
                            onChange={(e) => setShopDistrict(e.target.value)}
                            placeholder="Kariakoo"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            {lang === "sw" ? "Aina ya Biashara" : "Shop Category"}
                          </label>
                          <div className="relative">
                            <select
                              value={shopCategory}
                              onChange={(e) => setShopCategory(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none bg-white"
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
                      </>
                    )}
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.phone", lang)}</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(withTanzaniaPrefix(e.target.value))}
                      placeholder="+255 7XX XXX XXX or +country code"
                      autoComplete="tel"
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.pin", lang)}</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="PIN"
                      maxLength={8}
                      inputMode="numeric"
                      autoComplete={view === "register" ? "new-password" : "current-password"}
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      aria-label={showPin ? "Hide PIN" : "Show PIN"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 min-h-0"
                    >
                      {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? t("auth.loading", lang) : view === "register" ? t("auth.register", lang) : t("auth.login", lang)}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              <div className="mt-4 space-y-2 text-center">
                <button
                  type="button"
                  onClick={() => switchView(view === "register" ? "login" : "register")}
                  className="text-brand-600 text-sm hover:underline min-h-0 block w-full"
                >
                  {view === "register" ? t("auth.haveAccount", lang) : t("auth.noAccount", lang)}
                </button>
                {view === "login" && (
                  <button
                    type="button"
                    onClick={() => switchView("forgot")}
                    className="text-gray-400 text-sm hover:text-brand-600 hover:underline min-h-0 block w-full"
                  >
                    {lang === "sw" ? "Umesahau PIN?" : "Forgot PIN?"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <Link
          href="/catalog"
          className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm font-semibold py-3 rounded-xl transition-colors"
        >
          <Store className="w-4 h-4" />
          {t("catalog.browse", lang)}
        </Link>

        <Link
          href="/pricing"
          className="mt-2 w-full inline-flex items-center justify-center gap-2 text-brand-200 hover:text-white text-sm py-2 transition-colors"
        >
          {lang === "sw" ? "Ona bei zetu ->" : "View pricing ->"}
        </Link>

        <p className="text-center text-brand-200 text-xs mt-4">
          Uzuri Living - Kujenga biashara Tanzania
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3 text-xs text-brand-200">
          <Link href="/about" className="hover:text-white">{lang === "sw" ? "Kuhusu" : "About"}</Link>
          <Link href="/pricing" className="hover:text-white">{lang === "sw" ? "Bei" : "Pricing"}</Link>
          <Link href="/contact" className="hover:text-white">{lang === "sw" ? "Mawasiliano" : "Contact"}</Link>
          <Link href="/help" className="hover:text-white">{lang === "sw" ? "Msaada" : "Help"}</Link>
          <Link href="/demo" className="hover:text-white">{lang === "sw" ? "Demo" : "Demo"}</Link>
          <Link href="/terms" className="hover:text-white">{lang === "sw" ? "Masharti" : "Terms"}</Link>
          <Link href="/privacy" className="hover:text-white">{lang === "sw" ? "Faragha" : "Privacy"}</Link>
        </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
