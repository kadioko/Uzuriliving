import { expect, test } from "@playwright/test";

test("inventory supports add, edit, and stock adjustment flows", async ({ page }) => {
  const suppliers = [{ id: "sup-1", name: "Jumla Traders", phone: "+255700000001" }];
  const products = [
    {
      id: "prod-1",
      name: "Mchele Super",
      sku: "MCH001",
      unit: "kg",
      buyingPrice: 2800,
      sellingPrice: 3200,
      currentStock: 12,
      minimumStock: 5,
      isActive: true,
      expiryDate: null,
      doesNotExpire: true,
      supplier: suppliers[0],
    },
  ];

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
      body: JSON.stringify({ products: products.filter((item) => item.currentStock <= item.minimumStock) }),
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
      body: JSON.stringify({ suppliers }),
    });
  });

  await page.route("**/api/products?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ products }),
    });
  });

  await page.route("**/api/products", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const body = JSON.parse(route.request().postData() || "{}");
    products.unshift({
      id: `prod-${products.length + 1}`,
      isActive: true,
      supplier: suppliers.find((item) => item.id === body.supplierId),
      ...body,
    });

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ product: products[0] }),
    });
  });

  await page.route("**/api/products/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const body = JSON.parse(route.request().postData() || "{}");
    if (body.name === "Failure Product") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Could not save product" }) });
      return;
    }
    const productId = route.request().url().split("/").pop();
    const product = products.find((item) => item.id === productId);
    if (product) {
      Object.assign(product, body, {
        supplier: suppliers.find((item) => item.id === body.supplierId) || product.supplier,
      });
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ product }),
    });
  });

  await page.route("**/api/stock/adjust", async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    const product = products.find((item) => item.id === body.productId);
    if (product) {
      if (body.type === "IN") product.currentStock += Number(body.quantity);
      if (body.type === "OUT") product.currentStock -= Number(body.quantity);
      if (body.type === "ADJUSTMENT") product.currentStock = Number(body.quantity);
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ product, movement: { id: "move-1" } }),
    });
  });

  await page.goto("/inventory");

  await expect(page.getByRole("heading", { name: /inventory|hifadhi ya bidhaa/i })).toBeVisible();
  await expect(page.getByText("Mchele Super")).toBeVisible();

  await page.getByRole("button", { name: /add product|ongeza bidhaa/i }).click();
  await expect(page.getByText(/add new product|ongeza bidhaa mpya/i)).toBeVisible();
  await page.getByLabel(/product name|jina la bidhaa/i).fill("Sukari White");
  await page.getByLabel(/sku/i).fill("SKR001");
  await page.getByLabel(/buying price|bei ya kununua/i).fill("3000");
  await page.getByLabel(/selling price|bei ya kuuza/i).fill("3500");
  await page.getByLabel(/current stock|idadi iliyopo/i).fill("8");
  await page.getByLabel(/minimum stock|kiwango cha chini/i).fill("2");
  await page.getByLabel(/supplier|msambazaji/i).selectOption("sup-1");
  await page.getByLabel(/does not expire|haiishi muda/i).check();
  await page.getByLabel(/^save$|^hifadhi$/i).click();

  await expect(page.getByText("Sukari White")).toBeVisible();
  await expect(page.getByText(/tzs 3,500/i)).toBeVisible();

  await page.getByLabel(/edit product sukari white|hariri bidhaa sukari white/i).click();
  await expect(page.getByText(/edit product|hariri bidhaa/i)).toBeVisible();
  await page.getByLabel(/product name|jina la bidhaa/i).fill("");
  await page.getByLabel(/product name|jina la bidhaa/i).fill("Sukari Brown");
  await page.getByLabel(/selling price|bei ya kuuza/i).fill("");
  await page.getByLabel(/selling price|bei ya kuuza/i).fill("3600");
  await page.getByLabel(/^save$|^hifadhi$/i).click();

  await expect(page.getByText("Sukari Brown")).toBeVisible();
  await expect(page.getByText(/tzs 3,600/i)).toBeVisible();

  await page.getByLabel(/adjust stock sukari brown|rekebisha hifadhi sukari brown/i).click();
  await expect(page.getByText(/adjust stock|rekebisha hifadhi/i)).toBeVisible();
  await page.getByLabel(/set amount|rekebisha/i).click();
  await page.getByLabel(/new quantity|idadi mpya/i).fill("25");
  await page.getByLabel(/note|maelezo/i).fill("Stock take correction");
  await page.getByLabel(/^save$|^hifadhi$/i).click();

  await expect(page.getByText(/25 pcs/)).toBeVisible();

  await page.getByLabel(/edit product sukari brown|hariri bidhaa sukari brown/i).click();
  await page.getByLabel(/product name|jina la bidhaa/i).fill("Failure Product");
  await page.getByLabel(/^save$|^hifadhi$/i).click();
  await expect(page.getByText("Could not save product")).toBeVisible();
  await expect(page.getByText(/edit product|hariri bidhaa/i)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
