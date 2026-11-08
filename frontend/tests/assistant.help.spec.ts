import { expect, test } from "@playwright/test";

test("AI Assistant help button opens the question guide", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let body: unknown = {};
    if (path === "/auth/me") body = { user: { id: "owner", name: "Owner", role: "MERCHANT", shop: { id: "shop", name: "Shop" }, features: { assistant: true } } };
    else if (path === "/assistant/snapshot") body = {
      checkedAt: "2026-11-09T10:00:00Z", businessDate: "2026-11-09", timeZone: "Africa/Dar_es_Salaam",
      permissions: { canManageStock: true }, sources: {}, dashboard: null, historySummary: null, debts: null, expenses: null, costs: null, stock: null,
    };
    else if (path === "/assistant/actions") body = { actions: [], businessDate: "2026-11-09", timeZone: "Africa/Dar_es_Salaam" };
    else if (path === "/notifications") body = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") body = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto("/assistant");
  await page.getByRole("link", { name: "How to use the AI Assistant" }).click();
  await expect(page).toHaveURL(/\/assistant\/help/);
  await expect(page.getByRole("heading", { name: "How to use the AI Assistant" })).toBeVisible();
  await expect(page.getByText(/Which products have had no sales in the last 60 days\?/)).toBeVisible();
  await expect(page.getByText(/The assistant uses deterministic calculations, does not change records, and only shows data your permissions allow\./)).toBeVisible();
});
