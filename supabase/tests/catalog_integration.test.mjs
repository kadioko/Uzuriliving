// Run only against an explicitly configured LOCAL Supabase stack. These test
// records use unique ids and are removed afterwards; production is rejected.
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const { Client } = require("pg");
const jwt = require("jsonwebtoken");
const dbUrl = process.env.CATALOG_TEST_DB_URL;
const apiUrl = process.env.CATALOG_TEST_API_URL;
const secret = process.env.CATALOG_TEST_JWT_SECRET;
const webUrl = process.env.CATALOG_TEST_WEB_URL;

test("catalogue credentials and protected API are isolated, revocable and view-only", { skip: !dbUrl || !apiUrl || !secret, timeout: 120000 }, async () => {
  for (const value of [dbUrl, apiUrl]) assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(value).hostname), "Integration tests may only use localhost");
  if (webUrl) assert.ok(["127.0.0.1", "localhost", "::1", "[::1]"].includes(new URL(webUrl).hostname), "Browser integration tests may only use localhost");
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  const prefix = `catalog-test-${randomUUID()}`;
  const owner = `${prefix}-owner`, otherOwner = `${prefix}-owner2`, shop = `${prefix}-shop`, otherShop = `${prefix}-shop2`, staff = `${prefix}-staff`, product = `${prefix}-product`;
  const ownerToken = jwt.sign({ userId: owner, role: "MERCHANT" }, secret, { expiresIn: "1h" });
  const staffToken = jwt.sign({ userId: owner, role: "MERCHANT", staffId: staff }, secret, { expiresIn: "1h" });
  const otherToken = jwt.sign({ userId: otherOwner, role: "MERCHANT" }, secret, { expiresIn: "1h" });
  async function call(path, { method = "GET", token, cookie, body } = {}) {
    const response = await fetch(`${apiUrl}${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    return { response, data };
  }
  function sessionCookie(response) {
    const header = response.headers.getSetCookie().find((item) => item.startsWith("uzuri_catalog_session="));
    assert.ok(header);
    assert.match(header, /HttpOnly/i);
    assert.match(header, /Secure/i);
    assert.match(header, /SameSite=Lax/i);
    return header.split(";")[0];
  }
  try {
    await db.query(`INSERT INTO users(id,phone,pin,name,role,"approvalStatus","updatedAt") VALUES ($1,$2,'unused','Catalogue fixture','MERCHANT','APPROVED',NOW()),($3,$4,'unused','Other fixture','MERCHANT','APPROVED',NOW())`, [owner, `${prefix}-phone`, otherOwner, `${prefix}-phone2`]);
    await db.query(`INSERT INTO shops(id,"userId",name,location,plan,"updatedAt") VALUES ($1,$2,'Catalogue fixture','Test','LIFETIME',NOW()),($3,$4,'Other fixture','Test','LIFETIME',NOW())`, [shop, owner, otherShop, otherOwner]);
    await db.query(`INSERT INTO staff_members(id,name,role,"shopId","updatedAt") VALUES ($1,'Fixture staff','CASHIER',$2,NOW())`, [staff, shop]);
    await db.query(`INSERT INTO products(id,name,"buyingPrice","sellingPrice","wholesalePrice","wholesaleMinQty","currentStock","shopId","updatedAt") VALUES ($1,'Catalogue fixture product',1000,5000,4000,6,10,$2,NOW())`, [product, shop]);

    let result = await call(`/public/shops/${shop}`);
    assert.equal(result.response.status, 200);
    assert.equal(result.data.products[0].sellingPrice, 5000, "unprotected shops retain their existing catalogue behaviour");
    assert.equal(result.data.products[0].wholesalePrice, 4000);
    result = await call("/settings/catalog-access", { token: staffToken });
    assert.equal(result.response.status, 403, "staff cannot manage catalogue passwords");
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { enabled: true } });
    assert.equal(result.response.status, 400, "both passwords required before enabling");
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { retailPassword: "same-password-123", wholesalePassword: "same-password-123" } });
    assert.equal(result.response.status, 400, "tiers must not share a password");
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { retailPassword: "retail-password-123", wholesalePassword: "wholesale-password-456", enabled: true } });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    assert.deepEqual(result.data.settings, { enabled: true, retailConfigured: true, wholesaleConfigured: true });
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { retailPassword: "wholesale-password-456" } });
    assert.equal(result.response.status, 400, "a reset cannot reuse the other tier's password");
    const stored = await db.query(`SELECT "retailPasswordHash","wholesalePasswordHash" FROM catalog_price_access WHERE "shopId"=$1`, [shop]);
    assert.match(stored.rows[0].retailPasswordHash, /^\$2[aby]\$/);
    assert.notEqual(stored.rows[0].retailPasswordHash, "retail-password-123");
    assert.equal((await db.query(`SELECT has_table_privilege('anon','public.catalog_price_access','SELECT') AS allowed`)).rows[0].allowed, false);

    for (const path of [`/public/shops/${shop}`, `/public/products?shopId=${shop}`]) {
      result = await call(path);
      assert.equal(result.response.status, 200);
      assert.match(result.response.headers.get("cache-control"), /no-store/);
      assert.ok(result.data.products.length > 0);
      for (const p of result.data.products) for (const field of ["sellingPrice", "wholesalePrice", "wholesaleMinQty", "buyingPrice"]) assert.equal(field in p, false, `${path} leaked ${field}`);
    }
    result = await call("/public/orders", { method: "POST", body: { shopId: shop, customerName: "Fixture", customerPhone: "+255700000001", items: [{ productId: product, quantity: 1, pricingTier: "WHOLESALE" }] } });
    assert.equal(result.response.status, 403, "protected shop rejects legacy public orders");
    assert.equal(Number((await db.query(`SELECT COUNT(*) FROM customer_orders WHERE "shopId"=$1`, [shop])).rows[0].count), 0);
    result = await call("/public/catalog/login", { method: "POST", body: { shopId: shop, tier: "WHOLESALE", password: "retail-password-123" } });
    assert.equal(result.response.status, 401);
    result = await call("/public/catalog/login", { method: "POST", body: { shopId: shop, tier: "RETAIL", password: "retail-password-123" } });
    assert.equal(result.response.status, 200);
    const retailCookie = sessionCookie(result.response);
    result = await call(`/public/catalog/${shop}`, { cookie: retailCookie });
    assert.equal(result.response.status, 200);
    assert.equal(result.data.tier, "RETAIL");
    assert.equal(result.data.products[0].price, 5000);
    assert.equal("wholesalePrice" in result.data.products[0], false);
    assert.equal("minimumQuantity" in result.data.products[0], false);
    await db.query(`INSERT INTO catalog_price_access("shopId",enabled,"retailPasswordHash","wholesalePasswordHash") VALUES ($1,TRUE,'not-used-retail','not-used-wholesale')`, [otherShop]);
    assert.equal((await call(`/public/catalog/${otherShop}`, { cookie: retailCookie })).response.status, 401, "session cannot cross shops even if the other shop is protected");
    assert.equal((await call("/products", { cookie: retailCookie })).response.status, 401, "customer cookie cannot access shop tools");
    assert.equal((await call("/settings/catalog-access", { cookie: retailCookie })).response.status, 401, "customer cookie cannot manage passwords");

    result = await call("/public/catalog/login", { method: "POST", body: { shopId: shop, tier: "WHOLESALE", password: "wholesale-password-456" } });
    assert.equal(result.response.status, 200);
    const wholesaleCookie = sessionCookie(result.response);
    result = await call(`/public/catalog/${shop}`, { cookie: wholesaleCookie });
    assert.equal(result.data.tier, "WHOLESALE");
    assert.equal(result.data.products[0].price, 4000);
    assert.equal(result.data.products[0].minimumQuantity, 6);
    assert.equal("sellingPrice" in result.data.products[0], false);
    if (webUrl) {
      // Exercise the actual UI with the real local Edge Function, forwarding
      // only same-origin requests and its Set-Cookie response. No production
      // requests, fixture data or passwords leave the local stack.
      const frontendRequire = createRequire(new URL("../../frontend/package.json", import.meta.url));
      const { chromium } = frontendRequire("@playwright/test");
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await page.addInitScript(() => localStorage.setItem("uzuriliving_language", "en"));
        await page.route("**/api/public/**", async (route) => {
          const original = route.request();
          const url = new URL(original.url());
          const headers = await original.allHeaders();
          const response = await fetch(`${apiUrl}${url.pathname.slice(4)}${url.search}`, { method: original.method(), headers: { ...(headers.cookie ? { cookie: headers.cookie } : {}), ...(headers["content-type"] ? { "content-type": headers["content-type"] } : {}) }, ...(original.postData() ? { body: original.postData() } : {}) });
          const outgoing = { "content-type": response.headers.get("content-type") ?? "application/json" };
          const setCookie = response.headers.getSetCookie();
          if (setCookie.length) outgoing["set-cookie"] = setCookie[0];
          await route.fulfill({ status: response.status, headers: outgoing, body: await response.text() });
        });
        await page.goto(`${webUrl}/catalog/${shop}?tier=wholesale`);
        await page.getByRole("heading", { name: "Sign in to view prices" }).waitFor();
        await page.getByLabel("Catalogue password").fill("wholesale-password-456");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.getByText("TZS 4,000").waitFor();
        assert.equal(await page.getByText("TZS 5,000").count(), 0);
        await page.reload();
        await page.getByText("TZS 4,000").waitFor();
        await page.getByRole("button", { name: "Sign out" }).click();
        await page.getByRole("button", { name: "Retail", exact: true }).click();
        await page.getByLabel("Catalogue password").fill("retail-password-123");
        await page.getByRole("button", { name: "Sign in", exact: true }).click();
        await page.getByText("TZS 5,000").waitFor();
        assert.equal(await page.getByText("TZS 4,000").count(), 0);
      } finally { await browser.close(); }
    }
    result = await call("/settings/catalog-access", { method: "PATCH", token: otherToken, body: { shopId: shop, retailPassword: "other-retail-password-123" } });
    assert.equal(result.response.status, 200);
    assert.equal((await call(`/public/catalog/${shop}`, { cookie: retailCookie })).response.status, 200, "another owner cannot rotate this shop's password by supplying its id");
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { wholesalePassword: "new-wholesale-789" } });
    assert.equal(result.response.status, 200);
    assert.equal((await call(`/public/catalog/${shop}`, { cookie: wholesaleCookie })).response.status, 401, "rotated wholesale password revokes old session");
    assert.equal((await call(`/public/catalog/${shop}`, { cookie: retailCookie })).response.status, 200, "retail session remains valid");
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { enabled: false } });
    assert.equal(result.response.status, 400, "public exposure requires confirmation");
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { enabled: false, confirmPublicExposure: true } });
    assert.equal(result.response.status, 200);
    assert.equal((await call(`/public/catalog/${shop}`, { cookie: retailCookie })).response.status, 401);
    result = await call("/settings/catalog-access", { method: "PATCH", token: ownerToken, body: { enabled: true } });
    assert.equal(result.response.status, 200);
    assert.equal((await call(`/public/catalog/${shop}`, { cookie: retailCookie })).response.status, 401, "re-enabling cannot restore old sessions");
    await db.query(`INSERT INTO auth_rate_limits(key,attempts,"windowStartedAt") VALUES ($1,20,NOW()) ON CONFLICT (key) DO UPDATE SET attempts=20,"windowStartedAt"=NOW()`, [`catalog:${shop}:WHOLESALE`]);
    result = await call("/public/catalog/login", { method: "POST", body: { shopId: shop, tier: "WHOLESALE", password: "invalid-password" } });
    assert.equal(result.response.status, 429, "catalogue password guesses are throttled");
  } finally {
    // Only the two uniquely generated fixture accounts are removed. Their
    // test shops/products/settings cascade, never existing user records.
    await db.query(`DELETE FROM auth_rate_limits WHERE key = ANY($1::text[])`, [[`catalog:${shop}:RETAIL`, `catalog:${shop}:WHOLESALE`]]);
    await db.query(`DELETE FROM users WHERE id = ANY($1::text[])`, [[owner, otherOwner]]);
    await db.end();
  }
});
