import { expect, test } from "@playwright/test";

test("admin user loading failures show an error instead of a false empty list", async ({ page }) => {
  let userReads = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, "");
    let status = 200;
    let payload: unknown = {};
    if (path === "/auth/me") payload = { user: { id: "admin-1", role: "ADMIN", name: "Admin", language: "en" } };
    else if (path === "/admin/overview") { status = 503; payload = { error: "Overview temporarily unavailable" }; }
    else if (path === "/admin/users") {
      userReads += 1;
      if (userReads <= 2) { status = 503; payload = { error: "Users temporarily unavailable" }; }
      else payload = { users: [] };
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

  await page.getByRole("button", { name: "Retry loading" }).click();
  await expect(page.getByText("All Users (0)")).toBeVisible();
  expect(userReads).toBeGreaterThanOrEqual(3);
});
