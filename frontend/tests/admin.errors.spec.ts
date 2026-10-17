import { expect, test } from "@playwright/test";

test("admin user loading failures show an error instead of a false empty list", async ({ page }) => {
  let userReads = 0;
  let allowUserLoad = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let status = 200;
    let payload: unknown = {};
    if (path === "/auth/me") payload = { user: { id: "admin-1", role: "ADMIN", name: "Admin", language: "en" } };
    else if (path === "/admin/overview") { status = 503; payload = { error: "Overview temporarily unavailable" }; }
    else if (path === "/admin/users") {
      userReads += 1;
      if (!allowUserLoad) { status = 503; payload = { error: "Users temporarily unavailable" }; }
      else payload = { users: [{ id: "merchant-1", name: "Amani Demo Merchant", phone: "+255789123456", role: "MERCHANT", createdAt: "2026-01-01T00:00:00.000Z" }] };
    }
    else if (path === "/admin/audit-logs") payload = { logs: [] };
    else if (path === "/reports/admin") payload = { reports: [] };
    else if (path === "/subscription/admin") payload = { shops: [] };
    else if (path === "/suppliers") payload = { suppliers: [] };
    else if (path === "/sync/admin/summary") payload = { shops: [] };
    else if (path === "/sync/admin/events") payload = { events: [], devices: [] };
    else if (path === "/assistant/admin/analytics") { status = 503; payload = { error: "Assistant analytics temporarily unavailable" }; }
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
  });

  await page.goto("/admin");
  await page.getByRole("button", { name: "Users", exact: true }).click();
  await expect(page.getByText("Users temporarily unavailable")).toBeVisible();
  await expect(page.getByText("All Users (0)")).toHaveCount(0);

  allowUserLoad = true;
  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.getByText("All Users (1)")).toBeVisible();
  await expect(page.getByText("Amani Demo Merchant")).toBeVisible();
  expect(userReads).toBeGreaterThanOrEqual(2);
});
