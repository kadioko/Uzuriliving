import { expect, test, type Page } from "@playwright/test";

type Product = {
  id: string;
  name: string;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  isActive: boolean;
  doesNotExpire: boolean;
  imageUrl?: string;
  barcode?: string;
  barcodeType?: string;
  barcodeGenerated?: boolean;
};

async function mockInventory(page: Page, failFirstAttachment = false, allowAiDownload = false) {
  const products: Product[] = [];
  const calls = { creates: 0, uploadUrls: 0, uploads: 0, attachmentAttempts: 0, barcodeRegenerations: 0, uploadedBytes: 0, contentType: "", declaredBytes: 0 };
  await page.addInitScript(() => {
    localStorage.setItem("uzuriliving_token", "playwright-merchant-token");
    localStorage.setItem("uzuriliving_language", "en");
  });
  if (!allowAiDownload) await page.route("https://huggingface.co/edgetools/u2netp/**", (route) => route.abort());
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { user: { name: "Test Merchant", role: "MERCHANT", language: "en", shop: { name: "Test Shop" } } } }));
  await page.route("**/api/subscription/status", (route) => route.fulfill({ json: { status: "active", daysLeft: 30 } }));
  await page.route("**/api/notifications", (route) => route.fulfill({ json: { items: [], unreadCount: 0 } }));
  await page.route("**/api/stock-counts", (route) => route.fulfill({ json: { count: null } }));
  await page.route("**/api/suppliers", (route) => route.fulfill({ json: { suppliers: [] } }));
  await page.route("**/api/products/low-stock", (route) => route.fulfill({ json: { products: [] } }));
  await page.route("**/api/products?*", (route) => route.fulfill({ json: { products, pagination: { totalPages: 1 } } }));
  await page.route("**/api/products", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    calls.creates += 1;
    const body = route.request().postDataJSON();
    const product: Product = { ...body, id: "product-1", isActive: true, doesNotExpire: false };
    if (body.generateBarcode) Object.assign(product, { barcode: "DP00000001", barcodeType: "INTERNAL", barcodeGenerated: true });
    products.unshift(product);
    await route.fulfill({ status: 201, json: { product } });
  });
  await page.route("**/api/products/*", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON();
    if (body.generateBarcode) calls.barcodeRegenerations += 1;
    if (body.imageUrl) {
      calls.attachmentAttempts += 1;
      if (failFirstAttachment && calls.attachmentAttempts === 1) {
        await route.fulfill({ status: 500, json: { error: "Could not attach image" } });
        return;
      }
    }
    Object.assign(products[0], body);
    await route.fulfill({ json: { product: products[0] } });
  });
  await page.route("**/api/storage/upload-url", async (route) => {
    calls.uploadUrls += 1;
    const body = route.request().postDataJSON();
    calls.contentType = body.contentType;
    calls.declaredBytes = body.fileSize;
    await route.fulfill({ json: { signedUrl: new URL("/__test-upload", page.url()).href, publicUrl: "https://example.test/product.jpg" } });
  });
  await page.route("**/__test-upload", async (route) => {
    calls.uploads += 1;
    calls.uploadedBytes = route.request().postDataBuffer()?.length || 0;
    await route.fulfill({ status: 200, body: "uploaded" });
  });
  await page.goto("/inventory");
  await page.getByRole("button", { name: /add product|ongeza bidhaa/i }).click();
  return calls;
}

async function imageBuffer(page: Page, noisy: boolean, color = "#e00000") {
  const encoded = await page.evaluate(({ addNoise, fillColor }) => {
    const canvas = document.createElement("canvas");
    canvas.width = addNoise ? 900 : 90;
    canvas.height = addNoise ? 600 : 60;
    const context = canvas.getContext("2d")!;
    if (addNoise) {
      const image = context.createImageData(canvas.width, canvas.height);
      let value = 123456789;
      for (let i = 0; i < image.data.length; i += 4) {
        value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
        image.data[i] = value & 255;
        image.data[i + 1] = (value >>> 8) & 255;
        image.data[i + 2] = (value >>> 16) & 255;
        image.data[i + 3] = 255;
      }
      context.putImageData(image, 0, 0);
    }
    context.clearRect(0, 0, canvas.width / 8, canvas.height / 8);
    context.fillStyle = fillColor;
    context.fillRect(canvas.width / 2 - 25, canvas.height / 2 - 25, 50, 50);
    return canvas.toDataURL("image/png").split(",")[1];
  }, { addNoise: noisy, fillColor: color });
  return Buffer.from(encoded, "base64");
}

async function enterProduct(page: Page) {
  await page.getByLabel(/product name|jina la bidhaa/i).fill("White background test");
  await page.getByLabel(/buying price|bei ya kununua/i).fill("1000");
  await page.getByLabel(/selling price|bei ya kuuza/i).fill("2000");
}

async function keepOriginal(page: Page) {
  await page.getByRole("button", { name: "Use original background" }).click();
  await expect(page.getByText(/image ready/i)).toBeVisible();
}

test("the upload explanation is hidden while image preparation remains available", async ({ page }) => {
  await mockInventory(page);
  await expect(page.getByText(/background removal runs on your device/i)).toHaveCount(0);
  await page.getByLabel("Product image").setInputFiles({ name: "small.png", mimeType: "image/png", buffer: await imageBuffer(page, false) });
  await keepOriginal(page);
  await expect(page.getByAltText("Product preview")).toBeVisible();
});

test("large transparent photos are made square, white, and compressed before upload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const calls = await mockInventory(page);
  await enterProduct(page);
  const original = await imageBuffer(page, true);
  expect(original.length).toBeGreaterThan(1024 * 1024);
  await page.getByLabel("Product image").setInputFiles({ name: "phone.png", mimeType: "image/png", buffer: original });
  await keepOriginal(page);

  const pixels = await page.getByAltText("Product preview").evaluate(async (node) => {
    const image = node as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const at = (x: number, y: number) => Array.from(context.getImageData(x, y, 1, 1).data);
    return { width: canvas.width, height: canvas.height, corner: at(2, 2), transparent: at(10, Math.floor(canvas.height / 6) + 10), middle: at(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)) };
  });
  expect(pixels.width).toBe(pixels.height);
  expect(pixels.width).toBeLessThanOrEqual(1024);
  expect(pixels.corner.slice(0, 3).every((value) => value >= 245)).toBe(true);
  expect(pixels.transparent.slice(0, 3).every((value) => value >= 235)).toBe(true);
  expect(pixels.middle[0]).toBeGreaterThan(175);
  expect(pixels.middle[1]).toBeLessThan(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);

  await page.getByLabel(/^save$|^hifadhi$/i).click();
  await expect(page.getByText("White background test")).toBeVisible();
  expect(calls.creates).toBe(1);
  expect(calls.uploads).toBe(1);
  expect(calls.contentType).toBe("image/jpeg");
  expect(calls.uploadedBytes).toBe(calls.declaredBytes);
  expect(calls.uploadedBytes).toBeGreaterThan(0);
  expect(calls.uploadedBytes).toBeLessThanOrEqual(1024 * 1024);
});

test("retrying a failed image attachment does not duplicate the product or reupload the file", async ({ page }) => {
  const calls = await mockInventory(page, true);
  await enterProduct(page);
  await page.getByLabel(/generate uzuri living barcode/i).check();
  await page.getByLabel("Product image").setInputFiles({ name: "small.png", mimeType: "image/png", buffer: await imageBuffer(page, false) });
  await keepOriginal(page);
  await page.getByLabel(/^save$|^hifadhi$/i).click();
  await expect(page.getByText(/product was saved, but its image/i)).toBeVisible();
  await page.getByLabel(/^save$|^hifadhi$/i).click();
  await expect(page.getByLabel("Product image")).toHaveCount(0);
  await expect(page.getByText("White background test")).toBeVisible();
  expect(calls.creates).toBe(1);
  expect(calls.uploadUrls).toBe(1);
  expect(calls.uploads).toBe(1);
  expect(calls.attachmentAttempts).toBe(2);
  expect(calls.barcodeRegenerations).toBe(0);
});

test("invalid images cannot silently be saved and can be cleared", async ({ page }) => {
  const calls = await mockInventory(page);
  await enterProduct(page);
  await page.getByLabel("Product image").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: Buffer.alloc(15 * 1024 * 1024 + 1) });
  await expect(page.getByText("Choose an image of up to 15 MB.")).toBeVisible();
  await expect(page.getByLabel(/^save$|^hifadhi$/i)).toBeDisabled();
  await page.getByRole("button", { name: /clear selected image/i }).click();
  await page.getByLabel("Product image").setInputFiles({ name: "bad.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
  await expect(page.getByText(/the image could not be prepared/i)).toBeVisible();
  await expect(page.getByLabel(/^save$|^hifadhi$/i)).toBeDisabled();
  await page.getByRole("button", { name: /clear selected image/i }).click();
  await expect(page.getByLabel(/^save$|^hifadhi$/i)).toBeEnabled();
  await page.getByLabel(/^save$|^hifadhi$/i).click();
  await expect(page.getByText("White background test")).toBeVisible();
  expect(calls.creates).toBe(1);
  expect(calls.uploads).toBe(0);
});

test("a slower previous selection cannot replace the latest image", async ({ page }) => {
  await mockInventory(page);
  const red = await imageBuffer(page, false);
  const blue = await imageBuffer(page, false, "#0000e0");
  await page.evaluate(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    let calls = 0;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      calls += 1;
      if (calls === 1) {
        setTimeout(() => original.call(this, (blob) => {
          callback(blob);
          (window as Window & { firstImageFinished?: boolean }).firstImageFinished = true;
        }, type, quality), 500);
      } else {
        original.call(this, callback, type, quality);
      }
    };
  });
  await page.getByLabel("Product image").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: red });
  await expect(page.getByText(/preparing image/i)).toBeVisible();
  await page.getByLabel("Product image").setInputFiles({ name: "blue.png", mimeType: "image/png", buffer: blue });
  await keepOriginal(page);
  await page.waitForFunction(() => (window as Window & { firstImageFinished?: boolean }).firstImageFinished === true);
  const color = await page.getByAltText("Product preview").evaluate(async (node) => {
    const image = node as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    return Array.from(context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data);
  });
  expect(color[2]).toBeGreaterThan(175);
  expect(color[0]).toBeLessThan(80);
});

test("failed background removal needs an explicit original-image choice", async ({ page }) => {
  await mockInventory(page);
  await enterProduct(page);
  await page.getByLabel("Product image").setInputFiles({ name: "small.png", mimeType: "image/png", buffer: await imageBuffer(page, false) });
  await expect(page.getByText(/background could not be removed/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByLabel(/^save$|^hifadhi$/i)).toBeDisabled();
  await keepOriginal(page);
  await expect(page.getByLabel(/^save$|^hifadhi$/i)).toBeEnabled();
});

test("real on-device background removal loads its model and produces a white preview", async ({ page }) => {
  test.skip(process.env.RUN_PRODUCT_AI_INTEGRATION !== "1", "Opt-in: downloads the real model and runtime from their CDNs");
  test.setTimeout(120_000);
  await mockInventory(page, false, true);
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600; canvas.height = 600;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#2052a0"; context.fillRect(0, 0, 600, 600);
    context.fillStyle = "#c30d20"; context.fillRect(215, 130, 170, 360);
    context.fillStyle = "#e02c30"; context.fillRect(235, 110, 130, 35);
    context.fillStyle = "white"; context.fillRect(235, 250, 130, 80);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Product image").setInputFiles({ name: "product.png", mimeType: "image/png", buffer: Buffer.from(encoded, "base64") });
  await expect(page.getByRole("button", { name: "Use white background" })).toBeVisible({ timeout: 100_000 });
  await expect(page.getByRole("button", { name: "Use white background" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/image ready/i)).toBeVisible();
  const pixels = await page.getByAltText("Product preview").evaluate(async (node) => {
    const image = node as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const at = (x: number, y: number) => Array.from(context.getImageData(Math.floor(x * canvas.width), Math.floor(y * canvas.height), 1, 1).data);
    return { background: at(0.1, 0.1), product: at(0.5, 0.35) };
  });
  expect(pixels.background.slice(0, 3).every((value) => value > 230)).toBe(true);
  expect(pixels.product[0]).toBeGreaterThan(pixels.product[1] + 50);
  await page.getByRole("button", { name: "Use original background" }).click();
  await expect(page.getByRole("button", { name: "Use original background" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Use white background" }).click();
  await expect(page.getByRole("button", { name: "Use white background" })).toHaveAttribute("aria-pressed", "true");

  expect(await page.evaluate(async () => (await (await caches.open("uzuri-product-background-model-v1")).keys()).length)).toBeGreaterThan(0);
  let repeatedModelRequests = 0;
  await page.route("https://huggingface.co/edgetools/u2netp/**", (route) => { repeatedModelRequests += 1; return route.abort(); });
  await page.reload();
  await page.getByRole("button", { name: /add product|ongeza bidhaa/i }).click();
  await page.getByLabel("Product image").setInputFiles({ name: "product.png", mimeType: "image/png", buffer: Buffer.from(encoded, "base64") });
  await expect(page.getByRole("button", { name: "Use white background" })).toBeVisible({ timeout: 100_000 });
  expect(repeatedModelRequests).toBe(0);
});

test("background removal can be previewed on a real product photo", async ({ page, request }, testInfo) => {
  test.skip(process.env.RUN_PRODUCT_AI_INTEGRATION !== "1", "Opt-in: downloads the real model, runtime and a public-domain sample photo");
  test.setTimeout(120_000);
  // Public-domain image by ChickenFreak, https://commons.wikimedia.org/wiki/File:Perfume_Bottle.jpg
  const photo = await request.get("https://upload.wikimedia.org/wikipedia/commons/5/52/Perfume_Bottle.jpg", {
    headers: { "User-Agent": "UzuriLivingImageTest/1.0 (support@uzuriliving.com)" },
  });
  expect(photo.ok()).toBe(true);
  await mockInventory(page, false, true);
  await page.getByLabel("Product image").setInputFiles({ name: "perfume.jpg", mimeType: "image/jpeg", buffer: await photo.body() });
  await expect(page.getByRole("button", { name: "Use white background" })).toBeVisible({ timeout: 100_000 });
  await page.getByAltText("Product preview").screenshot({ path: testInfo.outputPath("white-background.png") });
  await page.getByRole("button", { name: "Use original background" }).click();
  await page.getByAltText("Product preview").screenshot({ path: testInfo.outputPath("original-background.png") });
});
