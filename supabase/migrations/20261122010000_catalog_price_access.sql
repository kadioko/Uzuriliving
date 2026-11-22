-- Catalogue credentials are separate from owner/staff accounts. Only the
-- service-role Edge Function can read password hashes or change settings.
CREATE TABLE public.catalog_price_access (
  "shopId" TEXT PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  "retailPasswordHash" TEXT,
  "wholesalePasswordHash" TEXT,
  "retailVersion" UUID NOT NULL DEFAULT gen_random_uuid(),
  "wholesaleVersion" UUID NOT NULL DEFAULT gen_random_uuid(),
  revision UUID NOT NULL DEFAULT gen_random_uuid(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT catalog_price_access_credentials_required CHECK (
    NOT enabled OR ("retailPasswordHash" IS NOT NULL AND "wholesalePasswordHash" IS NOT NULL)
  )
);

ALTER TABLE public.catalog_price_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_price_access FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.catalog_price_access TO service_role;
