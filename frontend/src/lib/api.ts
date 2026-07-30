import { t, type Lang } from "@/lib/i18n";

const PROD_API_URL = "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api";
const REQUEST_TIMEOUT_MS = 20000;

function normalizeBaseUrl(url: string): string {
  const normalized = url.trim().replace(/\n/g, "").replace(/\/$/, "");
  return normalized;
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL);
  }

  if (typeof window !== "undefined" && window.location.hostname !== "localhost") return PROD_API_URL;
  return normalizeBaseUrl("http://localhost:4000/api");
}

export function getFriendlyErrorMessage(message: string, lang: Lang): string {
  const normalized = message.trim();

  if (normalized === "Invalid phone or PIN") {
    return t("auth.error.invalidCredentials", lang);
  }

  if (normalized === "Session expired") {
    return t("auth.error.sessionExpired", lang);
  }

  if (normalized.includes("Too many authentication attempts")) {
    return t("auth.error.rateLimited", lang);
  }

  if (normalized === "Unable to reach the Uzuri Living server. Confirm the API URL is correct and the backend is online.") {
    return t("auth.error.serverOffline", lang);
  }

  if (normalized === "The Uzuri Living server took too long to respond. Please try again.") {
    return t("auth.error.serverTimeout", lang);
  }

  if (normalized === "The Uzuri Living server returned an unexpected response format.") {
    return t("auth.error.unexpectedResponse", lang);
  }

  if (normalized === "Subscription required" || normalized === "SUBSCRIPTION_REQUIRED") {
    return t("billing.subscriptionRequired", lang);
  }

  if (normalized === "Pro plan required" || normalized === "PLAN_UPGRADE_REQUIRED" || normalized.includes("requires Uzuri Living Pro")) {
    return lang === "sw" ? "Sehemu hii inahitaji mpango wa Uzuri Living Pro." : "This feature requires the Uzuri Living Pro plan.";
  }

  return normalized;
}

let refreshingPromise: Promise<boolean> | null = null;
let authFailureHandled = false;

function handleAuthenticationFailure() {
  if (typeof window !== "undefined" && !authFailureHandled) {
    authFailureHandled = true;
    window.location.href = "/";
  }
}

async function tryRefreshToken(): Promise<boolean> {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const baseUrl = getBaseUrl();
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return false;
      return true;
    } catch {
      return false;
    } finally {
      refreshingPromise = null;
    }
  })();

  return refreshingPromise;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  lang: Lang = "en",
  _isRetry = false
): Promise<T> {
  const baseUrl = getBaseUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    res = await fetch(`${baseUrl}${path}`, { ...options, headers, credentials: "include", signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The Uzuri Living server took too long to respond. Please try again.");
    }
    throw new Error("Unable to reach the Uzuri Living server. Confirm the API URL is correct and the backend is online.");
  } finally {
    clearTimeout(timeoutId);
  }

  // Login, registration, and recovery requests must surface their own 401
  // response. Only an already-authenticated request should try refreshing a
  // session; otherwise a wrong PIN looks like a silent redirect/reload.
  const isAuthenticationRequest = path.startsWith("/auth/");
  if (res.status === 401 && !_isRetry && !isAuthenticationRequest) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request<T>(path, options, lang, true);
    }
    handleAuthenticationFailure();
    throw new Error("Session expired");
  }

  if (res.status === 401 && !isAuthenticationRequest) {
    handleAuthenticationFailure();
    throw new Error("Session expired");
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const rawMessage =
      typeof payload === "string"
        ? payload || `Request failed with status ${res.status}`
        : payload?.error || `Request failed with status ${res.status}`;

    throw new Error(getFriendlyErrorMessage(rawMessage, lang));
  }

  if (!isJson) {
    throw new Error("The Uzuri Living server returned an unexpected response format.");
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, lang?: Lang) => request<T>(path, {}, lang),
  post: <T>(path: string, body: unknown, lang?: Lang) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }, lang),
  patch: <T>(path: string, body: unknown, lang?: Lang) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }, lang),
  delete: <T>(path: string, lang?: Lang) => request<T>(path, { method: "DELETE" }, lang),
};

export async function downloadFile(path: string, filename: string, lang: Lang = "en") {
  const headers: Record<string, string> = {};

  const res = await fetch(`${getBaseUrl()}${path}`, { headers, credentials: "include" });
  if (!res.ok) {
    const payload = await res.text();
    throw new Error(getFriendlyErrorMessage(payload || `Request failed with status ${res.status}`, lang));
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function setToken(_token?: string) {
  authFailureHandled = false;
  // Kept as a compatibility no-op for older callers. Authentication lives in
  // Secure, HttpOnly cookies and no access token is stored in browser script.
}

export function clearToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("uzuriliving_token");
  }
}

export function formatTZS(amount: number): string {
  return `TZS ${Number(amount).toLocaleString("en-TZ")}`;
}
