-- Uzuri Living uses Tanzanian shillings. Store all money as whole TZS to avoid
-- floating-point drift in sales, debts, expenses, orders, and subscriptions.
ALTER TABLE "subscription_payments" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;
ALTER TABLE "offline_sync_events" ALTER COLUMN "total" TYPE INTEGER USING CASE WHEN "total" IS NULL THEN NULL ELSE ROUND("total")::INTEGER END;
ALTER TABLE "products" ALTER COLUMN "buyingPrice" TYPE INTEGER USING ROUND("buyingPrice")::INTEGER;
ALTER TABLE "products" ALTER COLUMN "sellingPrice" TYPE INTEGER USING ROUND("sellingPrice")::INTEGER;
ALTER TABLE "products" ALTER COLUMN "wholesalePrice" TYPE INTEGER USING CASE WHEN "wholesalePrice" IS NULL THEN NULL ELSE ROUND("wholesalePrice")::INTEGER END;
ALTER TABLE "supplier_catalog_products" ALTER COLUMN "price" TYPE INTEGER USING ROUND("price")::INTEGER;
ALTER TABLE "sales" ALTER COLUMN "totalAmount" TYPE INTEGER USING ROUND("totalAmount")::INTEGER;
ALTER TABLE "sales" ALTER COLUMN "profit" TYPE INTEGER USING ROUND("profit")::INTEGER;
ALTER TABLE "debts" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;
ALTER TABLE "debts" ALTER COLUMN "amountPaid" TYPE INTEGER USING ROUND("amountPaid")::INTEGER;
ALTER TABLE "expenses" ALTER COLUMN "amount" TYPE INTEGER USING ROUND("amount")::INTEGER;
ALTER TABLE "sale_items" ALTER COLUMN "unitPrice" TYPE INTEGER USING ROUND("unitPrice")::INTEGER;
ALTER TABLE "sale_items" ALTER COLUMN "buyingPrice" TYPE INTEGER USING ROUND("buyingPrice")::INTEGER;
ALTER TABLE "sale_items" ALTER COLUMN "totalPrice" TYPE INTEGER USING ROUND("totalPrice")::INTEGER;
ALTER TABLE "orders" ALTER COLUMN "totalAmount" TYPE INTEGER USING CASE WHEN "totalAmount" IS NULL THEN NULL ELSE ROUND("totalAmount")::INTEGER END;
ALTER TABLE "order_items" ALTER COLUMN "unitPrice" TYPE INTEGER USING CASE WHEN "unitPrice" IS NULL THEN NULL ELSE ROUND("unitPrice")::INTEGER END;
ALTER TABLE "customer_orders" ALTER COLUMN "totalAmount" TYPE INTEGER USING ROUND("totalAmount")::INTEGER;
ALTER TABLE "customer_order_items" ALTER COLUMN "unitPrice" TYPE INTEGER USING ROUND("unitPrice")::INTEGER;

ALTER TABLE "sales" ADD COLUMN "clientReference" TEXT;
CREATE UNIQUE INDEX "sales_shopId_clientReference_key" ON "sales"("shopId", "clientReference");

ALTER TABLE "suppliers" ADD COLUMN "createdByShopId" TEXT;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdByShopId_fkey" FOREIGN KEY ("createdByShopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "suppliers_createdByShopId_idx" ON "suppliers"("createdByShopId");

ALTER TABLE "products" ADD COLUMN "supplierCatalogProductId" TEXT;
ALTER TABLE "products" ADD CONSTRAINT "products_supplierCatalogProductId_fkey" FOREIGN KEY ("supplierCatalogProductId") REFERENCES "supplier_catalog_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "products_shopId_supplierCatalogProductId_key" ON "products"("shopId", "supplierCatalogProductId");

CREATE TABLE "debt_payments" (
  "id" TEXT NOT NULL,
  "debtId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
  "paymentRef" TEXT,
  "note" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "debt_payments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "debt_payments_debtId_createdAt_idx" ON "debt_payments"("debtId", "createdAt");

-- Preserve the balance while giving historic partial payments a traceable entry.
INSERT INTO "debt_payments" ("id", "debtId", "amount", "paymentMethod", "note", "createdAt")
SELECT 'legacy_' || "id", "id", "amountPaid", 'CASH', 'Opening balance migrated from legacy debt record', "createdAt"
FROM "debts"
WHERE "amountPaid" > 0;
