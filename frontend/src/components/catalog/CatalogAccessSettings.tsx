"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Lang } from "@/lib/i18n";

type AccessSettings = { enabled: boolean; retailConfigured: boolean; wholesaleConfigured: boolean };

export default function CatalogAccessSettings({ shopId, lang }: { shopId: string; lang: Lang }) {
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [retail, setRetail] = useState("");
  const [retailConfirm, setRetailConfirm] = useState("");
  const [wholesale, setWholesale] = useState("");
  const [wholesaleConfirm, setWholesaleConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const sw = lang === "sw";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<{ settings: AccessSettings }>("/settings/catalog-access", lang);
      setSettings(result.settings);
    } catch {
      setError(sw ? "Haikuwezekana kupata mipangilio ya catalog. Jaribu tena." : "Could not load catalogue access settings. Please try again.");
    } finally { setLoading(false); }
  }

  useEffect(() => { setOrigin(window.location.origin); void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function savePasswords(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (!retail && !wholesale) { setError(sw ? "Weka password angalau moja." : "Enter at least one password to update."); return; }
    if (retail !== retailConfirm || wholesale !== wholesaleConfirm) { setError(sw ? "Password na uthibitisho hazifanani." : "The password confirmations do not match."); return; }
    if ((retail && retail.trim().length < 10) || (wholesale && wholesale.trim().length < 10)) { setError(sw ? "Kila password iwe na angalau herufi 10." : "Each password must contain at least 10 characters."); return; }
    if (retail && wholesale && retail === wholesale) { setError(sw ? "Password za rejareja na jumla lazima ziwe tofauti." : "Retail and wholesale passwords must be different."); return; }
    setSaving(true);
    try {
      const data = await api.patch<{ settings: AccessSettings }>("/settings/catalog-access", { ...(retail ? { retailPassword: retail } : {}), ...(wholesale ? { wholesalePassword: wholesale } : {}) }, lang);
      setSettings(data.settings);
      setRetail(""); setRetailConfirm(""); setWholesale(""); setWholesaleConfirm("");
      setMessage(sw ? "Password zimehifadhiwa. Wateja wa aina iliyobadilishwa wataingia tena." : "Passwords saved. Customers whose password changed will need to sign in again.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save passwords"); }
    finally { setSaving(false); }
  }

  async function setEnabled(enabled: boolean) {
    if (!enabled && !window.confirm(sw ? "Ukizima ulinzi, bei zote za rejareja na jumla zitaonekana hadharani na maagizo ya catalog yataruhusiwa tena. Uko tayari?" : "Turning protection off makes retail and wholesale prices public again and re-enables catalogue ordering. Continue?")) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const data = await api.patch<{ settings: AccessSettings }>("/settings/catalog-access", { enabled, ...(!enabled ? { confirmPublicExposure: true } : {}) }, lang);
      setSettings(data.settings);
      setMessage(enabled ? (sw ? "Ulinzi wa bei umewashwa." : "Catalogue price protection is on.") : (sw ? "Ulinzi wa bei umezimwa." : "Catalogue price protection is off."));
    } catch (err) { setError(err instanceof Error ? err.message : "Could not update catalogue access"); }
    finally { setSaving(false); }
  }

  if (loading) return <p className="text-sm text-gray-500">{sw ? "Inapakia mipangilio..." : "Loading catalogue settings..."}</p>;
  if (!settings) return <div role="alert" className="space-y-2 text-sm text-red-700"><p>{error}</p><button type="button" onClick={() => void load()} className="font-semibold underline">{sw ? "Jaribu tena" : "Try again"}</button></div>;
  const ready = settings.retailConfigured && settings.wholesaleConfigured;
  const link = (tier: string) => `${origin}/catalog/${encodeURIComponent(shopId)}?tier=${tier}`;
  async function copyLink(tier: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link(tier));
      setError("");
      setMessage(sw ? "Link imenakiliwa. Tuma password tofauti na link." : "Link copied. Send the password separately.");
    } catch {
      setError(sw ? "Haikuwezekana kunakili. Bonyeza link kwa muda ili kuinakili." : "Could not copy the link. Press and hold the link to copy it.");
    }
  }
  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500";
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">{sw ? "Weka password tofauti za wateja wa rejareja na jumla. Wataona bei zao tu; hawataweza kuagiza au kutumia sehemu za ndani za duka." : "Set separate shared passwords for retail and wholesale customers. They can view only their own prices; they cannot place catalogue orders or access shop tools."}</p>
      <div className={`rounded-lg border p-3 text-sm ${settings.enabled ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`} role="status">
        {settings.enabled ? (sw ? "Ulinzi wa bei umewashwa." : "Price protection is on.") : (sw ? "Ulinzi bado haujawashwa: bei za catalog ya umma zinaonekana kwa wote." : "Protection is not enabled: published catalogue prices remain public." )}
      </div>
      <p className="text-xs leading-5 text-gray-600">{sw ? "Password haziwezi kuonyeshwa baada ya kuhifadhiwa. Zihifadhi salama na uzitume tofauti na link. Ukibadilisha password, wateja wa kundi hilo wataingia tena." : "Passwords cannot be shown after saving. Keep them safe and share each password separately from its link. Changing one signs that customer group out."}</p>
      <form onSubmit={savePasswords} className="space-y-4">
        {([
          ["retail", sw ? "Rejareja" : "Retail", retail, setRetail, retailConfirm, setRetailConfirm, settings.retailConfigured],
          ["wholesale", sw ? "Jumla" : "Wholesale", wholesale, setWholesale, wholesaleConfirm, setWholesaleConfirm, settings.wholesaleConfigured],
        ] as const).map(([id, label, value, setValue, confirmation, setConfirmation, configured]) => (
          <fieldset key={id} className="space-y-2 rounded-lg border border-gray-200 p-3">
            <legend className="px-1 text-sm font-semibold text-gray-800">{label} {configured && <span className="text-xs font-normal text-green-700">{sw ? "· imewekwa" : "· password set"}</span>}</legend>
            <label htmlFor={`${id}-catalog-password`} className="block text-xs font-medium text-gray-600">{configured ? (sw ? "Password mpya (si lazima)" : "New password (optional)") : (sw ? "Password" : "Password")}</label>
            <input id={`${id}-catalog-password`} type="password" autoComplete="new-password" value={value} onChange={(event) => setValue(event.target.value)} maxLength={72} className={inputClass} />
            <label htmlFor={`${id}-catalog-confirm`} className="block text-xs font-medium text-gray-600">{sw ? "Thibitisha password" : "Confirm password"}</label>
            <input id={`${id}-catalog-confirm`} type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} maxLength={72} className={inputClass} />
          </fieldset>
        ))}
        <button type="submit" disabled={saving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "..." : (sw ? "Hifadhi password" : "Save passwords")}</button>
      </form>
      <div className="space-y-2 border-t border-gray-100 pt-3">
        {!settings.enabled && <p className="text-xs leading-5 text-gray-600">{sw ? "Washa baada ya kuweka password zote mbili. Bidhaa zitaendelea kuonekana bila bei kwa sasa; kuagiza kupitia catalog kutazimwa." : "After setting both passwords, turn protection on. Products remain visible without prices for now, and catalogue ordering is disabled."}</p>}
        <button type="button" disabled={saving || (!settings.enabled && !ready)} onClick={() => void setEnabled(!settings.enabled)} className="rounded-lg border border-brand-300 bg-white px-4 py-2 text-sm font-semibold text-brand-800 disabled:opacity-50">
          {settings.enabled ? (sw ? "Zima ulinzi" : "Turn protection off") : (sw ? "Washa ulinzi wa bei" : "Turn on price protection")}
        </button>
      </div>
      {settings.enabled && origin && <div className="space-y-3 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-600">{sw ? "Tuma link husika na password yake tofauti." : "Share the appropriate link and send its password separately."}</p>
        {([['retail', sw ? 'Link ya rejareja' : 'Retail link'], ['wholesale', sw ? 'Link ya jumla' : 'Wholesale link']] as const).map(([tier, label]) => (
          <div key={tier}><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold text-gray-700">{label}</p><button type="button" onClick={() => void copyLink(tier)} className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-brand-700">{sw ? `Nakili ${tier === 'retail' ? 'ya rejareja' : 'ya jumla'}` : `Copy ${tier} link`}</button></div><a href={link(tier)} target="_blank" rel="noreferrer" className="break-all text-xs text-brand-700 underline">{link(tier)}</a></div>
        ))}
      </div>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
