import { expect, test, type Page } from "@playwright/test";

const shop = { id: "shop-1", name: "Test Shop", location: "Dar es Salaam", category: "beauty", productCount: 1, catalogProtected: true };
const product = { id: "product-1", name: "Perfume", unit: "pcs", currentStock: 10, imageUrl: null, shopId: shop.id, catalogProtected: true };
type Tier = "RETAIL" | "WHOLESALE";

async function mockProtectedCatalog(page: Page) {
  let activeTier: Tier | null = null;
  const credentials = { RETAIL: "retail-password-123", WHOLESALE: "wholesale-password-456" };
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Unexpected API request in test" } }));
  await page.route("**/api/public/events", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/public/shops/shop-1", (route) => route.fulfill({ json: { shop, products: [product] } }));
  await page.route("**/api/public/shops", (route) => route.fulfill({ json: { shops: [shop] } }));
  await page.route("**/api/public/products?*", (route) => route.fulfill({ json: { products: [{ ...product, shop }], pagination: { hasMore: false } } }));
  await page.route("**/api/public/catalog/login", (route) => {
    const body = route.request().postDataJSON() as { tier: Tier; password: string };
    if (credentials[body.tier] !== body.password) return route.fulfill({ status: 401, json: { error: "Invalid catalogue login" } });
    activeTier = body.tier;
    return route.fulfill({ json: { tier: activeTier } });
  });
  await page.route("**/api/public/catalog/logout", (route) => { activeTier = null; return route.fulfill({ json: { ok: true } }); });
  await page.route("**/api/public/catalog/shop-1", (route) => activeTier
    ? route.fulfill({ json: { tier: activeTier, products: [{ ...product, price: activeTier === "RETAIL" ? 5000 : 4000, ...(activeTier === "WHOLESALE" ? { minimumQuantity: 6 } : {}) }] } })
    : route.fulfill({ status: 401, json: { error: "Sign in" } }));
}

for (const width of [390, 1280]) {
  test(`customers only see their tier and cannot order at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockProtectedCatalog(page);
    await page.goto("/catalog/shop-1?tier=wholesale");
    await expect(page.getByRole("heading", { name: "Sign in to view prices" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Wholesale" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Perfume")).toBeVisible();
    await expect(page.getByText(/TZS 4,000|TZS 5,000/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add to cart|place order|checkout/i })).toHaveCount(0);
    await page.getByLabel("Catalogue password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("Incorrect password. Please ask the shop owner.")).toBeVisible();
    await expect(page).toHaveURL(/catalog\/shop-1/);
    await page.getByLabel("Catalogue password").fill("wholesale-password-456");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("TZS 4,000")).toBeVisible();
    await expect(page.getByText("Minimum 6 pcs")).toBeVisible();
    await expect(page.getByText("TZS 5,000")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /add to cart|place order|checkout/i })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Retail", exact: true }).click();
    await page.getByLabel("Catalogue password").fill("retail-password-123");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("TZS 5,000")).toBeVisible();
    await expect(page.getByText("TZS 4,000")).toHaveCount(0);
    await expect(page.getByText(/minimum 6/i)).toHaveCount(0);
  });
}

test("the marketplace sends customers to sign in instead of showing protected prices", async ({ page }) => {
  await mockProtectedCatalog(page);
  await page.goto("/catalog");
  await expect(page.getByText("Perfume")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in to view prices" })).toHaveAttribute("href", "/catalog/shop-1");
  await expect(page.getByText(/TZS 4,000|TZS 5,000/)).toHaveCount(0);
});

test("a different customer link asks for that tier rather than showing the previous session", async ({ page }) => {
  await mockProtectedCatalog(page);
  await page.goto("/catalog/shop-1?tier=wholesale");
  await page.getByLabel("Catalogue password").fill("wholesale-password-456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("TZS 4,000")).toBeVisible();
  await page.goto("/catalog/shop-1?tier=retail");
  await expect(page.getByRole("heading", { name: "Sign in to view prices" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retail", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("TZS 4,000")).toHaveCount(0);
  await page.getByLabel("Catalogue password").fill("retail-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("TZS 5,000")).toBeVisible();
});

test("only the owner sees catalogue access controls and can enable protection", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("uzuriliving_language", "en");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as Window & { copiedCatalogLink?: string }).copiedCatalogLink = value; } } });
  });
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Unexpected API request in test" } }));
  const user = { name: "Owner", role: "MERCHANT", language: "en", shop: { id: "shop-1", name: "Test Shop" } };
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user } }));
  await page.route("**/api/subscription/status", (route) => route.fulfill({ json: { status: "active", daysLeft: 30 } }));
  await page.route("**/api/products/low-stock", (route) => route.fulfill({ json: { products: [] } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { items: [], unreadCount: 0, settings: {} } }));
  await page.route("**/api/push/preferences", (route) => route.fulfill({ json: { preferences: {}, subscriptions: [], pushConfigured: false } }));
  await page.route("**/api/barcodes/settings", (route) => route.fulfill({ json: { settings: {} } }));
  await page.route("**/api/settings", (route) => route.fulfill({ json: { settings: { ...user, phone: "+255700000001", isStaff: false, shop: { ...shop, isCatalogPublished: true } } } }));
  let access = { enabled: false, retailConfigured: false, wholesaleConfigured: false };
  await page.route("**/api/settings/catalog-access", (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      access = { enabled: body.enabled ?? access.enabled, retailConfigured: body.retailPassword ? true : access.retailConfigured, wholesaleConfigured: body.wholesalePassword ? true : access.wholesaleConfigured };
    }
    return route.fulfill({ json: { settings: access } });
  });
  await page.goto("/settings");
  await expect(page.getByText("Protection is not enabled: published catalogue prices remain public.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on price protection" })).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).first().fill("retail-password-123");
  await page.getByLabel("Confirm password", { exact: true }).first().fill("retail-password-123");
  await page.getByLabel("Password", { exact: true }).last().fill("wholesale-password-456");
  await page.getByLabel("Confirm password", { exact: true }).last().fill("wholesale-password-456");
  await page.getByRole("button", { name: "Save passwords" }).click();
  await expect(page.getByRole("button", { name: "Turn on price protection" })).toBeEnabled();
  await page.getByRole("button", { name: "Turn on price protection" }).click();
  await expect(page.getByText("Price protection is on.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /tier=retail/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /tier=wholesale/ })).toBeVisible();
  await page.getByRole("button", { name: "Copy wholesale link" }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { copiedCatalogLink?: string }).copiedCatalogLink)).toContain("/catalog/shop-1?tier=wholesale");
});

test("staff settings do not show customer password controls", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "Unexpected API request in test" } }));
  const user = { name: "Staff", role: "MERCHANT", language: "en", shop: { id: "shop-1", name: "Test Shop" }, staff: { role: "CASHIER", permissions: {} } };
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user } }));
  await page.route("**/api/subscription/status", (route) => route.fulfill({ json: { status: "active", daysLeft: 30 } }));
  await page.route("**/api/products/low-stock", (route) => route.fulfill({ json: { products: [] } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { items: [], unreadCount: 0, settings: {} } }));
  await page.route("**/api/push/preferences", (route) => route.fulfill({ json: { preferences: {}, subscriptions: [], pushConfigured: false } }));
  await page.route("**/api/barcodes/settings", (route) => route.fulfill({ status: 403, json: { error: "Forbidden" } }));
  await page.route("**/api/settings", (route) => route.fulfill({ json: { settings: { ...user, phone: "+255700000001", isStaff: true, staffRole: "CASHIER", shop: { ...shop, isCatalogPublished: true } } } }));
  await page.goto("/settings");
  await expect(page.getByText("Staff", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Customer catalogue access", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});
