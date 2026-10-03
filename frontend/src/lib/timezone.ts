export const DEFAULT_TIME_ZONE = "Africa/Nairobi";
export const TIME_ZONE_STORAGE_KEY = "uzuriliving_timezone";

export function isValidTimeZone(value: string): boolean {
  if (!value.trim() || value.trim().length > 100) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).format();
    return true;
  } catch {
    return false;
  }
}

export function getDeviceTimeZone(): string {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected && isValidTimeZone(detected) ? detected : DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

export function getAppTimeZone(): string {
  if (typeof window === "undefined") return DEFAULT_TIME_ZONE;
  const stored = window.localStorage.getItem(TIME_ZONE_STORAGE_KEY);
  return stored && isValidTimeZone(stored) ? stored : DEFAULT_TIME_ZONE;
}

export function setAppTimeZone(timeZone: string): void {
  if (typeof window !== "undefined" && isValidTimeZone(timeZone)) {
    window.localStorage.setItem(TIME_ZONE_STORAGE_KEY, timeZone);
  }
}

export function formatAppDateTime(value: string | number | Date, locale = "en-US", options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: getAppTimeZone() }).format(new Date(value));
}

export function formatAppDate(value: string | number | Date, locale = "en-US", options: Intl.DateTimeFormatOptions = {}): string {
  return formatAppDateTime(value, locale, { year: "numeric", month: "short", day: "numeric", ...options });
}

export function formatAppTime(value: string | number | Date, locale = "en-US", options: Intl.DateTimeFormatOptions = {}): string {
  return formatAppDateTime(value, locale, { hour: "2-digit", minute: "2-digit", ...options });
}

export function getAppDateInputValue(value = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: getAppTimeZone(), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function timeZoneOffsetLabel(timeZone: string, value = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(value);
    return parts.find((part) => part.type === "timeZoneName")?.value.replace("GMT", "UTC") || "UTC";
  } catch {
    return "UTC";
  }
}
