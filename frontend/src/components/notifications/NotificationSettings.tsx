"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Check, LoaderCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useLang } from "@/lib/i18n";

type Preferences = { lowStock: boolean; debtDue: boolean; subscriptionExpiry: boolean; dailyAssistant: boolean };
const DEVICE_ID_KEY = "uzuriliving_push_device_id";

function deviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function deviceLabel() {
  const agent = navigator.userAgent;
  if (/android/i.test(agent)) return "Android phone";
  if (/iphone|ipad/i.test(agent)) return "Apple device";
  return "Browser device";
}

function base64UrlToUint8Array(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default function NotificationSettings({ owner }: { owner: boolean }) {
  const lang = useLang();
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const canPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setSupported(canPush);
    api.get<{ preferences: Preferences; subscriptions: Array<{ deviceId: string; isActive: boolean }>; pushConfigured: boolean }>("/push/preferences")
      .then((data) => {
        setPreferences(data.preferences);
        setConfigured(data.pushConfigured);
        setSubscribed(data.subscriptions.some((subscription) => subscription.deviceId === deviceId() && subscription.isActive));
      })
      .catch(() => {});
  }, []);

  async function enable() {
    if (!supported) return;
    setSaving(true);
    setMessage("");
    try {
      const config = await api.get<{ enabled: boolean; publicKey: string | null }>("/push/config");
      if (!config.enabled || !config.publicKey) {
        setConfigured(false);
        setMessage(lang === "sw" ? "Alerts za push bado zinaandaliwa. Tumia taarifa za ndani ya app kwa sasa." : "Push alerts are being prepared. In-app alerts are available now.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(lang === "sw" ? "Ruhusu notifications kwenye browser ili kupokea alerts." : "Allow notifications in your browser to receive alerts.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(config.publicKey) });
      const json = subscription.toJSON();
      await api.post("/push/subscribe", { endpoint: json.endpoint, keys: json.keys, deviceId: deviceId(), deviceLabel: deviceLabel() });
      setSubscribed(true);
      setConfigured(true);
      setMessage(lang === "sw" ? "Alerts za kifaa hiki zimewashwa." : "Alerts are enabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to enable alerts");
    } finally { setSaving(false); }
  }

  async function disable() {
    setSaving(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await api.post("/push/unsubscribe", { deviceId: deviceId() });
      setSubscribed(false);
      setMessage(lang === "sw" ? "Alerts za kifaa hiki zimezimwa." : "Alerts are disabled on this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to disable alerts");
    } finally { setSaving(false); }
  }

  async function togglePreference(key: keyof Preferences) {
    if (!preferences || !owner) return;
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    try { await api.patch("/push/preferences", { [key]: next[key] }); }
    catch { setPreferences(preferences); }
  }

  const labels: Array<[keyof Preferences, string, string]> = [
    ["lowStock", "Low stock", "Stock ndogo"],
    ["debtDue", "Debt due", "Madeni yanayodaiwa"],
    ["subscriptionExpiry", "Plan expiry", "Mpango unaisha"],
    ["dailyAssistant", "Daily AI priority", "Kipaumbele cha AI kila siku"],
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800">{lang === "sw" ? "Alerts za duka" : "Shop alerts"}</p>
          <p className="mt-0.5 text-xs leading-5 text-gray-500">{lang === "sw" ? "Arifa za stock, madeni, mpango na kipaumbele cha AI kwenye kifaa hiki." : "Stock, debt, plan, and AI-priority alerts on this device."}</p>
        </div>
        <button type="button" onClick={subscribed ? disable : enable} disabled={saving || !supported} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
          {subscribed ? (lang === "sw" ? "Zima" : "Disable") : (lang === "sw" ? "Washa" : "Enable")}
        </button>
      </div>
      {!supported && <p className="text-xs text-amber-700">{lang === "sw" ? "Browser hii haiungi mkono alerts za push." : "This browser does not support push alerts."}</p>}
      {!configured && <p className="text-xs text-gray-500">{lang === "sw" ? "Push delivery itawashwa baada ya Uzuri Living kusanidi huduma ya notifications." : "Push delivery will become available after Uzuri Living configures the notification service."}</p>}
      {message && <p className="flex items-center gap-1.5 text-xs text-brand-700"><Check className="h-3.5 w-3.5" />{message}</p>}
      {owner && preferences && <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {labels.map(([key, en, sw]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm text-gray-700">
          <span>{lang === "sw" ? sw : en}</span>
          <input type="checkbox" checked={preferences[key]} onChange={() => togglePreference(key)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
        </label>)}
      </div>}
    </div>
  );
}
