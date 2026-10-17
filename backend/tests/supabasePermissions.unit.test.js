const { test } = require("node:test");
const assert = require("node:assert/strict");
const { hasStaffPermission, canReadProducts, shopRouteAllowed, redactProduct } = require("../../supabase/functions/api/permissions.ts");
const { csvCell, readAll } = require("../../supabase/functions/api/query.ts");
const { formatAppDateTime } = require("../../frontend/src/lib/timezone.ts");
const staff = (permissions, role = "CASHIER") => ({ role: "MERCHANT", staffId: "staff", staffRole: role, permissions });

test("cashiers can read POS products without receiving stock or administration access", () => {
  const user = staff({ canSell: true });
  assert.equal(canReadProducts(user), true);
  for (const path of ["/staff", "/expenses", "/dashboard", "/stock-counts", "/orders", "/barcodes/settings"]) assert.equal(shopRouteAllowed(user, path, "GET"), false, path);
  assert.equal(shopRouteAllowed(user, "/sales", "POST"), true);
});
test("stock control never inherits selling, staff or financial permissions", () => {
  const user = staff({ canManageStock: true }, "STOCK_CLERK");
  for (const key of ["canSell", "canManageStaff", "canViewReports", "canRecordExpenses"]) assert.equal(hasStaffPermission(user, key), false, key);
  assert.equal(hasStaffPermission(user, "canAddInventory"), true);
  assert.equal(shopRouteAllowed(user, "/sales", "POST"), false);
});
test("explicit manager restrictions are respected", () => {
  assert.equal(shopRouteAllowed(staff({ canSell: false }, "MANAGER"), "/sales", "POST"), false);
});
test("price viewers keep prices and order status but cannot access costs or incoming quantities", () => {
  const user = staff({ canViewInventoryAndPrices: true });
  assert.equal(canReadProducts(user), true);
  assert.equal(shopRouteAllowed(user, "/barcodes/lookup/123456", "GET"), true);
  assert.equal(shopRouteAllowed(user, "/sales", "POST"), false);
  const visible = redactProduct({ sellingPrice: 100, wholesalePrice: 80, buyingPrice: 50, onOrderStatus: "ON_THE_WAY", onOrderQuantity: 500 }, user);
  assert.equal(visible.buyingPrice, null);
  assert.equal(visible.onOrderStatus, "ON_THE_WAY");
  assert.equal(visible.sellingPrice, 100);
  assert.equal("onOrderQuantity" in visible, false);
});
test("reports page through the database row cap and surface failed pages", async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const rows = await readAll(() => ({ range: async (from, to) => ({ data: source.slice(from, to + 1), error: null }) }));
  assert.equal(rows.length, 1201);
  await assert.rejects(() => readAll(() => ({ range: async () => ({ data: null, error: new Error("database unavailable") }) })), /database unavailable/);
});
test("CSV exports escape quotes and spreadsheet formulas", () => {
  assert.equal(csvCell('A "quote"'), '"A ""quote"""');
  assert.equal(csvCell("=1+1"), '"\'=1+1"');
  assert.equal(csvCell(-10), '"-10"');
});

test("UTC database timestamps display in the shop time zone even on a local UTC+3 device", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Africa/Nairobi";
    const options = { hour: "2-digit", minute: "2-digit", hour12: false };
    assert.equal(formatAppDateTime("2026-10-17T06:51:32.632", "en-GB", options), "09:51");
    assert.equal(formatAppDateTime("2026-10-17T06:51:32.632Z", "en-GB", options), "09:51");
    assert.equal(formatAppDateTime("invalid"), "-");
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});
