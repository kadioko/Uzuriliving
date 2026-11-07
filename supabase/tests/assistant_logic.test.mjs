import test from "node:test";
import assert from "node:assert/strict";
import { assistantActionRequiredPermissions, assistantRequiredPermissions, estimateStockCover, parseAssistantQuestion } from "../functions/api/assistant-intent.ts";
import { shopRouteAllowed } from "../functions/api/permissions.ts";

test("assistant questions are bounded to supported topics and periods", () => {
  assert.deepEqual(parseAssistantQuestion("What were my sales this month?"), { intent: "sales", period: "month" });
  assert.deepEqual(parseAssistantQuestion("Mauzo ya mwezi huu ni kiasi gani?"), { intent: "sales", period: "month" });
  assert.deepEqual(parseAssistantQuestion("Which products need reordering?"), { intent: "stock", period: "current" });
  assert.deepEqual(parseAssistantQuestion("How much is owed to me?"), { intent: "debts", period: "current" });
  assert.deepEqual(parseAssistantQuestion("How much were my purchases this month?"), { intent: "purchases", period: "month" });
  assert.deepEqual(parseAssistantQuestion("How much have I purchased all time?"), { intent: "purchases", period: "all" });
  assert.deepEqual(parseAssistantQuestion("What were sales today?"), { intent: "sales", period: "today" });
  for (const question of ["sales", "expenses", "purchases", "sales last month", "sales in 2024", "sales and expenses today", "profit this month", "stock this month", "sales all time"]) {
    assert.equal(parseAssistantQuestion(question), null, question);
  }
});

test("stock estimates require enough observations and subtract incoming units", () => {
  const sparse = [{ date: "2026-10-20", quantity: 10 }, { date: "2026-11-01", quantity: 10 }];
  assert.equal(estimateStockCover(5, 0, "2026-11-07", sparse), null);
  const sales = ["2026-10-20", "2026-10-22", "2026-10-25", "2026-10-27", "2026-10-30", "2026-11-02", "2026-11-07"].map((date) => ({ date, quantity: 10 }));
  const withoutIncoming = estimateStockCover(5, 0, "2026-11-07", sales);
  const withIncoming = estimateStockCover(5, 10, "2026-11-07", sales);
  assert.ok(withoutIncoming);
  assert.equal(withoutIncoming.observedDays, 19);
  assert.equal(withIncoming.suggestedAdditionalUnits, Math.max(0, withoutIncoming.suggestedAdditionalUnits - 10));
  assert.ok(withIncoming.daysOfCover > withoutIncoming.daysOfCover);
  assert.equal(estimateStockCover(5, 0, "invalid-date", sales), null);
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
  assert.deepEqual(assistantActionRequiredPermissions("stock-product-1"), ["canManageStock"]);
  assert.deepEqual(assistantActionRequiredPermissions("orders"), ["canManageStock"]);
  assert.deepEqual(assistantActionRequiredPermissions("debt"), ["canSell"]);
  assert.deepEqual(assistantActionRequiredPermissions("expenses"), ["canRecordExpenses"]);
  assert.deepEqual(assistantActionRequiredPermissions("top-product"), ["canViewReports"]);
  assert.deepEqual(assistantRequiredPermissions("stock"), ["canManageStock"]);
  assert.deepEqual(assistantRequiredPermissions("debts"), ["canViewReports", "canSell"]);
  assert.deepEqual(assistantRequiredPermissions("expenses"), ["canRecordExpenses"]);
  assert.deepEqual(assistantRequiredPermissions("purchases"), ["canViewReports"]);
});
