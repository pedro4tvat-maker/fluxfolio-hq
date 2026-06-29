CREATE OR REPLACE FUNCTION public.next_os_code(_company_id uuid, _location_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  loc_name text;
  letter text;
  next_num int;
BEGIN
  -- Inicial vem do CENTRO/LOCAL DE ESTOQUE (nunca do centro de custo)
  IF _location_id IS NOT NULL THEN
    SELECT nome INTO loc_name FROM public.stock_locations WHERE id = _location_id;
    letter := UPPER(SUBSTRING(regexp_replace(COALESCE(loc_name, ''), '[^A-Za-z]', '', 'g'), 1, 1));
  END IF;

  -- Fallback seguro quando a venda não tem centro de estoque
  IF letter IS NULL OR letter = '' THEN
    letter := 'V';
  END IF;

  -- Sequência única por (empresa, prefixo) considerando vendas à vista + a prazo
  WITH sales AS (
    SELECT os_code FROM public.transactions
      WHERE company_id = _company_id AND os_code ILIKE letter || '%'
    UNION ALL
    SELECT os_code FROM public.receivables
      WHERE company_id = _company_id AND os_code ILIKE letter || '%'
  )
  SELECT COALESCE(
           MAX(NULLIF(regexp_replace(os_code, '^[A-Za-z]+', ''), '')::int),
           0
         ) + 1
    INTO next_num
  FROM sales
  WHERE os_code IS NOT NULL;

  RETURN letter || LPAD(next_num::text, 4, '0');
END;
$function$;