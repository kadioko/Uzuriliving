-- Keep assistant traffic small: aggregate at the database boundary and only
-- return the fields used by the assistant. All functions are service-role only;
-- the Edge Function authenticates the user and supplies permission flags.
-- Prisma TIMESTAMP columns represent UTC in this app, so convert through UTC
-- before grouping into a shop-local calendar day.

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
      COALESCE(i.on_the_way, 0) AS on_the_way
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
          END
        ) || CASE WHEN p_can_manage_stock THEN jsonb_build_object(
          'onOrderQuantity', selected.on_order,
          'onOrderOrderedQuantity', selected.ordered,
          'onOrderInTransitQuantity', selected.on_the_way
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
          ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone)::DATE AS "businessDate",
          SUM(si.quantity)::BIGINT AS quantity
        FROM candidates AS c
        JOIN public.sale_items AS si ON si."productId" = c."productId"
        JOIN public.sales AS s ON s.id = si."saleId"
        WHERE s."shopId" = p_shop_id
          AND s."createdAt" >= v_since
          AND s."createdAt" <= v_now
        GROUP BY si."productId", ((s."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone)::DATE
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
    'debts', jsonb_build_object('status', CASE WHEN v_can_reports AND v_can_sell THEN 'ready' ELSE 'restricted' END),
    'expenses', jsonb_build_object('status', CASE WHEN v_can_expenses THEN 'ready' ELSE 'restricted' END),
    'costs', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END),
    'stock', jsonb_build_object('status', CASE WHEN v_can_view_stock THEN 'ready' ELSE 'restricted' END),
    'purchases', jsonb_build_object('status', CASE WHEN v_can_reports THEN 'ready' ELSE 'restricted' END)
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
        'netProfit',
          COALESCE((SELECT SUM(s.profit) FROM public.sales AS s WHERE s."shopId" = p_shop_id AND s."createdAt" >= v_today_start AND s."createdAt" < v_now), 0)
          - COALESCE((SELECT SUM(e.amount) FROM public.expenses AS e WHERE e."shopId" = p_shop_id AND e."spentAt" >= v_today_start AND e."spentAt" < v_now), 0)
      )) INTO v_dashboard;
      v_sources := jsonb_set(v_sources, '{today}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_dashboard := NULL;
      v_sources := jsonb_set(v_sources, '{today}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;

    BEGIN
      WITH top_products AS (
        SELECT
          si."productId",
          SUM(si.quantity)::BIGINT AS "totalQuantity",
          SUM(si."totalPrice")::BIGINT AS "totalRevenue"
        FROM public.sale_items AS si
        JOIN public.sales AS s ON s.id = si."saleId"
        WHERE s."shopId" = p_shop_id
        GROUP BY si."productId"
        ORDER BY SUM(si."totalPrice") DESC, si."productId"
        LIMIT 5
      )
      SELECT jsonb_build_object(
        'summary', jsonb_build_object(
          'totalSales', COALESCE((SELECT SUM(s."totalAmount") FROM public.sales AS s WHERE s."shopId" = p_shop_id), 0),
          'salesCount', COALESCE((SELECT COUNT(*) FROM public.sales AS s WHERE s."shopId" = p_shop_id), 0)
        ),
        'topProducts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'product', jsonb_build_object('name', p.name, 'unit', p.unit),
            'totalQuantity', t."totalQuantity",
            'totalRevenue', t."totalRevenue"
          ) ORDER BY t."totalRevenue" DESC)
          FROM top_products AS t
          LEFT JOIN public.products AS p ON p.id = t."productId" AND p."shopId" = p_shop_id
        ), '[]'::JSONB)
      ) INTO v_history;
      v_sources := jsonb_set(v_sources, '{history}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_history := NULL;
      v_sources := jsonb_set(v_sources, '{history}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;

    BEGIN
      SELECT jsonb_build_object('summary', jsonb_build_object(
        'salesRevenue', COALESCE(SUM(si."totalPrice"), 0),
        'missingCostSalesRevenue', COALESCE(SUM(si."totalPrice") FILTER (WHERE si."buyingPrice" IS NULL), 0)
      )) INTO v_costs
      FROM public.sale_items AS si
      JOIN public.sales AS s ON s.id = si."saleId"
      WHERE s."shopId" = p_shop_id
        AND s."createdAt" >= v_today_start
        AND s."createdAt" < v_now;
      v_sources := jsonb_set(v_sources, '{costs}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_costs := NULL;
      v_sources := jsonb_set(v_sources, '{costs}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  IF v_can_reports AND v_can_sell THEN
    BEGIN
      SELECT jsonb_build_object(
        'summary', jsonb_build_object(
          'openCount', COUNT(*) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL')),
          'totalOwed', COALESCE(SUM(GREATEST(d.amount - d."amountPaid", 0)) FILTER (WHERE d.status IN ('OPEN', 'PARTIAL')), 0)
        ),
        'debts', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'customerName', recent."customerName",
            'customerPhone', recent."customerPhone",
            'amount', recent.amount,
            'amountPaid', recent."amountPaid",
            'status', recent.status
          ))
          FROM (
            SELECT d2."customerName", d2."customerPhone", d2.amount, d2."amountPaid", d2.status
            FROM public.debts AS d2
            WHERE d2."shopId" = p_shop_id AND d2.status IN ('OPEN', 'PARTIAL')
            ORDER BY d2."createdAt" DESC, d2.id
            LIMIT 1
          ) AS recent
        ), '[]'::JSONB)
      ) INTO v_debts
      FROM public.debts AS d
      WHERE d."shopId" = p_shop_id;
      v_sources := jsonb_set(v_sources, '{debts}', jsonb_build_object('status', 'ready'), TRUE);
    EXCEPTION WHEN OTHERS THEN
      v_debts := NULL;
      v_sources := jsonb_set(v_sources, '{debts}', jsonb_build_object('status', 'unavailable'), TRUE);
    END;
  END IF;

  IF v_can_expenses THEN
    BEGIN
      SELECT jsonb_build_object('daily', COALESCE(jsonb_agg(jsonb_build_object(
        'businessDate', to_char(day."businessDate", 'YYYY-MM-DD'),
        'amount', day.amount,
        'count', day.count
      ) ORDER BY day."businessDate"), '[]'::JSONB)) INTO v_expenses
      FROM (
        SELECT ((e."spentAt" AT TIME ZONE 'UTC') AT TIME ZONE p_time_zone)::DATE AS "businessDate",
          SUM(e.amount)::BIGINT AS amount,
          COUNT(*)::BIGINT AS count
        FROM public.expenses AS e
        WHERE e."shopId" = p_shop_id
          AND e."spentAt" >= v_expense_start
          AND e."spentAt" < v_now
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
      WHERE o."shopId" = p_shop_id
        AND o.status = 'DELIVERED'
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
    'allTime', v_history,
    'debts', v_debts,
    'expenses', v_expenses,
    'costs', v_costs,
    'stock', v_stock,
    'purchases', v_purchases
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assistant_query_metrics(
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
BEGIN
  IF p_shop_id IS NULL OR p_shop_id = '' OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;
  IF p_intent NOT IN ('sales', 'expenses', 'debts', 'purchases', 'collections', 'payment_breakdown', 'top_products', 'top_supplier') THEN
    RAISE EXCEPTION 'Unsupported assistant query';
  END IF;
  IF p_from IS NOT NULL AND p_to IS NOT NULL AND p_from >= p_to THEN
    RAISE EXCEPTION 'Invalid assistant date range';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = p_time_zone) THEN
    RAISE EXCEPTION 'Invalid time zone';
  END IF;

  IF p_intent = 'sales' THEN
    SELECT jsonb_build_object('amount', COALESCE(SUM(s."totalAmount"), 0), 'count', COUNT(*))
    INTO v_result
    FROM public.sales AS s
    WHERE s."shopId" = p_shop_id
      AND (p_from IS NULL OR s."createdAt" >= p_from)
      AND (p_to IS NULL OR s."createdAt" < p_to);
  ELSIF p_intent = 'expenses' THEN
    SELECT jsonb_build_object('amount', COALESCE(SUM(e.amount), 0), 'count', COUNT(*))
    INTO v_result
    FROM public.expenses AS e
    WHERE e."shopId" = p_shop_id
      AND (p_from IS NULL OR e."spentAt" >= p_from)
      AND (p_to IS NULL OR e."spentAt" < p_to);
  ELSIF p_intent = 'debts' THEN
    SELECT jsonb_build_object(
      'amount', COALESCE(SUM(GREATEST(d.amount - d."amountPaid", 0)), 0),
      'count', COUNT(*)
    ) INTO v_result
    FROM public.debts AS d
    WHERE d."shopId" = p_shop_id AND d.status IN ('OPEN', 'PARTIAL');
  ELSIF p_intent = 'purchases' THEN
    SELECT jsonb_build_object(
      'amount', COALESCE(SUM(COALESCE(o."receivedTotalAmount", o."totalAmount", 0)), 0),
      'count', COUNT(*)
    ) INTO v_result
    FROM public.orders AS o
    WHERE o."shopId" = p_shop_id
      AND o.status = 'DELIVERED'
      AND (p_from IS NULL OR COALESCE(o."receivedAt", o."updatedAt", o."createdAt") >= p_from)
      AND (p_to IS NULL OR COALESCE(o."receivedAt", o."updatedAt", o."createdAt") < p_to);
  ELSIF p_intent = 'collections' THEN
    SELECT jsonb_build_object(
      'totalCollected', COALESCE(paid_sales.amount, 0) + COALESCE(debt_paid.amount, 0),
      'paidSales', COALESCE(paid_sales.amount, 0),
      'paidSalesCount', COALESCE(paid_sales.count, 0),
      'debtPayments', COALESCE(debt_paid.amount, 0),
      'debtPaymentCount', COALESCE(debt_paid.count, 0),
      'paymentMethods', COALESCE(methods.data, '[]'::JSONB)
    ) INTO v_result
    FROM (
      SELECT SUM(s."totalAmount") AS amount, COUNT(*) AS count
      FROM public.sales AS s
      WHERE s."shopId" = p_shop_id AND s."paymentMethod" <> 'CREDIT'
        AND (p_from IS NULL OR s."createdAt" >= p_from)
        AND (p_to IS NULL OR s."createdAt" < p_to)
    ) AS paid_sales
    CROSS JOIN (
      SELECT SUM(dp.amount) AS amount, COUNT(*) AS count
      FROM public.debt_payments AS dp
      JOIN public.debts AS d ON d.id = dp."debtId"
      WHERE d."shopId" = p_shop_id
        AND (p_from IS NULL OR dp."createdAt" >= p_from)
        AND (p_to IS NULL OR dp."createdAt" < p_to)
    ) AS debt_paid
    CROSS JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('method', by_method.method, 'amount', by_method.amount, 'count', by_method.count)
        ORDER BY by_method.amount DESC) AS data
      FROM (
        SELECT source.method, SUM(source.amount)::BIGINT AS amount, SUM(source.count)::BIGINT AS count
        FROM (
          SELECT s."paymentMethod"::TEXT AS method, SUM(s."totalAmount") AS amount, COUNT(*) AS count
          FROM public.sales AS s
          WHERE s."shopId" = p_shop_id AND s."paymentMethod" <> 'CREDIT'
            AND (p_from IS NULL OR s."createdAt" >= p_from)
            AND (p_to IS NULL OR s."createdAt" < p_to)
          GROUP BY s."paymentMethod"
          UNION ALL
          SELECT dp."paymentMethod"::TEXT AS method, SUM(dp.amount) AS amount, COUNT(*) AS count
          FROM public.debt_payments AS dp
          JOIN public.debts AS d ON d.id = dp."debtId"
          WHERE d."shopId" = p_shop_id
            AND (p_from IS NULL OR dp."createdAt" >= p_from)
            AND (p_to IS NULL OR dp."createdAt" < p_to)
          GROUP BY dp."paymentMethod"
        ) AS source
        GROUP BY source.method
      ) AS by_method
    ) AS methods;
  ELSIF p_intent = 'payment_breakdown' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('method', grouped.method, 'amount', grouped.amount, 'count', grouped.count)
      ORDER BY grouped.amount DESC), '[]'::JSONB)
    INTO v_result
    FROM (
      SELECT source.method, SUM(source.amount)::BIGINT AS amount, SUM(source.count)::BIGINT AS count
      FROM (
        SELECT s."paymentMethod"::TEXT AS method, SUM(s."totalAmount") AS amount, COUNT(*) AS count
        FROM public.sales AS s
        WHERE s."shopId" = p_shop_id AND s."paymentMethod" <> 'CREDIT'
          AND (p_from IS NULL OR s."createdAt" >= p_from)
          AND (p_to IS NULL OR s."createdAt" < p_to)
        GROUP BY s."paymentMethod"
        UNION ALL
        SELECT dp."paymentMethod"::TEXT AS method, SUM(dp.amount) AS amount, COUNT(*) AS count
        FROM public.debt_payments AS dp
        JOIN public.debts AS d ON d.id = dp."debtId"
        WHERE d."shopId" = p_shop_id
          AND (p_from IS NULL OR dp."createdAt" >= p_from)
          AND (p_to IS NULL OR dp."createdAt" < p_to)
        GROUP BY dp."paymentMethod"
      ) AS source
      GROUP BY source.method
    ) AS grouped;
  ELSIF p_intent = 'top_products' THEN
    SELECT jsonb_build_object(
      'products', COALESCE(jsonb_agg(jsonb_build_object(
        'id', ranked.id, 'name', ranked.name, 'unit', ranked.unit,
        'revenue', ranked.revenue, 'unitsSold', ranked."unitsSold", 'salesCount', ranked."salesCount"
      ) ORDER BY ranked.revenue DESC), '[]'::JSONB)
    ) INTO v_result
    FROM (
      SELECT p.id, p.name, p.unit,
        SUM(si."totalPrice")::BIGINT AS revenue,
        SUM(si.quantity)::BIGINT AS "unitsSold",
        COUNT(DISTINCT si."saleId")::BIGINT AS "salesCount"
      FROM public.sale_items AS si
      JOIN public.sales AS s ON s.id = si."saleId"
      JOIN public.products AS p ON p.id = si."productId" AND p."shopId" = p_shop_id
      WHERE s."shopId" = p_shop_id
        AND (p_from IS NULL OR s."createdAt" >= p_from)
        AND (p_to IS NULL OR s."createdAt" < p_to)
      GROUP BY p.id, p.name, p.unit
      ORDER BY SUM(si."totalPrice") DESC, p.name, p.id
      LIMIT 10
    ) AS ranked;
  ELSE
    SELECT jsonb_build_object(
      'amount', COALESCE(SUM(COALESCE(o."receivedTotalAmount", o."totalAmount", 0)), 0),
      'count', COUNT(*),
      'supplier', (SELECT jsonb_build_object('id', ranked."supplierId", 'name', ranked.name, 'amount', ranked.amount, 'orders', ranked.orders)
        FROM (
          SELECT o2."supplierId", su.name,
            SUM(COALESCE(o2."receivedTotalAmount", o2."totalAmount", 0))::BIGINT AS amount,
            COUNT(*)::BIGINT AS orders
          FROM public.orders AS o2
          LEFT JOIN public.suppliers AS su ON su.id = o2."supplierId"
          WHERE o2."shopId" = p_shop_id AND o2.status = 'DELIVERED'
            AND (p_from IS NULL OR COALESCE(o2."receivedAt", o2."updatedAt", o2."createdAt") >= p_from)
            AND (p_to IS NULL OR COALESCE(o2."receivedAt", o2."updatedAt", o2."createdAt") < p_to)
          GROUP BY o2."supplierId", su.name
          ORDER BY SUM(COALESCE(o2."receivedTotalAmount", o2."totalAmount", 0)) DESC, su.name
          LIMIT 1
        ) AS ranked)
    ) INTO v_result
    FROM public.orders AS o
    WHERE o."shopId" = p_shop_id AND o.status = 'DELIVERED'
      AND (p_from IS NULL OR COALESCE(o."receivedAt", o."updatedAt", o."createdAt") >= p_from)
      AND (p_to IS NULL OR COALESCE(o."receivedAt", o."updatedAt", o."createdAt") < p_to);
  END IF;

  RETURN COALESCE(v_result, '{}'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_stock_snapshot(TEXT, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_shop_snapshot(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assistant_query_metrics(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_stock_snapshot(TEXT, TEXT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_shop_snapshot(TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.assistant_query_metrics(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT) TO service_role;
