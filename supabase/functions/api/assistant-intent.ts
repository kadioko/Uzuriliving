export type AssistantIntent =
  | "sales"
  | "sales_collections"
  | "sales_patterns"
  | "sales_target"
  | "performance_drivers"
  | "daily_brief"
  | "gross_profit"
  | "product_profit"
  | "net_profit"
  | "stock"
  | "reorder_risk"
  | "stock_movements"
  | "debts"
  | "debt_aging"
  | "expenses"
  | "purchases"
  | "collections"
  | "payment_breakdown"
  | "top_products"
  | "unsold_products"
  | "product_trends"
  | "supplier_orders"
  | "delivery_differences"
  | "supplier_spend"
  | "top_supplier";

export type AssistantPeriod =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_60_days"
  | "last_90_days"
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
  if (intent === "stock" || intent === "stock_movements") return ["canViewInventoryAndPrices"];
  if (intent === "reorder_risk" || intent === "supplier_orders" || intent === "delivery_differences") return ["canManageStock"];
  if (["top_products", "unsold_products", "product_trends", "product_profit"].includes(intent)) return ["canViewProductPerformance"];
  if (intent === "daily_brief") return [];
  if (intent === "debts" || intent === "debt_aging" || intent === "collections") return ["canViewReports", "canSell"];
  if (intent === "sales_collections") return ["canViewReports", "canSell"];
  if (intent === "performance_drivers") return ["canViewReports", "canRecordExpenses"];
  if (intent === "expenses") return ["canRecordExpenses"];
  if (intent === "net_profit") return ["canViewReports", "canRecordExpenses"];
  return ["canViewReports"];
}

export function assistantActionRequiredPermissions(actionKey: string): string[] {
  if (actionKey.startsWith("stock-") || actionKey === "orders") return ["canManageStock"];
  if (actionKey === "debt") return ["canSell"];
  if (actionKey === "expenses") return ["canRecordExpenses"];
  if (actionKey === "net-profit") return ["canViewReports", "canRecordExpenses"];
  return ["canViewReports"];
}

export function assistantFinancialReconciliation(metrics: Record<string, unknown>) {
  const revenueDifference = Number(metrics.revenueDifference ?? 0);
  const profitDifference = metrics.profitDifference == null ? null : Number(metrics.profitDifference);
  const missingCostSalesRevenue = Number(metrics.missingCostSalesRevenue ?? 0);
  const reconciled = revenueDifference === 0 && (profitDifference === null || profitDifference === 0);
  return {
    revenueDifference: Number.isFinite(revenueDifference) ? revenueDifference : 0,
    profitDifference: profitDifference !== null && Number.isFinite(profitDifference) ? profitDifference : null,
    missingCostSalesRevenue: Number.isFinite(missingCostSalesRevenue) ? missingCostSalesRevenue : 0,
    grossProfitSafe: missingCostSalesRevenue === 0 && profitDifference !== null && reconciled,
    reconciled,
  };
}

export function estimateStockCover(
  currentStock: number,
  incoming: number,
  today: string,
  sales: Array<{ date: string; quantity: number }>,
  settings: {
    leadTimeDays?: number | null;
    safetyDays?: number | null;
    packSize?: number | null;
    availability?: { coverageFrom: string; coverageTo?: string; coverageDays: number; stockoutDays: number; availableDays: number; stockoutDates?: string[] };
  } = {},
) {
  const ordinal = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00Z`) / 86400000 : NaN;
  const todayDay = ordinal(today);
  const availability = settings.availability;
  if (!Number.isFinite(todayDay) || !availability || !Number.isFinite(ordinal(availability.coverageFrom))) return null;
  const stockoutDates = new Set(Array.isArray(availability.stockoutDates) ? availability.stockoutDates : []);
  const valid = sales.filter((sale) => Number.isFinite(sale.quantity) && sale.quantity > 0 && Number.isFinite(ordinal(sale.date)) && ordinal(sale.date) < todayDay && ordinal(sale.date) >= Math.max(todayDay - 28, ordinal(availability.coverageFrom)) && !stockoutDates.has(sale.date));
  const activeDays = new Set(valid.map((sale) => sale.date)).size;
  const observedDays = Math.max(0, Math.min(28, Math.floor(availability.coverageDays)));
  const availableDays = Math.max(0, Math.min(observedDays, Math.floor(availability.availableDays)));
  const stockoutDays = Math.max(0, Math.min(observedDays, Math.floor(availability.stockoutDays)));
  const units = valid.reduce((total, sale) => total + sale.quantity, 0);
  if (!Number.isFinite(observedDays) || availableDays === 0) return null;
  const dailyRate = units / availableDays;
  const availableWithIncoming = Math.max(0, currentStock) + Math.max(0, incoming);
  const hasEnoughHistory = observedDays >= 21 && availableDays >= 14 && activeDays >= 7 && units > 0;
  const leadTimeDays = settings.leadTimeDays;
  const safetyDays = settings.safetyDays;
  const packSize = Number.isInteger(settings.packSize) && Number(settings.packSize) > 0 ? Number(settings.packSize) : 1;
  const hasConfiguredReorderPolicy = Number.isInteger(leadTimeDays) && Number(leadTimeDays) >= 0
    && Number.isInteger(safetyDays) && Number(safetyDays) >= 0;
  const rawAdditionalUnits = hasEnoughHistory && hasConfiguredReorderPolicy
    ? Math.max(0, Math.ceil(dailyRate * (Number(leadTimeDays) + Number(safetyDays)) - availableWithIncoming))
    : null;
  const suggestedOrderQuantity = rawAdditionalUnits === null ? null : Math.ceil(rawAdditionalUnits / packSize) * packSize;
  return {
    observedDays,
    coverageTo: availability.coverageTo ?? null,
    activeDays,
    availabilityDays: availableDays,
    stockoutDays,
    dailyRate: Math.round(dailyRate * 100) / 100,
    hasEnoughHistory,
    hasConfiguredReorderPolicy,
    daysOfCover: dailyRate > 0 ? Math.round(availableWithIncoming / dailyRate * 10) / 10 : null,
    suggestedAdditionalUnits: suggestedOrderQuantity,
    suggestedOrderQuantity,
    leadTimeDays: hasConfiguredReorderPolicy ? Number(leadTimeDays) : null,
    safetyDays: hasConfiguredReorderPolicy ? Number(safetyDays) : null,
    packSize,
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

  const asksForProductTrends = /\b(product trends?|product performance trends?|products?\s+(?:(?:are|have been)\s+)?(?:gaining|growing|slowing|declining)|bidhaa zinazopanda|mwenendo wa bidhaa)\b/.test(text);
  const asksForDailyBrief = /\b(?:what needs? my attention|what should i focus on|what needs? attention|daily (?:shop )?brief|today(?:'s| is) (?:priority|priorities|brief)|what should i do today)\b|\b(?:nini kinahitaji kipaumbele|nifanye nini leo|muhtasari wa leo)\b/.test(text);
  const asksForPerformanceDrivers = /\b(?:what changed|what drove|why (?:did|has|have) (?:sales|revenue|profit) (?:change|go up|go down|increase|decrease)|drivers? of (?:the )?(?:change|growth|decline))\b|\b(?:nini kimebadilika|sababu za mabadiliko|nini kimesababisha mabadiliko)\b/.test(text);
  const asksForProductProfit = /\b(?:which|what|top|best|most profitable)\s+(?:products?|items?)\b.{0,55}\b(?:gross profit|profit|faida)\b|\b(?:gross profit|profit|faida)\b.{0,55}\b(?:by product|per product|products?|bidhaa)\b/.test(text);
  const asksForUnsoldProducts = /\b(?:what|which)\s+(?:(?:products?|items?)\s+)?(?:haven't we sold|have we not sold|didn't we sell|did we not sell|didn't sell|did not sell)\b|\bwhich\s+(?:products?|items?)\s+(?:(?:have|had)\s+)?(?:had\s+)?no\s+(?:recorded\s+)?sales\b|\bwhich\s+(?:products?|items?)\s+(?:have zero|had zero)\s+(?:recorded\s+)?sales\b|\bwhich\s+(?:products?|items?)\s+(?:we\s+)?(?:haven't|have not|didn't|did not|weren't|were not)\s+(?:been\s+)?(?:sold|sell)\b|\b(?:unsold|never sold)\s+(?:products?|items?)\b|\b(?:products?|items?)\s+(?:we\s+)?(?:haven't|have not|didn't|did not)\s+(?:been\s+)?sold\b|\bbidhaa\b.*\b(?:hazijauzwa|hazikuuzwa|hatuzijauza|hazina mauzo)\b/.test(text);
  const asksForReorderRisk = /\b(?:likely|might|could|will|about to)\s+(?:to\s+)?(?:run out|stock out)|\b(?:run out|stock out)\b.{0,55}\b(?:before|until|delivery|arrive|lead time)|\b(?:days? of cover|stock cover|kuisha kabla ya delivery|zitaisha kabla ya kufika)\b/.test(text);
  const asksForSupplierOrders = /\b(?:supplier )?orders?\b.{0,55}\b(?:late|overdue|awaiting|waiting|pending|out for delivery|not arrived|not received)\b|\b(?:late|overdue|awaiting|waiting|pending|out for delivery|not arrived|not received)\b.{0,55}\b(?:supplier )?orders?\b|\b(?:order gani|orders? gani)\b.{0,55}\b(?:bado|delivery|imechelewa|zimechelewa|zinasubiri|wanasubiri)\b/.test(text);
  const asksForDeliveryDifferences = /\b(?:supplier )?(?:deliver(?:y|ies)|receipts?|orders?)\b.{0,55}\b(?:difference|quantity differences?|discrepanc(?:y|ies)|missing|short|quantity error|not match)\b|\b(?:difference|quantity differences?|discrepanc(?:y|ies)|missing|short|quantity error|not match)\b.{0,55}\b(?:supplier )?(?:deliver(?:y|ies)|receipts?|orders?)\b|\b(?:bidhaa|idadi)\b.{0,55}\b(?:hazikulingana|zilikosekana|tofauti ya order)\b/.test(text);
  const asksForSalesCollections = /\b(?:collect(?:ed)?|cash collected|collections?)\b.{0,45}\b(?:versus|vs\.?|compared with|against)\b.{0,30}\b(?:sales?|revenue|record(?:ed)?)\b|\b(?:sales?|revenue|record(?:ed)?)\b.{0,45}\b(?:versus|vs\.?|compared with|against)\b.{0,30}\b(?:collected|cash|collections?)\b|\b(?:makusanyo|tumekusanya|nimekusanya|fedha zilizokusanywa)\b.{0,45}\b(?:dhidi ya|ikilinganishwa na|kuliko)\b.{0,30}\b(?:mauzo|mapato)\b|\b(?:mauzo|mapato)\b.{0,45}\b(?:dhidi ya|ikilinganishwa na)\b.{0,30}\b(?:makusanyo|fedha zilizokusanywa)\b/.test(text);
  const asksForSalesPatterns = /\b(?:busiest|busy|peak)\s+(?:days?|hours?|times?)\b|\b(?:what|which)\s+(?:days?|hours?|times?)\b.{0,40}\b(?:busiest|busy|peak|most sales|most busy)\b|\b(?:saa|siku)\b.{0,40}\b(?:zenye|zilizo)\s+(?:shughuli nyingi|wateja|mauzo)\s*(?:wengi|mengi)?\b|\b(?:saa|siku)\b.{0,55}\b(?:zina|zimekuwa na)\s+(?:mauzo\s+)?(?:mengi|nyingi)\b/.test(text);
  const asksForSalesTarget = /\b(?:sales?|revenue)\b.{0,45}\b(?:target|goal|quota)\b|\b(?:target|goal|quota)\b.{0,45}\b(?:sales?|revenue|mauzo)\b|\b(?:mauzo|mapato)\b.{0,40}\b(?:lengo|target)\b|\b(?:lengo|malengo)\s+(?:la|ya)\s+(?:mauzo|mapato)\b|\b(?:lengo|malengo)\s+(?:(?:la|ya)\s+)?(?:siku|wiki|mwezi)(?:\s+(?:la|ya))?\s+(?:mauzo|mapato)\b/.test(text);
  const asksForDebtAging = /\b(debt aging|overdue debts?|oldest debts?|age of (?:my )?debts?|most overdue|who is most overdue|madeni yaliyochelewa|madeni ya zamani|umri wa madeni)\b/.test(text);
  const asksForStockMovements = /\b(stock movements?|inventory movements?|stock history|stock in and out|movement history|mabadiliko ya stock|historia ya stock)\b/.test(text);
  const asksForTopProducts = !asksForProductTrends && !asksForUnsoldProducts && !asksForProductProfit && /\b(top|best|most|highest|best-selling|top-selling|bora|zilizouza|zinazouza)\b/.test(text)
    && /\b(products?|items?|bidhaa)\b/.test(text);
  const asksForTopSupplier = /\b(top|best|highest|most|largest|bora|mkuu)\b/.test(text)
    && /\b(suppliers?|vendors?|wasambazaji|msambazaji)\b/.test(text);
  const asksForSupplierSpend = !asksForTopSupplier && /\b(supplier spend|spend with suppliers?|spent with suppliers?|supplier purchases|purchases? from suppliers?|wasambazaji kiasi|manunuzi kwa suppliers?|manunuzi ya wasambazaji|matumizi kwa wasambazaji)\b/.test(text);
  const asksForNetProfit = /\b(net profit|profit after expenses|profit after costs|faida baada ya matumizi|faida halisi)\b/.test(text);
  const asksForGrossProfit = !asksForProductProfit && /\b(gross profit|profit before expenses|faida ghafi)\b/.test(text);
  const asksForPaymentBreakdown = /\b(payment methods?|methods of payment|payment breakdown|by payment|how (?:did|was) (?:customers? )?(?:pay|paid)|malipo kwa njia|njia za malipo)\b/.test(text);
  const asksForCollections = /\b(collect|collected|collection|collections|cash collected|money collected|cash received|money received|debt payments?|pesa zilizokusanywa|makusanyo|malipo yaliyopokelewa|nimekusanya)\b/.test(text);

  const flags = {
    sales: !asksForUnsoldProducts && !asksForSalesCollections && !asksForSalesTarget && !asksForSalesPatterns && !asksForPerformanceDrivers && /\b(sales?|sell|sells|sold|revenue|mapato|mauzo|niliuza)\b/.test(text),
    expenses: !asksForPerformanceDrivers && (/\b(expenses?|gharama)\b/.test(text) || (!asksForTopSupplier && !asksForSupplierSpend && /\b(spend(?:ing)?|matumizi)\b/.test(text))),
    debts: !asksForDebtAging && /\b(debts?|owed|owe|madeni|deni|nadai)\b/.test(text),
    purchases: !asksForSupplierSpend && /\b(purchases?|purchased|bought|manunuzi|nilinunua)\b/.test(text),
    stock: !asksForStockMovements && !asksForReorderRisk && /\b(stock|inventory|low stock|out of stock|reorder(?:ing)?|restock|kuagiza|bidhaa zilizobaki)\b/.test(text),
  };
  const hasOtherTopic = flags.sales || flags.expenses || flags.debts || flags.purchases || flags.stock || asksForTopSupplier || asksForSupplierSpend || asksForTopProducts || asksForPaymentBreakdown || asksForCollections;
  const asksForSeparateSalesAmount = /\b(?:how much|total|amount|value|revenue|cash collected|recorded sales)\b.{0,40}\b(?:sales?|revenue|mapato|mauzo)\b/.test(text);
  const specialIntents = [asksForDailyBrief, asksForPerformanceDrivers, asksForProductProfit, asksForReorderRisk, asksForSupplierOrders, asksForDeliveryDifferences, asksForSalesCollections, asksForSalesPatterns, asksForSalesTarget].filter(Boolean).length;
  if (specialIntents > 1) return null;
  if (asksForUnsoldProducts && (flags.expenses || flags.debts || flags.purchases || flags.stock || asksForTopSupplier || asksForSupplierSpend || asksForTopProducts || asksForPaymentBreakdown || asksForCollections || asksForNetProfit || asksForGrossProfit || asksForSeparateSalesAmount)) return null;
  if ((asksForDebtAging || asksForStockMovements || asksForProductTrends) && hasOtherTopic) return null;
  if (asksForSupplierSpend && (flags.sales || flags.expenses || flags.debts || flags.stock || asksForTopSupplier || asksForTopProducts || asksForPaymentBreakdown || asksForCollections)) return null;
  if ((asksForNetProfit && asksForGrossProfit) || ((asksForNetProfit || asksForGrossProfit) && (asksForTopProducts || asksForTopSupplier || asksForPaymentBreakdown || asksForCollections || flags.sales || flags.debts || flags.purchases || flags.stock))) return null;
  if (asksForTopProducts && (asksForTopSupplier || asksForSupplierSpend || flags.expenses || flags.debts || flags.purchases || flags.stock)) return null;
  if (asksForTopSupplier && (flags.sales || flags.expenses || flags.debts || flags.stock)) return null;
  if (asksForPaymentBreakdown && (flags.expenses || flags.purchases || flags.stock || asksForTopProducts || asksForTopSupplier)) return null;
  if (asksForCollections && (flags.expenses || flags.purchases || flags.stock || asksForTopProducts || asksForTopSupplier)) return null;

  let intent: AssistantIntent | null = null;
  if (asksForDailyBrief) intent = "daily_brief";
  else if (asksForPerformanceDrivers) intent = "performance_drivers";
  else if (asksForProductProfit) intent = "product_profit";
  else if (asksForReorderRisk) intent = "reorder_risk";
  else if (asksForSupplierOrders) intent = "supplier_orders";
  else if (asksForDeliveryDifferences) intent = "delivery_differences";
  else if (asksForSalesCollections) intent = "sales_collections";
  else if (asksForSalesPatterns) intent = "sales_patterns";
  else if (asksForSalesTarget) intent = "sales_target";
  else if (asksForProductTrends) intent = "product_trends";
  else if (asksForUnsoldProducts) intent = "unsold_products";
  else if (asksForDebtAging) intent = "debt_aging";
  else if (asksForStockMovements) intent = "stock_movements";
  else if (asksForSupplierSpend) intent = "supplier_spend";
  else if (asksForTopProducts) intent = "top_products";
  else if (asksForTopSupplier) intent = "top_supplier";
  else if (asksForNetProfit && !asksForGrossProfit) intent = "net_profit";
  else if (asksForGrossProfit) intent = "gross_profit";
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

  const comparisonRequested = !["sales_collections", "sales_target"].includes(intent)
    && /\b(compare|compared|versus|vs\.?|against|linganisha|ikilinganishwa)\b/.test(text);
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
      ["last_90_days", /\b(last|past|previous) 90 days\b|\bsiku 90 zilizopita\b/],
      ["last_30_days", /\b(last|past|previous) 30 days\b|\bsiku 30 zilizopita\b/],
      ["last_60_days", /\b(last|past|previous) 60 days\b|\bsiku 60 zilizopita\b/],
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

  if (period === null) period = ["stock", "reorder_risk", "supplier_orders", "daily_brief", "debts", "debt_aging"].includes(intent) ? "current" : intent === "sales_patterns" ? "last_90_days" : ["product_trends", "stock_movements"].includes(intent) ? "last_30_days" : ["performance_drivers"].includes(intent) ? "this_week" : "month";

  if (intent === "performance_drivers" && !["this_week", "month", "custom"].includes(period)) return null;
  if (intent === "performance_drivers" && !compareTo && !range) {
    if (period === "month" || period === "last_month") {
      period = "month";
      compareTo = "last_month";
    } else {
      period = "this_week";
      compareTo = "last_week";
    }
  }

  if (intent === "sales_target" && ["yesterday", "last_7_days", "last_30_days", "last_60_days", "last_90_days", "last_week", "last_month", "year", "all"].includes(period)) return null;
  if (intent === "sales_target" && /\b(daily|per day|today|leo|kila siku)\b|\blengo la siku\b/.test(text)) period = "today";
  else if (intent === "sales_target" && /\b(weekly|per week|this week|wiki hii|kila wiki)\b|\blengo la wiki\b/.test(text)) period = "this_week";
  else if (intent === "sales_target" && /\b(monthly|per month|this month|mwezi huu|kila mwezi)\b|\blengo la mwezi\b/.test(text)) period = "month";

  if (period === "custom") {
    if (!range || ["stock", "debts", "debt_aging", "daily_brief", "reorder_risk", "supplier_orders", "sales_target"].includes(intent) || /\b(compare|compared|versus|vs\.?|against|last|previous)\b/.test(text)) return null;
    return { intent, period, fromDate: range[1], toDate: range[2] };
  }
  if (["last_7_days", "last_30_days", "last_60_days", "last_90_days"].includes(period) && ["stock", "reorder_risk", "supplier_orders", "daily_brief", "debts", "debt_aging"].includes(intent)) return null;
  if (intent === "stock" && period !== "current") return null;
  if (["daily_brief", "reorder_risk", "supplier_orders"].includes(intent) && !["current", "today"].includes(period)) return null;
  if ((intent === "debts" || intent === "debt_aging") && period !== "current") return null;
  if (intent === "product_trends" && period === "all") return null;
  if (intent === "sales_patterns" && period === "all") return null;
  if (intent === "sales_target" && !["today", "this_week", "month"].includes(period)) return null;
  if (intent === "performance_drivers" && !["this_week", "month"].includes(period)) return null;
  if (period === "all" && ["collections", "payment_breakdown"].includes(intent)) return null;
  if (intent === "performance_drivers" && !compareTo && period !== "custom") return null;
  if (compareTo && !["sales", "expenses", "collections", "purchases", "supplier_spend", "gross_profit", "net_profit", "performance_drivers"].includes(intent)) return null;

  return { intent, period, ...(compareTo ? { compareTo } : {}) };
}
