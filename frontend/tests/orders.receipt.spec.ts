import { expect, test, type Page } from "@playwright/test";

const supplier = { id: "supplier-1", name: "Alice Supplier", phone: "+255700000001" };
const orderedProduct = { id: "beauty-blender", name: "Beauty Blender", unit: "pcs", currentStock: 0 };
const cottonProduct = { id: "cotton-swab", name: "Cotton Swab Storage", unit: "pcs", currentStock: 0 };

function orderRecord(status: string) {
  const isDelivered = status === "DELIVERED";
  const product = isDelivered ? cottonProduct : orderedProduct;
  return {
    id: isDelivered ? "order-delivered" : "order-outgoing",
    orderGroupId: "group-238a7479",
    status,
    totalAmount: 38000,
    createdAt: "2026-10-31T09:00:00Z",
    supplier,
    items: [{
      id: "order-item-1",
      productId: product.id,
      product,
      quantity: isDelivered ? 36 : 10,
      unitPrice: isDelivered ? 38000 : 1000,
    }],
  };
}

async function installOrderMocks(page: Page, initialOrder: ReturnType<typeof orderRecord>) {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const method = route.request().method();
    let payload: unknown = {};
    if (path === "/auth/me") payload = { user: { id: "owner-1", role: "MERCHANT", name: "Gilbert", language: "en", shop: { id: "shop-1", name: "Uzuri Shop" } } };
    else if (path === "/orders" && method === "GET") payload = { orders: [initialOrder] };
    else if (path === "/orders/" + initialOrder.id && method === "GET") payload = { order: initialOrder };
    else if (path === "/products" && method === "GET") payload = {
      products: [
        { ...orderedProduct, buyingPrice: 1000, minimumStock: 5, isReorderable: true },
        { ...cottonProduct, buyingPrice: 3000, minimumStock: 5, isReorderable: true },
      ],
      pagination: { totalPages: 1 },
    };
    else if (path === "/suppliers") payload = { suppliers: [supplier] };
    else if (path === "/notifications") payload = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") payload = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });
}

test("delivery receipt reconciles saved order lines and lets staff add an unlisted product", async ({ page }) => {
  const order = orderRecord("OUT_FOR_DELIVERY");
  let receiptPayload: any = null;
  await installOrderMocks(page, order);
  await page.route("**/api/orders/order-outgoing/confirm-delivery", async (route: any) => {
    receiptPayload = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ receiptId: "receipt-1", reused: false }) });
  });

  await page.goto("/orders");
  await page.getByRole("button", { name: "Expand order Alice Supplier" }).click();
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByRole("dialog", { name: "Reconcile delivered goods" })).toBeVisible();
  await expect(page.getByText("Ordered: 10 pcs")).toBeVisible();

  await page.getByLabel("Search product missing from order").fill("Cotton Swab");
  await page.getByRole("button", { name: /Cotton Swab Storage/ }).click();
  await page.getByLabel("Quantity of unlisted product").fill("36");
  await page.getByRole("button", { name: "Add item" }).click();
  await expect(page.getByText("Order and delivery do not match")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm receipt and update stock" })).toBeDisabled();
  await page.getByLabel("Reason for delivery discrepancy").fill("36 units arrived but were missing from the saved order.");
  await expect(page.getByRole("button", { name: "Confirm receipt and update stock" })).toBeDisabled();
  await page.getByLabel("Actual purchase total").fill("1480000");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirm receipt and update stock" }).click();

  await expect(page.getByText("Receipt reconciled and stock updated.")).toBeVisible();
  expect(receiptPayload.receivedItems).toHaveLength(2);
  expect(receiptPayload.receivedItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ productId: "beauty-blender", orderItemId: "order-item-1", receivedQuantity: 10 }),
    expect.objectContaining({ productId: "cotton-swab", orderItemId: null, receivedQuantity: 36 }),
  ]));
  expect(receiptPayload.discrepancyNote).toContain("missing from the saved order");
  expect(receiptPayload.actualTotalAmount).toBe(1480000);
  expect(receiptPayload.idempotencyKey).toBeTruthy();
});

test("owner can add a post-delivery stock correction and inspect the receipt record", async ({ page }) => {
  const order = orderRecord("DELIVERED");
  let correctionPayload: any = null;
  await installOrderMocks(page, order);
  await page.route("**/api/orders/order-delivered/receipt-corrections", async (route: any) => {
    correctionPayload = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ receiptId: "correction-1", reused: false }) });
  });
  await page.route("**/api/orders/order-delivered/receipts", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        receipts: [{
          id: "correction-1",
          receiptType: "CORRECTION",
          note: "Received with Order 238A7479, stock was missed.",
          createdAt: "2026-11-03T09:00:00Z",
          items: [{ productId: cottonProduct.id, orderedQuantity: 36, receivedQuantity: 36, stockAddedQuantity: 31, unitPrice: 3000, product: cottonProduct }],
        }],
      }),
    });
  });

  await page.goto("/orders");
  await page.getByRole("button", { name: "Expand order Alice Supplier" }).click();
  await page.getByRole("button", { name: "Record missing received stock" }).click();
  await page.getByLabel("Search product for stock correction").fill("Cotton Swab");
  await page.getByRole("button", { name: /Cotton Swab Storage/ }).click();
  await page.getByRole("spinbutton", { name: "Quantity received" }).fill("36");
  await page.getByRole("spinbutton", { name: "Add to stock now" }).fill("31");
  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Correction reason").fill("Received with Order 238A7479, stock was missed.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save stock correction" }).click();
  await expect(page.getByText("Stock correction recorded.")).toBeVisible();
  expect(correctionPayload.items).toEqual([{ productId: cottonProduct.id, receivedQuantity: 36, stockAddedQuantity: 31, unitPrice: 3000 }]);
  expect(correctionPayload.idempotencyKey).toBeTruthy();

  await page.getByRole("button", { name: "Receipt history" }).click();
  await expect(page.getByText("Stock correction", { exact: true })).toBeVisible();
  await expect(page.getByText("Received 36 · added 31 pcs")).toBeVisible();
  await expect(page.getByText("Received with Order 238A7479, stock was missed.")).toBeVisible();
});

test("order revision history makes removed lines visible", async ({ page }) => {
  const order = orderRecord("OUT_FOR_DELIVERY");
  await installOrderMocks(page, order);
  await page.route("**/api/orders/order-outgoing/revisions", async (route: any) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revisions: [
        {
          id: "revision-1",
          revisionNumber: 1,
          action: "CREATED",
          beforeSnapshot: null,
          afterSnapshot: { totalAmount: 39000, items: [
            { productId: orderedProduct.id, productName: orderedProduct.name, quantity: 10, unitPrice: 1000 },
            { productId: cottonProduct.id, productName: cottonProduct.name, quantity: 12, unitPrice: 3000 },
          ] },
          createdAt: "2026-10-30T09:00:00Z",
        },
        {
          id: "revision-2",
          revisionNumber: 2,
          action: "EDITED",
          beforeSnapshot: { totalAmount: 39000, items: [
            { productId: orderedProduct.id, productName: orderedProduct.name, quantity: 10, unitPrice: 1000 },
            { productId: cottonProduct.id, productName: cottonProduct.name, quantity: 12, unitPrice: 3000 },
          ] },
          afterSnapshot: { totalAmount: 10000, items: [
            { productId: orderedProduct.id, productName: orderedProduct.name, quantity: 10, unitPrice: 1000 },
          ] },
          createdAt: "2026-10-31T09:00:00Z",
        },
      ] }) });
  });
  await page.goto("/orders");
  await page.getByRole("button", { name: "Expand order Alice Supplier" }).click();
  await page.getByRole("button", { name: "Order change history" }).click();
  await expect(page.getByRole("dialog", { name: "Order change history" })).toBeVisible();
  await expect(page.getByText("Removed: Cotton Swab Storage")).toBeVisible();
  await expect(page.getByText("Cotton Swab Storage × 12")).toHaveCount(2);
  await expect(page.getByText("After edit")).toBeVisible();
});

test("multi-supplier orders are submitted as one complete batch", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
  const suppliers = [
    { id: "supplier-1", name: "Alice Supplier", phone: "+255700000001" },
    { id: "supplier-2", name: "Coastal Wholesale", phone: "+255700000002" },
  ];
  const products = [
    { id: "beauty-blender", name: "Beauty Blender", unit: "pcs", currentStock: 0, minimumStock: 5, buyingPrice: 1000, isReorderable: true, supplier: suppliers[0] },
    { id: "cotton-swab", name: "Cotton Swab Storage", unit: "pcs", currentStock: 0, minimumStock: 5, buyingPrice: 3000, isReorderable: true, supplier: suppliers[1] },
  ];
  let batchPayload: any = null;
  await page.route("**/api/**", async (route: any) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    const method = route.request().method();
    let payload: unknown = {};
    if (path === "/auth/me") payload = { user: { id: "owner-1", role: "MERCHANT", name: "Gilbert", language: "en", shop: { id: "shop-1", name: "Uzuri Shop" } } };
    else if (path === "/orders" && method === "GET") payload = { orders: [] };
    else if (path === "/products" && method === "GET") payload = { products, pagination: { totalPages: 1 } };
    else if (path === "/suppliers") payload = { suppliers };
    else if (path === "/orders/batch" && method === "POST") {
      batchPayload = JSON.parse(route.request().postData() || "{}");
      payload = {
        orders: batchPayload.groups.map((group: any, index: number) => ({
          id: "order-" + index,
          orderGroupId: batchPayload.orderGroupId,
          status: "PENDING",
          totalAmount: group.items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0),
          createdAt: "2026-11-03T09:00:00Z",
          supplier: suppliers.find((entry) => entry.id === group.supplierId),
          items: group.items.map((item: any) => ({ ...item, id: "item-" + item.productId, product: products.find((entry) => entry.id === item.productId) })),
        })),
        whatsappMessage: { message: "Supplier order", whatsappUrl: null },
      };
    } else if (path === "/notifications") payload = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") payload = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/orders");
  await page.getByRole("button", { name: "New Order" }).click();
  await page.getByRole("button", { name: /Beauty Blender/ }).first().click();
  await page.getByRole("button", { name: /Cotton Swab Storage/ }).first().click();
  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page.getByText("2 supplier orders created.")).toBeVisible();
  expect(batchPayload.groups).toHaveLength(2);
  expect(batchPayload.groups.flatMap((group: any) => group.items.map((item: any) => item.productId)).sort()).toEqual(["beauty-blender", "cotton-swab"]);
  expect(batchPayload.orderGroupId).toBeTruthy();
});
