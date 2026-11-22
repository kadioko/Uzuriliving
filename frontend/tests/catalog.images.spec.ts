import { expect, test, type Page } from "@playwright/test";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="240"><rect width="120" height="240" fill="#fff"/><rect x="30" y="5" width="60" height="230" fill="#cc3344"/></svg>`;
const imageUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const shop = { id: "shop-1", name: "Test Shop", location: "Dar es Salaam", category: "beauty", productCount: 1 };
const product = { id: "product-1", name: "Tall perfume", unit: "pcs", sellingPrice: 5000, wholesalePrice: 4000, wholesaleMinQty: 2, currentStock: 10, imageUrl, shop };

async function mockCatalog(page: Page) {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/public/shops", (route) => route.fulfill({ json: { shops: [shop] } }));
  await page.route("**/api/public/shops/shop-1", (route) => route.fulfill({ json: { shop, products: [product] } }));
  await page.route("**/api/public/products?*", (route) => route.fulfill({ json: { products: [product], pagination: { hasMore: false } } }));
}

for (const [path, viewport] of [
  ["/catalog", { width: 390, height: 844 }],
  ["/catalog", { width: 1280, height: 800 }],
  ["/catalog/shop-1", { width: 390, height: 844 }],
  ["/catalog/shop-1", { width: 1280, height: 800 }],
] as const) {
  test(`catalogue photos are fully visible and can be enlarged on ${path} at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockCatalog(page);
    await page.goto(path);
    const thumbnail = page.getByRole("button", { name: "View full image of Tall perfume" });
    await expect(thumbnail).toBeVisible();
    await expect.poll(() => thumbnail.locator("img").evaluate((img) => getComputedStyle(img).objectFit)).toBe("contain");
    await expect(page.getByText(/retail price/i)).toBeVisible();
    await expect(page.getByText(/wholesale price/i)).toBeVisible();
    await thumbnail.click();
    const dialog = page.getByRole("dialog", { name: "Image of Tall perfume" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: "Tall perfume" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Zoom in" }).click();
    await expect(dialog.getByText("150%")).toBeVisible();
    await dialog.getByRole("button", { name: "Zoom out" }).click();
    await expect(dialog.getByText("100%")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(thumbnail).toBeFocused();
  });
}

test("products without a photo keep their placeholder", async ({ page }) => {
  await mockCatalog(page);
  await page.route("**/api/public/products?*", (route) => route.fulfill({ json: { products: [{ ...product, imageUrl: null }], pagination: { hasMore: false } } }));
  await page.goto("/catalog");
  await expect(page.getByText("Tall perfume")).toBeVisible();
  await expect(page.getByRole("button", { name: "View full image of Tall perfume" })).toHaveCount(0);
});
