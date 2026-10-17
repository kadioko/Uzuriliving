const test = require("node:test");
const assert = require("node:assert/strict");
const BASE = (process.env.SMOKE_BASE_URL || "https://ryadgenkvhgxjdyhbyqc.supabase.co/functions/v1/api").replace(/\/$/, "");
const phone = process.env.SMOKE_TEST_PHONE || "+255789123456";
const pin = process.env.SMOKE_TEST_PIN || "1234";
let ownerSession;
async function request(path, options = {}) {
  const response = await fetch(BASE + path, options);
  const payload = response.headers.get("content-type")?.includes("application/json") ? await response.json() : await response.text();
  return { response, payload };
}
async function login(loginPhone = phone, loginPin = pin) {
  const result = await request("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ phone: loginPhone, pin: loginPin }) });
  assert.equal(result.response.status, 200, "Demo login failed");
  const cookies = result.response.headers.getSetCookie();
  return { cookie: cookies.map((value) => value.split(";")[0]).join("; "), refresh: decodeURIComponent(cookies.find((value) => value.startsWith("uzuriliving_refresh=")).split(";")[0].split("=")[1]) };
}
function owner() { return ownerSession ??= login(); }
test("health and database status are healthy", async () => {
  for (const path of ["/health", "/status"]) {
    const { response, payload } = await request(path);
    assert.equal(response.status, 200);
    assert.equal(payload.status, "ok");
  }
});
test("registration rejects invalid fields without creating an account", async () => {
  for (const body of [{ phone: "", pin: "", name: "" }, { phone: "123", pin: "1234", name: "Invalid" }, { phone: "+255700000001", pin: "12", name: "Invalid" }, { phone: "+255700000001", pin: "1234", name: "Invalid", role: "ADMIN" }]) {
    const result = await request("/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(result.response.status, 400);
  }
});
test("owner operational read endpoints return valid data", async () => {
  const { cookie } = await owner();
  const paths = ["/auth/me", "/products?limit=2", "/dashboard", "/dashboard/analytics", "/purchases/analytics", "/sales?limit=2", "/debts", "/expenses", "/orders", "/customer-orders", "/staff", "/stock-counts", "/stock/movements", "/settings", "/barcodes/report", "/notifications", "/assistant/actions"];
  const productResult = await request("/products?limit=1", { headers: { cookie } });
  assert.equal(productResult.response.status, 200);
  if (productResult.payload.products?.[0]?.id) paths.push(`/products/${productResult.payload.products[0].id}/analytics?period=30`);
  for (const path of paths) {
    const { response, payload } = await request(path, { headers: { cookie } });
    assert.equal(response.status, 200, path + ": " + JSON.stringify(payload));
  }
});
test("cashier reads POS products but cannot read restricted administrative data", async () => {
  const { cookie } = await login("+255711234567", "1234");
  assert.equal((await request("/products?limit=2", { headers: { cookie } })).response.status, 200);
  for (const path of ["/staff", "/dashboard", "/expenses", "/stock-counts", "/orders", "/barcodes/settings"]) assert.equal((await request(path, { headers: { cookie } })).response.status, 403, path);
});
test("stock clerk cannot submit sales or read staff and financial reports", async () => {
  const { cookie } = await login("+255722345678", "1234");
  for (const path of ["/staff", "/dashboard", "/expenses", "/sales"]) assert.equal((await request(path, { headers: { cookie } })).response.status, 403, path);
  const result = await request("/sales", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: '{"items":[]}' });
  assert.equal(result.response.status, 403);
});
test("refresh tokens and invalid tokens cannot authenticate API access", async () => {
  const { refresh } = await owner();
  for (const token of [refresh, "invalid"]) assert.equal((await request("/auth/me", { headers: { Authorization: "Bearer " + token } })).response.status, 401);
});
test("invalid writes fail without changing demo stock or balances", async () => {
  const { cookie } = await owner();
  for (const [path, body] of [["/sales", { items: [] }], ["/stock/adjust", { productId: "", type: "BAD", quantity: 0 }], ["/public/orders", { shopId: "demo-shop-uzuri-0001", customerName: "Invalid", customerPhone: "+255700000000", items: [{ productId: "demo-product-0001", quantity: -1 }] }]]) {
    const result = await request(path, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal(result.response.status, 400, path);
  }
});
test("CSV downloads use the authenticated shop", async () => {
  const { cookie } = await owner();
  for (const path of ["/exports/sales.csv", "/exports/inventory.csv"]) {
    const result = await request(path, { headers: { cookie } });
    assert.equal(result.response.status, 200, path);
    assert.match(result.response.headers.get("content-type"), /text\/csv/);
    assert.ok(result.payload.split("\n").length > 1);
  }
});
test("foreign browser origins cannot submit state changes", async () => {
  assert.equal((await request("/auth/logout", { method: "POST", headers: { Origin: "https://invalid.example" } })).response.status, 403);
});
