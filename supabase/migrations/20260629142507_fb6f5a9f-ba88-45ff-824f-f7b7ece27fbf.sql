DO $$
DECLARE
  s RECORD;
  loc UUID;
  letter TEXT;
  next_num INT;
  code TEXT;
BEGIN
  -- Itera todas as vendas sem os_code, em ordem cronológica por empresa
  FOR s IN (
    SELECT id AS sale_id, 'vista'::text AS tipo, company_id, data AS sale_date
      FROM public.transactions
     WHERE tipo='entrada' AND os_code IS NULL
    UNION ALL
    SELECT id, 'prazo'::text, company_id, vencimento
      FROM public.receivables
     WHERE os_code IS NULL
    ORDER BY 4 NULLS LAST, 1
  ) LOOP
    -- 1) tenta achar location via stock_movement vinculado
    SELECT stock_location_id INTO loc
      FROM public.stock_movements
     WHERE related_sale_id = s.sale_id AND related_sale_type = s.tipo
       AND stock_location_id IS NOT NULL
     LIMIT 1;

    -- 2) fallback: stock_movement de venda na mesma empresa/data sem vínculo
    IF loc IS NULL THEN
      SELECT sm.stock_location_id INTO loc
        FROM public.stock_movements sm
       WHERE sm.company_id = s.company_id
         AND sm.motivo = 'Venda'
         AND sm.data = s.sale_date
         AND sm.stock_location_id IS NOT NULL
         AND sm.related_sale_id IS NULL
       ORDER BY sm.created_at
       LIMIT 1;
    END IF;

    -- 3) fallback final: primeiro stock_location da empresa
    IF loc IS NULL THEN
      SELECT id INTO loc FROM public.stock_locations
       WHERE company_id = s.company_id
       ORDER BY created_at LIMIT 1;
    END IF;

    IF loc IS NULL THEN CONTINUE; END IF;

    SELECT UPPER(SUBSTRING(regexp_replace(COALESCE(nome,'X'),'[^A-Za-z]','','g'),1,1))
      INTO letter FROM public.stock_locations WHERE id = loc;
    IF letter IS NULL OR letter = '' THEN letter := 'X'; END IF;

    WITH sales AS (
      SELECT t.os_code FROM public.transactions t
        JOIN public.stock_movements sm ON sm.related_sale_id=t.id AND sm.related_sale_type='vista'
       WHERE t.company_id = s.company_id AND sm.stock_location_id = loc AND t.os_code IS NOT NULL
      UNION ALL
      SELECT r.os_code FROM public.receivables r
        JOIN public.stock_movements sm ON sm.related_sale_id=r.id AND sm.related_sale_type='prazo'
       WHERE r.company_id = s.company_id AND sm.stock_location_id = loc AND r.os_code IS NOT NULL
    )
    SELECT COALESCE(MAX(NULLIF(regexp_replace(os_code,'^[A-Za-z]+',''),'')::int),0)+1
      INTO next_num FROM sales;

    code := letter || LPAD(next_num::text,4,'0');

    IF s.tipo = 'vista' THEN
      UPDATE public.transactions SET os_code = code WHERE id = s.sale_id;
    ELSE
      UPDATE public.receivables SET os_code = code WHERE id = s.sale_id;
    END IF;

    -- garante vínculo do movimento para a próxima iteração contar
    UPDATE public.stock_movements
       SET related_sale_id = s.sale_id, related_sale_type = s.tipo
     WHERE related_sale_id IS NULL
       AND company_id = s.company_id
       AND motivo = 'Venda'
       AND data = s.sale_date
       AND stock_location_id = loc;
  END LOOP;
END $$;