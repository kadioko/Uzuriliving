import test from "node:test";
import assert from "node:assert/strict";
import { assistantActionRequiredPermissions, assistantFinancialReconciliation, assistantRequiredPermissions, estimateStockCover, parseAssistantQuestion } from "../functions/api/assistant-intent.ts";
import { hasStaffPermission, shopRouteAllowed } from "../functions/api/permissions.ts";

test("assistant questions are bounded to supported topics and periods", () => {
  assert.deepEqual(parseAssistantQuestion("What were my sales this month?"), { intent: "sales", period: "month" });
  assert.deepEqual(parseAssistantQuestion("Mauzo ya mwezi huu ni kiasi gani?"), { intent: "sales", period: "month" });
  assert.deepEqual(parseAssistantQuestion("Which products need reordering?"), { intent: "stock", period: "current" });
  assert.deepEqual(parseAssistantQuestion("How much is owed to me?"), { intent: "debts", period: "current" });
  assert.deepEqual(parseAssistantQuestion("How much were my purchases this month?"), { intent: "purchases", period: "month" });
  assert.deepEqual(parseAssistantQuestion("How much have I purchased all time?"), { intent: "purchases", period: "all" });
  assert.deepEqual(parseAssistantQuestion("What were sales today?"), { intent: "sales", period: "today" });
  assert.deepEqual(parseAssistantQuestion("How much did I sell last week?"), { intent: "sales", period: "last_week" });
  assert.deepEqual(parseAssistantQuestion("sales this week vs last week"), { intent: "sales", period: "this_week", compareTo: "last_week" });
  assert.deepEqual(parseAssistantQuestion("Compare collections this month with last month"), { intent: "collections", period: "month", compareTo: "last_month" });
  assert.deepEqual(parseAssistantQuestion("How much did I spend from 2026-10-01 to 2026-10-31?"), { intent: "expenses", period: "custom", fromDate: "2026-10-01", toDate: "2026-10-31" });
  assert.deepEqual(parseAssistantQuestion("sales over the last 7 days"), { intent: "sales", period: "last_7_days" });
  assert.deepEqual(parseAssistantQuestion("top selling products this month"), { intent: "top_products", period: "month" });
  assert.deepEqual(parseAssistantQuestion("top supplier purchases last month"), { intent: "top_supplier", period: "last_month" });
  assert.deepEqual(parseAssistantQuestion("How much did I spend with suppliers last month?"), { intent: "supplier_spend", period: "last_month" });
  assert.deepEqual(parseAssistantQuestion("Supplier spend this week vs last week"), { intent: "supplier_spend", period: "this_week", compareTo: "last_week" });
  assert.deepEqual(parseAssistantQuestion("Who was my top supplier last month?"), { intent: "top_supplier", period: "last_month" });
  assert.deepEqual(parseAssistantQuestion("Top supplier purchases last month"), { intent: "top_supplier", period: "last_month" });
  assert.deepEqual(parseAssistantQuestion("Which products are slowing down over the last 30 days?"), { intent: "product_trends", period: "last_30_days" });
  assert.deepEqual(parseAssistantQuestion("Which debts are most overdue?"), { intent: "debt_aging", period: "current" });
  assert.deepEqual(parseAssistantQuestion("Stock movements last 7 days"), { intent: "stock_movements", period: "last_7_days" });
  assert.deepEqual(parseAssistantQuestion("How much cash did I collect this week?"), { intent: "collections", period: "this_week" });
  assert.deepEqual(parseAssistantQuestion("payment method breakdown this month"), { intent: "payment_breakdown", period: "month" });
  assert.deepEqual(parseAssistantQuestion("What was my gross profit this month?"), { intent: "gross_profit", period: "month" });
  assert.deepEqual(parseAssistantQuestion("Faida ghafi mwezi huu ni kiasi gani?"), { intent: "gross_profit", period: "month" });
  assert.deepEqual(parseAssistantQuestion("What was my net profit after expenses last week?"), { intent: "net_profit", period: "last_week" });
  assert.deepEqual(parseAssistantQuestion("Compare gross profit this month with last month"), { intent: "gross_profit", period: "month", compareTo: "last_month" });
  assert.deepEqual(parseAssistantQuestion("Compare net profit this week with last week"), { intent: "net_profit", period: "this_week", compareTo: "last_week" });
  assert.deepEqual(parseAssistantQuestion("Faida baada ya matumizi wiki iliyopita"), { intent: "net_profit", period: "last_week" });
  assert.deepEqual(parseAssistantQuestion("Nimekusanya kiasi gani wiki hii?"), { intent: "collections", period: "this_week" });
  for (const question of ["sales and expenses today", "profit this month", "stock this month", "stock from 2026-10-01 to 2026-10-31", "debts from 2026-10-01 to 2026-10-31", "sales in 2024", "sales from 2026-02-30 to 2026-03-01", "top products and expenses this month", "sales today and purchases this month", "compare sales this week with last month", "sales and net profit this month", "overdue debts and sales this month", "supplier spend and expenses this month"]) {
    assert.equal(parseAssistantQuestion(question), null, question);
  }
  assert.deepEqual(parseAssistantQuestion("sales"), { intent: "sales", period: "month" });
  assert.deepEqual(parseAssistantQuestion("expenses"), { intent: "expenses", period: "month" });
  assert.deepEqual(parseAssistantQuestion("purchases"), { intent: "purchases", period: "month" });
});

test("stock estimates require enough observations and subtract incoming units", () => {
  const sparse = [{ date: "2026-10-20", quantity: 10 }, { date: "2026-11-01", quantity: 10 }];
  assert.equal(estimateStockCover(5, 0, "2026-11-07", sparse), null);
  const sales = ["2026-10-17", "2026-10-19", "2026-10-22", "2026-10-24", "2026-10-27", "2026-10-30", "2026-11-02", "2026-11-07"].map((date) => ({ date, quantity: 10 }));
  const policy = { leadTimeDays: 7, safetyDays: 7, packSize: 6 };
  const availability = { coverageFrom: "2026-10-17", coverageTo: "2026-11-06", coverageDays: 21, stockoutDays: 0, availableDays: 21 };
  const withoutIncoming = estimateStockCover(5, 0, "2026-11-07", sales, { ...policy, availability });
  const withIncoming = estimateStockCover(5, 10, "2026-11-07", sales, { ...policy, availability });
  assert.ok(withoutIncoming);
  assert.equal(withoutIncoming.observedDays, 21);
  assert.equal(withoutIncoming.availabilityDays, 21);
  assert.equal(withoutIncoming.hasEnoughHistory, true);
  assert.equal(withoutIncoming.suggestedOrderQuantity % 6, 0);
  assert.ok(withIncoming.suggestedOrderQuantity <= withoutIncoming.suggestedOrderQuantity);
  assert.equal(estimateStockCover(5, 0, "2026-11-07", sales, policy), null);
  assert.ok(withIncoming.daysOfCover > withoutIncoming.daysOfCover);
  assert.equal(estimateStockCover(5, 0, "invalid-date", sales), null);
  const stockoutAdjusted = estimateStockCover(5, 0, "2026-11-07", sales, { ...policy, availability: { ...availability, stockoutDays: 7, availableDays: 14, stockoutDates: ["2026-10-17"] } });
  assert.ok(stockoutAdjusted.dailyRate > withoutIncoming.dailyRate);
  assert.equal(stockoutAdjusted.stockoutDays, 7);
  assert.equal(stockoutAdjusted.coverageTo, "2026-11-06");
  assert.equal(stockoutAdjusted.activeDays, 6, "stockout-day and current partial-day sales are excluded");
});

test("assistant financial definitions expose mismatches and withhold incomplete profit", () => {
  assert.deepEqual(assistantFinancialReconciliation({ revenueDifference: 0, profitDifference: 0, missingCostSalesRevenue: 0 }), {
    revenueDifference: 0, profitDifference: 0, missingCostSalesRevenue: 0, grossProfitSafe: true, reconciled: true,
  });
  assert.deepEqual(assistantFinancialReconciliation({ revenueDifference: 2500, profitDifference: -500, missingCostSalesRevenue: 1200 }), {
    revenueDifference: 2500, profitDifference: -500, missingCostSalesRevenue: 1200, grossProfitSafe: false, reconciled: false,
  });
  assert.deepEqual(assistantFinancialReconciliation({ revenueDifference: 2500, profitDifference: 0, missingCostSalesRevenue: 0 }), {
    revenueDifference: 2500, profitDifference: 0, missingCostSalesRevenue: 0, grossProfitSafe: false, reconciled: false,
  });
});

test("assistant permission is separate and recommendation history stays source-scoped", () => {
  const staff = { role: "MERCHANT", staffId: "staff", permissions: { canUseAssistant: true } };
  assert.equal(shopRouteAllowed(staff, "/assistant/ask", "POST"), true);
  assert.equal(shopRouteAllowed(staff, "/assistant/actions", "GET"), true);
  assert.equal(shopRouteAllowed(staff, "/assistant/stock", "GET"), true);
  assert.equal(shopRouteAllowed(staff, "/dashboard", "GET"), false);
  assert.equal(shopRouteAllowed(staff, "/debts", "GET"), false);
  assert.equal(shopRouteAllowed({ ...staff, permissions: { canViewReports: true } }, "/assistant/ask", "POST"), false);
  assert.equal(shopRouteAllowed({ role: "MERCHANT" }, "/assistant/actions", "GET"), true);
  const inventoryViewer = { ...staff, permissions: { canUseAssistant: true, canViewInventoryAndPrices: true } };
  assert.equal(shopRouteAllowed(inventoryViewer, "/assistant/ask", "POST"), true);
  assert.equal(hasStaffPermission(inventoryViewer, "canViewInventoryAndPrices"), true);
  assert.equal(hasStaffPermission(inventoryViewer, "canManageStock"), false);
  assert.deepEqual(assistantActionRequiredPermissions("stock-product-1"), ["canManageStock"]);
  assert.deepEqual(assistantActionRequiredPermissions("orders"), ["canManageStock"]);
  assert.deepEqual(assistantActionRequiredPermissions("debt"), ["canSell"]);
  assert.deepEqual(assistantActionRequiredPermissions("expenses"), ["canRecordExpenses"]);
  assert.deepEqual(assistantActionRequiredPermissions("top-product"), ["canViewReports"]);
  assert.deepEqual(assistantRequiredPermissions("stock"), ["canViewInventoryAndPrices"]);
  assert.deepEqual(assistantRequiredPermissions("stock_movements"), ["canViewInventoryAndPrices"]);
  assert.deepEqual(assistantRequiredPermissions("debts"), ["canViewReports", "canSell"]);
  assert.deepEqual(assistantRequiredPermissions("debt_aging"), ["canViewReports", "canSell"]);
  assert.deepEqual(assistantRequiredPermissions("expenses"), ["canRecordExpenses"]);
  assert.deepEqual(assistantRequiredPermissions("purchases"), ["canViewReports"]);
  assert.deepEqual(assistantRequiredPermissions("gross_profit"), ["canViewReports"]);
  assert.deepEqual(assistantRequiredPermissions("product_trends"), ["canViewReports"]);
  assert.deepEqual(assistantRequiredPermissions("supplier_spend"), ["canViewReports"]);
  assert.deepEqual(assistantRequiredPermissions("net_profit"), ["canViewReports", "canRecordExpenses"]);
});
