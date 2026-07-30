CREATE OR REPLACE FUNCTION "public"."create_public_customer_order"(
  "p_shop_id" TEXT,
  "p_customer_name" TEXT,
  "p_customer_phone" TEXT,
  "p_note" TEXT,
  "p_items" JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  "order_id" TEXT := gen_random_uuid()::TEXT;
  "total_amount" INTEGER := 0;
  "item" JSONB;
  "product_row" RECORD;
  "quantity" INTEGER;
  "tier" TEXT;
  "unit_price" INTEGER;
BEGIN
  IF jsonb_typeof("p_items") <> 'array' OR jsonb_array_length("p_items") = 0 THEN
    RAISE EXCEPTION 'At least one order item is required' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements("p_items") AS entry
    WHERE COALESCE(entry->>'productId', '') = ''
       OR (entry->>'quantity') !~ '^([1-9][0-9]*)$'
  ) THEN
    RAISE EXCEPTION 'Each item must include a productId and a whole-number quantity greater than 0' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT entry->>'productId' AS product_id, SUM((entry->>'quantity')::INTEGER) AS requested
      FROM jsonb_array_elements("p_items") AS entry
      GROUP BY entry->>'productId'
    ) AS requested
    LEFT JOIN "products" AS product ON product."id" = requested.product_id AND product."shopId" = "p_shop_id" AND product."isActive" = TRUE
    WHERE product."id" IS NULL OR product."currentStock" < requested.requested
  ) THEN
    RAISE EXCEPTION 'One or more products are unavailable or do not have enough stock' USING ERRCODE = '22023';
  END IF;

  INSERT INTO "customer_orders" ("id", "customerName", "customerPhone", "note", "status", "totalAmount", "shopId", "createdAt", "updatedAt")
  VALUES ("order_id", "p_customer_name", "p_customer_phone", "p_note", 'PENDING', 0, "p_shop_id", NOW(), NOW());

  FOR "item" IN SELECT value FROM jsonb_array_elements("p_items") LOOP
    SELECT * INTO "product_row" FROM "products" WHERE "id" = "item"->>'productId' AND "shopId" = "p_shop_id" FOR UPDATE;
    "quantity" := ("item"->>'quantity')::INTEGER;
    "tier" := CASE WHEN UPPER(COALESCE("item"->>'pricingTier', 'RETAIL')) = 'WHOLESALE' THEN 'WHOLESALE' ELSE 'RETAIL' END;
    "unit_price" := CASE WHEN "tier" = 'WHOLESALE' AND "product_row"."wholesalePrice" IS NOT NULL THEN "product_row"."wholesalePrice" ELSE "product_row"."sellingPrice" END;
    "total_amount" := "total_amount" + ("unit_price" * "quantity");
    INSERT INTO "customer_order_items" ("id", "quantity", "unitPrice", "pricingTier", "productId", "orderId")
    VALUES (gen_random_uuid()::TEXT, "quantity", "unit_price", "tier"::"PricingTier", "product_row"."id", "order_id");
  END LOOP;

  UPDATE "customer_orders" SET "totalAmount" = "total_amount", "updatedAt" = NOW() WHERE "id" = "order_id";
  RETURN jsonb_build_object('id', "order_id", 'totalAmount', "total_amount");
END;
$$;

REVOKE ALL ON FUNCTION "public"."create_public_customer_order"(TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."create_public_customer_order"(TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
