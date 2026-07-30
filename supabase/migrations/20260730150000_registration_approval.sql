ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED';

-- Existing accounts are trusted; only new registrations enter the approval queue.
UPDATE "users"
SET "approvalStatus" = 'APPROVED'
WHERE "approvalStatus" IS NULL OR "approvalStatus" NOT IN ('PENDING', 'APPROVED', 'REJECTED');
