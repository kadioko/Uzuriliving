ALTER TABLE "shops"
  ADD COLUMN IF NOT EXISTS "timeZone" TEXT NOT NULL DEFAULT 'Africa/Nairobi';

COMMENT ON COLUMN "shops"."timeZone" IS 'IANA time zone used for shop-local dates, times, reports, and analytics.';
