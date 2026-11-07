export type AssistantIntent =
  | "sales"
  | "stock"
  | "debts"
  | "expenses"
  | "purchases"
  | "collections"
  | "payment_breakdown"
  | "top_products"
  | "top_supplier";

export type AssistantPeriod =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "this_week"
  | "last_week"
  | "month"
  | "last_month"
  | "year"
  | "all"
  | "current"
  | "custom";

export type AssistantComparison = "last_week" | "last_month";
export type ParsedAssistantQuestion = {
  intent: AssistantIntent;
  period: AssistantPeriod;
  compareTo?: AssistantComparison;
  fromDate?: string;
  toDate?: string;
};

export function assistantRequiredPermissions(intent: AssistantIntent): string[] {
  if (intent === "stock") return ["canViewInventoryAndPrices"];
  if (intent === "debts" || intent === "collections") return ["canViewReports", "canSell"];
  if (intent === "expenses") return ["canRecordExpenses"];
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

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// This is a bounded intent router, not a general-purpose LLM. It only emits
// supported, typed queries; date arithmetic and database access stay server-side.
export function parseAssistantQuestion(question: string): ParsedAssistantQuestion | null {
  const text = question.toLocaleLowerCase().trim();
  if (!text || text.length > 250) return null;
  if (/\b(?:in|for|during|since)\s+20\d{2}\b/.test(text) && !/\d{4}-\d{2}-\d{2}/.test(text)) return null;

  const range = text.match(/\b(?:between|from|kuanzia)?\s*(\d{4}-\d{2}-\d{2})\s+(?:and|to|through|mpaka|hadi)\s+(\d{4}-\d{2}-\d{2})\b/);
  if (range && (!isValidDateKey(range[1]) || !isValidDateKey(range[2]) || range[1] > range[2])) return null;

  const asksForTopProducts = /\b(top|best|most|highest|best-selling|top-selling|bora|zilizouza|zinazouza)\b/.test(text)
    && /\b(products?|items?|bidhaa)\b/.test(text);
  const asksForTopSupplier = /\b(top|best|highest|most|largest|bora|mkuu)\b/.test(text)
    && /\b(suppliers?|vendors?|wasambazaji|msambazaji)\b/.test(text);
  const asksForPaymentBreakdown = /\b(payment methods?|methods of payment|payment breakdown|by payment|how (?:did|was) (?:customers? )?(?:pay|paid)|malipo kwa njia|njia za malipo)\b/.test(text);
  const asksForCollections = /\b(collect|collected|collection|collections|cash collected|money collected|cash received|money received|debt payments?|pesa zilizokusanywa|makusanyo|malipo yaliyopokelewa|nimekusanya)\b/.test(text);

  const flags = {
    sales: /\b(sales?|sell|sells|sold|revenue|mapato|mauzo|niliuza)\b/.test(text),
    expenses: /\b(expenses?|spend(?:ing)?|matumizi|gharama)\b/.test(text),
    debts: /\b(debts?|owed|owe|madeni|deni|nadai)\b/.test(text),
    purchases: /\b(purchases?|purchased|bought|manunuzi|nilinunua)\b/.test(text),
    stock: /\b(stock|inventory|low stock|out of stock|reorder(?:ing)?|restock|kuagiza|bidhaa zilizobaki)\b/.test(text),
  };
  if (asksForTopProducts && (asksForTopSupplier || flags.expenses || flags.debts || flags.purchases || flags.stock)) return null;
  if (asksForTopSupplier && (flags.sales || flags.expenses || flags.debts || flags.stock)) return null;
  if (asksForPaymentBreakdown && (flags.expenses || flags.purchases || flags.stock || asksForTopProducts || asksForTopSupplier)) return null;
  if (asksForCollections && (flags.expenses || flags.purchases || flags.stock || asksForTopProducts || asksForTopSupplier)) return null;

  let intent: AssistantIntent | null = null;
  if (asksForTopProducts) intent = "top_products";
  else if (asksForTopSupplier) intent = "top_supplier";
  else if (asksForPaymentBreakdown) intent = "payment_breakdown";
  else if (asksForCollections) intent = "collections";
  else {
    const topics: Array<[AssistantIntent, keyof typeof flags]> = [
      ["purchases", "purchases"], ["sales", "sales"], ["debts", "debts"], ["expenses", "expenses"], ["stock", "stock"],
    ];
    const matches = topics.filter(([, flag]) => flags[flag]);
    if (matches.length === 1) intent = matches[0][0];
    else return null;
  }

  const comparisonRequested = /\b(compare|compared|versus|vs\.?|against|linganisha|ikilinganishwa)\b/.test(text);
  let compareTo: AssistantComparison | undefined;
  let period: AssistantPeriod | null = null;
  if (range) {
    period = "custom";
  } else if (comparisonRequested) {
    if (/\b(this week|wiki hii)\b/.test(text) && /\b(last week|previous week|wiki iliyopita|wiki iliyotangulia)\b/.test(text)) {
      period = "this_week";
      compareTo = "last_week";
    } else if (/\b(this month|mwezi huu)\b/.test(text) && /\b(last month|previous month|mwezi uliopita|mwezi uliotangulia)\b/.test(text)) {
      period = "month";
      compareTo = "last_month";
    } else return null;
  } else {
    const periods: Array<[AssistantPeriod, RegExp]> = [
      ["today", /\b(today|leo)\b/],
      ["yesterday", /\b(yesterday|jana)\b/],
      ["last_7_days", /\b(last|past|previous) 7 days\b/],
      ["this_week", /\b(this week|wiki hii)\b/],
      ["last_week", /\b(last week|previous week|wiki iliyopita|wiki iliyotangulia)\b/],
      ["month", /\b(this month|mwezi huu)\b/],
      ["last_month", /\b(last month|previous month|mwezi uliopita|mwezi uliotangulia)\b/],
      ["year", /\b(this year|mwaka huu)\b/],
      ["all", /\b(all time|lifetime|ever|muda wote|tangu mwanzo)\b/],
    ];
    const matches = periods.filter(([, pattern]) => pattern.test(text));
    if (matches.length === 1) period = matches[0][0];
    else if (matches.length !== 0) return null;
  }

  if (period === null) period = intent === "stock" || intent === "debts" ? "current" : "month";

  if (period === "custom") {
    if (!range || intent === "stock" || intent === "debts" || /\b(compare|compared|versus|vs\.?|against|last|previous)\b/.test(text)) return null;
    return { intent, period, fromDate: range[1], toDate: range[2] };
  }
  if (period === "last_7_days" && (intent === "stock" || intent === "debts")) return null;
  if (intent === "stock" && period !== "current") return null;
  if (intent === "debts" && period !== "current") return null;
  if (period === "all" && ["collections", "payment_breakdown"].includes(intent)) return null;
  if (compareTo && !["sales", "expenses", "collections", "purchases"].includes(intent)) return null;

  return { intent, period, ...(compareTo ? { compareTo } : {}) };
}
