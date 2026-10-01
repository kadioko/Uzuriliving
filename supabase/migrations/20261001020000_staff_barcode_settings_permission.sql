-- Barcode scanner and printer settings are operational configuration, not a general staff setting.
ALTER TABLE "staff_members"
  ADD COLUMN IF NOT EXISTS "canManageBarcodeSettings" BOOLEAN NOT NULL DEFAULT false;

-- Owners and managers retain configuration access; other staff must be explicitly granted it.
UPDATE "staff_members"
SET "canManageBarcodeSettings" = true
WHERE "role" IN ('OWNER', 'MANAGER');
