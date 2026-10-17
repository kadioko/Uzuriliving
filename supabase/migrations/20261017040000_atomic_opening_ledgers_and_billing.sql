CREATE FUNCTION public.create_shop_product(p_product JSONB,p_user_id TEXT,p_staff_id TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE product_row products%ROWTYPE;
BEGIN
  product_row:=jsonb_populate_record(NULL::products,p_product||jsonb_build_object('isActive',TRUE));
  INSERT INTO products SELECT product_row.*;
  IF product_row."currentStock">0 THEN
    INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId") VALUES(gen_random_uuid()::TEXT,'IN',product_row."currentStock",'Initial stock',product_row.id,p_user_id,p_staff_id);
  END IF;
  RETURN product_row.id;
END $$;

CREATE FUNCTION public.create_shop_debt(p_shop_id TEXT,p_user_id TEXT,p_body JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE debt_row debts%ROWTYPE; amount_value INTEGER:=(p_body->>'amount')::INTEGER; paid INTEGER:=COALESCE((p_body->>'amountPaid')::INTEGER,0);
BEGIN
  IF amount_value<=0 OR paid<0 OR paid>amount_value THEN RAISE EXCEPTION 'Invalid opening balance' USING ERRCODE='22023'; END IF;
  INSERT INTO debts(id,"customerName","customerPhone",amount,"amountPaid",status,"dueDate",note,"shopId","updatedAt") VALUES(gen_random_uuid()::TEXT,NULLIF(p_body->>'customerName',''),p_body->>'customerPhone',amount_value,paid,CASE WHEN paid=0 THEN 'OPEN'::"DebtStatus" WHEN paid=amount_value THEN 'PAID'::"DebtStatus" ELSE 'PARTIAL'::"DebtStatus" END,NULLIF(p_body->>'dueDate','')::TIMESTAMP,NULLIF(p_body->>'note',''),p_shop_id,NOW()) RETURNING * INTO debt_row;
  IF paid>0 THEN INSERT INTO debt_payments(id,"debtId",amount,note,"recordedBy") VALUES(gen_random_uuid()::TEXT,debt_row.id,paid,'Opening payment',p_user_id); END IF;
  RETURN jsonb_build_object('debt',to_jsonb(debt_row));
END $$;

CREATE FUNCTION public.apply_subscription_payment(p_shop_id TEXT,p_admin_id TEXT,p_body JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE shop_row shops%ROWTYPE; payment_row subscription_payments%ROWTYPE;
  ref TEXT:=UPPER(REGEXP_REPLACE(BTRIM(p_body->>'reference'),'\s+','','g'));
  plan_value TEXT:=p_body->>'plan'; months_value INTEGER:=(p_body->>'months')::INTEGER; amount_value INTEGER:=(p_body->>'amount')::INTEGER;
  ends TIMESTAMP;
BEGIN
  IF COALESCE(ref,'')='' OR plan_value NOT IN ('BASIC','PRO') OR months_value NOT BETWEEN 1 AND 24 OR amount_value<=0 THEN RAISE EXCEPTION 'Invalid subscription payment' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('subscription:'||ref,0));
  SELECT * INTO shop_row FROM shops WHERE id=p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Shop not found' USING ERRCODE='P0002'; END IF;
  SELECT * INTO payment_row FROM subscription_payments WHERE "normalizedReference"=ref;
  IF FOUND THEN
    IF payment_row."shopId"<>p_shop_id THEN RAISE EXCEPTION 'Payment reference already belongs to another shop' USING ERRCODE='22023'; END IF;
    RETURN jsonb_build_object('payment',to_jsonb(payment_row),'shop',to_jsonb(shop_row),'reused',TRUE);
  END IF;
  ends:=GREATEST(NOW()::TIMESTAMP,COALESCE(shop_row."subscriptionEndsAt",NOW()::TIMESTAMP))+make_interval(months=>months_value);
  INSERT INTO subscription_payments(id,"shopId",plan,amount,months,method,reference,"normalizedReference",status,"reviewedBy","reviewedAt",note,"sourceReportId") VALUES(gen_random_uuid()::TEXT,p_shop_id,plan_value,amount_value,months_value,COALESCE(p_body->>'method','MANUAL'),p_body->>'reference',ref,'CONFIRMED',p_admin_id,NOW(),NULLIF(p_body->>'note',''),NULLIF(p_body->>'sourceReportId','')) RETURNING * INTO payment_row;
  UPDATE shops SET plan=plan_value,"subscriptionEndsAt"=ends,"isActive"=TRUE,"updatedAt"=NOW() WHERE id=p_shop_id RETURNING * INTO shop_row;
  RETURN jsonb_build_object('payment',to_jsonb(payment_row),'shop',to_jsonb(shop_row),'subscriptionEndsAt',ends,'reused',FALSE);
END $$;

REVOKE ALL ON FUNCTION public.create_shop_product(JSONB,TEXT,TEXT),public.create_shop_debt(TEXT,TEXT,JSONB),public.apply_subscription_payment(TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_shop_product(JSONB,TEXT,TEXT),public.create_shop_debt(TEXT,TEXT,JSONB),public.apply_subscription_payment(TEXT,TEXT,JSONB) TO service_role;
