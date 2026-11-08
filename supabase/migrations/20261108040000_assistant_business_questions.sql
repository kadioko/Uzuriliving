-- Persist the small amount of shop context needed for target and delivery
-- questions. Dates are shop-calendar dates, not UTC timestamps.
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS "dailySalesTarget" INTEGER,
  ADD COLUMN IF NOT EXISTS "weeklySalesTarget" INTEGER,
  ADD COLUMN IF NOT EXISTS "monthlySalesTarget" INTEGER;

ALTER TABLE public.shops
  DROP CONSTRAINT IF EXISTS shops_sales_targets_nonnegative;
ALTER TABLE public.shops
  ADD CONSTRAINT shops_sales_targets_nonnegative
  CHECK (("dailySalesTarget" IS NULL OR "dailySalesTarget" >= 0)
    AND ("weeklySalesTarget" IS NULL OR "weeklySalesTarget" >= 0)
    AND ("monthlySalesTarget" IS NULL OR "monthlySalesTarget" >= 0));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS "expectedDeliveryDate" DATE;

CREATE INDEX IF NOT EXISTS orders_shop_status_expected_delivery_idx
  ON public.orders ("shopId", status, "expectedDeliveryDate");

-- Include shop on-hand quantity in dormant-product answers, while keeping the
-- query bounded and restricted to active products.
CREATE OR REPLACE FUNCTION public.assistant_unsold_product_metrics(
  p_shop_id TEXT,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_result JSONB;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF p_to IS NULL OR (p_from IS NOT NULL AND p_from >= p_to) THEN
    RAISE EXCEPTION 'A valid assistant date range is required';
  END IF;

  WITH sold_products AS (
    SELECT DISTINCT si."productId"
    FROM public.sales AS s
    JOIN public.sale_items AS si ON si."saleId" = s.id
    WHERE s."shopId" = p_shop_id
      AND (p_from IS NULL OR s."createdAt" >= p_from)
      AND s."createdAt" < p_to
      AND si.quantity > 0
  ), unsold_products AS (
    SELECT p.id, p.name, p.unit, p."currentStock"
    FROM public.products AS p
    WHERE p."shopId" = p_shop_id
      AND p."isActive" = TRUE
      AND NOT EXISTS (SELECT 1 FROM sold_products AS sold WHERE sold."productId" = p.id)
  ), counts AS (
    SELECT COUNT(*)::INTEGER AS record_count FROM unsold_products
  )
  SELECT jsonb_build_object(
    'recordCount', counts.record_count,
    'listedCount', LEAST(counts.record_count, 30),
    'hasMore', counts.record_count > 30,
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', listed.id, 'name', listed.name, 'unit', listed.unit, 'currentStock', listed."currentStock")
        ORDER BY listed.name, listed.id)
      FROM (SELECT id, name, unit, "currentStock" FROM unsold_products ORDER BY name, id LIMIT 30) AS listed
    ), '[]'::JSONB)
  ) INTO v_result
  FROM counts;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_unsold_product_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_unsold_product_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

-- A single shop-scoped, bounded metric RPC backs new analytical questions.
-- It returns aggregates only; permissions and user-visible wording stay in the
-- authenticated Edge Function.
CREATE OR REPLACE FUNCTION public.assistant_expanded_metrics(
  p_shop_id TEXT,
  p_intent TEXT,
  p_from TIMESTAMPTZ,
  p_to TIMESTAMPTZ,
  p_compare_from TIMESTAMPTZ,
  p_compare_to TIMESTAMPTZ,
  p_time_zone TEXT
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
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF p_intent NOT IN ('performance_drivers', 'product_profit', 'sales_patterns', 'supplier_orders', 'delivery_differences') THEN
    RAISE EXCEPTION 'Unsupported assistant query';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION 'Invalid assistant date range';
  END IF;
  IF (p_compare_from IS NULL) <> (p_compare_to IS NULL)
     OR (p_compare_from IS NOT NULL AND p_compare_from >= p_compare_to) THEN
    RAISE EXCEPTION 'Invalid assistant comparison range';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone';
  END IF;
  v_today := (statement_timestamp() AT TIME ZONE p_time_zone)::DATE;

  IF p_intent = 'performance_drivers' THEN
    WITH periods AS (
      SELECT 'current'::TEXT AS period, p_from AS started_at, p_to AS ended_at
      UNION ALL
      SELECT 'previous', p_compare_from, p_compare_to WHERE p_compare_from IS NOT NULL
    ), sales AS (
      SELECT periods.period, s.id, s."totalAmount"
      FROM periods
      LEFT JOIN public.sales AS s ON s."shopId" = p_shop_id
        AND s."createdAt" >= periods.started_at AND s."createdAt" < periods.ended_at
    ), items AS (
      SELECT periods.period,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units,
        COALESCE(SUM(si."totalPrice"), 0)::BIGINT AS item_revenue,
        COALESCE(SUM(si.quantity * si."buyingPrice") FILTER (WHERE si."buyingPrice" IS NOT NULL), 0)::BIGINT AS cogs,
        COALESCE(SUM(si."totalPrice") FILTER (WHERE si."buyingPrice" IS NULL), 0)::BIGINT AS missing_cost_revenue
      FROM periods
      LEFT JOIN public.sales AS s ON s."shopId" = p_shop_id
        AND s."createdAt" >= periods.started_at AND s."createdAt" < periods.ended_at
      LEFT JOIN public.sale_items AS si ON si."saleId" = s.id
      GROUP BY periods.period
    ), headers AS (
      SELECT period, COALESCE(SUM("totalAmount"), 0)::BIGINT AS revenue,
        COUNT(id)::BIGINT AS sale_count
      FROM sales GROUP BY period
    ), expenses AS (
      SELECT periods.period, COALESCE(SUM(e.amount), 0)::BIGINT AS amount,
        COUNT(e.id)::BIGINT AS record_count
      FROM periods
      LEFT JOIN public.expenses AS e ON e."shopId" = p_shop_id
        AND e."spentAt" >= periods.started_at AND e."spentAt" < periods.ended_at
      GROUP BY periods.period
    ), summaries AS (
      SELECT headers.period, headers.revenue, headers.sale_count, items.units,
        items.item_revenue, items.cogs, items.missing_cost_revenue,
        CASE WHEN items.missing_cost_revenue = 0 THEN items.item_revenue - items.cogs END AS gross_profit,
        expenses.amount AS expenses, expenses.record_count AS expense_count
      FROM headers JOIN items USING (period) JOIN expenses USING (period)
    ), product_periods AS (
      SELECT periods.period, p.id, p.name, p.unit,
        COALESCE(SUM(si."totalPrice"), 0)::BIGINT AS revenue,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units
      FROM periods
      JOIN public.sales AS s ON s."shopId" = p_shop_id
        AND s."createdAt" >= periods.started_at AND s."createdAt" < periods.ended_at
      JOIN public.sale_items AS si ON si."saleId" = s.id
      JOIN public.products AS p ON p.id = si."productId" AND p."shopId" = p_shop_id
      GROUP BY periods.period, p.id, p.name, p.unit
    ), product_changes AS (
      SELECT COALESCE(current.id, previous.id) AS id,
        COALESCE(current.name, previous.name) AS name,
        COALESCE(current.unit, previous.unit) AS unit,
        COALESCE(current.revenue, 0) AS current_revenue,
        COALESCE(current.units, 0) AS current_units,
        COALESCE(previous.revenue, 0) AS previous_revenue,
        COALESCE(previous.units, 0) AS previous_units
      FROM (SELECT * FROM product_periods WHERE period = 'current') AS current
      FULL OUTER JOIN (SELECT * FROM product_periods WHERE period = 'previous') AS previous
        ON previous.id = current.id
    )
    SELECT jsonb_build_object(
      'current', (SELECT to_jsonb(summaries) - 'period' FROM summaries WHERE period = 'current'),
      'previous', (SELECT to_jsonb(summaries) - 'period' FROM summaries WHERE period = 'previous'),
      'products', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name, 'unit', ranked.unit,
          'currentRevenue', ranked.current_revenue, 'previousRevenue', ranked.previous_revenue,
          'currentUnits', ranked.current_units, 'previousUnits', ranked.previous_units,
          'revenueChange', ranked.current_revenue - ranked.previous_revenue,
          'unitsChange', ranked.current_units - ranked.previous_units)
          ORDER BY ABS(ranked.current_revenue - ranked.previous_revenue) DESC, ranked.name, ranked.id)
        FROM (SELECT * FROM product_changes ORDER BY ABS(current_revenue - previous_revenue) DESC, name, id LIMIT 5) AS ranked
      ), '[]'::JSONB)
    ) INTO v_result;
  ELSIF p_intent = 'product_profit' THEN
    WITH product_totals AS (
      SELECT p.id, p.name, p.unit,
        COALESCE(SUM(si.quantity), 0)::BIGINT AS units,
        COALESCE(SUM(si."totalPrice"), 0)::BIGINT AS revenue,
        COALESCE(SUM(si.quantity * si."buyingPrice") FILTER (WHERE si."buyingPrice" IS NOT NULL), 0)::BIGINT AS cogs,
        COALESCE(SUM(si."totalPrice") FILTER (WHERE si."buyingPrice" IS NULL), 0)::BIGINT AS missing_cost_revenue,
        COUNT(si.id) FILTER (WHERE si."buyingPrice" IS NULL)::BIGINT AS missing_cost_lines,
        COUNT(si.id)::BIGINT AS line_count
      FROM public.products AS p
      JOIN public.sale_items AS si ON si."productId" = p.id
      JOIN public.sales AS s ON s.id = si."saleId" AND s."shopId" = p_shop_id
        AND (p_from IS NULL OR s."createdAt" >= p_from) AND (p_to IS NULL OR s."createdAt" < p_to)
      WHERE p."shopId" = p_shop_id
      GROUP BY p.id, p.name, p.unit
    ), complete AS (
      SELECT *, revenue - cogs AS gross_profit FROM product_totals WHERE missing_cost_lines = 0
    )
    SELECT jsonb_build_object(
      'recordCount', COALESCE((SELECT SUM(line_count) FROM product_totals), 0),
      'productCount', COUNT(*),
      'incompleteCostProductCount', (SELECT COUNT(*) FROM product_totals WHERE missing_cost_lines > 0),
      'missingCostSalesRevenue', COALESCE((SELECT SUM(missing_cost_revenue) FROM product_totals), 0),
      'products', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ranked.id, 'name', ranked.name,
        'unit', ranked.unit, 'unitsSold', ranked.units, 'revenue', ranked.revenue,
        'costOfGoodsSold', ranked.cogs, 'grossProfit', ranked.gross_profit, 'saleLines', ranked.line_count)
        ORDER BY ranked.gross_profit DESC, ranked.name, ranked.id)
        FROM (SELECT * FROM complete ORDER BY gross_profit DESC, name, id LIMIT 10) AS ranked), '[]'::JSONB)
    ) INTO v_result FROM complete;
  ELSIF p_intent = 'sales_patterns' THEN
    WITH selected AS (
      SELECT s.id, s."totalAmount",
        (s."createdAt" AT TIME ZONE p_time_zone)::DATE AS business_date,
        EXTRACT(ISODOW FROM s."createdAt" AT TIME ZONE p_time_zone)::INTEGER AS weekday_number,
        EXTRACT(HOUR FROM s."createdAt" AT TIME ZONE p_time_zone)::INTEGER AS hour_of_day
      FROM public.sales AS s
      WHERE s."shopId" = p_shop_id
        AND (p_from IS NULL OR s."createdAt" >= p_from)
        AND (p_to IS NULL OR s."createdAt" < p_to)
    ), day_rank AS (
      SELECT weekday_number, COUNT(*)::BIGINT AS sales, SUM("totalAmount")::BIGINT AS revenue
      FROM selected GROUP BY weekday_number
    ), hour_rank AS (
      SELECT hour_of_day, COUNT(*)::BIGINT AS sales, SUM("totalAmount")::BIGINT AS revenue
      FROM selected GROUP BY hour_of_day
    )
    SELECT jsonb_build_object(
      'salesCount', (SELECT COUNT(*) FROM selected),
      'observedDays', (SELECT COUNT(DISTINCT business_date) FROM selected),
      'revenue', (SELECT COALESCE(SUM("totalAmount"), 0) FROM selected),
      'busiestDay', (SELECT jsonb_build_object('weekday', weekday_number, 'sales', sales, 'revenue', revenue) FROM day_rank ORDER BY sales DESC, revenue DESC, weekday_number LIMIT 1),
      'busiestHour', (SELECT jsonb_build_object('hour', hour_of_day, 'sales', sales, 'revenue', revenue) FROM hour_rank ORDER BY sales DESC, revenue DESC, hour_of_day LIMIT 1)
    ) INTO v_result;
  ELSIF p_intent = 'supplier_orders' THEN
    WITH open_orders AS (
      SELECT o.id, o.status::TEXT AS status, o."expectedDeliveryDate", o."createdAt",
        s.name AS supplier_name, COUNT(oi.id)::INTEGER AS line_count
      FROM public.orders AS o
      JOIN public.suppliers AS s ON s.id = o."supplierId"
      LEFT JOIN public.order_items AS oi ON oi."orderId" = o.id
      WHERE o."shopId" = p_shop_id AND o.status IN ('PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY')
      GROUP BY o.id, o.status, o."expectedDeliveryDate", o."createdAt", s.name
    )
    SELECT jsonb_build_object(
      'openCount', COUNT(*),
      'lateCount', COUNT(*) FILTER (WHERE "expectedDeliveryDate" < v_today),
      'noExpectedDateCount', COUNT(*) FILTER (WHERE "expectedDeliveryDate" IS NULL),
      'outForDeliveryCount', COUNT(*) FILTER (WHERE status = 'OUT_FOR_DELIVERY'),
      'recordCount', COUNT(*),
      'orders', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', ranked.id, 'status', ranked.status,
        'supplier', ranked.supplier_name, 'expectedDeliveryDate', ranked."expectedDeliveryDate",
        'createdAt', ranked."createdAt", 'lineCount', ranked.line_count)
        ORDER BY ranked."expectedDeliveryDate" ASC NULLS LAST, ranked."createdAt" ASC, ranked.id)
        FROM (SELECT * FROM open_orders ORDER BY "expectedDeliveryDate" ASC NULLS LAST, "createdAt" ASC, id LIMIT 10) AS ranked), '[]'::JSONB)
    ) INTO v_result FROM open_orders;
  ELSE
    WITH discrepant_orders AS (
      SELECT o.id, o."orderGroupId", o.status::TEXT AS status,
        COALESCE(r."createdAt", o."receivedAt", o."updatedAt") AS received_at,
        s.name AS supplier_name,
        COUNT(ri.id) FILTER (WHERE ri."orderedQuantity" <> ri."receivedQuantity")::INTEGER AS difference_lines,
        COALESCE(SUM(ABS(ri."orderedQuantity" - ri."receivedQuantity")) FILTER (WHERE ri."orderedQuantity" <> ri."receivedQuantity"), 0)::BIGINT AS unit_difference,
        EXISTS (SELECT 1 FROM public.supplier_order_receipts AS correction
          WHERE correction."orderId" = o.id AND correction."receiptType" = 'CORRECTION') AS has_correction,
        COALESCE(jsonb_agg(jsonb_build_object('product', p.name, 'ordered', ri."orderedQuantity", 'received', ri."receivedQuantity")
          ORDER BY p.name) FILTER (WHERE ri."orderedQuantity" <> ri."receivedQuantity"), '[]'::JSONB) AS items
      FROM public.supplier_order_receipts AS r
      JOIN public.orders AS o ON o.id = r."orderId" AND o."shopId" = p_shop_id
      JOIN public.suppliers AS s ON s.id = o."supplierId"
      JOIN public.supplier_order_receipt_items AS ri ON ri."receiptId" = r.id
      JOIN public.products AS p ON p.id = ri."productId" AND p."shopId" = p_shop_id
      WHERE r."receiptType" = 'INITIAL'
        AND (p_from IS NULL OR r."createdAt" >= p_from)
        AND (p_to IS NULL OR r."createdAt" < p_to)
      GROUP BY o.id, o."orderGroupId", o.status, r."createdAt", o."receivedAt", o."updatedAt", s.name
    )
    SELECT jsonb_build_object(
      'recordCount', COUNT(*) FILTER (WHERE difference_lines > 0),
      'differenceLines', COALESCE(SUM(difference_lines), 0),
      'unitsDifference', COALESCE(SUM(unit_difference), 0),
      'orders', COALESCE(jsonb_agg(jsonb_build_object('id', id, 'orderGroupId', "orderGroupId", 'status', status,
        'receivedAt', received_at, 'supplier', supplier_name, 'differenceLines', difference_lines,
        'unitsDifference', unit_difference, 'correctionRecorded', has_correction, 'items', items)
        ORDER BY received_at DESC, id) FILTER (WHERE difference_lines > 0), '[]'::JSONB)
    ) INTO v_result FROM discrepant_orders;
  END IF;
  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_expanded_metrics(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_expanded_metrics(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.assistant_reorder_risk_metrics(p_shop_id TEXT, p_time_zone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_today DATE; v_result JSONB;
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN RAISE EXCEPTION 'Shop not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN RAISE EXCEPTION 'Invalid time zone'; END IF;
  v_today := (statement_timestamp() AT TIME ZONE p_time_zone)::DATE;

  WITH products AS (
    SELECT p.id, p.name, p.unit, p."currentStock", p."supplierLeadTimeDays", p."reorderSafetyDays", p."reorderPackSize",
      GREATEST(v_today - 28, (p."assistantStockTrackingStartedAt" AT TIME ZONE p_time_zone)::DATE
        + CASE WHEN p."assistantStockTrackingStartedAt" > (((p."assistantStockTrackingStartedAt" AT TIME ZONE p_time_zone)::DATE)::TIMESTAMP AT TIME ZONE p_time_zone) THEN 1 ELSE 0 END) AS coverage_from
    FROM public.products AS p
    WHERE p."shopId" = p_shop_id AND p."isActive" AND p."isReorderable"
  ), calendar AS (
    SELECT p.id, day::DATE AS business_date,
      EXISTS (SELECT 1 FROM public.product_stockout_periods AS stockout
        WHERE stockout."productId" = p.id
          AND stockout."startedAt" < ((day::DATE + 1)::TIMESTAMP AT TIME ZONE p_time_zone)
          AND COALESCE(stockout."endedAt", 'infinity'::TIMESTAMPTZ) > (day::DATE::TIMESTAMP AT TIME ZONE p_time_zone)) AS is_stockout
    FROM products AS p
    CROSS JOIN LATERAL generate_series(p.coverage_from, v_today - 1, INTERVAL '1 day') AS day
    WHERE p.coverage_from < v_today
  ), observations AS (
    SELECT p.id, COUNT(c.business_date)::INTEGER AS observed_days,
      COUNT(c.business_date) FILTER (WHERE c.is_stockout)::INTEGER AS stockout_days,
      COUNT(c.business_date) FILTER (WHERE NOT c.is_stockout)::INTEGER AS available_days
    FROM products AS p LEFT JOIN calendar AS c ON c.id = p.id
    GROUP BY p.id
  ), sales_by_day AS (
    SELECT p.id, (s."createdAt" AT TIME ZONE p_time_zone)::DATE AS business_date, SUM(si.quantity)::BIGINT AS quantity
    FROM products AS p
    JOIN public.sale_items AS si ON si."productId" = p.id
    JOIN public.sales AS s ON s.id = si."saleId" AND s."shopId" = p_shop_id
    WHERE s."createdAt" >= ((v_today - 28)::TIMESTAMP AT TIME ZONE p_time_zone)
      AND s."createdAt" < (v_today::TIMESTAMP AT TIME ZONE p_time_zone)
    GROUP BY p.id, (s."createdAt" AT TIME ZONE p_time_zone)::DATE
  ), demand AS (
    SELECT p.id,
      COUNT(s.business_date) FILTER (WHERE NOT COALESCE(c.is_stockout, FALSE))::INTEGER AS selling_days,
      COALESCE(SUM(s.quantity) FILTER (WHERE NOT COALESCE(c.is_stockout, FALSE)), 0)::BIGINT AS units_sold
    FROM products AS p
    LEFT JOIN sales_by_day AS s ON s.id = p.id
    LEFT JOIN calendar AS c ON c.id = p.id AND c.business_date = s.business_date
    GROUP BY p.id
  ), incoming AS (
    SELECT oi."productId",
      SUM(oi.quantity)::BIGINT AS quantity,
      COUNT(DISTINCT o.id)::INTEGER AS open_order_count,
      BOOL_OR(o."expectedDeliveryDate" IS NULL) AS has_unknown_eta,
      MIN(o."expectedDeliveryDate") FILTER (WHERE o."expectedDeliveryDate" >= v_today) AS next_delivery_date,
      BOOL_OR(o.status = 'OUT_FOR_DELIVERY') AS is_out_for_delivery,
      BOOL_OR(o."expectedDeliveryDate" < v_today) AS has_overdue_order
    FROM public.orders AS o
    JOIN public.order_items AS oi ON oi."orderId" = o.id
    WHERE o."shopId" = p_shop_id AND o.status IN ('PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY')
    GROUP BY oi."productId"
  ), estimates AS (
    SELECT p.id, p.name, p.unit, p."currentStock", p."supplierLeadTimeDays", p."reorderSafetyDays", p."reorderPackSize",
      COALESCE(i.quantity, 0) AS incoming_quantity,
      COALESCE(i.open_order_count, 0) AS open_order_count,
      COALESCE(i.has_unknown_eta, FALSE) AS has_unknown_eta,
      i.next_delivery_date, COALESCE(i.is_out_for_delivery, FALSE) AS is_out_for_delivery,
      COALESCE(i.has_overdue_order, FALSE) AS has_overdue_order,
      o.observed_days, o.available_days, o.stockout_days, d.selling_days, d.units_sold,
      CASE WHEN o.available_days > 0 THEN d.units_sold::NUMERIC / o.available_days END AS units_per_available_day,
      CASE WHEN COALESCE(i.open_order_count, 0) > 0 AND COALESCE(i.has_unknown_eta, FALSE) THEN NULL
        WHEN i.next_delivery_date IS NOT NULL THEN i.next_delivery_date - v_today
        WHEN COALESCE(i.is_out_for_delivery, FALSE) OR COALESCE(i.has_overdue_order, FALSE) THEN NULL
        ELSE p."supplierLeadTimeDays" END AS days_until_delivery
    FROM products AS p
    JOIN observations AS o ON o.id = p.id
    JOIN demand AS d ON d.id = p.id
    LEFT JOIN incoming AS i ON i."productId" = p.id
  ), risks AS (
    SELECT *,
      CASE WHEN units_per_available_day > 0 THEN ROUND("currentStock" / units_per_available_day, 1) END AS days_of_cover,
      CASE WHEN units_per_available_day > 0 AND days_until_delivery IS NOT NULL
        THEN GREATEST(CEIL(units_per_available_day * days_until_delivery - "currentStock"), 0)::BIGINT END AS estimated_shortfall
      , CASE WHEN open_order_count = 0 AND "supplierLeadTimeDays" IS NOT NULL AND units_per_available_day > 0
          THEN (CEIL(GREATEST(CEIL(units_per_available_day * ("supplierLeadTimeDays" + COALESCE("reorderSafetyDays", 0)) - "currentStock"), 0)
            / GREATEST(COALESCE("reorderPackSize", 1), 1)) * GREATEST(COALESCE("reorderPackSize", 1), 1))::BIGINT
        END AS suggested_order_quantity
    FROM estimates
  )
  SELECT jsonb_build_object(
    'checkedAt', statement_timestamp(),
    'businessDate', v_today,
    'recordCount', COUNT(*) FILTER (WHERE observed_days >= 21 AND available_days >= 14 AND selling_days >= 7 AND units_sold > 0
      AND days_until_delivery IS NOT NULL AND days_of_cover < days_until_delivery),
    'insufficientHistoryCount', COUNT(*) FILTER (WHERE observed_days < 21 OR available_days < 14 OR selling_days < 7 OR units_sold = 0),
    'missingLeadTimeCount', COUNT(*) FILTER (WHERE "supplierLeadTimeDays" IS NULL AND next_delivery_date IS NULL),
    'unknownDeliveryCount', COUNT(*) FILTER (WHERE (open_order_count > 0 AND has_unknown_eta)
      OR (open_order_count = 0 AND next_delivery_date IS NULL AND "supplierLeadTimeDays" IS NULL)
      OR (is_out_for_delivery AND next_delivery_date IS NULL) OR has_overdue_order),
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ranked.id, 'name', ranked.name, 'unit', ranked.unit,
        'currentStock', ranked."currentStock", 'onOrderQuantity', ranked.incoming_quantity,
        'nextDeliveryDate', ranked.next_delivery_date, 'outForDelivery', ranked.is_out_for_delivery,
        'leadTimeDays', ranked."supplierLeadTimeDays", 'safetyDays', ranked."reorderSafetyDays",
        'observedDays', ranked.observed_days, 'availableDays', ranked.available_days,
        'stockoutDays', ranked.stockout_days, 'sellingDays', ranked.selling_days,
        'averageDailyUnits', ROUND(ranked.units_per_available_day, 2),
        'daysOfCoverOnHand', ranked.days_of_cover,
        'daysUntilDelivery', ranked.days_until_delivery,
        'estimatedShortfallBeforeDelivery', ranked.estimated_shortfall,
        'suggestedOrderQuantity', ranked.suggested_order_quantity,
        'reorderPackSize', ranked."reorderPackSize",
        'estimateBasis', CASE WHEN ranked.next_delivery_date IS NOT NULL THEN 'expected_delivery_date'
          WHEN ranked.has_overdue_order THEN 'overdue_order_no_revised_date'
          WHEN ranked."supplierLeadTimeDays" IS NOT NULL THEN 'configured_supplier_lead_time' ELSE 'delivery_date_unknown' END
      ) ORDER BY ranked.days_of_cover ASC, ranked.name, ranked.id)
      FROM (SELECT * FROM risks
        WHERE observed_days >= 21 AND available_days >= 14 AND selling_days >= 7 AND units_sold > 0
          AND days_until_delivery IS NOT NULL AND days_of_cover < days_until_delivery
        ORDER BY days_of_cover ASC, name, id LIMIT 20) AS ranked
    ), '[]'::JSONB)
  ) INTO v_result FROM risks;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_reorder_risk_metrics(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_reorder_risk_metrics(TEXT, TEXT) TO service_role;

-- Capture promised delivery dates in order revision history as well as in the
-- live order record.
CREATE OR REPLACE FUNCTION public.supplier_order_snapshot(p_order_id TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'supplierId', o."supplierId",
    'supplierName', s.name,
    'status', o.status,
    'note', o.note,
    'totalAmount', o."totalAmount",
    'expectedDeliveryDate', o."expectedDeliveryDate",
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'productId', oi."productId",
        'productName', p.name,
        'quantity', oi.quantity,
        'unitPrice', oi."unitPrice",
        'note', oi.note
      ) ORDER BY p.name, oi."productId")
      FROM public.order_items AS oi
      JOIN public.products AS p ON p.id = oi."productId"
      WHERE oi."orderId" = o.id
    ), '[]'::JSONB)
  )
  FROM public.orders AS o
  JOIN public.suppliers AS s ON s.id = o."supplierId"
  WHERE o.id = p_order_id
$$;

-- Preserve the existing atomic order write and add the shop-local promised
-- delivery date to it, rather than writing order content and ETA separately.
CREATE OR REPLACE FUNCTION public.save_supplier_order(p_shop_id TEXT, p_order_id TEXT, p_body JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  saved_id TEXT := COALESCE(p_order_id, gen_random_uuid()::TEXT);
  existing public.orders%ROWTYPE;
  product_row public.products%ROWTYPE;
  item JSONB;
  qty INTEGER;
  price INTEGER;
  total INTEGER := 0;
  supplier_id TEXT;
  delivery_date DATE;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO existing FROM public.orders WHERE id = p_order_id AND "shopId" = p_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002'; END IF;
    IF existing.status NOT IN ('PENDING', 'OUT_FOR_DELIVERY') THEN RAISE EXCEPTION 'Only pending or out-for-delivery orders can be edited' USING ERRCODE = '22023'; END IF;
    supplier_id := existing."supplierId";
    delivery_date := CASE WHEN p_body ? 'expectedDeliveryDate' THEN NULLIF(p_body->>'expectedDeliveryDate', '')::DATE ELSE existing."expectedDeliveryDate" END;
  ELSE
    supplier_id := p_body->>'supplierId';
    delivery_date := NULLIF(p_body->>'expectedDeliveryDate', '')::DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = supplier_id AND ("createdByShopId" IS NULL OR "createdByShopId" = p_shop_id)) THEN
    RAISE EXCEPTION 'Supplier not available to this shop' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_body->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_body->'items') = 0 THEN RAISE EXCEPTION 'An order must contain at least one product' USING ERRCODE = '22023'; END IF;
  IF (SELECT COUNT(*) <> COUNT(DISTINCT value->>'productId') FROM jsonb_array_elements(p_body->'items')) THEN RAISE EXCEPTION 'Each product can appear only once in an order' USING ERRCODE = '22023'; END IF;
  IF p_order_id IS NULL THEN
    INSERT INTO public.orders(id, "shopId", "supplierId", "orderGroupId", "expectedDeliveryDate", status, "updatedAt")
    VALUES(saved_id, p_shop_id, supplier_id, NULLIF(p_body->>'orderGroupId', ''), delivery_date, 'PENDING', NOW());
  ELSE
    DELETE FROM public.order_items WHERE "orderId" = saved_id;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_body->'items') ORDER BY value->>'productId' LOOP
    IF COALESCE(item->>'quantity', '') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Order quantities must be positive whole numbers' USING ERRCODE = '22023'; END IF;
    qty := (item->>'quantity')::INTEGER;
    SELECT * INTO product_row FROM public.products WHERE id = item->>'productId' AND "shopId" = p_shop_id AND "isActive" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not available in this shop' USING ERRCODE = '22023'; END IF;
    IF NULLIF(item->>'unitPrice', '') IS NOT NULL AND item->>'unitPrice' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Order prices must be whole non-negative numbers' USING ERRCODE = '22023'; END IF;
    price := COALESCE(NULLIF(item->>'unitPrice', '')::INTEGER, product_row."buyingPrice");
    total := total + qty * price;
    INSERT INTO public.order_items(id, "orderId", "productId", quantity, "unitPrice", note)
    VALUES(gen_random_uuid()::TEXT, saved_id, product_row.id, qty, price, NULLIF(BTRIM(item->>'note'), ''));
  END LOOP;
  UPDATE public.orders SET "totalAmount" = total, "expectedDeliveryDate" = delivery_date,
    note = NULLIF(BTRIM(p_body->>'note'), ''), "updatedAt" = NOW()
  WHERE id = saved_id AND "shopId" = p_shop_id;
  RETURN saved_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_supplier_order(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_supplier_order(TEXT, TEXT, JSONB) TO service_role;

-- Keep batch creation idempotent while recording one expected date for all
-- suppliers in the same batch.
CREATE OR REPLACE FUNCTION public.save_supplier_order_batch_with_eta(
  p_shop_id TEXT, p_groups JSONB, p_order_group_id TEXT, p_note TEXT,
  p_user_id TEXT, p_staff_id TEXT, p_expected_delivery_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE result JSONB; existing_count INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id || ':' || p_order_group_id, 0));
  SELECT COUNT(*) INTO existing_count FROM public.orders WHERE "shopId" = p_shop_id AND "orderGroupId" = p_order_group_id;
  IF existing_count > 0 AND EXISTS (
    SELECT 1 FROM public.orders WHERE "shopId" = p_shop_id AND "orderGroupId" = p_order_group_id
      AND "expectedDeliveryDate" IS DISTINCT FROM p_expected_delivery_date
  ) THEN
    RAISE EXCEPTION 'Order batch reference already exists with a different expected delivery date' USING ERRCODE = '22023';
  END IF;
  result := public.save_supplier_order_batch(p_shop_id, p_groups, p_order_group_id, p_note, p_user_id, p_staff_id);
  IF existing_count = 0 THEN
    UPDATE public.orders SET "expectedDeliveryDate" = p_expected_delivery_date
    WHERE "shopId" = p_shop_id AND "orderGroupId" = p_order_group_id;
    UPDATE public.supplier_order_revisions AS revision
    SET "afterSnapshot" = jsonb_set(
      revision."afterSnapshot",
      '{expectedDeliveryDate}',
      COALESCE(to_jsonb(p_expected_delivery_date), 'null'::JSONB),
      TRUE
    )
    FROM public.orders AS order_row
    WHERE order_row."shopId" = p_shop_id AND order_row."orderGroupId" = p_order_group_id
      AND revision."orderId" = order_row.id AND revision."shopId" = p_shop_id
      AND revision.action = 'CREATED';
  END IF;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_supplier_order_batch_with_eta(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_supplier_order_batch_with_eta(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, DATE) TO service_role;
