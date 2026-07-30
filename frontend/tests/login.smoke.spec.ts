import { expect, test } from "@playwright/test";

test("live login smoke test", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Uzuri Living" })).toBeVisible();

  const phoneInput = page.locator('input[type="tel"]').first();
  const pinInput = page.locator('input[inputmode="numeric"]').first();

  await phoneInput.fill(process.env.PLAYWRIGHT_TEST_PHONE || "+255700000003");
  await pinInput.fill(process.env.PLAYWRIGHT_TEST_PIN || "1234");

  await page.locator('form button[type="submit"]').click();

  await page.waitForURL(/dashboard|supplier/, { timeout: 15000 });
  await expect(page).toHaveURL(/dashboard|supplier/);

  if (/dashboard/.test(page.url())) {
    await expect(page.getByRole("heading", { name: /business overview|muhtasari wa biashara/i })).toBeVisible();
    await page.getByRole("link", { name: /inventory|hifadhi ya bidhaa/i }).click();
    await page.waitForURL(/inventory/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /inventory|hifadhi ya bidhaa/i })).toBeVisible();
    await page.locator('a[href="/orders"]').click();
    await page.waitForURL(/orders/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /supplier orders|maagizo ya bidhaa/i })).toBeVisible();
    await page.getByRole("link", { name: /sales|mauzo/i }).click();
    await page.waitForURL(/sales/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: /sales|mauzo/i })).toBeVisible();
    await page.getByRole("button", { name: /log out|toka/i }).click();
    await page.waitForURL(/\/$/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Uzuri Living" })).toBeVisible();
    return;
  }

  await expect(page.getByText(/portal ya wasambazaji|supplier/i)).toBeVisible();
  await page.getByRole("button", { name: /toka|log out/i }).click();
  await page.waitForURL(/\/$/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Uzuri Living" })).toBeVisible();
});
