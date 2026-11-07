import { expect, test } from "@playwright/test";

test("assistant distinguishes unavailable and restricted sources and links supplier orders correctly", async ({ page }) => {
  let snapshotRequests = 0;
  let shownEvents = 0;
  let expenseAvailable = false;
  const readPaths: string[] = [];
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    let status = 200;
    let body: unknown = {};
    if (route.request().method() === "GET") readPaths.push(path);
    if (path === "/auth/me") body = { user: { id: "owner", name: "Owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") {
      snapshotRequests += 1;
      body = {
        checkedAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", timeZone: "Africa/Dar_es_Salaam",
        permissions: { canManageStock: true },
        sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "restricted" }, expenses: { status: expenseAvailable ? "ready" : "unavailable" }, costs: { status: "ready" }, stock: { status: "ready" }, purchases: { status: "ready" } },
        dashboard: { summary: { totalSales: 100, totalProfit: 0, netProfit: -50, totalExpenses: 50, salesCount: 1, pendingOrders: 1 }, topProducts: [] },
        allTime: { summary: { totalSales: 100, salesCount: 1 }, topProducts: [] }, debts: null,
        expenses: expenseAvailable ? { daily: [] } : null,
        costs: { summary: { salesRevenue: 100, missingCostSalesRevenue: 20 } },
        stock: { products: [] },
      };
    }
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [] };
      else {
        const event = route.request().postDataJSON();
        if (event.eventType === "SHOWN") shownEvents += 1;
        body = { action: { id: "occurrence-1", actionKey: event.actionKey, title: event.title, href: event.href, status: event.eventType === "COMPLETED" ? "COMPLETED" : event.eventType === "DISMISSED" ? "DISMISSED" : event.eventType === "OPENED" ? "OPENED" : "OPEN", shownAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", updatedAt: "2026-11-07T12:00:00Z" } };
      }
    }
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
  await expect.poll(() => snapshotRequests).toBeGreaterThan(0);
  expect(snapshotRequests).toBeLessThan(8);
  expect(readPaths.filter((path) => ["/dashboard", "/dashboard/profit", "/debts", "/expenses", "/assistant/stock", "/purchases/analytics"].includes(path))).toEqual([]);
  const expenses = sources.getByText("Expenses", { exact: true }).locator("../..");
  const previousRequests = snapshotRequests;
  expenseAvailable = true;
  await expenses.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => snapshotRequests).toBeGreaterThan(previousRequests);
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
    } else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", timeZone: "Africa/Dar_es_Salaam",
      permissions: { canManageStock: true },
      sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "ready" }, expenses: { status: "ready" }, costs: { status: "ready" }, stock: { status: "ready" }, purchases: { status: "ready" } },
      dashboard: { summary: { totalSales: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, salesCount: 0, pendingOrders: 0 } },
      allTime: { summary: { totalSales: 0, salesCount: 0 }, topProducts: [] },
      debts: { summary: { openCount: 0, totalOwed: 0 }, debts: [] },
      expenses: { daily: [] }, costs: { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } }, stock: { products: [] },
    };
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [] };
      else {
        const event = route.request().postDataJSON();
        body = { action: { id: "occurrence-1", actionKey: event.actionKey, title: event.title, href: event.href, status: "OPEN", shownAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", updatedAt: "2026-11-07T12:00:00Z" } };
      }
    }
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

test("expense recommendation compares shop-local calendar weeks from compact daily totals", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", name: "Owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", timeZone: "Africa/Dar_es_Salaam",
      permissions: { canManageStock: true },
      sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "ready" }, expenses: { status: "ready" }, costs: { status: "ready" }, stock: { status: "ready" }, purchases: { status: "ready" } },
      dashboard: { summary: { totalSales: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, salesCount: 0, pendingOrders: 0 } },
      allTime: { summary: { totalSales: 0, salesCount: 0 }, topProducts: [] },
      debts: { summary: { openCount: 0, totalOwed: 0 }, debts: [] },
      expenses: { daily: [
        { businessDate: "2026-11-07", amount: 100, count: 1 },
        { businessDate: "2026-11-06", amount: 100, count: 1 },
        { businessDate: "2026-11-01", amount: 100, count: 1 },
        { businessDate: "2026-10-31", amount: 80, count: 1 },
        { businessDate: "2026-10-28", amount: 80, count: 1 },
        { businessDate: "2026-10-25", amount: 80, count: 1 },
      ] },
      costs: { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } }, stock: { products: [] },
    };
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [], businessDate: "2026-11-07", timeZone: "Africa/Dar_es_Salaam" };
      else { const event = route.request().postDataJSON(); body = { action: { id: "expense-action", actionKey: event.actionKey, title: event.title, href: event.href, status: "OPEN", shownAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", updatedAt: "2026-11-07T12:00:00Z" } }; }
    }
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "Expenses rose 25% over the last 7 days" })).toBeVisible();
});

test("inventory-view-only staff receive stock access without stock-control recommendations", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "staff", name: "Viewer", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-07T12:00:00Z", businessDate: "2026-11-07", timeZone: "Africa/Dar_es_Salaam",
      permissions: { canManageStock: false },
      sources: { today: { status: "restricted" }, history: { status: "restricted" }, debts: { status: "restricted" }, expenses: { status: "restricted" }, costs: { status: "restricted" }, stock: { status: "ready" }, purchases: { status: "restricted" } },
      dashboard: null, allTime: null, debts: null, expenses: null, costs: null,
      stock: { count: 1, products: [{ id: "p1", name: "Soap", currentStock: 0, minimumStock: 3, unit: "pcs", onOrderStatus: "ON_THE_WAY" }] },
    };
    else if (path === "/assistant/actions") body = { actions: [], businessDate: "2026-11-07", timeZone: "Africa/Dar_es_Salaam" };
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  const sources = page.getByRole("region", { name: "Data source status" });
  await expect(sources.getByText("Stock and incoming orders", { exact: true })).toBeVisible();
  await expect(sources.getByText("Stock and incoming orders", { exact: true }).locator("../..").getByText(/Checked/)).toBeVisible();
  await expect(page.getByText("Review stock for Soap")).toHaveCount(0);
});
