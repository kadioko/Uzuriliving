ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "receivedTotalAmount" INTEGER;

-- Preserve historical delivered orders in purchase reporting. New deliveries
-- are stamped by the API at the moment stock is received.
UPDATE "orders"
SET "receivedAt" = COALESCE("receivedAt", "updatedAt"),
    "receivedTotalAmount" = COALESCE("receivedTotalAmount", "totalAmount")
WHERE "status" = 'DELIVERED';

CREATE INDEX IF NOT EXISTS "orders_shopId_receivedAt_idx"
  ON "orders"("shopId", "receivedAt" DESC);
