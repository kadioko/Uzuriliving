import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";

test("login page has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter((item) => item.impact === "critical");
  test.expect(blocking).toEqual([]);
});

test("inventory page has no critical accessibility violations with mocked auth", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("uzuriliving_token", "playwright-merchant-token");
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          name: "Test Merchant",
          role: "MERCHANT",
          language: "en",
          shop: { name: "Test Shop" },
        },
      }),
    });
  });

  await page.route("**/api/products/low-stock", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: [] }),
    });
  });

  await page.route("**/api/subscription/status", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "active", daysLeft: 30 }) });
  });

  await page.route("**/api/notifications", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], unreadCount: 0 }) });
  });

  await page.route("**/api/suppliers", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ suppliers: [] }),
    });
  });

  await page.route("**/api/products?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products: [] }),
    });
  });

  await page.goto("/inventory");
  await page.getByRole("heading", { name: /inventory|hifadhi ya bidhaa/i }).waitFor();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter((item) => item.impact === "critical");
  test.expect(blocking).toEqual([]);
});
