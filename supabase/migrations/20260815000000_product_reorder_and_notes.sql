ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "isReorderable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "note" TEXT;

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "note" TEXT;

CREATE INDEX IF NOT EXISTS "orders_shopId_active_reorder_idx"
  ON "orders"("shopId", "status");
