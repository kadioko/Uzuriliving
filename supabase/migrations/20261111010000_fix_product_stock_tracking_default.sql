-- jsonb_populate_record(NULL::products, ...) produces NULL for omitted fields;
-- INSERT ... SELECT product_row.* therefore does not apply table defaults.
-- The product API does not supply the assistant tracking timestamp.
CREATE OR REPLACE FUNCTION public.create_shop_product(p_product JSONB, p_user_id TEXT, p_staff_id TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE product_row products%ROWTYPE;
BEGIN
  product_row := jsonb_populate_record(NULL::products, p_product || jsonb_build_object('isActive', TRUE));
  product_row."assistantStockTrackingStartedAt" := COALESCE(product_row."assistantStockTrackingStartedAt", statement_timestamp());
  INSERT INTO products SELECT product_row.*;
  IF product_row."currentStock" > 0 THEN
    INSERT INTO stock_movements(id,type,quantity,note,"productId","createdById","createdByStaffId")
    VALUES(gen_random_uuid()::TEXT,'IN',product_row."currentStock",'Initial stock',product_row.id,p_user_id,p_staff_id);
  END IF;
  RETURN product_row.id;
END $$;
