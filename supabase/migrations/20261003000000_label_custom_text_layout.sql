-- Persist custom label text placement and size for saved templates.
ALTER TABLE "label_templates"
  ADD COLUMN IF NOT EXISTS "customTextPosition" TEXT NOT NULL DEFAULT 'ABOVE_BARCODE',
  ADD COLUMN IF NOT EXISTS "customTextSize" TEXT NOT NULL DEFAULT 'SMALL';

ALTER TABLE "label_templates"
  DROP CONSTRAINT IF EXISTS "label_templates_customTextPosition_check",
  DROP CONSTRAINT IF EXISTS "label_templates_customTextSize_check";

ALTER TABLE "label_templates"
  ADD CONSTRAINT "label_templates_customTextPosition_check"
    CHECK ("customTextPosition" IN ('TOP', 'ABOVE_BARCODE', 'BELOW_BARCODE')),
  ADD CONSTRAINT "label_templates_customTextSize_check"
    CHECK ("customTextSize" IN ('SMALL', 'MEDIUM', 'LARGE'));
