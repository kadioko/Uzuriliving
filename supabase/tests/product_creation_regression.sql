-- Safe to run against a database owner connection: all fixtures are rolled back.
BEGIN;
DO $$
DECLARE
  owner_id TEXT := gen_random_uuid()::TEXT;
  shop_id TEXT := gen_random_uuid()::TEXT;
  stocked_id TEXT;
  empty_id TEXT;
  payload JSONB;
BEGIN
  INSERT INTO users(id,phone,pin,name,role,"approvalStatus","updatedAt")
  VALUES(owner_id,'product-test-'||owner_id,'unused','Product test','MERCHANT','APPROVED',NOW());
  INSERT INTO shops(id,name,location,"userId","updatedAt")
  VALUES(shop_id,'Product creation test','Test',owner_id,NOW());
  -- This mirrors the API's product object, which omits the tracking timestamp.
  payload := jsonb_build_object('name','Product creation test','unit','pcs','buyingPrice',5,'sellingPrice',10,
    'minimumStock',5,'reorderPackSize',1,'barcodeGenerated',FALSE,'doesNotExpire',FALSE,
    'isReorderable',TRUE,'shopId',shop_id,'createdAt',NOW(),'updatedAt',NOW());
  stocked_id := create_shop_product(payload || jsonb_build_object('id',gen_random_uuid()::TEXT,'currentStock',2),owner_id,NULL);
  IF NOT EXISTS(SELECT 1 FROM products WHERE id=stocked_id AND "currentStock"=2 AND "assistantStockTrackingStartedAt" IS NOT NULL)
     OR (SELECT COUNT(*) FROM stock_movements WHERE "productId"=stocked_id AND type='IN' AND quantity=2)<>1
  THEN RAISE EXCEPTION 'Stocked product or opening movement is incorrect'; END IF;
  empty_id := create_shop_product(payload || jsonb_build_object('id',gen_random_uuid()::TEXT,'currentStock',0),owner_id,NULL);
  IF NOT EXISTS(SELECT 1 FROM products WHERE id=empty_id AND "currentStock"=0 AND "assistantStockTrackingStartedAt" IS NOT NULL)
     OR EXISTS(SELECT 1 FROM stock_movements WHERE "productId"=empty_id)
     OR (SELECT COUNT(*) FROM product_stockout_periods WHERE "productId"=empty_id AND "endedAt" IS NULL)<>1
  THEN RAISE EXCEPTION 'Zero-stock product or stockout tracking is incorrect'; END IF;
END $$;
ROLLBACK;
SELECT 'Product creation regression passed; test data rolled back' AS result;
