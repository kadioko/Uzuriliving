const router = require("express").Router();
const ctrl = require("../controllers/supplier.controller");
const { authenticate, requireRole, requirePermission } = require("../middleware/auth");
const { requireActiveSubscription } = require("../middleware/subscription");
const { supplierCreateValidation, supplierUpdateValidation, supplierOrdersValidation } = require("../middleware/validation");

router.use(authenticate);

// Supplier portal routes must be declared before /:id so "portal" is not treated as a supplier id.
router.get("/portal/orders", requireRole("SUPPLIER", "ADMIN"), supplierOrdersValidation, ctrl.myOrders);
router.get("/portal/dashboard", requireRole("SUPPLIER", "ADMIN"), ctrl.supplierDashboard);
router.get("/portal/products", requireRole("SUPPLIER", "ADMIN"), ctrl.listPortalProducts);
router.post("/portal/products", requireRole("SUPPLIER", "ADMIN"), ctrl.createPortalProduct);
router.patch("/portal/products/:productId", requireRole("SUPPLIER", "ADMIN"), ctrl.updatePortalProduct);
router.delete("/portal/products/:productId", requireRole("SUPPLIER", "ADMIN"), ctrl.removePortalProduct);

// Merchant-facing supplier directory (read-only is fine for any role)
router.get("/", ctrl.list);
router.post("/:id/catalog/:catalogProductId/import", requireRole("MERCHANT"), requirePermission("canManageStock"), requireActiveSubscription, ctrl.importCatalogProduct);
router.get("/:id", ctrl.get);
router.post("/", requireRole("MERCHANT", "ADMIN"), requirePermission("canManageStock"), requireActiveSubscription, supplierCreateValidation, ctrl.create);
router.patch("/:id", requireRole("MERCHANT", "ADMIN"), requirePermission("canManageStock"), requireActiveSubscription, supplierUpdateValidation, ctrl.update);
router.delete("/:id", requireRole("ADMIN"), ctrl.remove);

module.exports = router;
