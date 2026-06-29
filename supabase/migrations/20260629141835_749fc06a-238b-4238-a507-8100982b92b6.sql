
CREATE OR REPLACE FUNCTION public.next_os_code(_company_id uuid, _location_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  loc_name text;
  letter text;
  next_num int;
BEGIN
  SELECT nome INTO loc_name FROM public.stock_locations WHERE id = _location_id;
  letter := UPPER(SUBSTRING(regexp_replace(COALESCE(loc_name, 'X'), '[^A-Za-z]', '', 'g'), 1, 1));
  IF letter IS NULL OR letter = '' THEN letter := 'X'; END IF;

  WITH sales AS (
    SELECT t.os_code
    FROM public.transactions t
    JOIN public.stock_movements sm
      ON sm.related_sale_id = t.id AND sm.related_sale_type = 'vista'
    WHERE t.company_id = _company_id AND sm.stock_location_id = _location_id
    UNION ALL
    SELECT r.os_code
    FROM public.receivables r
    JOIN public.stock_movements sm
      ON sm.related_sale_id = r.id AND sm.related_sale_type = 'prazo'
    WHERE r.company_id = _company_id AND sm.stock_location_id = _location_id
  )
  SELECT COALESCE(MAX(NULLIF(regexp_replace(os_code, '^[A-Za-z]+', ''), '')::int), 0) + 1
    INTO next_num
  FROM sales
  WHERE os_code IS NOT NULL;

  RETURN letter || LPAD(next_num::text, 4, '0');
END;
$$;
