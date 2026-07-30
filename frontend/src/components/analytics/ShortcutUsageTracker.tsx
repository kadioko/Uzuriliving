"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

const ROUTES = { sale: "/sales", inventory: "/inventory", debts: "/debts" } as const;
const DEVICE_ID_KEY = "uzuriliving_usage_device_id";

function deviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_ID_KEY, id); }
  return id;
}

export default function ShortcutUsageTracker({ merchant }: { merchant: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (!merchant) return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("shortcut") as keyof typeof ROUTES | null;
    if (!action || ROUTES[action] !== pathname) return;
    api.post("/usage-events", { eventName: "android_shortcut_opened", action, route: ROUTES[action], deviceId: deviceId() }).catch(() => {});
  }, [merchant, pathname]);
  return null;
}
