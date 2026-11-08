-- Improve assistant evidence, privacy, recency, operational visibility and lifecycle.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS "assistantStockTrackingStartedAt" TIMESTAMPTZ NOT NULL DEFAULT statement_timestamp();

CREATE TABLE IF NOT EXISTS public.product_stockout_periods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  "startedAt" TIMESTAMPTZ NOT NULL,
  "endedAt" TIMESTAMPTZ,
  CONSTRAINT product_stockout_periods_ordered_check CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt")
);
CREATE INDEX IF NOT EXISTS product_stockout_periods_product_start_idx
  ON public.product_stockout_periods ("productId", "startedAt", "endedAt");
CREATE UNIQUE INDEX IF NOT EXISTS product_stockout_periods_one_open_idx
  ON public.product_stockout_periods ("productId") WHERE "endedAt" IS NULL;
ALTER TABLE public.product_stockout_periods ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.product_stockout_periods FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.product_stockout_periods TO service_role;

CREATE OR REPLACE FUNCTION public.track_product_stockout_period()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := statement_timestamp();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."currentStock" <= 0 THEN
      INSERT INTO public.product_stockout_periods ("productId", "startedAt")
      VALUES (NEW.id, GREATEST(NEW."assistantStockTrackingStartedAt", v_now));
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."currentStock" > 0 AND NEW."currentStock" <= 0 THEN
    INSERT INTO public.product_stockout_periods ("productId", "startedAt")
    VALUES (NEW.id, v_now)
    ON CONFLICT ("productId") WHERE "endedAt" IS NULL DO NOTHING;
  ELSIF OLD."currentStock" <= 0 AND NEW."currentStock" > 0 THEN
    UPDATE public.product_stockout_periods
       SET "endedAt" = v_now
     WHERE "productId" = NEW.id AND "endedAt" IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_track_stockout_period ON public.products;
CREATE TRIGGER products_track_stockout_period
AFTER INSERT OR UPDATE OF "currentStock" ON public.products
FOR EACH ROW EXECUTE FUNCTION public.track_product_stockout_period();

-- Existing zero-stock products have an unknown earlier history. Begin observing
-- from this migration; do not infer how long they were unavailable beforehand.
INSERT INTO public.product_stockout_periods ("productId", "startedAt")
SELECT p.id, statement_timestamp()
FROM public.products AS p
WHERE p."currentStock" <= 0
  AND NOT EXISTS (
    SELECT 1 FROM public.product_stockout_periods AS period
    WHERE period."productId" = p.id AND period."endedAt" IS NULL
  );

CREATE OR REPLACE FUNCTION public.assistant_stock_observation(
  p_shop_id TEXT,
  p_product_ids TEXT[],
  p_time_zone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE;
  v_window_start DATE;
  v_result JSONB;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone';
  END IF;
  v_today := (statement_timestamp() AT TIME ZONE p_time_zone)::DATE;
  v_window_start := v_today - 28;

  SELECT COALESCE(jsonb_object_agg(observed.id, jsonb_build_object(
    'coverageFrom', CASE WHEN observed.coverage_days > 0 THEN to_char(observed.coverage_from, 'YYYY-MM-DD') END,
    'coverageTo', CASE WHEN observed.coverage_days > 0 THEN to_char(v_today - 1, 'YYYY-MM-DD') END,
    'coverageDays', observed.coverage_days,
    'stockoutDays', observed.stockout_days,
    'stockoutDates', observed.stockout_dates,
    'availableDays', GREATEST(observed.coverage_days - observed.stockout_days, 0),
    'trackingStartedAt', observed.tracking_started_at
  )), '{}'::JSONB)
  INTO v_result
  FROM (
    SELECT tracked.id,
      GREATEST(v_window_start, tracked.first_full_day) AS coverage_from,
      GREATEST(v_today - GREATEST(v_window_start, tracked.first_full_day), 0)::INTEGER AS coverage_days,
      (
        SELECT COUNT(*)::INTEGER
        FROM generate_series(
          GREATEST(v_window_start, tracked.first_full_day),
          v_today - 1,
          INTERVAL '1 day'
        ) AS day_start
        WHERE EXISTS (
          SELECT 1 FROM public.product_stockout_periods AS period
          WHERE period."productId" = tracked.id
            AND period."startedAt" < ((day_start::DATE + 1)::TIMESTAMP AT TIME ZONE p_time_zone)
            AND COALESCE(period."endedAt", 'infinity'::TIMESTAMPTZ) > (day_start::DATE::TIMESTAMP AT TIME ZONE p_time_zone)
        )
      ) AS stockout_days,
      (
        SELECT COALESCE(jsonb_agg(to_char(day_start::DATE, 'YYYY-MM-DD') ORDER BY day_start), '[]'::JSONB)
        FROM generate_series(
          GREATEST(v_window_start, tracked.first_full_day),
          v_today - 1,
          INTERVAL '1 day'
        ) AS day_start
        WHERE EXISTS (
          SELECT 1 FROM public.product_stockout_periods AS period
          WHERE period."productId" = tracked.id
            AND period."startedAt" < ((day_start::DATE + 1)::TIMESTAMP AT TIME ZONE p_time_zone)
            AND COALESCE(period."endedAt", 'infinity'::TIMESTAMPTZ) > (day_start::DATE::TIMESTAMP AT TIME ZONE p_time_zone)
        )
      ) AS stockout_dates,
      tracked."assistantStockTrackingStartedAt" AS tracking_started_at
    FROM (
      SELECT p.id, p."assistantStockTrackingStartedAt",
        (p."assistantStockTrackingStartedAt" AT TIME ZONE p_time_zone)::DATE
          + CASE WHEN p."assistantStockTrackingStartedAt" > (((p."assistantStockTrackingStartedAt" AT TIME ZONE p_time_zone)::DATE)::TIMESTAMP AT TIME ZONE p_time_zone) THEN 1 ELSE 0 END AS first_full_day
      FROM public.products AS p
      WHERE p."shopId" = p_shop_id AND p.id = ANY(COALESCE(p_product_ids, ARRAY[]::TEXT[]))
    ) AS tracked
  ) AS observed;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_stock_observation(TEXT, TEXT[], TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_stock_observation(TEXT, TEXT[], TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.assistant_recent_product_trends(
  p_shop_id TEXT,
  p_time_zone TEXT
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
  v_to TIMESTAMPTZ;
  v_from TIMESTAMPTZ;
  v_previous_from TIMESTAMPTZ;
  v_products JSONB;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone';
  END IF;
  v_today := (v_now AT TIME ZONE p_time_zone)::DATE;
  v_to := v_today::TIMESTAMP AT TIME ZONE p_time_zone;
  v_from := (v_today - 30)::TIMESTAMP AT TIME ZONE p_time_zone;
  v_previous_from := (v_today - 60)::TIMESTAMP AT TIME ZONE p_time_zone;

  WITH ranked AS (
    SELECT p.id, p.name, p.unit,
      COALESCE(SUM(si."totalPrice") FILTER (WHERE s."createdAt" >= v_from), 0)::BIGINT AS "revenue30d",
      COALESCE(SUM(si.quantity) FILTER (WHERE s."createdAt" >= v_from), 0)::BIGINT AS "units30d",
      COALESCE(SUM(si."totalPrice") FILTER (WHERE s."createdAt" < v_from), 0)::BIGINT AS "previousRevenue30d",
      COALESCE(SUM(si.quantity) FILTER (WHERE s."createdAt" < v_from), 0)::BIGINT AS "previousUnits30d",
      COUNT(DISTINCT s.id) FILTER (WHERE s."createdAt" >= v_from)::BIGINT AS "sales30d",
      COUNT(DISTINCT s.id) FILTER (WHERE s."createdAt" < v_from)::BIGINT AS "previousSales30d"
    FROM public.sales AS s
    JOIN public.sale_items AS si ON si."saleId" = s.id
    JOIN public.products AS p ON p.id = si."productId" AND p."shopId" = p_shop_id
    WHERE s."shopId" = p_shop_id
      AND s."createdAt" >= v_previous_from AND s."createdAt" < v_to
    GROUP BY p.id, p.name, p.unit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', product.id,
    'name', product.name,
    'unit', product.unit,
    'revenue30d', product."revenue30d",
    'units30d', product."units30d",
    'sales30d', product."sales30d",
    'previousRevenue30d', product."previousRevenue30d",
    'previousUnits30d', product."previousUnits30d",
    'previousSales30d', product."previousSales30d",
    'revenueChangePercent', CASE WHEN product."previousRevenue30d" > 0
      THEN ROUND((product."revenue30d" - product."previousRevenue30d")::NUMERIC * 100 / product."previousRevenue30d")
      ELSE NULL END
  ) ORDER BY product."revenue30d" DESC, product.name, product.id), '[]'::JSONB)
  INTO v_products
  FROM (SELECT * FROM ranked WHERE "revenue30d" > 0 ORDER BY "revenue30d" DESC, name, id LIMIT 5) AS product;

  RETURN jsonb_build_object(
    'windowDays', 30,
    'from', to_char(v_today - 30, 'YYYY-MM-DD'),
    'to', to_char(v_today - 1, 'YYYY-MM-DD'),
    'comparisonFrom', to_char(v_today - 60, 'YYYY-MM-DD'),
    'comparisonTo', to_char(v_today - 31, 'YYYY-MM-DD'),
    'checkedAt', v_now,
    'products', v_products
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_recent_product_trends(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_recent_product_trends(TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.assistant_sync_health_snapshot(p_shop_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  WITH recent AS (
    SELECT e.id, e."deviceId", e."localId", e.status, e."resolutionStatus", e."createdAt"
    FROM public.offline_sync_events AS e
    WHERE e."shopId" = p_shop_id
    ORDER BY e."createdAt" DESC, e.id DESC
    LIMIT 2000
  ), latest_per_sale AS (
    SELECT DISTINCT ON (COALESCE("deviceId", 'unknown'), COALESCE("localId", id))
      "deviceId", status, "resolutionStatus", "createdAt"
    FROM recent
    ORDER BY COALESCE("deviceId", 'unknown'), COALESCE("localId", id), "createdAt" DESC, id DESC
  )
  SELECT jsonb_build_object(
    'serverKnownPending', COUNT(*) FILTER (WHERE status = 'QUEUED' AND "resolutionStatus" <> 'RESOLVED'),
    'serverKnownFailed', COUNT(*) FILTER (WHERE status = 'FAILED' AND "resolutionStatus" <> 'RESOLVED'),
    'devicesObserved', (SELECT COUNT(DISTINCT NULLIF("deviceId", '')) FROM recent),
    'lastEventReceivedAt', (SELECT MAX("createdAt") FROM recent),
    'lastSuccessfulSyncAt', (SELECT MAX("createdAt") FROM recent WHERE status = 'SYNCED'),
    'observedFrom', (SELECT MIN("createdAt") FROM recent),
    'eventsInspected', (SELECT COUNT(*) FROM recent),
    'observationLimitReached', (SELECT COUNT(*) >= 2000 FROM recent),
    'checkedAt', statement_timestamp()
  ) INTO v_result
  FROM latest_per_sale;
  RETURN COALESCE(v_result, jsonb_build_object('serverKnownPending', 0, 'serverKnownFailed', 0, 'devicesObserved', 0, 'eventsInspected', 0, 'observationLimitReached', FALSE, 'checkedAt', statement_timestamp()));
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_sync_health_snapshot(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_sync_health_snapshot(TEXT) TO service_role;

-- Shop-home snapshot v2: preserve bounded summaries, rank overdue debts properly,
-- and replace the all-time sale-item scan with a 60-day trend window.
CREATE OR REPLACE FUNCTION public.assistant_shop_snapshot(
  p_shop_id TEXT,
  p_time_zone TEXT,
  p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := statement_timestamp();
  v_local_now TIMESTAMP;
  v_today DATE;
  v_today_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
  v_expense_start TIMESTAMPTZ;
  v_can_reports BOOLEAN := COALESCE((p_permissions->>'canViewReports')::BOOLEAN, FALSE);
  v_can_sell BOOLEAN := COALESCE((p_permissions->>'canSell')::BOOLEAN, FALSE);
  v_can_expenses BOOLEAN := COALESCE((p_permissions->>'canRecordExpenses')::BOOLEAN, FALSE);
  v_can_manage_stock BOOLEAN := COALESCE((p_permissions->>'canManageStock')::BOOLEAN, FALSE);
  v_can_view_stock BOOLEAN := COALESCE((p_permissions->>'canViewInventoryAndPrices')::BOOLEAN, FALSE)
    OR COALESCE((p_permissions->>'canManageStock')::BOOLEAN, FALSE);
  v_dashboard JSONB;
  v_history JSONB;
  v_debts JSONB;
  v_expenses JSONB;
  v_costs JSONB;
  v_stock JSONB;
  v_purchases JSONB;
  v_product_trends JSONB;
  v_sync_health JSONB;
  v_sources JSONB;
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone';
  END IF;

  v_local_now := v_now AT TIME ZONE p_time_zone;
  v_today := v_local_now::DATE;
  v_today_start := v_today::TIMESTAMP AT TIME ZONE p_time_zone;
  v_month_start := date_trunc('month', v_local_now) AT TIME ZONE p_time_zone;
  v_expense_start := (v_today - 13)::TIMESTAMP AT TIME ZONE p_time_zone;
  v_sources := jsonb_build_object(
    'today', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END),
    'history', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END),
    'trends', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END),
    'debts', jsonb_build_object('status', CASE WHEN v_can_reports AND v_can_sell THEN 'ready' ELSE 'restricted' END),
    'expenses', jsonb_build_object('status', CASE WHEN v_can_expenses THEN 'ready' ELSE 'restricted' END),
    'costs', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END),
    'stock', jsonb_build_object('status', CASE WHEN v_can_view_stock THEN 'ready' ELSE 'restricted' END),
    'purchases', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END),
    'sync', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END)
  );

  IF v_can_reports THEN
    BEGIN
      SELECT jsonb_build_object('summary', jsonb_build_object(
        'totalSales', COALESCE((SELECT SUM(s."totalAmount") FROM public.sales AS s WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now), 0),
        'totalProfit', COALESCE((SELECT SUM(s.profit) FROM public.sales AS s WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now), 0),
        'totalExpenses', COALESCE((SELECT SUM(e.amount) FROM public.expenses AS e WHERE e."shopId" = p_shop_id AND e."spentAt" >= v_today_start AND e."spentAt" < v_now), 0),
        'salesCount', COALESCE((SELECT COUNT(*) FROM public.sales AS s WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now), 0),
        'pendingOrders', COALESCE((SELECT COUNT(*) FROM public.orders AS o WHERE o."shopId" = p_shop_id AND o.status IN ('PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY')), 0),
        'totalProducts', COALESCE((SELECT COUNT(*) FROM public.products AS p WHERE p."shopId" = p_shop_id AND p."isActive" = TRUE), 0),
        'lowStockCount', COALESCE((SELECT COUNT(*) FROM public.products AS p WHERE p."shopId" = p_shop_id AND p."isActive" = TRUE AND p."currentStock" <= p."minimumStock"), 0),
        'outOfStockCount', COALESCE((SELECT COUNT(*) FROM public.products AS p WHERE p."shopId" = p_shop_id AND p."isActive" = TRUE AND p."currentStock" = 0), 0),
        'netProfit', COALESCE((SELECT SUM(s.profit) FROM public.sales AS s WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now), 0)
          - COALESCE((SELECT SUM(e.amount) FROM public.expenses AS e WHERE e."shopId" = p_shop_id AND e."spentAt" >= v_today_start AND e."spentAt" < v_now), 0)
      )) INTO v_dashboard;
      v_sources := jsonb_set(v_sources, '{today}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_dashboard := NULL;
      v_sources := jsonb_set(v_sources, '{today}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;

    BEGIN
      SELECT jsonb_build_object(
        'summary', jsonb_build_object('hasBusinessHistory', EXISTS (SELECT 1 FROM public.sales WHERE "shopId" = p_shop_id)),
        'topProducts', '[]'::JSONB
      ) INTO v_history;
      v_sources := jsonb_set(v_sources, '{history}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_history := NULL;
      v_sources := jsonb_set(v_sources, '{history}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;

    BEGIN
      v_product_trends := public.assistant_recent_product_trends(p_shop_id, p_time_zone);
      v_sources := jsonb_set(v_sources, '{trends}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_product_trends := NULL;
      v_sources := jsonb_set(v_sources, '{trends}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;

    BEGIN
      SELECT jsonb_build_object('summary', jsonb_build_object(
        'salesRevenue', COALESCE(SUM(si."totalPrice"), 0),
        'headerSalesRevenue', COALESCE((SELECT SUM(s."totalAmount") FROM public.sales AS s WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now), 0),
        'missingCostSalesRevenue', COALESCE(SUM(si."totalPrice") FILTER (WHERE si."buyingPrice" IS NULL), 0)
      )) INTO v_costs
      FROM public.sale_items AS si
      JOIN public.sales AS s ON s.id = si."saleId"
      WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now;
      v_sources := jsonb_set(v_sources, '{costs}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_costs := NULL;
      v_sources := jsonb_set(v_sources, '{costs}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;

    BEGIN
      v_sync_health := public.assistant_sync_health_snapshot(p_shop_id);
      v_sources := jsonb_set(v_sources, '{sync}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_sync_health := NULL;
      v_sources := jsonb_set(v_sources, '{sync}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  IF v_can_reports AND v_can_sell THEN
    BEGIN
      SELECT jsonb_build_object(
        'summary', jsonb_build_object(
          'openCount', COUNT(*) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL') AND d.amount > d."amountPaid"),
          'totalOwed', COALESCE(SUM(GREATEST(d.amount - d."amountPaid", 0)) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL')), 0),
          'overdueCount', COUNT(*) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL') AND d.amount > d."amountPaid" AND d."dueDate" IS NOT NULL AND d."dueDate"::DATE < v_today)
        ),
        'debts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ranked.id,
            'customerName', ranked."customerName",
            'balance', ranked.balance,
            'dueDate', ranked."dueDate",
            'daysOverdue', CASE WHEN ranked."dueDate"::DATE < v_today THEN v_today - ranked."dueDate"::DATE ELSE 0 END,
            'status', ranked.status
          ) ORDER BY ranked.is_overdue DESC, ranked.overdue_days DESC, ranked.balance DESC, ranked."dueDate" ASC NULLS LAST, ranked.id)
          FROM (
            SELECT d2.id, d2."customerName", d2."dueDate", d2.status,
              GREATEST(d2.amount - d2."amountPaid", 0) AS balance,
              (d2."dueDate" IS NOT NULL AND d2."dueDate"::DATE < v_today) AS is_overdue,
              CASE WHEN d2."dueDate"::DATE < v_today THEN v_today - d2."dueDate"::DATE ELSE 0 END AS overdue_days
            FROM public.debts AS d2
            WHERE d2."shopId" = p_shop_id AND d2.status IN ('OPEN', 'PARTIAL') AND d2.amount > d2."amountPaid"
            ORDER BY (d2."dueDate" IS NOT NULL AND d2."dueDate"::DATE < v_today) DESC,
              CASE WHEN d2."dueDate"::DATE < v_today THEN v_today - d2."dueDate"::DATE ELSE 0 END DESC,
              GREATEST(d2.amount - d2."amountPaid", 0) DESC, d2."dueDate" ASC NULLS LAST, d2.id
            LIMIT 3
          ) AS ranked
        ), '[]'::JSONB)
      ) INTO v_debts
      FROM public.debts AS d WHERE d."shopId" = p_shop_id;
      v_sources := jsonb_set(v_sources, '{debts}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_debts := NULL;
      v_sources := jsonb_set(v_sources, '{debts}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  IF v_can_expenses THEN
    BEGIN
      SELECT jsonb_build_object('daily', COALESCE(jsonb_agg(jsonb_build_object(
        'businessDate', to_char(day."businessDate", 'YYYY-MM-DD'), 'amount', day.amount, 'count', day.count
      ) ORDER BY day."businessDate"), '[]'::JSONB)) INTO v_expenses
      FROM (
        SELECT ((e."spentAt" AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone)::DATE AS "businessDate",
          SUM(e.amount)::BIGINT AS amount, COUNT(*)::BIGINT AS count
        FROM public.expenses AS e WHERE e."shopId" = p_shop_id AND e."spentAt" >= v_expense_start AND e."spentAt" < v_now
        GROUP BY ((e."spentAt" AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone)::DATE
      ) AS day;
      v_sources := jsonb_set(v_sources, '{expenses}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_expenses := NULL;
      v_sources := jsonb_set(v_sources, '{expenses}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  IF v_can_view_stock THEN
    BEGIN
      v_stock := public.assistant_stock_snapshot(p_shop_id, p_time_zone, v_can_manage_stock, v_can_reports);
      v_sources := jsonb_set(v_sources, '{stock}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_stock := NULL;
      v_sources := jsonb_set(v_sources, '{stock}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  IF v_can_reports THEN
    BEGIN
      SELECT jsonb_build_object('summary', jsonb_build_object(
        'totalPurchaseAmount', COALESCE(SUM(COALESCE(o."receivedTotalAmount", o."totalAmount", 0)), 0),
        'purchaseCount', COUNT(*)
      )) INTO v_purchases
      FROM public.orders AS o
      WHERE o."shopId" = p_shop_id AND o.status = 'DELIVERED'
        AND COALESCE(o."receivedAt", o."updatedAt", o."createdAt") >= v_month_start
        AND COALESCE(o."receivedAt", o."updatedAt", o."createdAt") < v_now;
      v_sources := jsonb_set(v_sources, '{purchases}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_purchases := NULL;
      v_sources := jsonb_set(v_sources, '{purchases}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  RETURN jsonb_build_object(
    'checkedAt', v_now,
    'businessDate', to_char(v_today, 'YYYY-MM-DD'),
    'timeZone', p_time_zone,
    'sources', v_sources,
    'dashboard', v_dashboard,
    'historySummary', v_history,
    'productTrends', v_product_trends,
    'debts', v_debts,
    'expenses', v_expenses,
    'costs', v_costs,
    'stock', v_stock,
    'syncHealth', v_sync_health,
    'purchases', v_purchases
  );
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_shop_snapshot(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_shop_snapshot(TEXT, TEXT, JSONB) TO service_role;

-- Keep financial definitions auditable across header-level sales analytics and
-- line-item COGS. A discrepancy is surfaced rather than silently blended.
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
DECLARE v_result JSONB;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN RAISE EXCEPTION 'Shop not found'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN RAISE EXCEPTION 'Invalid assistant date range'; END IF;
  WITH selected_sales AS (
    SELECT s.id, s."totalAmount", s.profit
    FROM public.sales AS s
    WHERE s."shopId" = p_shop_id AND (p_from IS NULL OR s."createdAt" >= p_from) AND (p_to IS NULL OR s."createdAt" < p_to)
  ), header_totals AS (
    SELECT COUNT(*)::BIGINT AS sales_count, COALESCE(SUM("totalAmount"), 0)::BIGINT AS header_revenue,
      COALESCE(SUM(profit), 0)::BIGINT AS stored_profit
    FROM selected_sales
  ), item_totals AS (
    SELECT COUNT(si.id)::BIGINT AS item_count,
      COALESCE(SUM(si."totalPrice"), 0)::BIGINT AS item_revenue,
      COALESCE(SUM(si.quantity * si."buyingPrice") FILTER (WHERE si."buyingPrice" IS NOT NULL), 0)::BIGINT AS cogs,
      COALESCE(SUM(si."totalPrice") FILTER (WHERE si."buyingPrice" IS NULL), 0)::BIGINT AS missing_cost_revenue,
      COUNT(si.id) FILTER (WHERE si."buyingPrice" IS NULL)::BIGINT AS missing_cost_items
    FROM selected_sales AS s LEFT JOIN public.sale_items AS si ON si."saleId" = s.id
  ), totals AS (
    SELECT header_totals.sales_count, item_totals.item_count, header_totals.header_revenue,
      item_totals.item_revenue, item_totals.cogs, item_totals.missing_cost_revenue,
      item_totals.missing_cost_items, header_totals.stored_profit
    FROM header_totals CROSS JOIN item_totals
  ), expense_totals AS (
    SELECT COALESCE(SUM(e.amount), 0)::BIGINT AS amount, COUNT(*)::BIGINT AS count
    FROM public.expenses AS e WHERE p_include_expenses AND e."shopId" = p_shop_id
      AND (p_from IS NULL OR e."spentAt" >= p_from) AND (p_to IS NULL OR e."spentAt" < p_to)
  )
  SELECT jsonb_build_object(
    'salesCount', totals.sales_count, 'saleItemCount', totals.item_count,
    'revenue', totals.item_revenue, 'headerSalesRevenue', totals.header_revenue,
    'revenueDifference', totals.header_revenue - totals.item_revenue,
    'costOfGoodsSold', totals.cogs, 'missingCostSalesRevenue', totals.missing_cost_revenue,
    'missingCostItemCount', totals.missing_cost_items,
    'grossProfit', CASE WHEN totals.missing_cost_revenue = 0 THEN totals.item_revenue - totals.cogs ELSE NULL END,
    'storedSaleProfit', totals.stored_profit,
    'profitDifference', CASE WHEN totals.missing_cost_revenue = 0 THEN totals.stored_profit - (totals.item_revenue - totals.cogs) ELSE NULL END,
    'expenseAmount', expense_totals.amount, 'expenseCount', expense_totals.count,
    'netProfit', CASE WHEN p_include_expenses AND totals.missing_cost_revenue = 0 THEN totals.item_revenue - totals.cogs - expense_totals.amount ELSE NULL END
  ) INTO v_result FROM totals CROSS JOIN expense_totals;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_profit_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_profit_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO service_role;

-- New bounded intents reuse shop-local ranges and existing permission gates.
CREATE OR REPLACE FUNCTION public.assistant_extended_query_metrics(
  p_shop_id TEXT,
  p_intent TEXT,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_time_zone TEXT DEFAULT 'Africa/Nairobi'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_today DATE;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN RAISE EXCEPTION 'Shop not found'; END IF;
  IF p_intent NOT IN ('debt_aging', 'stock_movements', 'product_trends', 'supplier_spend') THEN RAISE EXCEPTION 'Unsupported assistant query'; END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN RAISE EXCEPTION 'Invalid assistant date range'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN RAISE EXCEPTION 'Invalid time zone'; END IF;
  v_today := (statement_timestamp() AT TIME ZONE p_time_zone)::DATE;

  IF p_intent = 'supplier_spend' THEN
    WITH delivered_orders AS (
      SELECT o."supplierId" AS supplier_id, su.name AS supplier_name,
        COALESCE(o."receivedTotalAmount", o."totalAmount", 0)::BIGINT AS amount
      FROM public.orders AS o
      LEFT JOIN public.suppliers AS su ON su.id = o."supplierId"
      WHERE o."shopId" = p_shop_id AND o.status = 'DELIVERED'
        AND (p_from IS NULL OR COALESCE(o."receivedAt", o."updatedAt", o."createdAt") >= p_from)
        AND (p_to IS NULL OR COALESCE(o."receivedAt", o."updatedAt", o."createdAt") < p_to)
    ), supplier_totals AS (
      SELECT supplier_id, COALESCE(supplier_name, 'Unknown supplier') AS name,
        SUM(amount)::BIGINT AS amount, COUNT(*)::BIGINT AS orders
      FROM delivered_orders GROUP BY supplier_id, supplier_name
    )
    SELECT jsonb_build_object(
      'amount', COALESCE(SUM(delivered_orders.amount), 0),
      'count', COUNT(*),
      'supplierCount', COUNT(DISTINCT delivered_orders.supplier_id),
      'suppliers', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('name', ranked.name, 'amount', ranked.amount, 'orders', ranked.orders)
          ORDER BY ranked.amount DESC, ranked.name)
        FROM (SELECT * FROM supplier_totals ORDER BY amount DESC, name LIMIT 5) AS ranked
      ), '[]'::JSONB)
    ) INTO v_result FROM delivered_orders;
  ELSIF p_intent = 'debt_aging' THEN
    SELECT jsonb_build_object(
      'openCount', COUNT(*),
      'totalOwed', COALESCE(SUM(balance), 0),
      'notDueAmount', COALESCE(SUM(balance) FILTER (WHERE due_date IS NULL OR due_date::DATE >= v_today), 0),
      'overdue1To30', COALESCE(SUM(balance) FILTER (WHERE days_overdue BETWEEN 1 AND 30), 0),
      'overdue31To60', COALESCE(SUM(balance) FILTER (WHERE days_overdue BETWEEN 31 AND 60), 0),
      'overdue61Plus', COALESCE(SUM(balance) FILTER (WHERE days_overdue > 60), 0),
      'overdueCount', COUNT(*) FILTER (WHERE days_overdue > 0),
      'recordCount', COUNT(*)
    ) INTO v_result
    FROM (
      SELECT GREATEST(d.amount - d."amountPaid", 0) AS balance, d."dueDate" AS due_date,
        CASE WHEN d."dueDate"::DATE < v_today THEN v_today - d."dueDate"::DATE ELSE 0 END AS days_overdue
      FROM public.debts AS d WHERE d."shopId" = p_shop_id AND d.status IN ('OPEN', 'PARTIAL') AND d.amount > d."amountPaid"
    ) AS open_debts;
  ELSIF p_intent = 'stock_movements' THEN
    SELECT jsonb_build_object(
      'recordCount', COUNT(*),
      'movementTypes', COALESCE(jsonb_agg(jsonb_build_object('type', grouped.type, 'records', grouped.records, 'quantity', grouped.quantity) ORDER BY grouped.type), '[]'::JSONB),
      'quantityIn', COALESCE(SUM(grouped.quantity) FILTER (WHERE grouped.type = 'IN'), 0),
      'quantityOut', COALESCE(SUM(grouped.quantity) FILTER (WHERE grouped.type = 'OUT'), 0)
    ) INTO v_result
    FROM (
      SELECT m.type::TEXT AS type, COUNT(*)::BIGINT AS records, COALESCE(SUM(m.quantity), 0)::BIGINT AS quantity
      FROM public.stock_movements AS m JOIN public.products AS p ON p.id = m."productId"
      WHERE p."shopId" = p_shop_id AND (p_from IS NULL OR m."createdAt" >= p_from) AND (p_to IS NULL OR m."createdAt" < p_to)
      GROUP BY m.type
    ) AS grouped;
  ELSE
    WITH duration AS (SELECT COALESCE(p_to - p_from, INTERVAL '30 days') AS span), grouped AS (
      SELECT p.id, p.name, p.unit,
        COALESCE(SUM(si."totalPrice") FILTER (WHERE s."createdAt" >= p_from), 0)::BIGINT AS revenue,
        COALESCE(SUM(si.quantity) FILTER (WHERE s."createdAt" >= p_from), 0)::BIGINT AS units,
        COALESCE(SUM(si."totalPrice") FILTER (WHERE s."createdAt" < p_from), 0)::BIGINT AS previous_revenue,
        COALESCE(SUM(si.quantity) FILTER (WHERE s."createdAt" < p_from), 0)::BIGINT AS previous_units
      FROM public.sales AS s JOIN public.sale_items AS si ON si."saleId" = s.id
      JOIN public.products AS p ON p.id = si."productId" AND p."shopId" = p_shop_id
      WHERE s."shopId" = p_shop_id AND p_from IS NOT NULL AND p_to IS NOT NULL
        AND s."createdAt" >= p_from - (SELECT span FROM duration) AND s."createdAt" < p_to
      GROUP BY p.id, p.name, p.unit
    )
    SELECT jsonb_build_object('products', COALESCE(jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'unit', unit, 'revenue', revenue, 'unitsSold', units,
      'previousRevenue', previous_revenue, 'previousUnits', previous_units,
      'changePercent', CASE WHEN previous_revenue > 0 THEN ROUND((revenue - previous_revenue)::NUMERIC * 100 / previous_revenue) ELSE NULL END
    ) ORDER BY revenue DESC, name, id), '[]'::JSONB), 'recordCount', COUNT(*))
    INTO v_result FROM (SELECT * FROM grouped WHERE revenue > 0 ORDER BY revenue DESC, name, id LIMIT 10) AS trend;
  END IF;
  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_extended_query_metrics(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_extended_query_metrics(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;

-- Recommendation state now distinguishes snooze from dismissal, stores a small
-- optional reason, and guarantees a single SHOWN impression per occurrence.
ALTER TABLE public.assistant_action_occurrences
  ADD COLUMN IF NOT EXISTS "snoozedUntil" DATE,
  ADD COLUMN IF NOT EXISTS "dismissReason" TEXT;
ALTER TABLE public.assistant_action_occurrences DROP CONSTRAINT IF EXISTS assistant_action_occurrences_status_check;
ALTER TABLE public.assistant_action_occurrences ADD CONSTRAINT assistant_action_occurrences_status_check
  CHECK (status IN ('OPEN', 'OPENED', 'COMPLETED', 'DISMISSED', 'SNOOZED'));
ALTER TABLE public.assistant_action_events ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.assistant_action_events ADD COLUMN IF NOT EXISTS "snoozedUntil" DATE;
ALTER TABLE public.assistant_action_events DROP CONSTRAINT IF EXISTS assistant_action_events_eventType_check;
ALTER TABLE public.assistant_action_events ADD CONSTRAINT assistant_action_events_eventType_check
  CHECK ("eventType" IN ('SHOWN', 'OPENED', 'COMPLETED', 'DISMISSED', 'RESTORED', 'SNOOZED'));

-- Old debt links may include names, phone numbers, or balances. Make retained
-- history links generic before any UI reads them again.
UPDATE public.assistant_action_occurrences SET href = '/debts', title = 'Follow up on overdue debts'
WHERE "actionKey" = 'debt' AND (href <> '/debts' OR title <> 'Follow up on overdue debts');
UPDATE public.assistant_actions SET href = '/debts', title = 'Follow up on overdue debts'
WHERE "actionKey" = 'debt' AND (href <> '/debts' OR title <> 'Follow up on overdue debts');

DELETE FROM public.assistant_action_events AS duplicate
USING public.assistant_action_events AS earlier
WHERE duplicate."occurrenceId" = earlier."occurrenceId"
  AND duplicate."eventType" = 'SHOWN' AND earlier."eventType" = 'SHOWN'
  AND (duplicate."createdAt", duplicate.id) > (earlier."createdAt", earlier.id);
CREATE UNIQUE INDEX IF NOT EXISTS assistant_action_one_shown_per_occurrence_idx
  ON public.assistant_action_events ("occurrenceId") WHERE "eventType" = 'SHOWN';

DROP FUNCTION IF EXISTS public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, NUMERIC, JSONB);
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
  p_observed_outcome JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_snoozed_until DATE DEFAULT NULL
)
RETURNS SETOF public.assistant_action_occurrences
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE saved public.assistant_action_occurrences%ROWTYPE;
BEGIN
  IF p_event_type NOT IN ('SHOWN', 'OPENED', 'COMPLETED', 'DISMISSED', 'RESTORED', 'SNOOZED') THEN RAISE EXCEPTION 'Invalid assistant occurrence event'; END IF;
  IF p_condition_key IS NULL OR length(p_condition_key) > 300 THEN RAISE EXCEPTION 'Invalid assistant condition key'; END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('ALREADY_HANDLED', 'NOT_RELEVANT', 'NOT_NOW') THEN RAISE EXCEPTION 'Invalid assistant dismissal reason'; END IF;
  IF p_event_type IN ('DISMISSED', 'SNOOZED') AND p_reason IS NULL THEN RAISE EXCEPTION 'Dismissal reason is required'; END IF;
  IF p_event_type = 'SNOOZED' AND (p_snoozed_until IS NULL OR p_snoozed_until <= p_business_date OR p_snoozed_until > p_business_date + 30) THEN RAISE EXCEPTION 'Invalid snooze date'; END IF;

  INSERT INTO public.assistant_action_occurrences AS existing (
    id, "shopId", "actionKey", title, href, "businessDate", "conditionKey", status,
    "shownAt", "openedAt", "completedAt", "dismissedAt", "baselineStock", "observedOutcome",
    "snoozedUntil", "dismissReason", "createdAt", "updatedAt"
  ) VALUES (
    p_id, p_shop_id, p_action_key,
    CASE WHEN p_action_key = 'debt' THEN 'Follow up on overdue debts' ELSE p_title END,
    CASE WHEN p_action_key = 'debt' THEN '/debts' ELSE p_href END,
    p_business_date, p_condition_key,
    CASE WHEN p_event_type = 'OPENED' THEN 'OPENED' WHEN p_event_type IN ('COMPLETED', 'DISMISSED', 'SNOOZED') THEN p_event_type ELSE 'OPEN' END,
    NOW(), CASE WHEN p_event_type = 'OPENED' THEN NOW() END,
    CASE WHEN p_event_type = 'COMPLETED' THEN NOW() END,
    CASE WHEN p_event_type = 'DISMISSED' THEN NOW() END,
    p_baseline_stock, p_observed_outcome, p_snoozed_until, p_reason, NOW(), NOW()
  )
  ON CONFLICT ("shopId", "actionKey", "businessDate", "conditionKey") DO UPDATE SET
    status = CASE
      WHEN p_event_type = 'COMPLETED' AND existing.status NOT IN ('DISMISSED', 'SNOOZED') THEN 'COMPLETED'
      WHEN p_event_type = 'DISMISSED' AND existing.status <> 'COMPLETED' THEN 'DISMISSED'
      WHEN p_event_type = 'SNOOZED' AND existing.status NOT IN ('COMPLETED', 'DISMISSED') THEN 'SNOOZED'
      WHEN p_event_type = 'RESTORED' AND existing.status IN ('DISMISSED', 'SNOOZED') THEN 'OPEN'
      WHEN p_event_type = 'OPENED' AND existing.status = 'OPEN' THEN 'OPENED'
      ELSE existing.status
    END,
    href = CASE WHEN p_action_key = 'debt' THEN '/debts' ELSE EXCLUDED.href END,
    title = CASE WHEN p_action_key = 'debt' THEN 'Follow up on overdue debts' ELSE EXCLUDED.title END,
    "openedAt" = CASE WHEN p_event_type = 'OPENED' THEN COALESCE(existing."openedAt", NOW()) ELSE existing."openedAt" END,
    "completedAt" = CASE WHEN p_event_type = 'COMPLETED' THEN COALESCE(existing."completedAt", NOW()) ELSE existing."completedAt" END,
    "dismissedAt" = CASE WHEN p_event_type = 'DISMISSED' THEN COALESCE(existing."dismissedAt", NOW()) ELSE existing."dismissedAt" END,
    "snoozedUntil" = CASE WHEN p_event_type = 'SNOOZED' THEN p_snoozed_until WHEN p_event_type = 'RESTORED' THEN NULL ELSE existing."snoozedUntil" END,
    "dismissReason" = CASE WHEN p_event_type IN ('DISMISSED', 'SNOOZED') THEN p_reason WHEN p_event_type = 'RESTORED' THEN NULL ELSE existing."dismissReason" END,
    "baselineStock" = COALESCE(existing."baselineStock", EXCLUDED."baselineStock"),
    "observedOutcome" = COALESCE(existing."observedOutcome", EXCLUDED."observedOutcome"),
    "updatedAt" = NOW()
  RETURNING existing.* INTO saved;

  INSERT INTO public.assistant_action_events (
    "occurrenceId", "shopId", "actionKey", "businessDate", "conditionKey", "eventType", reason, "snoozedUntil"
  ) VALUES (saved.id, p_shop_id, p_action_key, p_business_date, p_condition_key, p_event_type, p_reason, p_snoozed_until)
  ON CONFLICT ("occurrenceId") WHERE "eventType" = 'SHOWN' DO NOTHING;
  RETURN NEXT saved;
END;
$$;

REVOKE ALL ON FUNCTION public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, NUMERIC, JSONB, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_assistant_action_occurrence(TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, NUMERIC, JSONB, TEXT, DATE) TO service_role;

CREATE INDEX IF NOT EXISTS offline_sync_events_shop_device_local_created_idx
  ON public.offline_sync_events ("shopId", "deviceId", "localId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS sale_items_assistant_recent_cover_idx
  ON public.sale_items ("saleId", "productId") INCLUDE (quantity, "totalPrice", "buyingPrice");
