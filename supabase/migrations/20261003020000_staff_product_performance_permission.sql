ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "canViewProductPerformance" BOOLEAN NOT NULL DEFAULT false;

UPDATE "staff_members"
SET "canViewProductPerformance" = true
WHERE "role" IN ('OWNER', 'MANAGER');
