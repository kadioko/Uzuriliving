import { expect, test } from "@playwright/test";

for (const account of ["owner", "stock staff"] as const) {
test(`${account} can save an out-for-delivery order without silently repricing its products`, async ({ page }) => {
  const supplier = { id: "supplier-1", name: "Coastal Wholesale", phone: "+255700000001" };
  const product = { id: "product-1", name: "Spa Soak", unit: "pcs", buyingPrice: 2300, currentStock: 0, minimumStock: 5, isReorderable: true, supplier: { id: "supplier-2", name: "Previous Supplier" } };
  const order = {
    id: "order-1", status: "OUT_FOR_DELIVERY", totalAmount: 1800, note: "Original note", createdAt: "2026-10-16T09:00:00Z", supplier,
    items: [{ productId: product.id, product, quantity: 1, unitPrice: 1800, note: "Original item note" }],
  };
  const savedPayloads: Array<{ items: Array<{ quantity: number; unitPrice?: number; supplierId?: string }>; note?: string }> = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let payload: unknown = {};
    if (path === "/auth/me") payload = { user: { id: "owner-1", role: "MERCHANT", name: account === "owner" ? "Gilbert" : "Stock Clerk", language: "en", shop: { id: "shop-1", name: "Uzuri Shop" }, ...(account === "stock staff" ? { staff: { id: "staff-1", role: "STOCK_CLERK", permissions: { canManageStock: true } } } : {}) } };
    else if (path === "/orders" && route.request().method() === "GET") payload = { orders: [order] };
    else if (path === "/orders/order-1" && route.request().method() === "PATCH") {
      const savedPayload = JSON.parse(route.request().postData() || "{}");
      savedPayloads.push(savedPayload);
      order.items[0].quantity = savedPayload.items[0].quantity;
      order.items[0].unitPrice = savedPayload.items[0].unitPrice;
      order.note = savedPayload.note || "";
      order.totalAmount = order.items[0].quantity * order.items[0].unitPrice;
      payload = { order };
    }
    else if (path === "/products") payload = { products: [{ ...product, buyingPrice: account === "stock staff" ? null : product.buyingPrice }], pagination: { totalPages: 1 } };
    else if (path === "/suppliers") payload = { suppliers: [supplier] };
    else if (path === "/notifications") payload = { items: [], unreadCount: 0 };
    else if (path === "/subscription/status") payload = { status: "active", daysLeft: 30 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/orders");
  await expect(page.getByText("Coastal Wholesale").first()).toBeVisible();
  await page.getByRole("button", { name: "Expand order Coastal Wholesale" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Unit purchase price for Spa Soak")).toHaveValue("1800");
  await expect(page.getByText("TZS 1,800").last()).toBeVisible();
  await expect(page.getByText("Spa Soak", { exact: true }).first()).toBeVisible();
  await page.getByLabel("Quantity for Spa Soak").fill("");
  await expect(page.getByLabel("Quantity for Spa Soak")).toHaveValue("");
  await page.getByLabel("Quantity for Spa Soak").fill("2");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Order updated.")).toBeVisible();
  await expect(page.getByText("TZS 3,600")).toBeVisible();
  expect(savedPayloads[0]?.items[0]).toMatchObject({ quantity: 2, unitPrice: 1800, supplierId: supplier.id });
  expect(order.status).toBe("OUT_FOR_DELIVERY");

  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Unit purchase price for Spa Soak").fill("1700");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("TZS 3,400")).toBeVisible();
  expect(savedPayloads[1]?.items[0]).toMatchObject({ quantity: 2, unitPrice: 1700, supplierId: supplier.id });
});
}
