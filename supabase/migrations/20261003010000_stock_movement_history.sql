ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByStaffId" TEXT;

CREATE INDEX IF NOT EXISTS "stock_movements_createdAt_idx"
  ON "stock_movements" ("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "stock_movements_createdById_idx"
  ON "stock_movements" ("createdById");

CREATE INDEX IF NOT EXISTS "stock_movements_createdByStaffId_idx"
  ON "stock_movements" ("createdByStaffId");
