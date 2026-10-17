import { expect, test, type Page } from "@playwright/test";

async function mockShop(page: Page, canSell: boolean) {
  let saleRequests = 0;
  const product = { id: "p1", name: "Effervescent soak  spa 3 g", unit: "pcs", sellingPrice: 100, wholesalePrice: 80, currentStock: 48, barcode: "12345678", buyingPrice: null, onOrderStatus: "ON_THE_WAY" };
  await page.addInitScript(() => {
    localStorage.setItem("uzuriliving_pending_sales", JSON.stringify([{ id: "old", total: 100, payload: { items: [{ productId: "p1", quantity: 1 }] } }]));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let payload: unknown = {};
    if (path === "/auth/me") payload = { user: { id: "owner", name: "Price viewer", role: "MERCHANT", language: "en", shop: { id: "shop", name: "Test shop" }, staff: { id: "staff", role: "CASHIER", permissions: { canSell, canViewInventoryAndPrices: true } } } };
    else if (path === "/products" || path === "/products/low-stock") payload = { products: [product], pagination: { totalPages: 1 } };
    else if (path === "/notifications") payload = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") payload = { daysLeft: null };
    else if (path.startsWith("/barcodes/lookup/")) payload = { product };
    else if (path === "/sales") { saleRequests++; return route.fulfill({ status: 403, contentType: "application/json", body: '{"error":"Selling disabled"}' }); }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
  return { saleRequests: () => saleRequests };
}

test("price viewer can search and scan prices without cart, history, checkout or automatic sales", async ({ page }) => {
  const state = await mockShop(page, false);
  await page.goto("/sales");
  await expect(page.getByText("Read-only access:", { exact: false })).toBeVisible();
  await expect(page.locator('a[href="/sales"]').first()).toBeVisible();
  await page.getByPlaceholder(/search products/i).fill("Effervescent soak spa 3 g");
  await expect(page.getByText("Effervescent soak spa 3 g", { exact: false })).toBeVisible();
  await expect(page.getByText("On the way", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Wholesale", exact: true }).click();
  await expect(page.getByText("TZS 80", { exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Sales", exact: true }).click();
  await page.keyboard.type("12345678");
  await page.keyboard.press("Enter");
  await expect(page.getByPlaceholder(/search products/i)).toHaveValue("12345678");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /history|complete sale/i })).toHaveCount(0);
  expect(state.saleRequests()).toBe(0);
});

test("cashier barcode scan uses the current wholesale mode", async ({ page }) => {
  await mockShop(page, true);
  await page.goto("/sales");
  await page.getByRole("button", { name: "Wholesale", exact: true }).click();
  await page.getByRole("heading", { name: "Sales", exact: true }).click();
  await page.keyboard.type("12345678");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("spinbutton").first()).toHaveValue("80");
  await expect(page.getByLabel("Quantity for Effervescent soak spa 3 g", { exact: false })).toHaveValue("1");
});
