const { body, query, validationResult } = require("express-validator");

const PAYMENT_METHODS = ["CASH", "MPESA", "TIGOPESA", "AIRTEL_MONEY", "HALOPESA", "BANK", "CREDIT"];
const ORDER_STATUSES = ["PENDING", "CONFIRMED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const SUMMARY_PERIODS = ["today", "week", "month", "all"];
const STOCK_MOVEMENT_TYPES = ["IN", "OUT", "ADJUSTMENT"];

function handleValidationErrors(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    error: result.array()[0].msg,
    details: result.array().map((item) => ({ field: item.path, message: item.msg })),
  });
}

const productCreateValidation = [
  body("name").trim().notEmpty().withMessage("Product name is required"),
  body("sku").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("SKU must be 100 characters or less"),
  body("unit").optional({ values: "falsy" }).trim().isLength({ max: 30 }).withMessage("Unit must be 30 characters or less"),
  body("buyingPrice").notEmpty().withMessage("Buying price is required").bail().isInt({ min: 0 }).withMessage("Buying price must be a whole TZS amount"),
  body("sellingPrice").notEmpty().withMessage("Selling price is required").bail().isInt({ min: 0 }).withMessage("Selling price must be a whole TZS amount"),
  body("wholesalePrice").optional({ nullable: true, values: "falsy" }).isInt({ min: 0 }).withMessage("Wholesale price must be a whole TZS amount"),
  body("wholesaleMinQty").optional({ nullable: true, values: "falsy" }).isInt({ min: 1 }).withMessage("Wholesale minimum quantity must be 1 or greater"),
  body("currentStock").optional().isInt({ min: 0 }).withMessage("Current stock must be a whole number 0 or greater"),
  body("minimumStock").optional().isInt({ min: 0 }).withMessage("Minimum stock must be a whole number 0 or greater"),
  body("supplierId").optional({ values: "falsy" }).isString().withMessage("Supplier ID must be a string"),
  body("doesNotExpire").optional().isBoolean().withMessage("doesNotExpire must be true or false"),
  body("expiryDate").optional({ values: "falsy" }).isISO8601().withMessage("Expiry date must be a valid date"),
  body("barcode").optional({ nullable: true, values: "falsy" }).trim().isLength({ min: 4, max: 64 }).matches(/^[A-Za-z0-9._-]+$/).withMessage("Barcode format is invalid"),
  body("barcodeType").optional({ values: "falsy" }).isIn(["EAN13", "UPC", "CODE128", "INTERNAL"]).withMessage("Invalid barcode type"),
  body("generateBarcode").optional().isBoolean().withMessage("generateBarcode must be true or false"),
  handleValidationErrors,
];

const productUpdateValidation = [
  body("name").optional().trim().notEmpty().withMessage("Product name cannot be empty"),
  body("sku").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("SKU must be 100 characters or less"),
  body("unit").optional({ values: "falsy" }).trim().isLength({ max: 30 }).withMessage("Unit must be 30 characters or less"),
  body("buyingPrice").optional().isInt({ min: 0 }).withMessage("Buying price must be a whole TZS amount"),
  body("sellingPrice").optional().isInt({ min: 0 }).withMessage("Selling price must be a whole TZS amount"),
  body("wholesalePrice").optional({ nullable: true, values: "falsy" }).isInt({ min: 0 }).withMessage("Wholesale price must be a whole TZS amount"),
  body("wholesaleMinQty").optional({ nullable: true, values: "falsy" }).isInt({ min: 1 }).withMessage("Wholesale minimum quantity must be 1 or greater"),
  body("minimumStock").optional().isInt({ min: 0 }).withMessage("Minimum stock must be a whole number 0 or greater"),
  body("supplierId").optional({ nullable: true }).isString().withMessage("Supplier ID must be a string"),
  body("isActive").optional().isBoolean().withMessage("isActive must be true or false"),
  body("doesNotExpire").optional().isBoolean().withMessage("doesNotExpire must be true or false"),
  body("expiryDate").optional({ nullable: true, values: "falsy" }).isISO8601().withMessage("Expiry date must be a valid date"),
  body("barcode").optional({ nullable: true, values: "falsy" }).trim().isLength({ min: 4, max: 64 }).matches(/^[A-Za-z0-9._-]+$/).withMessage("Barcode format is invalid"),
  body("barcodeType").optional({ values: "falsy" }).isIn(["EAN13", "UPC", "CODE128", "INTERNAL"]).withMessage("Invalid barcode type"),
  body("generateBarcode").optional().isBoolean().withMessage("generateBarcode must be true or false"),
  handleValidationErrors,
];

const productListValidation = [
  query("lowStock").optional().isIn(["true", "false"]).withMessage("lowStock must be true or false"),
  query("search").optional().isString().withMessage("search must be a string"),
  query("page").optional().isInt({ min: 1 }).withMessage("page must be 1 or greater"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("limit must be between 1 and 200"),
  handleValidationErrors,
];

const saleListValidation = [
  query("from").optional().isISO8601().withMessage("from must be a valid date"),
  query("to").optional().isISO8601().withMessage("to must be a valid date"),
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("limit must be between 1 and 200"),
  query("offset").optional().isInt({ min: 0 }).withMessage("offset must be 0 or greater"),
  handleValidationErrors,
];

const saleSummaryValidation = [
  query("period").optional().isIn(SUMMARY_PERIODS).withMessage("period must be today, week, month, or all"),
  handleValidationErrors,
];

const saleCreateValidation = [
  body("items").isArray({ min: 1 }).withMessage("Sale must have at least one item"),
  body("items.*.productId").isString().notEmpty().withMessage("Each sale item must include a productId"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Each sale item quantity must be a whole number greater than 0"),
  body("items.*.unitPrice").optional({ values: "falsy" }).isInt({ min: 0 }).withMessage("Each sale item unitPrice must be a whole TZS amount"),
  body("clientReference").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("Sale reference must be 100 characters or less"),
  body("saleMode").optional({ values: "falsy" }).custom((v) => ["RETAIL", "WHOLESALE"].includes(String(v).toUpperCase())).withMessage("saleMode must be RETAIL or WHOLESALE"),
  body("paymentMethod").optional().custom((value) => PAYMENT_METHODS.includes(String(value).toUpperCase())).withMessage("Invalid payment method"),
  body("paymentRef").optional({ values: "falsy" }).trim().isLength({ max: 100 }).withMessage("Payment reference must be 100 characters or less"),
  body("customerPhone").optional({ values: "falsy" }).trim().isLength({ max: 30 }).withMessage("Customer phone must be 30 characters or less"),
  body("note").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Note must be 500 characters or less"),
  handleValidationErrors,
];

const orderListValidation = [
  query("status").optional().custom((value) => ORDER_STATUSES.includes(String(value).toUpperCase())).withMessage("Invalid order status"),
  handleValidationErrors,
];

const orderCreateValidation = [
  body("supplierId").isString().notEmpty().withMessage("supplierId is required"),
  body("items").isArray({ min: 1 }).withMessage("Order must include at least one item"),
  body("items.*.productId").isString().notEmpty().withMessage("Each order item must include a productId"),
  body("items.*.quantity").isInt({ min: 1 }).withMessage("Each order item quantity must be a whole number greater than 0"),
  body("items.*.unitPrice").optional({ values: "falsy" }).isInt({ min: 0 }).withMessage("Each order item unitPrice must be a whole TZS amount"),
  body("note").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Note must be 500 characters or less"),
  handleValidationErrors,
];

const stockAdjustValidation = [
  body("productId").isString().notEmpty().withMessage("productId is required"),
  body("type").custom((value) => STOCK_MOVEMENT_TYPES.includes(String(value).toUpperCase())).withMessage("type must be IN, OUT, or ADJUSTMENT"),
  body("quantity").isInt({ min: 0 }).withMessage("quantity must be a whole number 0 or greater").bail().custom((value, { req }) => {
    if (String(req.body.type || "").toUpperCase() !== "ADJUSTMENT" && Number(value) === 0) {
      throw new Error("quantity must be greater than 0 for stock in or out");
    }
    return true;
  }),
  body("note").optional({ values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Note must be 500 characters or less"),
  handleValidationErrors,
];

const stockMovementsValidation = [
  query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("limit must be between 1 and 200"),
  handleValidationErrors,
];

const supplierCreateValidation = [
  body("name").trim().notEmpty().withMessage("Supplier name is required"),
  body("phone").trim().notEmpty().withMessage("Supplier phone is required").bail().isLength({ max: 30 }).withMessage("Supplier phone must be 30 characters or less"),
  body("address").optional({ values: "falsy" }).trim().isLength({ max: 255 }).withMessage("Address must be 255 characters or less"),
  handleValidationErrors,
];

const supplierUpdateValidation = [
  body("name").optional().trim().notEmpty().withMessage("Supplier name cannot be empty"),
  body("phone").optional().trim().notEmpty().withMessage("Supplier phone cannot be empty").bail().isLength({ max: 30 }).withMessage("Supplier phone must be 30 characters or less"),
  body("address").optional({ nullable: true, values: "falsy" }).trim().isLength({ max: 255 }).withMessage("Address must be 255 characters or less"),
  body("verificationStatus").optional().custom((value) => ["UNVERIFIED", "NEEDS_REVIEW", "VERIFIED", "REJECTED"].includes(String(value).toUpperCase())).withMessage("Invalid supplier verification status"),
  body("adminNotes").optional({ nullable: true, values: "falsy" }).trim().isLength({ max: 500 }).withMessage("Admin notes must be 500 characters or less"),
  handleValidationErrors,
];

const supplierOrdersValidation = [
  query("status").optional().custom((value) => ORDER_STATUSES.includes(String(value).toUpperCase())).withMessage("Invalid order status"),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  productListValidation,
  productCreateValidation,
  productUpdateValidation,
  saleListValidation,
  saleSummaryValidation,
  saleCreateValidation,
  orderListValidation,
  orderCreateValidation,
  stockAdjustValidation,
  stockMovementsValidation,
  supplierCreateValidation,
  supplierUpdateValidation,
  supplierOrdersValidation,
};
