-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MERCHANT', 'SUPPLIER', 'ADMIN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MPESA', 'TIGOPESA', 'AIRTEL_MONEY', 'HALOPESA', 'BANK', 'CREDIT');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaleChannel" AS ENUM ('POS', 'ONLINE');

-- CreateEnum
CREATE TYPE "PricingTier" AS ENUM ('RETAIL', 'WHOLESALE');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'SALARY', 'UTILITIES', 'TRANSPORT', 'STOCK', 'MARKETING', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'MANAGER', 'CASHIER', 'STOCK_CLERK');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NEW', 'CONTACTED', 'NEEDS_HELP', 'SETUP_DONE', 'ACTIVATED', 'PAID', 'CONVERTED', 'CHURN_RISK');

-- CreateEnum
CREATE TYPE "BarcodeType" AS ENUM ('EAN13', 'UPC', 'CODE128', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('BUG', 'FEATURE_REQUEST', 'ACCOUNT_ISSUE', 'BILLING', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MERCHANT',
    "language" TEXT NOT NULL DEFAULT 'sw',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "district" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE_TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "subscriptionEndsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCatalogPublished" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NEW',
    "lastContactedAt" TIMESTAMP(3),
    "followUpNotes" TEXT,
    "barcodeScanningEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bluetoothScannerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "barcodeGenerationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "barcodeAutoFocus" BOOLEAN NOT NULL DEFAULT true,
    "barcodeSuccessSound" BOOLEAN NOT NULL DEFAULT true,
    "barcodeVibrate" BOOLEAN NOT NULL DEFAULT true,
    "barcodeAutoAddToCart" BOOLEAN NOT NULL DEFAULT true,
    "acquisitionSource" TEXT,
    "acquisitionMedium" TEXT,
    "acquisitionCampaign" TEXT,
    "acquisitionContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_events" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pagePath" TEXT,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "content" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "method" TEXT NOT NULL DEFAULT 'MANUAL',
    "reference" TEXT,
    "normalizedReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "proofUrl" TEXT,
    "sourceReportId" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offline_sync_events" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "deviceId" TEXT,
    "deviceLabel" TEXT,
    "status" TEXT NOT NULL,
    "total" INTEGER,
    "message" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "localId" TEXT,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "contactedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offline_sync_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_actions" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'ASSISTANT',
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "userId" TEXT,
    "staffId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "lowStock" BOOLEAN NOT NULL DEFAULT true,
    "debtDue" BOOLEAN NOT NULL DEFAULT true,
    "subscriptionExpiry" BOOLEAN NOT NULL DEFAULT true,
    "dailyAssistant" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_deliveries" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT NOT NULL DEFAULT '/notifications',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "retryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_usage_events" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "action" TEXT,
    "route" TEXT NOT NULL,
    "userId" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdByShopId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "barcodeType" "BarcodeType",
    "barcodeGenerated" BOOLEAN NOT NULL DEFAULT false,
    "barcodeCreatedAt" TIMESTAMP(3),
    "barcodeUpdatedAt" TIMESTAMP(3),
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "buyingPrice" INTEGER NOT NULL,
    "sellingPrice" INTEGER NOT NULL,
    "wholesalePrice" INTEGER,
    "wholesaleMinQty" INTEGER,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "minimumStock" INTEGER NOT NULL DEFAULT 5,
    "expiryDate" TIMESTAMP(3),
    "doesNotExpire" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierCatalogProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "barcode_scans" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT,
    "barcode" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT 'POS',
    "found" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "barcode_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_counts" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_items" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expected" INTEGER NOT NULL,
    "counted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_catalog_products" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "price" INTEGER NOT NULL,
    "minOrderQty" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_catalog_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "profit" INTEGER NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentRef" TEXT,
    "channel" "SaleChannel" NOT NULL DEFAULT 'POS',
    "pricingTier" "PricingTier" NOT NULL DEFAULT 'RETAIL',
    "customerPhone" TEXT,
    "note" TEXT,
    "clientReference" TEXT,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "note" TEXT,
    "status" "DebtStatus" NOT NULL DEFAULT 'OPEN',
    "shopId" TEXT NOT NULL,
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "paymentRef" TEXT,
    "note" TEXT,
    "recordedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "vendor" TEXT,
    "note" TEXT,
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "pin" TEXT,
    "language" TEXT NOT NULL DEFAULT 'sw',
    "role" "StaffRole" NOT NULL DEFAULT 'CASHIER',
    "canSell" BOOLEAN NOT NULL DEFAULT true,
    "canManageStock" BOOLEAN NOT NULL DEFAULT false,
    "canManageStaff" BOOLEAN NOT NULL DEFAULT false,
    "canViewReports" BOOLEAN NOT NULL DEFAULT false,
    "canRecordExpenses" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "buyingPrice" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER,
    "note" TEXT,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_orders" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "note" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "shopId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_order_items" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "pricingTier" "PricingTier" NOT NULL DEFAULT 'RETAIL',
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "customer_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "shops_userId_key" ON "shops"("userId");

-- CreateIndex
CREATE INDEX "marketing_events_eventName_createdAt_idx" ON "marketing_events"("eventName", "createdAt");

-- CreateIndex
CREATE INDEX "marketing_events_source_campaign_createdAt_idx" ON "marketing_events"("source", "campaign", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_normalizedReference_key" ON "subscription_payments"("normalizedReference");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_sourceReportId_key" ON "subscription_payments"("sourceReportId");

-- CreateIndex
CREATE INDEX "subscription_payments_shopId_paidAt_idx" ON "subscription_payments"("shopId", "paidAt");

-- CreateIndex
CREATE INDEX "offline_sync_events_shopId_createdAt_idx" ON "offline_sync_events"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "offline_sync_events_status_createdAt_idx" ON "offline_sync_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "offline_sync_events_resolutionStatus_createdAt_idx" ON "offline_sync_events"("resolutionStatus", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_actions_shopId_status_idx" ON "assistant_actions"("shopId", "status");

-- CreateIndex
CREATE INDEX "assistant_actions_createdAt_idx" ON "assistant_actions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_actions_shopId_actionKey_key" ON "assistant_actions"("shopId", "actionKey");

-- CreateIndex
CREATE INDEX "push_subscriptions_shopId_isActive_idx" ON "push_subscriptions"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_shopId_deviceId_key" ON "push_subscriptions"("shopId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_shopId_key" ON "notification_preferences"("shopId");

-- CreateIndex
CREATE INDEX "push_deliveries_status_retryAt_idx" ON "push_deliveries"("status", "retryAt");

-- CreateIndex
CREATE INDEX "push_deliveries_shopId_createdAt_idx" ON "push_deliveries"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "app_usage_events_shopId_eventName_createdAt_idx" ON "app_usage_events"("shopId", "eventName", "createdAt");

-- CreateIndex
CREATE INDEX "app_usage_events_shopId_deviceId_createdAt_idx" ON "app_usage_events"("shopId", "deviceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_userId_key" ON "suppliers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "products_barcode_key" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_shopId_isActive_idx" ON "products"("shopId", "isActive");

-- CreateIndex
CREATE INDEX "products_shopId_barcode_idx" ON "products"("shopId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_shopId_supplierCatalogProductId_key" ON "products"("shopId", "supplierCatalogProductId");

-- CreateIndex
CREATE INDEX "barcode_scans_shopId_barcode_idx" ON "barcode_scans"("shopId", "barcode");

-- CreateIndex
CREATE INDEX "barcode_scans_shopId_createdAt_idx" ON "barcode_scans"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_counts_shopId_status_idx" ON "stock_counts"("shopId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_items_stockCountId_productId_key" ON "stock_count_items"("stockCountId", "productId");

-- CreateIndex
CREATE INDEX "supplier_catalog_products_supplierId_isAvailable_idx" ON "supplier_catalog_products"("supplierId", "isAvailable");

-- CreateIndex
CREATE INDEX "sales_shopId_createdAt_idx" ON "sales"("shopId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_shopId_clientReference_key" ON "sales"("shopId", "clientReference");

-- CreateIndex
CREATE UNIQUE INDEX "debts_saleId_key" ON "debts"("saleId");

-- CreateIndex
CREATE INDEX "debts_shopId_status_idx" ON "debts"("shopId", "status");

-- CreateIndex
CREATE INDEX "debts_customerPhone_idx" ON "debts"("customerPhone");

-- CreateIndex
CREATE INDEX "debt_payments_debtId_createdAt_idx" ON "debt_payments"("debtId", "createdAt");

-- CreateIndex
CREATE INDEX "expenses_shopId_spentAt_idx" ON "expenses"("shopId", "spentAt");

-- CreateIndex
CREATE INDEX "expenses_shopId_category_idx" ON "expenses"("shopId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "staff_members_phone_key" ON "staff_members"("phone");

-- CreateIndex
CREATE INDEX "staff_members_shopId_role_idx" ON "staff_members"("shopId", "role");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "orders_shopId_status_idx" ON "orders"("shopId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_createdAt_idx" ON "audit_logs"("resourceType", "createdAt");

-- CreateIndex
CREATE INDEX "reports_userId_idx" ON "reports"("userId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_priority_idx" ON "reports"("priority");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offline_sync_events" ADD CONSTRAINT "offline_sync_events_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_usage_events" ADD CONSTRAINT "app_usage_events_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_createdByShopId_fkey" FOREIGN KEY ("createdByShopId") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supplierCatalogProductId_fkey" FOREIGN KEY ("supplierCatalogProductId") REFERENCES "supplier_catalog_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_scans" ADD CONSTRAINT "barcode_scans_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "barcode_scans" ADD CONSTRAINT "barcode_scans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_counts" ADD CONSTRAINT "stock_counts_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "stock_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_items" ADD CONSTRAINT "stock_count_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_catalog_products" ADD CONSTRAINT "supplier_catalog_products_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_orders" ADD CONSTRAINT "customer_orders_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_order_items" ADD CONSTRAINT "customer_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "customer_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
