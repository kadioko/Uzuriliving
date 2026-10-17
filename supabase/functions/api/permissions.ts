type Principal = Record<string, unknown>;

export function hasStaffPermission(user: Principal, permission: string): boolean {
  if (user.role === "ADMIN" || (user.role === "MERCHANT" && (!user.staffId || user.staffRole === "OWNER"))) return true;
  const permissions = user.permissions as Record<string, unknown> | undefined;
  // Stock control inherits only stock actions, never selling, finance or staff administration.
  return permissions?.[permission] === true || (["canViewInventoryAndPrices", "canAddInventory", "canManageExpiry", "canRefundStock"].includes(permission) && permissions?.canManageStock === true);
}

export function canReadProducts(user: Principal): boolean {
  return ["canSell", "canViewInventoryAndPrices", "canAddInventory", "canManageExpiry", "canRefundStock"].some((key) => hasStaffPermission(user, key));
}

export function shopRouteAllowed(user: Principal, path: string, method: string): boolean {
  const has = (key: string) => hasStaffPermission(user, key);
  if (path === "/staff" || path.startsWith("/staff/")) return has("canManageStaff");
  if (["/sales", "/debts", "/customer-orders", "/sync/events"].some((root) => path === root || path.startsWith(`${root}/`))) return has("canSell");
  if (path === "/expenses" || path.startsWith("/expenses/")) return has("canRecordExpenses");
  if (["/dashboard", "/purchases", "/assistant", "/exports"].some((root) => path === root || path.startsWith(`${root}/`))) return has("canViewReports");
  if (path === "/stock-counts" || path.startsWith("/stock-counts/") || path === "/orders" || path.startsWith("/orders/")) return has("canManageStock");
  if (path === "/barcodes/settings") return has("canManageBarcodeSettings");
  if (path.startsWith("/barcodes/lookup/")) return method === "GET" && canReadProducts(user);
  if (path.startsWith("/barcodes/")) return has("canManageStock") || has("canManageBarcodeSettings");
  if (path === "/suppliers" || path.startsWith("/suppliers/")) return canReadProducts(user);
  if (path === "/storage/upload-url") return has("canAddInventory");
  if (path === "/push/preferences" && method !== "GET") return has("canManageStaff");
  if (path === "/push/deliveries") return has("canViewReports");
  return true;
}

export function redactProduct(product: Principal, user: Principal): Principal {
  const result = { ...product };
  if (!hasStaffPermission(user, "canViewReports")) result.buyingPrice = null;
  if (!hasStaffPermission(user, "canManageStock")) {
    for (const key of ["onOrderQuantity", "onOrderOrderedQuantity", "onOrderInTransitQuantity"]) delete result[key];
  }
  return result;
}
