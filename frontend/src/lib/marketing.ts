type Attribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  sessionId: string;
};

const ATTRIBUTION_KEY = "uzuriliving_marketing_attribution";
const SESSION_KEY = "uzuriliving_marketing_session";
const MAX_VALUE_LENGTH = 120;

function clean(value: string | null): string | null {
  const trimmed = value?.trim().slice(0, MAX_VALUE_LENGTH) || "";
  return trimmed || null;
}

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const sessionId = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return { source: null, medium: null, campaign: null, content: null, sessionId: "" };

  const params = new URLSearchParams(window.location.search);
  let referrerSource: string | null = null;
  try {
    referrerSource = document.referrer ? clean(new URL(document.referrer).hostname) : null;
  } catch {
    referrerSource = null;
  }
  const incoming = {
    source: clean(params.get("utm_source")) || referrerSource,
    medium: clean(params.get("utm_medium")),
    campaign: clean(params.get("utm_campaign")),
    content: clean(params.get("utm_content")),
  };
  const saved = window.localStorage.getItem(ATTRIBUTION_KEY);
  let previous: Partial<Attribution> | null = null;
  try {
    previous = saved ? JSON.parse(saved) : null;
  } catch {
    window.localStorage.removeItem(ATTRIBUTION_KEY);
  }
  const attribution = {
    source: incoming.source || previous?.source || "direct",
    medium: incoming.medium || previous?.medium || null,
    campaign: incoming.campaign || previous?.campaign || null,
    content: incoming.content || previous?.content || null,
    sessionId: getSessionId(),
  };
  window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  return attribution;
}

export function getAttribution(): Attribution {
  return captureAttribution();
}

export function trackMarketingEvent(eventName: "page_view" | "cta_click" | "whatsapp_click" | "registration_started", details: Record<string, string> = {}) {
  if (typeof window === "undefined") return;
  const attribution = captureAttribution();
  fetch("/_api/public/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ eventName, ...attribution, details }),
  }).catch(() => {});
}
