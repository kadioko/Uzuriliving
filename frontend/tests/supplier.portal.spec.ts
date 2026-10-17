import { expect, test } from "@playwright/test";

test("supplier portal shows orders but cannot change shop-managed statuses", async ({ page }) => {
  const orders = [
    {
      id: "ord-pending-1",
      status: "PENDING",
      totalAmount: 24000,
      createdAt: "2026-04-03T08:00:00.000Z",
      note: "Pakia mapema",
      shop: { name: "Duka la Amina", location: "Mbagala", district: "Temeke" },
      items: [{ product: { name: "Unga", unit: "bag" }, quantity: 5 }],
    },
    {
      id: "ord-pending-2",
      status: "PENDING",
      totalAmount: 15000,
      createdAt: "2026-04-03T09:00:00.000Z",
      shop: { name: "Duka la Juma", location: "Tegeta", district: "Kinondoni" },
      items: [{ product: { name: "Mafuta", unit: "litre" }, quantity: 3 }],
    },
    {
      id: "ord-confirmed-1",
      status: "CONFIRMED",
      totalAmount: 18000,
      createdAt: "2026-04-03T10:00:00.000Z",
      shop: { name: "Duka la Rehema", location: "Buguruni", district: "Ilala" },
      items: [{ product: { name: "Sukari", unit: "bag" }, quantity: 2 }],
    },
  ];

  await page.addInitScript(() => {
    window.localStorage.setItem("uzuriliving_token", "playwright-supplier-token");
  });

  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { name: "Jumla Traders", role: "SUPPLIER", language: "sw", supplier: { name: "Jumla Traders" } } }),
    });
  });

  await page.route("**/api/suppliers/portal/products", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ products: [] }) });
  });

  await page.route("**/api/suppliers/portal/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ordersByStatus: { PENDING: 2, CONFIRMED: 1, OUT_FOR_DELIVERY: 0, DELIVERED: 0 },
        pendingOrders: [orders[0]],
      }),
    });
  });

  await page.route("**/api/suppliers/portal/orders", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ orders }),
    });
  });

  let statusWrites = 0;
  await page.route("**/api/suppliers/portal/orders/*/status", async (route) => {
    statusWrites++;
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Owner access required" }) });
  });

  await page.goto("/supplier");

  await expect(page.getByText(/portal ya wasambazaji/i)).toBeVisible();
  await expect(page.getByText("Duka la Amina")).toBeVisible();
  await expect(page.getByText("Duka la Juma")).toBeVisible();

  await page.getByRole("button", { name: /expand order duka la amina/i }).click();
  await expect(page.getByText(/mmiliki wa duka au mfanyakazi mwenye ruhusa/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /thibitisha|safirishwa|kataa agizo/i })).toHaveCount(0);

  await page.getByRole("button", { name: /zilizothibitishwa/i }).click();
  await expect(page.getByText("Duka la Rehema")).toBeVisible();
  await page.getByRole("button", { name: /zinazosubiri/i }).click();
  await expect(page.getByText("Duka la Amina")).toBeVisible();
  await page.getByRole("button", { name: /yote/i }).click();
  await expect(page.getByText("Duka la Juma")).toBeVisible();
  expect(statusWrites).toBe(0);
});
