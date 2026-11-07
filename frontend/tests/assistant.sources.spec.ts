import { expect, test } from "@playwright/test";

test("assistant distinguishes unavailable and restricted sources and links supplier orders correctly", async ({ page }) => {
  let expenseRequests = 0;
  let shownEvents = 0;
  let expenseAvailable = false;
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    let status = 200;
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", name: "Owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/dashboard/profit") body = { summary: { salesRevenue: 100, missingCostSalesRevenue: 20 } };
    else if (path === "/dashboard") body = { summary: { totalSales: 100, netProfit: -50, totalExpenses: 50, salesCount: 1, pendingOrders: 1 }, lowStockAlerts: [], topProducts: [] };
    else if (path === "/debts") { status = 403; body = { error: "You do not have permission to view debts" }; }
    else if (path === "/expenses") { expenseRequests += 1; if (!expenseAvailable) { status = 503; body = { error: "Expenses unavailable" }; } else body = { expenses: [], summary: { total: 0, count: 0 } }; }
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [] };
      else {
        const event = route.request().postDataJSON();
        if (event.eventType === "SHOWN") shownEvents += 1;
        body = { action: { id: "occurrence-1", actionKey: event.actionKey, title: event.title, href: event.href, status: event.eventType === "COMPLETED" ? "COMPLETED" : event.eventType === "DISMISSED" ? "DISMISSED" : event.eventType === "OPENED" ? "OPENED" : "OPEN", shownAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", updatedAt: "2026-11-07T12:00:00Z" } };
      }
    }
    else if (path === "/assistant/stock") body = { products: [] };
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  const sources = page.getByRole("region", { name: "Data source status" });
  await expect(sources.getByText("Permission required")).toBeVisible();
  await expect(sources.getByText(/Unavailable; dependent recommendations are hidden/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open supplier orders" })).toHaveAttribute("href", "/orders");
  await expect.poll(() => shownEvents).toBeGreaterThan(0);
  await expect(page.getByText("Expenses exceed today's recorded profit estimate")).toHaveCount(0);
  const expenses = sources.getByText("Expenses", { exact: true }).locator("../..");
  const previousRequests = expenseRequests;
  expenseAvailable = true;
  await expenses.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => expenseRequests).toBeGreaterThan(previousRequests);
  await expect(expenses.getByText(/Checked/)).toBeVisible();
});

test("Ask displays evidence and clears a previous answer when access is denied", async ({ page }) => {
  let askCount = 0;
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let status = 200;
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", name: "Owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/ask") {
      askCount += 1;
      if (askCount === 1) body = { answer: { message: "Recorded sales this month so far: TZS 10,000. This includes credit sales and is not cash collected.", source: "Recorded sales", href: "/analytics", from: "2026-11-01T00:00:00Z", to: "2026-11-07T12:00:00Z", checkedAt: "2026-11-07T12:00:00Z", timeZone: "Africa/Dar_es_Salaam" } };
      else { status = 403; body = { error: "You do not have permission to view the records needed for this answer" }; }
    } else if (path === "/dashboard/profit") body = { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } };
    else if (path === "/dashboard") body = { summary: { totalSales: 0, totalProfit: 0, salesCount: 0, pendingOrders: 0 }, lowStockAlerts: [], topProducts: [] };
    else if (path === "/debts") body = { summary: { openCount: 0, totalOwed: 0 }, debts: [] };
    else if (path === "/expenses") body = { expenses: [], summary: { total: 0, count: 0 } };
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [] };
      else {
        const event = route.request().postDataJSON();
        body = { action: { id: "occurrence-1", actionKey: event.actionKey, title: event.title, href: event.href, status: "OPEN", shownAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", updatedAt: "2026-11-07T12:00:00Z" } };
      }
    }
    else if (path === "/assistant/stock") body = { products: [] };
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  await page.getByLabel("Question for assistant").fill("What were my sales this month?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/This includes credit sales/)).toBeVisible();
  await expect(page.getByText(/Source: Recorded sales/)).toContainText("Africa/Dar_es_Salaam");
  await expect(page.getByRole("link", { name: /Open relevant records/ })).toHaveAttribute("href", "/analytics");
  await page.getByLabel("Question for assistant").fill("How much is owed to me?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("You do not have permission to view the records needed for this answer")).toBeVisible();
  await expect(page.getByText(/This includes credit sales/)).toHaveCount(0);
});
