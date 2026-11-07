-- Keep one recommendation occurrence per shop-local business day. The legacy
-- assistant_actions table remains intact; its rows are copied as historical
-- occurrences so existing user-visible history is preserved.
CREATE TABLE IF NOT EXISTS public.assistant_action_occurrences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shopId" TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  "actionKey" TEXT NOT NULL,
  title TEXT NOT NULL,
  href TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'OPENED', 'COMPLETED', 'DISMISSED')),
  "shownAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "openedAt" TIMESTAMPTZ,
  "completedAt" TIMESTAMPTZ,
  "dismissedAt" TIMESTAMPTZ,
  "baselineStock" NUMERIC,
  "observedOutcome" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("shopId", "actionKey", "businessDate")
);

CREATE INDEX IF NOT EXISTS assistant_action_occurrences_shop_day_idx
  ON public.assistant_action_occurrences ("shopId", "businessDate" DESC, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS assistant_action_occurrences_day_status_idx
  ON public.assistant_action_occurrences ("businessDate" DESC, status);

ALTER TABLE public.assistant_action_occurrences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assistant_action_occurrences FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.assistant_action_occurrences TO service_role;

INSERT INTO public.assistant_action_occurrences (
  id, "shopId", "actionKey", title, href, "businessDate", status,
  "shownAt", "openedAt", "completedAt", "dismissedAt", "createdAt", "updatedAt"
)
SELECT
  old.id,
  old."shopId",
  old."actionKey",
  old.title,
  old.href,
  (old."createdAt" AT TIME ZONE COALESCE(NULLIF(shop."timeZone", ''), 'Africa/Nairobi'))::date,
  CASE WHEN old.status IN ('OPEN', 'OPENED', 'COMPLETED', 'DISMISSED') THEN old.status ELSE 'OPEN' END,
  old."createdAt",
  old."openedAt",
  old."completedAt",
  old."dismissedAt",
  old."createdAt",
  old."updatedAt"
FROM public.assistant_actions AS old
JOIN public.shops AS shop ON shop.id = old."shopId"
ON CONFLICT ("shopId", "actionKey", "businessDate") DO NOTHING;

CREATE OR REPLACE FUNCTION public.record_assistant_action_occurrence(
  p_id TEXT,
  p_shop_id TEXT,
  p_action_key TEXT,
  p_title TEXT,
  p_href TEXT,
  p_business_date DATE,
  p_event_type TEXT,
  p_baseline_stock NUMERIC DEFAULT NULL,
  p_observed_outcome JSONB DEFAULT NULL
)
RETURNS SETOF public.assistant_action_occurrences
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF p_event_type NOT IN ('SHOWN', 'OPENED', 'COMPLETED', 'DISMISSED') THEN
    RAISE EXCEPTION 'Invalid assistant occurrence event';
  END IF;

  RETURN QUERY
  INSERT INTO public.assistant_action_occurrences AS existing (
    id, "shopId", "actionKey", title, href, "businessDate", status,
    "shownAt", "openedAt", "completedAt", "dismissedAt", "baselineStock",
    "observedOutcome", "createdAt", "updatedAt"
  ) VALUES (
    p_id, p_shop_id, p_action_key, p_title, p_href, p_business_date,
    CASE WHEN p_event_type = 'OPENED' THEN 'OPENED'
         WHEN p_event_type IN ('COMPLETED', 'DISMISSED') THEN p_event_type
         ELSE 'OPEN' END,
    NOW(),
    CASE WHEN p_event_type = 'OPENED' THEN NOW() END,
    CASE WHEN p_event_type = 'COMPLETED' THEN NOW() END,
    CASE WHEN p_event_type = 'DISMISSED' THEN NOW() END,
    p_baseline_stock, p_observed_outcome, NOW(), NOW()
  )
  ON CONFLICT ("shopId", "actionKey", "businessDate") DO UPDATE SET
    status = CASE
      WHEN p_event_type = 'COMPLETED' AND existing.status <> 'DISMISSED' THEN 'COMPLETED'
      WHEN p_event_type = 'DISMISSED' AND existing.status <> 'COMPLETED' THEN 'DISMISSED'
      WHEN p_event_type = 'OPENED' AND existing.status = 'OPEN' THEN 'OPENED'
      ELSE existing.status
    END,
    "openedAt" = CASE WHEN p_event_type = 'OPENED' THEN COALESCE(existing."openedAt", NOW()) ELSE existing."openedAt" END,
    "completedAt" = CASE WHEN p_event_type = 'COMPLETED' THEN COALESCE(existing."completedAt", NOW()) ELSE existing."completedAt" END,
    "dismissedAt" = CASE WHEN p_event_type = 'DISMISSED' THEN COALESCE(existing."dismissedAt", NOW()) ELSE existing."dismissedAt" END,
    "baselineStock" = COALESCE(existing."baselineStock", EXCLUDED."baselineStock"),
    "observedOutcome" = COALESCE(existing."observedOutcome", EXCLUDED."observedOutcome"),
    "updatedAt" = NOW()
  RETURNING existing.*;
END;
$$;

REVOKE ALL ON FUNCTION public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, NUMERIC, JSONB) TO service_role;
