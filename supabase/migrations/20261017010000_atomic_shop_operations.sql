-- Keep stock, ledgers and order status in the same database transaction.
ALTER TABLE public.customer_orders ADD COLUMN IF NOT EXISTS "stockReservedAt" TIMESTAMP(3);

CREATE OR REPLACE FUNCTION public.record_shop_sale(p_shop_id TEXT, p_user_id TEXT, p_staff_id TEXT, p_body JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sale_row sales%ROWTYPE; product_row products%ROWTYPE; item JSONB;
  sale_id TEXT := gen_random_uuid()::TEXT; ref TEXT := NULLIF(BTRIM(p_body->>'clientReference'), '');
  qty INTEGER; price INTEGER; total INTEGER := 0; profit_total INTEGER := 0;
  tier TEXT := CASE WHEN p_body->>'saleMode' = 'WHOLESALE' THEN 'WHOLESALE' ELSE 'RETAIL' END;
  payment TEXT := COALESCE(p_body->>'paymentMethod', 'CASH');
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('sale:' || p_shop_id || ':' || COALESCE(ref, ''), 0));
  IF ref IS NOT NULL THEN
    SELECT * INTO sale_row FROM sales WHERE "shopId" = p_shop_id AND "clientReference" = ref;
    IF FOUND THEN RETURN jsonb_build_object('sale', to_jsonb(sale_row) || jsonb_build_object('items', (SELECT COALESCE(jsonb_agg(si), '[]') FROM sale_items si WHERE "saleId" = sale_row.id)), 'reused', TRUE); END IF;
  END IF;
  IF jsonb_typeof(p_body->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_body->'items') = 0 THEN
    RAISE EXCEPTION 'Sale must have at least one item' USING ERRCODE = '22023';
  END IF;
  IF (SELECT COUNT(*) <> COUNT(DISTINCT value->>'productId') FROM jsonb_array_elements(p_body->'items')) THEN
    RAISE EXCEPTION 'Each product can appear only once in a sale' USING ERRCODE = '22023';
  END IF;
  IF payment NOT IN ('CASH','MPESA','TIGOPESA','AIRTEL_MONEY','HALOPESA','BANK','CREDIT') THEN RAISE EXCEPTION 'Invalid payment method' USING ERRCODE = '22023'; END IF;
  IF payment = 'CREDIT' AND COALESCE(BTRIM(p_body->>'customerPhone'), '') = '' THEN RAISE EXCEPTION 'Customer phone is required for credit sales' USING ERRCODE = '22023'; END IF;
  INSERT INTO sales (id,"totalAmount",profit,"paymentMethod","paymentRef",channel,"pricingTier","customerPhone",note,"clientReference","shopId")
  VALUES (sale_id,0,0,payment::"PaymentMethod",NULLIF(p_body->>'paymentRef',''),CASE WHEN p_body->>'channel' = 'ONLINE' THEN 'ONLINE'::"SaleChannel" ELSE 'POS'::"SaleChannel" END,tier::"PricingTier",NULLIF(p_body->>'customerPhone',''),NULLIF(p_body->>'note',''),ref,p_shop_id);
  FOR item IN SELECT value FROM jsonb_array_elements(p_body->'items') ORDER BY value->>'productId' LOOP
    IF COALESCE(item->>'quantity','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Sale quantities must be positive whole numbers' USING ERRCODE = '22023'; END IF;
    qty := (item->>'quantity')::INTEGER;
    SELECT * INTO product_row FROM products WHERE id = item->>'productId' AND "shopId" = p_shop_id AND "isActive" FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not available in this shop' USING ERRCODE = '22023'; END IF;
    IF product_row."currentStock" < qty THEN RAISE EXCEPTION 'Insufficient stock for %', product_row.name USING ERRCODE = '22023'; END IF;
    IF NULLIF(item->>'unitPrice','') IS NOT NULL AND item->>'unitPrice' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Prices must be whole non-negative numbers' USING ERRCODE = '22023'; END IF;
    price := COALESCE(NULLIF(item->>'unitPrice','')::INTEGER, CASE WHEN tier = 'WHOLESALE' THEN product_row."wholesalePrice" END, product_row."sellingPrice");
    total := total + qty * price;
    profit_total := profit_total + qty * (price - product_row."buyingPrice");
    INSERT INTO sale_items(id,quantity,"unitPrice","buyingPrice","totalPrice","saleId","productId") VALUES(gen_random_uuid()::TEXT,qty,price,product_row."buyingPrice",qty*price,sale_id,product_row.id);
    UPDATE products SET "currentStock" = "currentStock" - qty, "updatedAt" = NOW() WHERE id = product_row.id;
    INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId") VALUES(gen_random_uuid()::TEXT,'OUT',qty,'Sale #' || RIGHT(sale_id,6),product_row.id,p_user_id,p_staff_id);
  END LOOP;
  UPDATE sales SET "totalAmount" = total, profit = profit_total WHERE id = sale_id RETURNING * INTO sale_row;
  IF payment = 'CREDIT' THEN
    INSERT INTO debts(id,"customerName","customerPhone",amount,status,note,"saleId","shopId","updatedAt") VALUES(gen_random_uuid()::TEXT,NULLIF(p_body->>'customerName',''),p_body->>'customerPhone',total,'OPEN',COALESCE(NULLIF(p_body->>'note',''),'Credit sale #' || RIGHT(sale_id,6)),sale_id,p_shop_id,NOW());
  END IF;
  RETURN jsonb_build_object('sale', to_jsonb(sale_row) || jsonb_build_object('items', (SELECT jsonb_agg(si) FROM sale_items si WHERE "saleId" = sale_id)), 'reused', FALSE);
END $$;

CREATE OR REPLACE FUNCTION public.receive_supplier_order(p_shop_id TEXT,p_order_id TEXT,p_user_id TEXT,p_staff_id TEXT,p_amount INTEGER DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_row orders%ROWTYPE; product_row products%ROWTYPE; item RECORD; received INTEGER;
BEGIN
  SELECT * INTO order_row FROM orders WHERE id = p_order_id AND "shopId" = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002'; END IF;
  IF order_row.status = 'DELIVERED' THEN RETURN jsonb_build_object('message','Delivery already confirmed','reused',TRUE); END IF;
  IF order_row.status NOT IN ('CONFIRMED','OUT_FOR_DELIVERY') THEN RAISE EXCEPTION 'Cannot confirm delivery from %',order_row.status USING ERRCODE = '22023'; END IF;
  received := COALESCE(p_amount,order_row."totalAmount",0);
  IF received < 0 THEN RAISE EXCEPTION 'Received amount cannot be negative' USING ERRCODE = '22023'; END IF;
  FOR item IN SELECT * FROM order_items WHERE "orderId" = p_order_id ORDER BY "productId" LOOP
    SELECT * INTO product_row FROM products WHERE id = item."productId" AND "shopId" = p_shop_id FOR UPDATE;
    IF NOT FOUND OR item.quantity <= 0 THEN RAISE EXCEPTION 'Invalid product in this order' USING ERRCODE = '22023'; END IF;
    UPDATE products SET "currentStock" = "currentStock" + item.quantity,"isActive" = TRUE,"updatedAt" = NOW() WHERE id = product_row.id;
    INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId") VALUES(gen_random_uuid()::TEXT,'IN',item.quantity,'Order delivery #' || RIGHT(p_order_id,6),product_row.id,p_user_id,p_staff_id);
  END LOOP;
  UPDATE orders SET status='DELIVERED',"receivedAt"=NOW(),"receivedTotalAmount"=received,"updatedAt"=NOW() WHERE id=p_order_id;
  RETURN jsonb_build_object('message','Delivery confirmed and stock updated','reused',FALSE);
END $$;

CREATE OR REPLACE FUNCTION public.adjust_shop_stock(p_shop_id TEXT,p_user_id TEXT,p_staff_id TEXT,p_body JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE product_row products%ROWTYPE; movement stock_movements%ROWTYPE; qty INTEGER; next_stock INTEGER; kind TEXT := p_body->>'type';
BEGIN
  IF COALESCE(p_body->>'quantity','') !~ '^[0-9]+$' OR kind NOT IN ('IN','OUT','ADJUSTMENT','RETURN') THEN RAISE EXCEPTION 'Invalid stock adjustment' USING ERRCODE='22023'; END IF;
  qty := (p_body->>'quantity')::INTEGER;
  IF kind <> 'ADJUSTMENT' AND qty = 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero' USING ERRCODE='22023'; END IF;
  SELECT * INTO product_row FROM products WHERE id=p_body->>'productId' AND "shopId"=p_shop_id AND "isActive" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='P0002'; END IF;
  next_stock := CASE WHEN kind IN ('IN','RETURN') THEN product_row."currentStock"+qty WHEN kind='OUT' THEN product_row."currentStock"-qty ELSE qty END;
  IF next_stock < 0 THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE='22023'; END IF;
  UPDATE products SET "currentStock"=next_stock,"updatedAt"=NOW() WHERE id=product_row.id RETURNING * INTO product_row;
  INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId") VALUES(gen_random_uuid()::TEXT,kind::"StockMovementType",qty,NULLIF(p_body->>'note',''),product_row.id,p_user_id,p_staff_id) RETURNING * INTO movement;
  RETURN jsonb_build_object('product',to_jsonb(product_row),'movement',to_jsonb(movement));
END $$;

CREATE OR REPLACE FUNCTION public.pay_shop_debt(p_shop_id TEXT,p_debt_id TEXT,p_user_id TEXT,p_body JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE debt_row debts%ROWTYPE; payment INTEGER := (p_body->>'amount')::INTEGER;
BEGIN
  SELECT * INTO debt_row FROM debts WHERE id=p_debt_id AND "shopId"=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Debt not found' USING ERRCODE='P0002'; END IF;
  IF payment <= 0 OR debt_row.status IN ('PAID','CANCELLED') OR payment > debt_row.amount-debt_row."amountPaid" THEN RAISE EXCEPTION 'Payment exceeds the remaining balance or debt is closed' USING ERRCODE='22023'; END IF;
  UPDATE debts SET "amountPaid"="amountPaid"+payment,status=CASE WHEN "amountPaid"+payment=amount THEN 'PAID'::"DebtStatus" ELSE 'PARTIAL'::"DebtStatus" END,"updatedAt"=NOW() WHERE id=p_debt_id RETURNING * INTO debt_row;
  INSERT INTO debt_payments(id,"debtId",amount,"paymentMethod","paymentRef",note,"recordedBy") VALUES(gen_random_uuid()::TEXT,p_debt_id,payment,COALESCE(p_body->>'paymentMethod','CASH')::"PaymentMethod",NULLIF(p_body->>'paymentRef',''),NULLIF(p_body->>'note',''),p_user_id);
  RETURN jsonb_build_object('debt',to_jsonb(debt_row)||jsonb_build_object('payments',(SELECT jsonb_agg(dp) FROM debt_payments dp WHERE "debtId"=p_debt_id)));
END $$;

CREATE OR REPLACE FUNCTION public.change_customer_order_status(p_shop_id TEXT,p_order_id TEXT,p_status TEXT,p_user_id TEXT,p_staff_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE order_row customer_orders%ROWTYPE; item RECORD; product_row products%ROWTYPE; reserve BOOLEAN; release BOOLEAN;
BEGIN
  SELECT * INTO order_row FROM customer_orders WHERE id=p_order_id AND "shopId"=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer order not found' USING ERRCODE='P0002'; END IF;
  IF NOT ((order_row.status='PENDING' AND p_status IN ('CONFIRMED','CANCELLED')) OR (order_row.status='CONFIRMED' AND p_status IN ('OUT_FOR_DELIVERY','CANCELLED')) OR (order_row.status='OUT_FOR_DELIVERY' AND p_status IN ('DELIVERED','CANCELLED'))) THEN RAISE EXCEPTION 'Cannot move customer order from % to %',order_row.status,p_status USING ERRCODE='22023'; END IF;
  reserve := p_status IN ('CONFIRMED','OUT_FOR_DELIVERY','DELIVERED') AND order_row."stockReservedAt" IS NULL;
  release := p_status='CANCELLED' AND order_row."stockReservedAt" IS NOT NULL;
  IF reserve OR release THEN
    FOR item IN SELECT "productId",SUM(quantity)::INTEGER AS quantity FROM customer_order_items WHERE "orderId"=p_order_id GROUP BY "productId" ORDER BY "productId" LOOP
      SELECT * INTO product_row FROM products WHERE id=item."productId" AND "shopId"=p_shop_id FOR UPDATE;
      IF NOT FOUND OR item.quantity <= 0 OR (reserve AND (NOT product_row."isActive" OR product_row."currentStock"<item.quantity)) THEN RAISE EXCEPTION 'Insufficient stock or product unavailable' USING ERRCODE='22023'; END IF;
      UPDATE products SET "currentStock"="currentStock"+CASE WHEN reserve THEN -item.quantity ELSE item.quantity END,"updatedAt"=NOW() WHERE id=product_row.id;
      INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId") VALUES(gen_random_uuid()::TEXT,CASE WHEN reserve THEN 'OUT'::"StockMovementType" ELSE 'IN'::"StockMovementType" END,item.quantity,'Customer order #' || RIGHT(p_order_id,6) || CASE WHEN reserve THEN ' reserved' ELSE ' cancelled - stock released' END,product_row.id,p_user_id,p_staff_id);
    END LOOP;
  END IF;
  UPDATE customer_orders SET status=p_status::"OrderStatus","stockReservedAt"=CASE WHEN reserve THEN NOW() ELSE "stockReservedAt" END,"updatedAt"=NOW() WHERE id=p_order_id RETURNING * INTO order_row;
  RETURN jsonb_build_object('order',to_jsonb(order_row));
END $$;

CREATE OR REPLACE FUNCTION public.shop_stock_count(p_shop_id TEXT,p_user_id TEXT,p_staff_id TEXT,p_id TEXT,p_action TEXT,p_body JSONB)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE count_row stock_counts%ROWTYPE; count_id TEXT; item RECORD; product_row products%ROWTYPE;
BEGIN
  IF p_action='start' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('count:'||p_shop_id,0));
    SELECT id INTO count_id FROM stock_counts WHERE "shopId"=p_shop_id AND status='OPEN' ORDER BY "createdAt" DESC LIMIT 1;
    IF FOUND THEN RETURN count_id; END IF;
    count_id:=gen_random_uuid()::TEXT;
    INSERT INTO stock_counts(id,"shopId","createdById",status,"updatedAt") VALUES(count_id,p_shop_id,p_user_id,'OPEN',NOW());
    INSERT INTO stock_count_items(id,"stockCountId","productId",expected,counted,"updatedAt") SELECT gen_random_uuid()::TEXT,count_id,id,"currentStock",0,NOW() FROM products WHERE "shopId"=p_shop_id AND "isActive";
    RETURN count_id;
  END IF;
  SELECT * INTO count_row FROM stock_counts WHERE id=p_id AND "shopId"=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock count not found' USING ERRCODE='P0002'; END IF;
  IF count_row.status <> 'OPEN' THEN RAISE EXCEPTION 'This stock count has already been completed' USING ERRCODE='22023'; END IF;
  IF p_action='scan' THEN
    SELECT * INTO product_row FROM products WHERE "shopId"=p_shop_id AND barcode=p_body->>'barcode' AND "isActive";
    IF NOT FOUND THEN RAISE EXCEPTION 'This barcode was not found.' USING ERRCODE='P0002'; END IF;
    UPDATE stock_count_items SET counted=counted+1,"updatedAt"=NOW() WHERE "stockCountId"=p_id AND "productId"=product_row.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'This product is not part of the stock count' USING ERRCODE='22023'; END IF;
    RETURN p_id;
  END IF;
  IF p_action <> 'finish' THEN RAISE EXCEPTION 'Invalid stock count action' USING ERRCODE='22023'; END IF;
  IF COALESCE((p_body->>'applyAdjustments')::BOOLEAN,FALSE) THEN
    FOR item IN SELECT * FROM stock_count_items WHERE "stockCountId"=p_id ORDER BY "productId" LOOP
      SELECT * INTO product_row FROM products WHERE id=item."productId" AND "shopId"=p_shop_id FOR UPDATE;
      IF NOT FOUND OR product_row."currentStock" <> item.expected THEN RAISE EXCEPTION 'Stock changed during the count. Finish without applying and start a new count.' USING ERRCODE='40001'; END IF;
      IF item.counted <> item.expected THEN
        UPDATE products SET "currentStock"=item.counted,"updatedAt"=NOW() WHERE id=product_row.id;
        INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId") VALUES(gen_random_uuid()::TEXT,'ADJUSTMENT',item.counted,'Stock count '||p_id,product_row.id,p_user_id,p_staff_id);
      END IF;
    END LOOP;
  END IF;
  UPDATE stock_counts SET status='COMPLETED',"completedAt"=NOW(),"updatedAt"=NOW() WHERE id=p_id;
  RETURN p_id;
END $$;

DO $$
DECLARE signature TEXT;
BEGIN
  FOR signature IN SELECT p.oid::regprocedure::TEXT FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('record_shop_sale','receive_supplier_order','adjust_shop_stock','pay_shop_debt','change_customer_order_status','shop_stock_count') LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION '||signature||' FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION '||signature||' TO service_role';
  END LOOP;
END $$;
