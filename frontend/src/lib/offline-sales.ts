export const PENDING_SALES_STORAGE_KEY = "uzuriliving_pending_sales";

/** Count locally queued sales that have not yet reached the server. */
export function getPendingOfflineSalesCount(shopId: string | null | undefined): number {
  if (typeof window === "undefined" || !shopId) return 0;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(`${PENDING_SALES_STORAGE_KEY}:${shopId}`) || "[]");
    if (!Array.isArray(value)) return 0;
    return value.filter((sale) => sale && typeof sale === "object" && typeof sale.id === "string" && sale.payload && typeof sale.payload === "object").length;
  } catch {
    return 0;
  }
}
