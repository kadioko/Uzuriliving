-- Record the actual goods received, not just the quantities originally ordered.
-- Receipt writes and stock movements are committed atomically by the functions below.

CREATE TABLE IF NOT EXISTS public.supplier_order_receipts (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  "shopId" TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  "receiptType" TEXT NOT NULL CHECK ("receiptType" IN ('INITIAL', 'CORRECTION')),
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "actualTotalAmount" INTEGER CHECK ("actualTotalAmount" IS NULL OR "actualTotalAmount" >= 0),
  note TEXT,
  "createdById" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "createdByStaffId" TEXT REFERENCES public.staff_members(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS supplier_order_receipts_one_initial_per_order
  ON public.supplier_order_receipts ("orderId")
  WHERE "receiptType" = 'INITIAL';

CREATE INDEX IF NOT EXISTS supplier_order_receipts_shop_order_created
  ON public.supplier_order_receipts ("shopId", "orderId", "createdAt");

CREATE TABLE IF NOT EXISTS public.supplier_order_receipt_items (
  id TEXT PRIMARY KEY,
  "receiptId" TEXT NOT NULL REFERENCES public.supplier_order_receipts(id) ON DELETE CASCADE,
  "orderItemId" TEXT REFERENCES public.order_items(id) ON DELETE SET NULL,
  "productId" TEXT NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  "orderedQuantity" INTEGER NOT NULL CHECK ("orderedQuantity" >= 0),
  "receivedQuantity" INTEGER NOT NULL CHECK ("receivedQuantity" >= 0),
  "stockAddedQuantity" INTEGER NOT NULL CHECK ("stockAddedQuantity" >= 0),
  "unitPrice" INTEGER NOT NULL DEFAULT 0 CHECK ("unitPrice" >= 0),
  note TEXT,
  UNIQUE ("receiptId", "productId")
);

CREATE INDEX IF NOT EXISTS supplier_order_receipt_items_product
  ON public.supplier_order_receipt_items ("productId");

-- Keep immutable before/after snapshots so a missing line can be traced to
-- the initial save or to a later edit. Older orders cannot be reconstructed.
CREATE TABLE IF NOT EXISTS public.supplier_order_revisions (
  id TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "shopId" TEXT NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  "revisionNumber" INTEGER NOT NULL CHECK ("revisionNumber" > 0),
  action TEXT NOT NULL CHECK (action IN ('CREATED', 'EDITED')),
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB NOT NULL,
  "createdById" TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  "createdByStaffId" TEXT REFERENCES public.staff_members(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("orderId", "revisionNumber")
);

CREATE INDEX IF NOT EXISTS supplier_order_revisions_shop_order_created
  ON public.supplier_order_revisions ("shopId", "orderId", "createdAt");

ALTER TABLE public.supplier_order_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_order_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.supplier_order_receipts, public.supplier_order_receipt_items, public.supplier_order_revisions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.supplier_order_receipts, public.supplier_order_receipt_items, public.supplier_order_revisions TO service_role;

CREATE FUNCTION public.supplier_order_snapshot(p_order_id TEXT)
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
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'productId', oi."productId",
        'productName', p.name,
        'quantity', oi.quantity,
        'unitPrice', oi."unitPrice",
        'note', oi.note
      ) ORDER BY p.name, oi."productId")
      FROM order_items oi
      JOIN products p ON p.id = oi."productId"
      WHERE oi."orderId" = o.id
    ), '[]'::JSONB)
  )
  FROM orders o
  JOIN suppliers s ON s.id = o."supplierId"
  WHERE o.id = p_order_id
$$;

CREATE FUNCTION public.save_supplier_order_with_revision(
  p_shop_id TEXT,
  p_order_id TEXT,
  p_body JSONB,
  p_user_id TEXT,
  p_staff_id TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  before_snapshot JSONB;
  after_snapshot JSONB;
  saved_id TEXT;
  revision_number INTEGER;
  order_row orders%ROWTYPE;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO order_row FROM orders
    WHERE id = p_order_id AND "shopId" = p_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002'; END IF;
    before_snapshot := public.supplier_order_snapshot(p_order_id);
  END IF;

  saved_id := public.save_supplier_order(p_shop_id, p_order_id, p_body);
  after_snapshot := public.supplier_order_snapshot(saved_id);
  IF after_snapshot IS NULL THEN RAISE EXCEPTION 'Saved order could not be read back' USING ERRCODE = 'P0002'; END IF;
  SELECT COALESCE(MAX("revisionNumber"), 0) + 1 INTO revision_number
  FROM supplier_order_revisions WHERE "orderId" = saved_id;

  INSERT INTO supplier_order_revisions (
    id, "orderId", "shopId", "revisionNumber", action,
    "beforeSnapshot", "afterSnapshot", "createdById", "createdByStaffId"
  ) VALUES (
    gen_random_uuid()::TEXT, saved_id, p_shop_id, revision_number,
    CASE WHEN before_snapshot IS NULL THEN 'CREATED' ELSE 'EDITED' END,
    before_snapshot, after_snapshot, p_user_id, p_staff_id
  );
  RETURN saved_id;
END
$$;

-- Replace the legacy all-or-nothing receive RPC. Every saved order line must be
-- reconciled, and unexpected products can be recorded as extra receipt lines.
DROP FUNCTION IF EXISTS public.receive_supplier_order(TEXT, TEXT, TEXT, TEXT, INTEGER);

CREATE FUNCTION public.receive_supplier_order(
  p_shop_id TEXT,
  p_order_id TEXT,
  p_user_id TEXT,
  p_staff_id TEXT,
  p_amount INTEGER,
  p_received_items JSONB,
  p_note TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row orders%ROWTYPE;
  order_item RECORD;
  product_row products%ROWTYPE;
  received_item JSONB;
  receipt_id TEXT := gen_random_uuid()::TEXT;
  received INTEGER;
  expected_count INTEGER;
  supplied_count INTEGER;
  discrepancy BOOLEAN := FALSE;
  existing_receipt supplier_order_receipts%ROWTYPE;
  item_note TEXT;
  unit_price INTEGER;
BEGIN
  IF COALESCE(BTRIM(p_idempotency_key), '') = '' OR LENGTH(p_idempotency_key) > 120 THEN
    RAISE EXCEPTION 'A valid receipt request key is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO existing_receipt
  FROM supplier_order_receipts
  WHERE "idempotencyKey" = p_idempotency_key;
  IF FOUND THEN
    IF existing_receipt."orderId" <> p_order_id OR existing_receipt."shopId" <> p_shop_id OR existing_receipt."receiptType" <> 'INITIAL' THEN
      RAISE EXCEPTION 'Receipt request key was already used for another operation' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('message', 'Delivery receipt already recorded', 'receiptId', existing_receipt.id, 'reused', TRUE);
  END IF;

  SELECT * INTO order_row
  FROM orders
  WHERE id = p_order_id AND "shopId" = p_shop_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002'; END IF;

  IF order_row.status = 'DELIVERED' THEN
    SELECT * INTO existing_receipt
    FROM supplier_order_receipts
    WHERE "orderId" = p_order_id AND "receiptType" = 'INITIAL';
    IF FOUND THEN
      RETURN jsonb_build_object('message', 'Delivery receipt already recorded', 'receiptId', existing_receipt.id, 'reused', TRUE);
    END IF;
    RAISE EXCEPTION 'Order is already delivered; use a stock correction for additional goods' USING ERRCODE = '22023';
  END IF;
  IF order_row.status NOT IN ('CONFIRMED', 'OUT_FOR_DELIVERY') THEN
    RAISE EXCEPTION 'Cannot confirm delivery from %', order_row.status USING ERRCODE = '22023';
  END IF;
  IF p_amount IS NOT NULL AND p_amount < 0 THEN
    RAISE EXCEPTION 'Received amount cannot be negative' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(COALESCE(BTRIM(p_note), '')) > 500 THEN
    RAISE EXCEPTION 'Receipt notes must be 500 characters or fewer' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_received_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_received_items) = 0 THEN
    RAISE EXCEPTION 'Reconcile every order line before confirming delivery' USING ERRCODE = '22023';
  END IF;
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_received_items) AS payload(value))
     <> (SELECT COUNT(DISTINCT value->>'productId') FROM jsonb_array_elements(p_received_items) AS payload(value)) THEN
    RAISE EXCEPTION 'A product can appear only once in a receipt' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO expected_count FROM order_items WHERE "orderId" = p_order_id;
  SELECT COUNT(*) INTO supplied_count
  FROM jsonb_array_elements(p_received_items) AS payload(value)
  WHERE NULLIF(value->>'orderItemId', '') IS NOT NULL;
  IF expected_count = 0 OR supplied_count <> expected_count THEN
    RAISE EXCEPTION 'Receipt must include every saved order line' USING ERRCODE = '22023';
  END IF;

  IF p_amount IS NOT NULL AND (p_amount::TEXT !~ '^[0-9]+$') THEN
    RAISE EXCEPTION 'Received amount must be a whole non-negative number' USING ERRCODE = '22023';
  END IF;

  INSERT INTO supplier_order_receipts (
    id, "orderId", "shopId", "receiptType", "idempotencyKey",
    "actualTotalAmount", note, "createdById", "createdByStaffId"
  ) VALUES (
    receipt_id, p_order_id, p_shop_id, 'INITIAL', p_idempotency_key,
    COALESCE(p_amount, order_row."totalAmount", 0), NULLIF(BTRIM(p_note), ''),
    p_user_id, p_staff_id
  );

  FOR order_item IN
    SELECT * FROM order_items WHERE "orderId" = p_order_id ORDER BY "productId"
  LOOP
    SELECT value INTO received_item
    FROM jsonb_array_elements(p_received_items) AS payload(value)
    WHERE value->>'orderItemId' = order_item.id;

    IF received_item IS NULL OR received_item->>'productId' IS DISTINCT FROM order_item."productId" THEN
      RAISE EXCEPTION 'Saved order lines changed; refresh and reconcile again' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(received_item->>'orderedQuantity', '') !~ '^[1-9][0-9]*$'
       OR (received_item->>'orderedQuantity')::INTEGER <> order_item.quantity THEN
      RAISE EXCEPTION 'Order quantities changed; refresh and reconcile again' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(received_item->>'expectedUnitPrice', '') IS NOT NULL THEN
      IF received_item->>'expectedUnitPrice' !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Refresh the order before recording its receipt' USING ERRCODE = '22023';
      END IF;
      IF (received_item->>'expectedUnitPrice')::INTEGER <> COALESCE(order_item."unitPrice", 0) THEN
        RAISE EXCEPTION 'Order prices changed; refresh and reconcile again' USING ERRCODE = '22023';
      END IF;
    END IF;
    IF COALESCE(received_item->>'receivedQuantity', '') !~ '^(0|[1-9][0-9]*)$' THEN
      RAISE EXCEPTION 'Received quantities must be whole numbers zero or greater' USING ERRCODE = '22023';
    END IF;
    received := (received_item->>'receivedQuantity')::INTEGER;
    IF received <> order_item.quantity THEN discrepancy := TRUE; END IF;

    SELECT * INTO product_row
    FROM products
    WHERE id = order_item."productId" AND "shopId" = p_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An ordered product no longer belongs to this shop' USING ERRCODE = '22023'; END IF;

    item_note := NULLIF(BTRIM(received_item->>'note'), '');
    unit_price := COALESCE(order_item."unitPrice", product_row."buyingPrice", 0);
    INSERT INTO supplier_order_receipt_items (
      id, "receiptId", "orderItemId", "productId", "orderedQuantity",
      "receivedQuantity", "stockAddedQuantity", "unitPrice", note
    ) VALUES (
      gen_random_uuid()::TEXT, receipt_id, order_item.id, product_row.id,
      order_item.quantity, received, received, unit_price, item_note
    );

    IF received > 0 THEN
      UPDATE products
      SET "currentStock" = "currentStock" + received, "isActive" = TRUE, "updatedAt" = NOW()
      WHERE id = product_row.id;
      INSERT INTO stock_movements (
        id, type, quantity, note, "productId", "createdById", "createdByStaffId"
      ) VALUES (
        gen_random_uuid()::TEXT, 'IN', received,
        'Supplier order #' || RIGHT(p_order_id, 8) || ' received; expected ' || order_item.quantity || ', received ' || received
          || CASE WHEN item_note IS NOT NULL THEN ' — ' || item_note ELSE '' END,
        product_row.id, p_user_id, p_staff_id
      );
    END IF;
  END LOOP;

  FOR received_item IN
    SELECT value
    FROM jsonb_array_elements(p_received_items) AS payload(value)
    WHERE NULLIF(value->>'orderItemId', '') IS NULL
  LOOP
    IF COALESCE(received_item->>'productId', '') = ''
       OR COALESCE(received_item->>'receivedQuantity', '') !~ '^[1-9][0-9]*$' THEN
      RAISE EXCEPTION 'Unexpected receipt lines require a product and positive quantity' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(received_item->>'orderedQuantity', '0') <> '0' THEN
      RAISE EXCEPTION 'Unexpected receipt lines must have an ordered quantity of zero' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM order_items
      WHERE "orderId" = p_order_id AND "productId" = received_item->>'productId'
    ) THEN
      RAISE EXCEPTION 'Unexpected products must not duplicate an ordered product' USING ERRCODE = '22023';
    END IF;
    received := (received_item->>'receivedQuantity')::INTEGER;
    SELECT * INTO product_row
    FROM products
    WHERE id = received_item->>'productId' AND "shopId" = p_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Unexpected product is not available in this shop' USING ERRCODE = '22023'; END IF;

    IF NULLIF(received_item->>'unitPrice', '') IS NOT NULL THEN
      IF received_item->>'unitPrice' !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Receipt unit prices must be whole non-negative numbers' USING ERRCODE = '22023';
      END IF;
      unit_price := (received_item->>'unitPrice')::INTEGER;
    ELSE
      unit_price := COALESCE(product_row."buyingPrice", 0);
    END IF;
    item_note := NULLIF(BTRIM(received_item->>'note'), '');
    discrepancy := TRUE;
    INSERT INTO supplier_order_receipt_items (
      id, "receiptId", "orderItemId", "productId", "orderedQuantity",
      "receivedQuantity", "stockAddedQuantity", "unitPrice", note
    ) VALUES (
      gen_random_uuid()::TEXT, receipt_id, NULL, product_row.id, 0,
      received, received, unit_price, item_note
    );
    UPDATE products
    SET "currentStock" = "currentStock" + received, "isActive" = TRUE, "updatedAt" = NOW()
    WHERE id = product_row.id;
    INSERT INTO stock_movements (
      id, type, quantity, note, "productId", "createdById", "createdByStaffId"
    ) VALUES (
      gen_random_uuid()::TEXT, 'IN', received,
      'Unlisted supplier-order item #' || RIGHT(p_order_id, 8)
        || CASE WHEN item_note IS NOT NULL THEN ' — ' || item_note ELSE '' END,
      product_row.id, p_user_id, p_staff_id
    );
  END LOOP;

  IF discrepancy AND p_amount IS NULL THEN
    RAISE EXCEPTION 'Enter the full actual invoice total when received quantities differ' USING ERRCODE = '22023';
  END IF;
  IF discrepancy AND LENGTH(COALESCE(BTRIM(p_note), '')) < 5 THEN
    RAISE EXCEPTION 'Explain any difference between the order and goods received' USING ERRCODE = '22023';
  END IF;

  UPDATE orders
  SET status = 'DELIVERED',
      "receivedAt" = NOW(),
      "receivedTotalAmount" = COALESCE(p_amount, order_row."totalAmount", 0),
      "updatedAt" = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('message', 'Delivery reconciled and stock updated', 'receiptId', receipt_id, 'reused', FALSE);
END
$$;

CREATE FUNCTION public.record_supplier_order_stock_correction(
  p_shop_id TEXT,
  p_order_id TEXT,
  p_user_id TEXT,
  p_staff_id TEXT,
  p_items JSONB,
  p_note TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_row orders%ROWTYPE;
  product_row products%ROWTYPE;
  order_item RECORD;
  item JSONB;
  receipt_id TEXT := gen_random_uuid()::TEXT;
  qty INTEGER;
  stock_added INTEGER;
  price INTEGER;
  correction_total BIGINT := 0;
  existing_receipt supplier_order_receipts%ROWTYPE;
BEGIN
  IF COALESCE(BTRIM(p_idempotency_key), '') = '' OR LENGTH(p_idempotency_key) > 120 THEN
    RAISE EXCEPTION 'A valid correction request key is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO existing_receipt FROM supplier_order_receipts WHERE "idempotencyKey" = p_idempotency_key;
  IF FOUND THEN
    IF existing_receipt."orderId" <> p_order_id OR existing_receipt."shopId" <> p_shop_id OR existing_receipt."receiptType" <> 'CORRECTION' THEN
      RAISE EXCEPTION 'Correction request key was already used for another operation' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('message', 'Stock correction already recorded', 'receiptId', existing_receipt.id, 'reused', TRUE);
  END IF;
  SELECT * INTO order_row FROM orders
  WHERE id = p_order_id AND "shopId" = p_shop_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO existing_receipt FROM supplier_order_receipts WHERE "idempotencyKey" = p_idempotency_key;
  IF FOUND THEN
    IF existing_receipt."orderId" <> p_order_id OR existing_receipt."shopId" <> p_shop_id OR existing_receipt."receiptType" <> 'CORRECTION' THEN
      RAISE EXCEPTION 'Correction request key was already used for another operation' USING ERRCODE = '22023';
    END IF;
    RETURN jsonb_build_object('message', 'Stock correction already recorded', 'receiptId', existing_receipt.id, 'reused', TRUE);
  END IF;
  IF order_row.status <> 'DELIVERED' THEN
    RAISE EXCEPTION 'Stock corrections are only available after delivery is confirmed' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Add at least one received product' USING ERRCODE = '22023';
  END IF;
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_items) AS payload(value))
     <> (SELECT COUNT(DISTINCT value->>'productId') FROM jsonb_array_elements(p_items) AS payload(value)) THEN
    RAISE EXCEPTION 'A product can appear only once in a correction' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(COALESCE(BTRIM(p_note), '')) < 5 OR LENGTH(BTRIM(p_note)) > 500 THEN
    RAISE EXCEPTION 'Correction reason must be between 5 and 500 characters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO supplier_order_receipts (
    id, "orderId", "shopId", "receiptType", "idempotencyKey",
    note, "createdById", "createdByStaffId"
  ) VALUES (
    receipt_id, p_order_id, p_shop_id, 'CORRECTION', p_idempotency_key,
    BTRIM(p_note), p_user_id, p_staff_id
  );

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) AS payload(value)
  LOOP
    IF COALESCE(item->>'productId', '') = ''
       OR COALESCE(item->>'receivedQuantity', '') !~ '^[1-9][0-9]*$'
       OR COALESCE(item->>'stockAddedQuantity', '') !~ '^(0|[1-9][0-9]*)$' THEN
      RAISE EXCEPTION 'Received and stock-add quantities must be valid whole numbers' USING ERRCODE = '22023';
    END IF;
    qty := (item->>'receivedQuantity')::INTEGER;
    stock_added := (item->>'stockAddedQuantity')::INTEGER;
    IF stock_added > qty THEN
      RAISE EXCEPTION 'Quantity added to stock cannot exceed the quantity received' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO product_row FROM products
    WHERE id = item->>'productId' AND "shopId" = p_shop_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product is not available in this shop' USING ERRCODE = '22023'; END IF;
    SELECT * INTO order_item FROM order_items
    WHERE "orderId" = p_order_id AND "productId" = product_row.id;
    IF NULLIF(item->>'unitPrice', '') IS NOT NULL THEN
      IF item->>'unitPrice' !~ '^[0-9]+$' THEN
        RAISE EXCEPTION 'Correction unit costs must be whole non-negative numbers' USING ERRCODE = '22023';
      END IF;
      price := (item->>'unitPrice')::INTEGER;
    ELSE
      price := COALESCE(order_item."unitPrice", product_row."buyingPrice", 0);
    END IF;
    correction_total := correction_total + qty::BIGINT * price;
    INSERT INTO supplier_order_receipt_items (
      id, "receiptId", "orderItemId", "productId", "orderedQuantity",
      "receivedQuantity", "stockAddedQuantity", "unitPrice", note
    ) VALUES (
      gen_random_uuid()::TEXT, receipt_id, order_item.id, product_row.id,
      COALESCE(order_item.quantity, 0), qty, stock_added, price, BTRIM(p_note)
    );
    IF stock_added > 0 THEN
      UPDATE products
      SET "currentStock" = "currentStock" + stock_added, "isActive" = TRUE, "updatedAt" = NOW()
      WHERE id = product_row.id;
      INSERT INTO stock_movements (
        id, type, quantity, note, "productId", "createdById", "createdByStaffId"
      ) VALUES (
        gen_random_uuid()::TEXT, 'IN', stock_added,
        'Supplier order #' || RIGHT(p_order_id, 8) || ' stock correction — ' || BTRIM(p_note),
        product_row.id, p_user_id, p_staff_id
      );
    END IF;
  END LOOP;

  UPDATE supplier_order_receipts
  SET "actualTotalAmount" = correction_total
  WHERE id = receipt_id;
  UPDATE orders
  SET "receivedTotalAmount" = COALESCE("receivedTotalAmount", "totalAmount", 0) + correction_total,
      "updatedAt" = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('message', 'Stock correction recorded', 'receiptId', receipt_id, 'costAdded', correction_total, 'reused', FALSE);
END
$$;

-- Multi-supplier batches must either save completely or not save at all.
CREATE FUNCTION public.save_supplier_order_batch(
  p_shop_id TEXT,
  p_groups JSONB,
  p_order_group_id TEXT,
  p_note TEXT,
  p_user_id TEXT,
  p_staff_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  group_row JSONB;
  saved_id TEXT;
  result JSONB := '[]'::JSONB;
  existing_count INTEGER;
BEGIN
  IF COALESCE(BTRIM(p_order_group_id), '') = '' THEN
    RAISE EXCEPTION 'Order group reference is required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array' OR jsonb_array_length(p_groups) = 0 OR jsonb_array_length(p_groups) > 20 THEN
    RAISE EXCEPTION 'A batch must contain 1 to 20 supplier orders' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id || ':' || p_order_group_id, 0));
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_groups) AS payload(value))
     <> (SELECT COUNT(DISTINCT value->>'supplierId') FROM jsonb_array_elements(p_groups) AS payload(value)) THEN
    RAISE EXCEPTION 'A supplier can appear only once in an order batch' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_groups) AS payload(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
       OR COALESCE(BTRIM(value->>'supplierId'), '') = ''
       OR jsonb_typeof(value->'items') IS DISTINCT FROM 'array'
       OR CASE WHEN jsonb_typeof(value->'items') = 'array' THEN jsonb_array_length(value->'items') = 0 ELSE TRUE END
  ) THEN
    RAISE EXCEPTION 'Each supplier order must include a supplier and products' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*) INTO existing_count
  FROM orders
  WHERE "shopId" = p_shop_id AND "orderGroupId" = p_order_group_id;
  IF existing_count > 0 THEN
    IF existing_count <> jsonb_array_length(p_groups) OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_groups) AS payload(value)
      WHERE NOT EXISTS (
        SELECT 1 FROM orders o
        WHERE o."shopId" = p_shop_id
          AND o."orderGroupId" = p_order_group_id
          AND o."supplierId" = payload.value->>'supplierId'
      )
    ) OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_groups) AS requested_group(value)
      JOIN orders o
        ON o."shopId" = p_shop_id
       AND o."orderGroupId" = p_order_group_id
       AND o."supplierId" = requested_group.value->>'supplierId'
      WHERE (SELECT COUNT(*) FROM order_items oi WHERE oi."orderId" = o.id)
              <> jsonb_array_length(requested_group.value->'items')
         OR EXISTS (
           SELECT 1
           FROM jsonb_array_elements(requested_group.value->'items') AS requested_item(value)
           WHERE NOT EXISTS (
             SELECT 1
             FROM order_items oi
             WHERE oi."orderId" = o.id
               AND oi."productId" = requested_item.value->>'productId'
               AND oi.quantity::TEXT = requested_item.value->>'quantity'
               AND (
                 NULLIF(requested_item.value->>'unitPrice', '') IS NULL
                 OR oi."unitPrice"::TEXT = requested_item.value->>'unitPrice'
               )
           )
         )
    ) THEN
      RAISE EXCEPTION 'Order batch reference already exists with different suppliers or products' USING ERRCODE = '22023';
    END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', o.id, 'supplierId', o."supplierId") ORDER BY o.id), '[]'::JSONB)
      INTO result
    FROM orders o
    WHERE o."shopId" = p_shop_id AND o."orderGroupId" = p_order_group_id;
    RETURN jsonb_build_object('orders', result, 'reused', TRUE);
  END IF;

  FOR group_row IN SELECT value FROM jsonb_array_elements(p_groups) AS payload(value)
  LOOP
    IF COALESCE(BTRIM(group_row->>'supplierId'), '') = ''
       OR jsonb_typeof(group_row->'items') IS DISTINCT FROM 'array'
       OR jsonb_array_length(group_row->'items') = 0 THEN
      RAISE EXCEPTION 'Each supplier order must include a supplier and products' USING ERRCODE = '22023';
    END IF;
    saved_id := save_supplier_order_with_revision(
      p_shop_id,
      NULL,
      jsonb_build_object(
        'supplierId', group_row->>'supplierId',
        'items', group_row->'items',
        'note', p_note,
        'orderGroupId', p_order_group_id
      ),
      p_user_id,
      p_staff_id
    );
    result := result || jsonb_build_array(jsonb_build_object('id', saved_id, 'supplierId', group_row->>'supplierId'));
  END LOOP;

  RETURN jsonb_build_object('orders', result, 'reused', FALSE);
END
$$;

REVOKE ALL ON FUNCTION public.receive_supplier_order(TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_supplier_order_stock_correction(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.supplier_order_snapshot(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_supplier_order_with_revision(TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_supplier_order_batch(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_supplier_order(TEXT, TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_supplier_order_stock_correction(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.supplier_order_snapshot(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_supplier_order_with_revision(TEXT, TEXT, JSONB, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_supplier_order_batch(TEXT, JSONB, TEXT, TEXT, TEXT, TEXT) TO service_role;
