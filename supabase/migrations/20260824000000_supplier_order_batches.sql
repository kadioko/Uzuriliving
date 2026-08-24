ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "orderGroupId" TEXT;

CREATE INDEX IF NOT EXISTS "orders_shopId_orderGroupId_idx"
  ON "orders"("shopId", "orderGroupId");
