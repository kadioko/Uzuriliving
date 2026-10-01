-- Read-only inventory and pricing access for staff who should not change stock or sell.
ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "canViewInventoryAndPrices" BOOLEAN NOT NULL DEFAULT false;

-- Preserve access for existing stock-control staff and the built-in management roles.
UPDATE "staff_members"
SET "canViewInventoryAndPrices" = true
WHERE "canManageStock" = true OR "role" IN ('OWNER', 'MANAGER');
