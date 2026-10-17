-- Execute as the database owner. All fixtures and operations roll back.
BEGIN;
DO $$
DECLARE
  shop_id TEXT := gen_random_uuid()::TEXT; owner_id TEXT := gen_random_uuid()::TEXT;
  supplier_id TEXT := gen_random_uuid()::TEXT; product_id TEXT := gen_random_uuid()::TEXT;
  order_id TEXT := gen_random_uuid()::TEXT; customer_id TEXT := gen_random_uuid()::TEXT;
  debt_id TEXT := gen_random_uuid()::TEXT; result JSONB; repeat_result JSONB;
  qty INTEGER; count_id TEXT; saved_order TEXT; opening_product TEXT; registered_id TEXT; other_shop TEXT := gen_random_uuid()::TEXT;
BEGIN
  INSERT INTO users(id,phone,pin,name,role,"approvalStatus","updatedAt") VALUES(owner_id,'audit-'||owner_id,'unused','Audit fixture','MERCHANT','APPROVED',NOW());
  INSERT INTO shops(id,name,location,"userId","updatedAt") VALUES(shop_id,'Audit fixture','Test',owner_id,NOW());
  INSERT INTO suppliers(id,name,phone,"updatedAt") VALUES(supplier_id,'Audit supplier','audit-'||supplier_id,NOW());
  INSERT INTO products(id,name,"buyingPrice","sellingPrice","currentStock","shopId","updatedAt") VALUES(product_id,'Audit product',5,10,10,shop_id,NOW());
  result := record_shop_sale(shop_id,owner_id,NULL,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',2)),'clientReference','audit-retry'));
  repeat_result := record_shop_sale(shop_id,owner_id,NULL,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',200)),'clientReference','audit-retry'));
  IF result->'sale'->>'id' <> repeat_result->'sale'->>'id' OR repeat_result->>'reused' <> 'true' THEN RAISE EXCEPTION 'Sale retry was not idempotent'; END IF;
  SELECT "currentStock" INTO qty FROM products WHERE id=product_id;
  IF qty <> 8 THEN RAISE EXCEPTION 'Sale stock incorrect'; END IF;
  BEGIN
    PERFORM record_shop_sale(shop_id,owner_id,NULL,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',200)),'clientReference','audit-insufficient'));
    RAISE EXCEPTION 'Overselling was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF EXISTS(SELECT 1 FROM sales WHERE "shopId"=shop_id AND "clientReference"='audit-insufficient') THEN RAISE EXCEPTION 'Failed sale left a header behind'; END IF;
  BEGIN
    PERFORM record_shop_sale(shop_id,owner_id,NULL,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',1,'unitPrice',-1))));
    RAISE EXCEPTION 'Negative price accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  INSERT INTO orders(id,"shopId","supplierId",status,"totalAmount","updatedAt") VALUES(order_id,shop_id,supplier_id,'OUT_FOR_DELIVERY',25,NOW());
  INSERT INTO order_items(id,"orderId","productId",quantity,"unitPrice") VALUES(gen_random_uuid()::TEXT,order_id,product_id,5,5);
  UPDATE products SET "isActive"=FALSE WHERE id=product_id;
  PERFORM receive_supplier_order(shop_id,order_id,owner_id,NULL,NULL);
  PERFORM receive_supplier_order(shop_id,order_id,owner_id,NULL,NULL);
  SELECT "currentStock" INTO qty FROM products WHERE id=product_id AND "isActive";
  IF qty IS DISTINCT FROM 13 THEN RAISE EXCEPTION 'Receiving duplicated stock or failed to restore product'; END IF;
  INSERT INTO debts(id,"customerPhone",amount,"shopId","updatedAt") VALUES(debt_id,'+255700000000',100,shop_id,NOW());
  PERFORM pay_shop_debt(shop_id,debt_id,owner_id,'{"amount":60}');
  BEGIN
    PERFORM pay_shop_debt(shop_id,debt_id,owner_id,'{"amount":60}');
    RAISE EXCEPTION 'Debt overpayment was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF (SELECT "amountPaid" FROM debts WHERE id=debt_id) <> 60 OR (SELECT COUNT(*) FROM debt_payments WHERE "debtId"=debt_id) <> 1 THEN RAISE EXCEPTION 'Debt ledger diverged'; END IF;
  INSERT INTO customer_orders(id,"customerName","customerPhone","shopId","updatedAt") VALUES(customer_id,'Audit customer','+255700000000',shop_id,NOW());
  INSERT INTO customer_order_items(id,"orderId","productId",quantity,"unitPrice") VALUES(gen_random_uuid()::TEXT,customer_id,product_id,3,10);
  BEGIN
    PERFORM change_customer_order_status(shop_id,customer_id,'DELIVERED',owner_id,NULL);
    RAISE EXCEPTION 'Customer order skipped confirmation';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  PERFORM change_customer_order_status(shop_id,customer_id,'CONFIRMED',owner_id,NULL);
  IF (SELECT "currentStock" FROM products WHERE id=product_id) <> 10 THEN RAISE EXCEPTION 'Order did not reserve stock'; END IF;
  PERFORM change_customer_order_status(shop_id,customer_id,'CANCELLED',owner_id,NULL);
  IF (SELECT "currentStock" FROM products WHERE id=product_id) <> 13 THEN RAISE EXCEPTION 'Cancellation did not release stock'; END IF;
  count_id := shop_stock_count(shop_id,owner_id,NULL,NULL,'start','{}');
  BEGIN
    PERFORM shop_stock_count(other_shop,owner_id,NULL,count_id,'finish','{"applyAdjustments":true}');
    RAISE EXCEPTION 'Another shop could finish a stock count';
  EXCEPTION WHEN SQLSTATE 'P0002' THEN NULL; END;
  PERFORM adjust_shop_stock(shop_id,owner_id,NULL,jsonb_build_object('productId',product_id,'type','IN','quantity',1));
  BEGIN
    PERFORM shop_stock_count(shop_id,owner_id,NULL,count_id,'finish','{"applyAdjustments":true}');
    RAISE EXCEPTION 'Stale count overwrote current stock';
  EXCEPTION WHEN SQLSTATE '40001' THEN NULL; END;
  IF (SELECT "currentStock" FROM products WHERE id=product_id) <> 14 THEN RAISE EXCEPTION 'Stale stock count changed stock'; END IF;
  saved_order:=save_supplier_order(shop_id,NULL,jsonb_build_object('supplierId',supplier_id,'items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',2))));
  BEGIN
    PERFORM save_supplier_order(shop_id,saved_order,jsonb_build_object('items',jsonb_build_array(jsonb_build_object('productId',product_id,'quantity',2,'unitPrice',-1))));
    RAISE EXCEPTION 'Invalid order edit accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
  IF (SELECT SUM(quantity) FROM order_items WHERE "orderId"=saved_order)<>2 THEN RAISE EXCEPTION 'Failed edit destroyed order lines'; END IF;
  result:=apply_subscription_payment(shop_id,owner_id,'{"plan":"BASIC","amount":15000,"months":1,"reference":"AUDIT-PAYMENT"}');
  repeat_result:=apply_subscription_payment(shop_id,owner_id,'{"plan":"BASIC","amount":15000,"months":1,"reference":"AUDIT-PAYMENT"}');
  IF result->'shop'->>'subscriptionEndsAt'<>repeat_result->'shop'->>'subscriptionEndsAt' OR (SELECT COUNT(*) FROM subscription_payments WHERE "shopId"=shop_id)<>1 THEN RAISE EXCEPTION 'Payment retry duplicated entitlement'; END IF;
  result:=create_shop_debt(shop_id,owner_id,'{"customerPhone":"+255700000001","amount":100,"amountPaid":20}');
  IF (SELECT SUM(amount) FROM debt_payments WHERE "debtId"=result->'debt'->>'id')<>20 THEN RAISE EXCEPTION 'Opening debt payment missing'; END IF;
  opening_product:=create_shop_product(jsonb_build_object('id',gen_random_uuid()::TEXT,'name','Opening stock audit','unit','pcs','buyingPrice',5,'sellingPrice',10,'currentStock',2,'minimumStock',5,'barcodeGenerated',FALSE,'doesNotExpire',FALSE,'isReorderable',TRUE,'shopId',shop_id,'createdAt',NOW(),'updatedAt',NOW()),owner_id,NULL);
  IF (SELECT SUM(quantity) FROM stock_movements WHERE "productId"=opening_product)<>2 THEN RAISE EXCEPTION 'Opening stock ledger missing'; END IF;
  IF NOT check_auth_rate_limit('audit:'||shop_id,2,60) OR NOT check_auth_rate_limit('audit:'||shop_id,2,60) OR check_auth_rate_limit('audit:'||shop_id,2,60) THEN RAISE EXCEPTION 'Authentication rate limit failed'; END IF;
  registered_id:=register_shop_account(jsonb_build_object('name','Registration fixture','role','MERCHANT','phone','audit-register-'||shop_id),'unused-hash');
  IF NOT EXISTS(SELECT 1 FROM users u JOIN shops s ON s."userId"=u.id WHERE u.id=registered_id AND u."approvalStatus"='PENDING') THEN RAISE EXCEPTION 'Registration missing approval state or shop'; END IF;
  BEGIN
    INSERT INTO staff_members(id,name,phone,"shopId","updatedAt") VALUES(gen_random_uuid()::TEXT,'Duplicate login','audit-'||owner_id,shop_id,NOW());
    RAISE EXCEPTION 'Owner and staff could share a login phone';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  IF has_table_privilege('anon','public.users','SELECT') OR has_function_privilege('anon','public.record_shop_sale(text,text,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Anonymous database access is still open'; END IF;
END $$;
ROLLBACK;
SELECT 'passed: stock/sale/order atomicity, retries, debt ledger, reservations, stale counts, billing, registration, login identity, rate limits, anonymous access restrictions' AS result;
