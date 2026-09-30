-- Granular staff permissions for inventory intake, expiry dates, and returned stock.
ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "canAddInventory" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canManageExpiry" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canRefundStock" BOOLEAN NOT NULL DEFAULT false;

-- Keep existing stock clerks and managers fully functional after the new permissions arrive.
UPDATE "staff_members"
SET
  "canAddInventory" = true,
  "canManageExpiry" = true,
  "canRefundStock" = true
WHERE "canManageStock" = true;

ALTER TYPE "StockMovementType" ADD VALUE IF NOT EXISTS 'RETURN';
