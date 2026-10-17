CREATE FUNCTION public.save_supplier_order(p_shop_id TEXT,p_order_id TEXT,p_body JSONB)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  saved_id TEXT:=COALESCE(p_order_id,gen_random_uuid()::TEXT); existing orders%ROWTYPE;
  product_row products%ROWTYPE; item JSONB; qty INTEGER; price INTEGER; total INTEGER:=0; supplier_id TEXT;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT * INTO existing FROM orders WHERE id=p_order_id AND "shopId"=p_shop_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='P0002'; END IF;
    IF existing.status NOT IN ('PENDING','OUT_FOR_DELIVERY') THEN RAISE EXCEPTION 'Only pending or out-for-delivery orders can be edited' USING ERRCODE='22023'; END IF;
    supplier_id:=existing."supplierId";
  ELSE supplier_id:=p_body->>'supplierId'; END IF;
  IF NOT EXISTS(SELECT 1 FROM suppliers WHERE id=supplier_id AND ("createdByShopId" IS NULL OR "createdByShopId"=p_shop_id)) THEN RAISE EXCEPTION 'Supplier not available to this shop' USING ERRCODE='22023'; END IF;
  IF jsonb_typeof(p_body->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_body->'items')=0 THEN RAISE EXCEPTION 'An order must contain at least one product' USING ERRCODE='22023'; END IF;
  IF (SELECT COUNT(*)<>COUNT(DISTINCT value->>'productId') FROM jsonb_array_elements(p_body->'items')) THEN RAISE EXCEPTION 'Each product can appear only once in an order' USING ERRCODE='22023'; END IF;
  IF p_order_id IS NULL THEN
    INSERT INTO orders(id,"shopId","supplierId","orderGroupId",status,"updatedAt") VALUES(saved_id,p_shop_id,supplier_id,NULLIF(p_body->>'orderGroupId',''),'PENDING',NOW());
  ELSE DELETE FROM order_items WHERE "orderId"=saved_id; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_body->'items') ORDER BY value->>'productId' LOOP
    IF COALESCE(item->>'quantity','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Order quantities must be positive whole numbers' USING ERRCODE='22023'; END IF;
    qty:=(item->>'quantity')::INTEGER;
    SELECT * INTO product_row FROM products WHERE id=item->>'productId' AND "shopId"=p_shop_id AND "isActive" FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not available in this shop' USING ERRCODE='22023'; END IF;
    IF NULLIF(item->>'unitPrice','') IS NOT NULL AND item->>'unitPrice' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Order prices must be whole non-negative numbers' USING ERRCODE='22023'; END IF;
    price:=COALESCE(NULLIF(item->>'unitPrice','')::INTEGER,product_row."buyingPrice");
    total:=total+qty*price;
    INSERT INTO order_items(id,"orderId","productId",quantity,"unitPrice",note) VALUES(gen_random_uuid()::TEXT,saved_id,product_row.id,qty,price,NULLIF(BTRIM(item->>'note'),''));
  END LOOP;
  UPDATE orders SET "totalAmount"=total,note=NULLIF(BTRIM(p_body->>'note'),''),"updatedAt"=NOW() WHERE id=saved_id;
  RETURN saved_id;
END $$;
REVOKE ALL ON FUNCTION public.save_supplier_order(TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_supplier_order(TEXT,TEXT,JSONB) TO service_role;
