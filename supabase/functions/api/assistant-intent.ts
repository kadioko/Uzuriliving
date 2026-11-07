export type AssistantIntent = "sales" | "stock" | "debts" | "expenses" | "purchases";
export type AssistantPeriod = "today" | "month" | "current" | "all";

export function assistantRequiredPermissions(intent: AssistantIntent): string[] {
  if (intent === "stock") return ["canManageStock"];
  if (intent === "debts") return ["canViewReports", "canSell"];
  if (intent === "expenses") return ["canRecordExpenses"];
  if (intent === "purchases") return ["canViewReports"];
  return ["canViewReports"];
}

export function assistantActionRequiredPermissions(actionKey: string): string[] {
  if (actionKey.startsWith("stock-") || actionKey === "orders") return ["canManageStock"];
  if (actionKey === "debt") return ["canSell"];
  if (actionKey === "expenses") return ["canRecordExpenses"];
  if (actionKey === "net-profit") return ["canViewReports", "canRecordExpenses"];
  return ["canViewReports"];
}

export function estimateStockCover(currentStock: number, incoming: number, today: string, sales: Array<{ date: string; quantity: number }>) {
  const ordinal = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) / 86400000 : NaN;
  const todayDay = ordinal(today);
  const valid = sales.filter((sale) => Number.isFinite(sale.quantity) && sale.quantity > 0 && Number.isFinite(ordinal(sale.date)) && ordinal(sale.date) <= todayDay && ordinal(sale.date) >= todayDay - 27);
  const activeDays = new Set(valid.map((sale) => sale.date)).size;
  const firstDay = valid.reduce((first, sale) => Math.min(first, ordinal(sale.date)), todayDay);
  const observedDays = valid.length ? todayDay - firstDay + 1 : 0;
  const units = valid.reduce((total, sale) => total + sale.quantity, 0);
  if (!Number.isFinite(todayDay) || observedDays < 14 || activeDays < 7 || units <= 0) return null;
  const dailyRate = units / observedDays;
  const availableWithIncoming = Math.max(0, currentStock) + Math.max(0, incoming);
  return {
    observedDays,
    activeDays,
    daysOfCover: Math.round(availableWithIncoming / dailyRate * 10) / 10,
    suggestedAdditionalUnits: Math.max(0, Math.ceil(dailyRate * 14 - availableWithIncoming)),
  };
}

// This is deliberately a bounded intent router, not a general-purpose LLM.
// Refuse unsupported periods and mixed questions instead of guessing.
export function parseAssistantQuestion(question: string): { intent: AssistantIntent; period: AssistantPeriod } | null {
  const text = question.toLocaleLowerCase().trim();
  if (!text || text.length > 250) return null;
  const topics: Array<[AssistantIntent, RegExp]> = [
    ["purchases", /\b(purchases?|purchased|manunuzi)\b/],
    ["sales", /\b(sales?|revenue|mauzo)\b/],
    ["stock", /\b(stock|inventory|products?|bidhaa|reorder|restock|kuagiza)\b/],
    ["debts", /\b(debts?|owed|owe|madeni|deni|nadai)\b/],
    ["expenses", /\b(expenses?|costs?|matumizi|gharama)\b/],
  ];
  if (/\b(profit|faida|supplier|msambazaji|refunds?|returns?|marejesho)\b/.test(text)) return null;
  const matches = topics.filter(([, pattern]) => pattern.test(text));
  if (matches.length !== 1) return null;
  const today = /\b(today|leo)\b/.test(text);
  const month = /\b(this month|mwezi huu)\b/.test(text);
  const allTime = /\b(all time|lifetime)\b/.test(text);
  if (Number(today) + Number(month) + Number(allTime) > 1) return null;
  if (/\b(yesterday|jana|juzi|kesho|tomorrow|last|previous|past|ago|week|wiki|year|mwaka|quarter|custom|between|from|mpaka|uliopita|iliyopita|ever|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b|\d/.test(text)) return null;
  if (/\b(month|mwezi)\b/.test(text) && !month) return null;
  const intent = matches[0][0];
  if (intent === "purchases") return month ? { intent, period: "month" } : allTime ? { intent, period: "all" } : null;
  if (intent === "stock" || intent === "debts") return month ? null : { intent, period: "current" };
  if (allTime || (!today && !month)) return null;
  return { intent, period: month ? "month" : "today" };
}
