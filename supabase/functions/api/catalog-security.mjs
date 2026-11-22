// Keep this module dependency-free so the response boundaries and session
// rules can be tested under Node as well as the Edge runtime.
export function catalogAccessSummary(row) {
  return {
    enabled: row?.enabled === true,
    retailConfigured: Boolean(row?.retailPasswordHash),
    wholesaleConfigured: Boolean(row?.wholesalePasswordHash),
  };
}

export function publicCatalogProduct(product, protectedCatalog) {
  // Use an allowlist: adding a sensitive product column later must not make it
  // public accidentally. The shop information is attached by the caller.
  const visible = {
    id: product.id,
    name: product.name,
    unit: product.unit,
    currentStock: product.currentStock,
    imageUrl: product.imageUrl,
    shopId: product.shopId,
    catalogProtected: Boolean(protectedCatalog),
  };
  return protectedCatalog ? visible : {
    ...visible,
    sellingPrice: product.sellingPrice,
    wholesalePrice: product.wholesalePrice,
    wholesaleMinQty: product.wholesaleMinQty,
  };
}

export function privateCatalogProduct(product, tier) {
  if (tier !== "RETAIL" && tier !== "WHOLESALE") throw new Error("Invalid catalog tier");
  return {
    id: product.id,
    name: product.name,
    unit: product.unit,
    currentStock: product.currentStock,
    imageUrl: product.imageUrl,
    price: tier === "RETAIL" ? product.sellingPrice : product.wholesalePrice,
    ...(tier === "WHOLESALE" ? { minimumQuantity: product.wholesaleMinQty } : {}),
  };
}

export function catalogSessionTier(payload, shopId, settings) {
  if (!settings?.enabled || payload?.type !== "catalog" || payload.shopId !== shopId) return null;
  if (payload.tier === "RETAIL" && payload.version === settings.retailVersion && settings.retailPasswordHash) return "RETAIL";
  if (payload.tier === "WHOLESALE" && payload.version === settings.wholesaleVersion && settings.wholesalePasswordHash) return "WHOLESALE";
  return null;
}

export function validCatalogPassword(value) {
  if (typeof value !== "string" || value.trim().length < 10) return false;
  // bcrypt only considers the first 72 UTF-8 bytes; reject longer values
  // rather than letting two different passwords authenticate identically.
  return new TextEncoder().encode(value).length <= 72;
}
