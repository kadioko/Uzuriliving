import test from "node:test";
import assert from "node:assert/strict";
import { catalogAccessSummary, catalogSessionTier, privateCatalogProduct, publicCatalogProduct, validCatalogPassword } from "../functions/api/catalog-security.mjs";

const product = { id: "p", shopId: "shop-a", name: "Example", unit: "pcs", currentStock: 8, imageUrl: "image", sellingPrice: 5000, wholesalePrice: 4000, wholesaleMinQty: 6, buyingPrice: 1000, futureSecret: "private" };
const settings = { enabled: true, retailPasswordHash: "retail-hash", wholesalePasswordHash: "wholesale-hash", retailVersion: "retail-v1", wholesaleVersion: "wholesale-v1" };

test("protected public catalogue exposes neither price nor unlisted fields", () => {
  const visible = publicCatalogProduct(product, true);
  assert.deepEqual(Object.keys(visible).sort(), ["catalogProtected", "currentStock", "id", "imageUrl", "name", "shopId", "unit"].sort());
  assert.equal(visible.catalogProtected, true);
  assert.equal(publicCatalogProduct(product, false).sellingPrice, 5000);
  assert.equal("buyingPrice" in publicCatalogProduct(product, false), false);
  assert.equal("futureSecret" in publicCatalogProduct(product, false), false);
});

test("private catalogue returns only the authenticated tier's price", () => {
  const retail = privateCatalogProduct(product, "RETAIL");
  const wholesale = privateCatalogProduct(product, "WHOLESALE");
  assert.equal(retail.price, 5000);
  assert.equal(wholesale.price, 4000);
  assert.equal(wholesale.minimumQuantity, 6);
  for (const result of [retail, wholesale]) {
    for (const field of ["sellingPrice", "wholesalePrice", "buyingPrice", "futureSecret"]) assert.equal(field in result, false);
  }
  assert.equal("minimumQuantity" in retail, false);
  const noWholesalePrice = privateCatalogProduct({ ...product, wholesalePrice: null }, "WHOLESALE");
  assert.equal(noWholesalePrice.price, null, "a missing wholesale price must not fall back to the retail price");
  assert.equal("sellingPrice" in noWholesalePrice, false);
  assert.throws(() => privateCatalogProduct(product, "ADMIN"));
});

test("catalogue sessions are shop- and tier-scoped and revoked on password rotation", () => {
  const retail = { type: "catalog", shopId: "shop-a", tier: "RETAIL", version: "retail-v1" };
  const wholesale = { type: "catalog", shopId: "shop-a", tier: "WHOLESALE", version: "wholesale-v1" };
  assert.equal(catalogSessionTier(retail, "shop-a", settings), "RETAIL");
  assert.equal(catalogSessionTier(wholesale, "shop-a", settings), "WHOLESALE");
  assert.equal(catalogSessionTier(retail, "shop-b", settings), null);
  assert.equal(catalogSessionTier({ ...retail, tier: "WHOLESALE" }, "shop-a", settings), null);
  assert.equal(catalogSessionTier({ ...retail, type: "access" }, "shop-a", settings), null);
  assert.equal(catalogSessionTier(retail, "shop-a", { ...settings, retailVersion: "rotated" }), null);
  assert.equal(catalogSessionTier(wholesale, "shop-a", { ...settings, retailVersion: "rotated" }), "WHOLESALE");
  assert.equal(catalogSessionTier(retail, "shop-a", { ...settings, enabled: false }), null);
});

test("credential status never contains password hashes and rejects unsafe lengths", () => {
  assert.deepEqual(catalogAccessSummary(settings), { enabled: true, retailConfigured: true, wholesaleConfigured: true });
  assert.equal(validCatalogPassword("short"), false);
  assert.equal(validCatalogPassword("          "), false);
  assert.equal(validCatalogPassword("long-enough-password"), true);
  assert.equal(validCatalogPassword("a".repeat(73)), false);
  assert.equal(validCatalogPassword("é".repeat(37)), false);
});
