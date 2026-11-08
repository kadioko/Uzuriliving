-- Preserve recommendation state changes as events, allow a recommendation to
-- reappear after its underlying condition changes, and store shop-owner reorder
-- policy per product without assuming supplier lead times.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "supplierLeadTimeDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "reorderSafetyDays" INTEGER,
  ADD COLUMN IF NOT EXISTS "reorderPackSize" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_supplier_lead_time_days_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_supplier_lead_time_days_check
      CHECK ("supplierLeadTimeDays" IS NULL OR "supplierLeadTimeDays" BETWEEN 0 AND 365);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_reorder_safety_days_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_reorder_safety_days_check
      CHECK ("reorderSafetyDays" IS NULL OR "reorderSafetyDays" BETWEEN 0 AND 365);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_reorder_pack_size_check') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_reorder_pack_size_check
      CHECK ("reorderPackSize" BETWEEN 1 AND 100000);
  END IF;
END;
$$;

ALTER TABLE public.assistant_action_occurrences
  ADD COLUMN IF NOT EXISTS "conditionKey" TEXT NOT NULL DEFAULT '';

ALTER TABLE public.assistant_action_occurrences
  DROP CONSTRAINT IF EXISTS "assistant_action_occurrences_shopId_actionKey_businessDate_key";

CREATE UNIQUE INDEX IF NOT EXISTS assistant_action_occurrences_condition_key
  ON public.assistant_action_occurrences ("shopId", "actionKey", "businessDate", "conditionKey");

CREATE TABLE IF NOT EXISTS public.assistant_action_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "occurrenceId" TEXT NOT NULL REFERENCES public.assistant_action_occurrences(id) ON DELETE CASCADE,
  "shopId" TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  "actionKey" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "conditionKey" TEXT NOT NULL DEFAULT '',
  "eventType" TEXT NOT NULL CHECK ("eventType" IN ('SHOWN', 'OPENED', 'COMPLETED', 'DISMISSED', 'RESTORED')),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assistant_action_events_shop_day_idx
  ON public.assistant_action_events ("shopId", "businessDate" DESC, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS assistant_action_events_type_idx
  ON public.assistant_action_events ("businessDate" DESC, "eventType", "occurrenceId");

ALTER TABLE public.assistant_action_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assistant_action_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.assistant_action_events TO service_role;

-- Reconstruct the known event timeline for legacy recommendation occurrences.
INSERT INTO public.assistant_action_events (
  "occurrenceId", "shopId", "actionKey", "businessDate", "conditionKey", "eventType", "createdAt"
)
SELECT old.id, old."shopId", old."actionKey", old."businessDate", old."conditionKey", event."eventType", event."createdAt"
FROM public.assistant_action_occurrences AS old
CROSS JOIN LATERAL (
  SELECT 'SHOWN'::TEXT AS "eventType", old."shownAt" AS "createdAt"
  UNION ALL SELECT 'OPENED', old."openedAt" WHERE old."openedAt" IS NOT NULL
  UNION ALL SELECT 'COMPLETED', old."completedAt" WHERE old."completedAt" IS NOT NULL
  UNION ALL SELECT 'DISMISSED', old."dismissedAt" WHERE old."dismissedAt" IS NOT NULL
) AS event;

DROP FUNCTION IF EXISTS public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, NUMERIC, JSONB);

CREATE OR REPLACE FUNCTION public.record_assistant_action_occurrence(
  p_id TEXT,
  p_shop_id TEXT,
  p_action_key TEXT,
  p_title TEXT,
  p_href TEXT,
  p_business_date DATE,
  p_event_type TEXT,
  p_condition_key TEXT DEFAULT '',
  p_baseline_stock NUMERIC DEFAULT NULL,
  p_observed_outcome JSONB DEFAULT NULL
)
RETURNS SETOF public.assistant_action_occurrences
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  saved public.assistant_action_occurrences%ROWTYPE;
BEGIN
  IF p_event_type NOT IN ('SHOWN', 'OPENED', 'COMPLETED', 'DISMISSED', 'RESTORED') THEN
    RAISE EXCEPTION 'Invalid assistant occurrence event';
  END IF;
  IF p_condition_key IS NULL OR length(p_condition_key) > 300 THEN
    RAISE EXCEPTION 'Invalid assistant condition key';
  END IF;

  INSERT INTO public.assistant_action_occurrences AS existing (
    id, "shopId", "actionKey", title, href, "businessDate", "conditionKey", status,
    "shownAt", "openedAt", "completedAt", "dismissedAt", "baselineStock",
    "observedOutcome", "createdAt", "updatedAt"
  ) VALUES (
    p_id, p_shop_id, p_action_key, p_title, p_href, p_business_date, p_condition_key,
    CASE WHEN p_event_type = 'OPENED' THEN 'OPENED'
         WHEN p_event_type IN ('COMPLETED', 'DISMISSED') THEN p_event_type
         ELSE 'OPEN' END,
    NOW(),
    CASE WHEN p_event_type = 'OPENED' THEN NOW() END,
    CASE WHEN p_event_type = 'COMPLETED' THEN NOW() END,
    CASE WHEN p_event_type = 'DISMISSED' THEN NOW() END,
    p_baseline_stock, p_observed_outcome, NOW(), NOW()
  )
  ON CONFLICT ("shopId", "actionKey", "businessDate", "conditionKey") DO UPDATE SET
    status = CASE
      WHEN p_event_type = 'COMPLETED' AND existing.status <> 'DISMISSED' THEN 'COMPLETED'
      WHEN p_event_type = 'DISMISSED' AND existing.status <> 'COMPLETED' THEN 'DISMISSED'
      WHEN p_event_type = 'RESTORED' AND existing.status = 'DISMISSED' THEN 'OPEN'
      WHEN p_event_type = 'OPENED' AND existing.status = 'OPEN' THEN 'OPENED'
      ELSE existing.status
    END,
    "openedAt" = CASE WHEN p_event_type = 'OPENED' THEN COALESCE(existing."openedAt", NOW()) ELSE existing."openedAt" END,
    "completedAt" = CASE WHEN p_event_type = 'COMPLETED' THEN COALESCE(existing."completedAt", NOW()) ELSE existing."completedAt" END,
    "dismissedAt" = CASE WHEN p_event_type = 'DISMISSED' THEN COALESCE(existing."dismissedAt", NOW()) ELSE existing."dismissedAt" END,
    "baselineStock" = COALESCE(existing."baselineStock", EXCLUDED."baselineStock"),
    "observedOutcome" = COALESCE(existing."observedOutcome", EXCLUDED."observedOutcome"),
    "updatedAt" = NOW()
  RETURNING existing.* INTO saved;

  INSERT INTO public.assistant_action_events (
    "occurrenceId", "shopId", "actionKey", "businessDate", "conditionKey", "eventType"
  ) VALUES (
    saved.id, p_shop_id, p_action_key, p_business_date, p_condition_key, p_event_type
  );

  RETURN NEXT saved;
END;
$$;

REVOKE ALL ON FUNCTION public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, NUMERIC, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, NUMERIC, JSONB) TO service_role;

-- The all-time product-ranking query joins line items back to sales by saleId.
-- This covering index can reduce heap reads while retaining the existing saleId
-- access path used elsewhere.
CREATE INDEX IF NOT EXISTS sale_items_assistant_history_cover_idx
  ON public.sale_items ("saleId", "productId") INCLUDE (quantity, "totalPrice", "buyingPrice");

CREATE OR REPLACE FUNCTION public.assistant_stock_snapshot(
  p_shop_id TEXT,
  p_time_zone TEXT,
  p_can_manage_stock BOOLEAN,
  p_can_view_reports BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := statement_timestamp();
  v_today DATE;
  v_since TIMESTAMPTZ;
  v_products JSONB := '[]'::JSONB;
  v_daily_sales JSONB := '[]'::JSONB;
  v_count BIGINT := 0;
  v_demand_status TEXT := 'restricted';
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone';
  END IF;

  v_today := (v_now AT TIME ZONE p_time_zone)::DATE;
  v_since := (v_today - 27)::TIMESTAMP AT TIME ZONE p_time_zone;

  WITH incoming AS (
    SELECT
      oi."productId",
      SUM(oi.quantity)::BIGINT AS total,
      SUM(oi.quantity) FILTER (WHERE o.status = 'OUT_FOR_DELIVERY')::BIGINT AS on_the_way,
      SUM(oi.quantity) FILTER (WHERE o.status <> 'OUT_FOR_DELIVERY')::BIGINT AS ordered
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi."orderId" = o.id
    WHERE o."shopId" = p_shop_id
      AND o.status IN ('PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY')
    GROUP BY oi."productId"
  ), low_stock AS (
    SELECT
      p.id,
      p.name,
      p."currentStock",
      p."minimumStock",
      p.unit,
      COALESCE(i.total, 0) AS on_order,
      COALESCE(i.ordered, 0) AS ordered,
      COALESCE(i.on_the_way, 0) AS on_the_way,
      p."supplierLeadTimeDays",
      p."reorderSafetyDays",
      p."reorderPackSize",
      (SELECT MAX(m."createdAt") FROM public.stock_movements AS m WHERE m."productId" = p.id) AS stock_revision_at
    FROM public.products AS p
    LEFT JOIN incoming AS i ON i."productId" = p.id
    WHERE p."shopId" = p_shop_id
      AND p."isActive" = TRUE
      AND p."isReorderable" = TRUE
      AND p."currentStock" <= p."minimumStock"
      AND COALESCE(i.total, 0) < GREATEST(p."minimumStock" - p."currentStock", 1)
  )
  SELECT
    COUNT(*)::BIGINT,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', selected.id,
          'name', selected.name,
          'currentStock', selected."currentStock",
          'minimumStock', selected."minimumStock",
          'unit', selected.unit,
          'requiresRestock', TRUE,
          'onOrderStatus', CASE
            WHEN selected.on_the_way > 0 THEN 'ON_THE_WAY'
            WHEN selected.on_order > 0 THEN 'ORDERED'
            ELSE NULL
          END,
          'stockRevisionAt', selected.stock_revision_at
        ) || CASE WHEN p_can_manage_stock THEN jsonb_build_object(
          'onOrderQuantity', selected.on_order,
          'onOrderOrderedQuantity', selected.ordered,
          'onOrderInTransitQuantity', selected.on_the_way,
          'supplierLeadTimeDays', selected."supplierLeadTimeDays",
          'reorderSafetyDays', selected."reorderSafetyDays",
          'reorderPackSize', selected."reorderPackSize"
        ) ELSE '{}'::JSONB END
        ORDER BY selected."currentStock", selected.name, selected.id
      )
      FROM (
        SELECT * FROM low_stock
        ORDER BY "currentStock", name, id
        LIMIT 20
      ) AS selected
    ), '[]'::JSONB)
  INTO v_count, v_products
  FROM low_stock;

  IF p_can_view_reports THEN
    BEGIN
      WITH candidates AS (
        SELECT value->>'id' AS "productId"
        FROM jsonb_array_elements(v_products) WITH ORDINALITY AS product(value, position)
        WHERE position <= 3
      ), grouped_sales AS (
        SELECT
          si."productId",
          (s."createdAt" AT TIME ZONE p_time_zone)::DATE AS "businessDate",
          SUM(si.quantity)::BIGINT AS quantity
        FROM candidates AS c
        JOIN public.sale_items AS si ON si."productId" = c."productId"
        JOIN public.sales AS s ON s.id = si."saleId"
        WHERE s."shopId" = p_shop_id
          AND s."createdAt" >= v_since
          AND s."createdAt" <= v_now
        GROUP BY si."productId", (s."createdAt" AT TIME ZONE p_time_zone)::DATE
      )
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'productId', "productId",
        'date', to_char("businessDate", 'YYYY-MM-DD'),
        'quantity', quantity
      ) ORDER BY "businessDate", "productId"), '[]'::JSONB)
      INTO v_daily_sales
      FROM grouped_sales;
      v_demand_status := 'ready';
    EXCEPTION WHEN OTHERS THEN
      v_daily_sales := '[]'::JSONB;
      v_demand_status := 'unavailable';
    END;
  END IF;

  RETURN jsonb_build_object(
    'count', v_count,
    'products', v_products,
    'dailySales', v_daily_sales,
    'demandStatus', v_demand_status,
    'checkedAt', v_now,
    'timeZone', p_time_zone,
    'businessDate', to_char(v_today, 'YYYY-MM-DD')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_stock_snapshot(TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_stock_snapshot(TEXT, TEXT, BOOLEAN, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.assistant_profit_metrics(
  p_shop_id TEXT,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_include_expenses BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION 'Invalid assistant date range';
  END IF;

  WITH sale_totals AS (
    SELECT
      COUNT(DISTINCT s.id)::BIGINT AS sales_count,
      COUNT(si.id)::BIGINT AS sale_item_count,
      COALESCE(SUM(si."totalPrice"), 0)::BIGINT AS revenue,
      COALESCE(SUM(si.quantity * si."buyingPrice") FILTER (WHERE si."buyingPrice" IS NOT NULL), 0)::BIGINT AS cost_of_goods,
      COALESCE(SUM(si."totalPrice") FILTER (WHERE si."buyingPrice" IS NULL), 0)::BIGINT AS missing_cost_revenue,
      COUNT(si.id) FILTER (WHERE si."buyingPrice" IS NULL)::BIGINT AS missing_cost_item_count
    FROM public.sales AS s
    LEFT JOIN public.sale_items AS si ON si."saleId" = s.id
    WHERE s."shopId" = p_shop_id
      AND (p_from IS NULL OR s."createdAt" >= p_from)
      AND (p_to IS NULL OR s."createdAt" < p_to)
  ), expense_totals AS (
    SELECT COALESCE(SUM(e.amount), 0)::BIGINT AS amount, COUNT(*)::BIGINT AS count
    FROM public.expenses AS e
    WHERE p_include_expenses
      AND e."shopId" = p_shop_id
      AND (p_from IS NULL OR e."spentAt" >= p_from)
      AND (p_to IS NULL OR e."spentAt" < p_to)
  )
  SELECT jsonb_build_object(
    'salesCount', sale_totals.sales_count,
    'saleItemCount', sale_totals.sale_item_count,
    'revenue', sale_totals.revenue,
    'costOfGoodsSold', sale_totals.cost_of_goods,
    'missingCostSalesRevenue', sale_totals.missing_cost_revenue,
    'missingCostItemCount', sale_totals.missing_cost_item_count,
    'grossProfit', CASE WHEN sale_totals.missing_cost_revenue = 0 THEN sale_totals.revenue - sale_totals.cost_of_goods ELSE NULL END,
    'expenseAmount', expense_totals.amount,
    'expenseCount', expense_totals.count,
    'netProfit', CASE WHEN p_include_expenses AND sale_totals.missing_cost_revenue = 0 THEN sale_totals.revenue - sale_totals.cost_of_goods - expense_totals.amount ELSE NULL END
  ) INTO v_result
  FROM sale_totals CROSS JOIN expense_totals;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_profit_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_profit_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO service_role;
