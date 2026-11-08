-- Answer bounded, shop-local questions about active products with no recorded
-- positive-quantity sale lines in a selected date range.
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
DECLARE
  v_result JSONB;
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
      AND (p_from IS NULL OR s."createdAt" >= p_from) AND s."createdAt" < p_to
      AND si.quantity > 0
  ), unsold_products AS (
    SELECT p.id, p.name, p.unit
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
      SELECT jsonb_agg(jsonb_build_object('name', listed.name, 'unit', listed.unit)
        ORDER BY listed.name, listed.id)
      FROM (SELECT id, name, unit FROM unsold_products ORDER BY name, id LIMIT 30) AS listed
    ), '[]'::JSONB)
  ) INTO v_result
  FROM counts;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.assistant_unsold_product_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assistant_unsold_product_metrics(TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
