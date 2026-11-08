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
        historySummary: { summary: { hasBusinessHistory: true } }, debts: null,
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
  await expect(sources.getByText(/Unavailable; dependent recommendations are hidden/).first()).toBeVisible();
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
  await expect(expenses.getByText(/last checked/)).toBeVisible();
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
      historySummary: { summary: { hasBusinessHistory: false } },
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
      historySummary: { summary: { hasBusinessHistory: false } },
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
      dashboard: null, historySummary: { summary: { hasBusinessHistory: false } }, debts: null, expenses: null, costs: null,
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
  await expect(sources.getByText("Stock and incoming orders", { exact: true }).locator("../..").getByText(/last checked/)).toBeVisible();
  await expect(page.getByText("Review stock for Soap")).toHaveCount(0);
});

test("recent product advice and cross-device sync status use explicit bounded evidence", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-08T13:00:00Z", businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam",
      permissions: { canManageStock: false },
      sources: { today: { status: "ready" }, history: { status: "ready" }, trends: { status: "ready" }, debts: { status: "restricted" }, expenses: { status: "restricted" }, costs: { status: "ready" }, stock: { status: "restricted" }, purchases: { status: "restricted" }, sync: { status: "ready" } },
      dashboard: { summary: { totalSales: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, lowStockCount: 0, outOfStockCount: 0, pendingOrders: 0, salesCount: 0 } },
      historySummary: { summary: { hasBusinessHistory: true } },
      productTrends: { windowDays: 30, from: "2026-10-09", to: "2026-11-07", comparisonFrom: "2026-09-09", comparisonTo: "2026-10-08", products: [{ id: "trend-p1", name: "Mafuta ya Kupikia", unit: "pcs", revenue30d: 30000, units30d: 10, previousRevenue30d: 20000, previousUnits30d: 6, revenueChangePercent: 50 }] },
      debts: null, expenses: null, costs: { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } }, stock: null,
      syncHealth: { serverKnownPending: 2, serverKnownFailed: 1, devicesObserved: 3, lastEventReceivedAt: "2026-11-08T12:30:00Z", lastSuccessfulSyncAt: "2026-11-08T12:00:00Z", eventsInspected: 5, observationLimitReached: false, checkedAt: "2026-11-08T13:00:00Z" },
    };
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [], businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam" };
      else {
        const event = route.request().postDataJSON();
        body = { action: { id: "trend-occurrence", actionKey: event.actionKey, conditionKey: event.conditionKey, title: event.title, href: event.href, status: "OPEN", shownAt: "2026-11-08T13:00:00Z", businessDate: "2026-11-08", updatedAt: "2026-11-08T13:00:00Z" } };
      }
    } else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "Promote Mafuta ya Kupikia" })).toBeVisible();
  await expect(page.getByText(/Last 30 days: TZS 30,000 revenue and 10 units; \+50% vs the prior 30 days/)).toBeVisible();
  const sync = page.getByRole("region", { name: "Cross-device sync report" });
  await expect(sync.getByText("Pending (server reports): 2")).toBeVisible();
  await expect(sync.getByText("Failed syncs (server reports): 1")).toBeVisible();
  await expect(sync.getByText(/offline device cannot report its current local queue/)).toBeVisible();
});

test("dismissing a recommendation hides it for the day and Undo restores it", async ({ page }) => {
  const recordedEvents: string[] = [];
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-08T12:00:00Z", businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam",
      permissions: { canManageStock: true },
      sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "restricted" }, expenses: { status: "restricted" }, costs: { status: "ready" }, stock: { status: "ready" }, purchases: { status: "restricted" } },
      dashboard: { summary: { totalSales: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, lowStockCount: 0, outOfStockCount: 0, pendingOrders: 0, salesCount: 0 } },
      historySummary: { summary: { hasBusinessHistory: false } }, debts: null, expenses: null,
      costs: { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } },
      stock: { count: 1, businessDate: "2026-11-08", demandStatus: "ready", dailySales: [], products: [{ id: "p1", name: "Soap", currentStock: 0, minimumStock: 3, unit: "pcs", onOrderQuantity: 0, stockRevisionAt: "rev-1", reorderEstimate: null }] },
    };
    else if (path === "/assistant/actions") {
      if (route.request().method() === "GET") body = { actions: [], businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam" };
      else {
        const event = route.request().postDataJSON();
        recordedEvents.push(event.eventType);
        body = { action: { id: "occurrence-1", actionKey: event.actionKey, conditionKey: event.conditionKey, title: event.actionKey === "debt" ? "Follow up on overdue debts" : event.title, href: event.actionKey === "debt" ? "/debts" : event.href, status: event.eventType === "DISMISSED" ? "DISMISSED" : event.eventType === "SNOOZED" ? "SNOOZED" : event.eventType === "OPENED" ? "OPENED" : "OPEN", shownAt: "2026-11-08T12:00:00Z", businessDate: "2026-11-08", updatedAt: "2026-11-08T12:00:00Z", dismissReason: event.reason, snoozedUntil: event.snoozedUntil } };
      }
    } else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  const card = page.getByRole("heading", { name: "Review stock for Soap" });
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Dismiss / snooze" }).click();
  await page.getByRole("button", { name: "Already handled" }).click();
  await expect(card).toHaveCount(0);
  const dismissed = page.getByText("Hidden today (1)");
  await dismissed.click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Dismiss / snooze" }).click();
  await page.getByRole("button", { name: "Remind me tomorrow" }).click();
  await expect(card).toHaveCount(0);
  const hiddenSection = page.locator("details").filter({ hasText: "Hidden today (1)" });
  if (!await hiddenSection.evaluate((element) => (element as HTMLDetailsElement).open)) await hiddenSection.locator("summary").click();
  await expect(page.getByText("Snoozed until 2026-11-09")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card).toBeVisible();
  expect(recordedEvents).toContain("DISMISSED");
  expect(recordedEvents).toContain("SNOOZED");
  expect(recordedEvents).toContain("RESTORED");
});

test("a changed stock condition gets a fresh recommendation occurrence", async ({ page }) => {
  let shownCondition = "";
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-08T13:00:00Z", businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam", permissions: { canManageStock: true },
      sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "restricted" }, expenses: { status: "restricted" }, costs: { status: "ready" }, stock: { status: "ready" }, purchases: { status: "restricted" } },
      dashboard: { summary: { totalSales: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, lowStockCount: 0, outOfStockCount: 0, pendingOrders: 0, salesCount: 0 } },
      historySummary: { summary: { hasBusinessHistory: false } }, debts: null, expenses: null, costs: { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } },
      stock: { count: 1, businessDate: "2026-11-08", demandStatus: "restricted", products: [{ id: "p1", name: "Soap", currentStock: 1, minimumStock: 3, unit: "pcs", stockRevisionAt: "new-revision" }] },
    };
    else if (path === "/assistant/actions" && route.request().method() === "GET") body = {
      businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam", actions: [{ id: "old-occurrence", actionKey: "stock-p1", conditionKey: "0:3:0:old-revision", title: "Review stock for Soap", href: "/inventory", status: "DISMISSED", shownAt: "2026-11-08T09:00:00Z", businessDate: "2026-11-08", updatedAt: "2026-11-08T09:00:00Z" }],
    };
    else if (path === "/assistant/actions") {
      const event = route.request().postDataJSON();
      if (event.eventType === "SHOWN") shownCondition = event.conditionKey;
      body = { action: { id: "new-occurrence", actionKey: event.actionKey, conditionKey: event.conditionKey, title: event.title, href: event.href, status: "OPEN", shownAt: "2026-11-08T13:00:00Z", businessDate: "2026-11-08", updatedAt: "2026-11-08T13:00:00Z" } };
    } else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "Review stock for Soap" })).toBeVisible();
  await expect.poll(() => shownCondition).toBe("1:3:0:new-revision");
});

test("a changed debt balance restores today's recommendation", async ({ page }) => {
  let debtAmount = 100;
  let snapshotRequests = 0;
  let originalCondition = "";
  let changedCondition = "";
  let savedDebtTitle = "";
  let savedDebtHref = "";
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/snapshot") {
      snapshotRequests += 1;
      body = {
        checkedAt: "2020-01-01T00:00:00Z", businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam", permissions: { canManageStock: false },
        sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "ready" }, expenses: { status: "restricted" }, costs: { status: "restricted" }, stock: { status: "restricted" }, purchases: { status: "restricted" } },
        dashboard: null, historySummary: { summary: { hasBusinessHistory: false } },
        debts: { summary: { openCount: 1, totalOwed: debtAmount }, debts: [{ id: "debt-opaque-1", customerName: "Amina", balance: debtAmount, status: "OPEN", dueDate: "2026-11-10", daysOverdue: 0 }] },
        expenses: null, costs: null, stock: null,
      };
    } else if (path === "/assistant/actions" && route.request().method() === "GET") body = { actions: [], businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam" };
    else if (path === "/assistant/actions") {
      const event = route.request().postDataJSON();
      if (event.eventType === "SHOWN") {
        if (!originalCondition) originalCondition = event.conditionKey;
        else changedCondition = event.conditionKey;
        savedDebtTitle = event.title;
        savedDebtHref = event.href;
      }
      body = { action: { id: "debt-occurrence", actionKey: event.actionKey, conditionKey: event.conditionKey, title: event.title, href: event.href, status: event.eventType === "DISMISSED" ? "DISMISSED" : "OPEN", shownAt: "2026-11-08T12:00:00Z", businessDate: "2026-11-08", updatedAt: "2026-11-08T12:00:00Z" } };
    } else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  const recommendation = page.getByRole("heading", { name: /Follow up on .* in unpaid debt/ });
  await expect(recommendation).toBeVisible();
  await page.getByRole("button", { name: "Dismiss / snooze" }).click();
  await page.getByRole("button", { name: "Already handled" }).click();
  await expect(recommendation).toHaveCount(0);
  debtAmount = 150;
  const debtsSource = page.getByRole("region", { name: "Data source status" }).getByText("Debts", { exact: true }).locator("../..");
  await expect(debtsSource.getByText(/This check may be stale/)).toBeVisible();
  await debtsSource.getByRole("button", { name: "Refresh" }).click();
  await expect.poll(() => snapshotRequests).toBeGreaterThan(1);
  await expect(recommendation).toBeVisible();
  await expect.poll(() => changedCondition).not.toBe("");
  await expect.poll(() => changedCondition).not.toBe(originalCondition);
  expect(savedDebtTitle).not.toContain("Amina");
  expect(savedDebtTitle).not.toContain("+255");
  expect(savedDebtHref).toBe("/debts");
});

test("broad earnings questions offer choices and evidence can carry offline-sync warnings", async ({ page }) => {
  const submitted: string[] = [];
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/ask") {
      const question = route.request().postDataJSON().question;
      submitted.push(question);
      body = submitted.length === 1
        ? { answer: { message: "Which measure do you mean?", source: null, href: null, from: null, to: null, checkedAt: "2026-11-08T13:00:00Z", timeZone: "Africa/Dar_es_Salaam", clarificationOptions: [{ label: "Gross profit", question: "What was my gross profit last week?" }] } }
        : { answer: { message: "Gross profit last week: TZS 12,000.", source: "Sale items and saved cost prices", href: "/analytics?period=custom&from=2026-10-26&to=2026-11-01", from: "2026-10-26T00:00:00Z", to: "2026-11-01T13:00:00Z", checkedAt: "2026-11-08T13:00:00Z", timeZone: "Africa/Dar_es_Salaam", evidence: { definition: "Sale-item revenue less saved buying cost.", recordCount: 3, recordCountLabel: "Sales", warnings: ["Two offline sales are waiting to sync."] } } };
    } else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-08T13:00:00Z", businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam", permissions: { canManageStock: false },
      sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "restricted" }, expenses: { status: "restricted" }, costs: { status: "ready" }, stock: { status: "restricted" }, purchases: { status: "restricted" } },
      dashboard: { summary: { totalSales: 0, totalProfit: 0, totalExpenses: 0, netProfit: 0, lowStockCount: 0, outOfStockCount: 0, pendingOrders: 0, salesCount: 0 } }, historySummary: { summary: { hasBusinessHistory: false } }, debts: null, expenses: null, costs: { summary: { salesRevenue: 0, missingCostSalesRevenue: 0 } }, stock: null,
    };
    else if (path === "/assistant/actions") body = { actions: [], businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam" };
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  await page.getByLabel("Question for assistant").fill("How much did I make last week?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.getByRole("button", { name: "Gross profit", exact: true }).click();
  await expect(page.getByText("How this was calculated")).toBeVisible();
  await expect(page.getByText("Sale-item revenue less saved buying cost.")).toBeVisible();
  await expect(page.getByText("Sales: 3")).toBeVisible();
  await expect(page.getByText(/Two offline sales are waiting to sync/)).toBeVisible();
  expect(submitted).toEqual(["How much did I make last week?", "What was my gross profit last week?"]);
});

test("Ask explains active products with no recorded sales for the selected month", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", name: "Owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" } } };
    else if (path === "/assistant/ask") body = { answer: {
      message: "3 active products had no recorded sales this month: Tea (pcs), Soap (pcs), Rice (bag).",
      source: "Active products and sale records", href: "/inventory", from: "2026-11-01T00:00:00Z", to: "2026-11-30T23:59:59Z",
      checkedAt: "2026-11-08T13:00:00Z", timeZone: "Africa/Dar_es_Salaam",
      evidence: { definition: "Active products with no positive-quantity sale-item record in the selected period. This does not prove the product had no demand.", recordCount: 3, recordCountLabel: "Active products with no recorded sales", warnings: ["Offline sales not yet synced are excluded; stockouts and returns can also change how to interpret this list."] },
    } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-08T13:00:00Z", businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam", permissions: { canManageStock: false },
      sources: { today: { status: "ready" }, history: { status: "ready" }, debts: { status: "restricted" }, expenses: { status: "restricted" }, costs: { status: "restricted" }, stock: { status: "restricted" }, purchases: { status: "restricted" } },
      dashboard: null, historySummary: { summary: { hasBusinessHistory: true } }, debts: null, expenses: null, costs: null, stock: null,
    };
    else if (path === "/assistant/actions") body = { actions: [], businessDate: "2026-11-08", timeZone: "Africa/Dar_es_Salaam" };
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/assistant");
  await page.getByLabel("Question for assistant").fill("What haven't we sold this month?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/3 active products had no recorded sales this month/)).toBeVisible();
  await expect(page.getByText("How this was calculated")).toBeVisible();
  await expect(page.getByRole("link", { name: /Open relevant records/ })).toHaveAttribute("href", "/inventory");
  await expect(page.getByText(/Offline sales not yet synced are excluded/)).toBeVisible();
});
