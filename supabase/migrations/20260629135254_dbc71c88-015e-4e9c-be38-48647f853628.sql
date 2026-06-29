
DO $$
DECLARE
  r record;
  it_qty numeric;
  it_name text;
  prod_id uuid;
  sm_id uuid;
  items_text text;
  item_line text;
BEGIN
  -- Backfill receivables (vendas a prazo)
  FOR r IN
    SELECT id, company_id, vencimento AS dt, descricao
    FROM public.receivables
    WHERE descricao ILIKE 'Venda%'
      AND NOT EXISTS (
        SELECT 1 FROM public.stock_movements sm
        WHERE sm.related_sale_id = receivables.id
      )
  LOOP
    -- Extrai bloco entre o ÚLTIMO "(" e ")" do descricao
    items_text := substring(r.descricao FROM '\(([^()]*)\)\s*$');
    IF items_text IS NULL THEN CONTINUE; END IF;

    FOR item_line IN SELECT trim(unnest(string_to_array(items_text, ','))) LOOP
      -- formato "Nx Nome @preco|ccusto" ou "Nome"
      it_qty := COALESCE(NULLIF(substring(item_line FROM '^(\d+(?:\.\d+)?)x'), '')::numeric, 1);
      it_name := trim(regexp_replace(item_line, '^\d+(?:\.\d+)?x\s*', ''));
      it_name := trim(regexp_replace(it_name, '\s*@[0-9.]+(\|c[0-9.]+)?\s*$', ''));
      IF it_name = '' THEN CONTINUE; END IF;

      SELECT id INTO prod_id FROM public.products
       WHERE company_id = r.company_id AND lower(nome) = lower(it_name)
       LIMIT 1;
      IF prod_id IS NULL THEN CONTINUE; END IF;

      SELECT id INTO sm_id FROM public.stock_movements
       WHERE company_id = r.company_id
         AND product_id = prod_id
         AND tipo = 'saida'
         AND motivo = 'Venda'
         AND data = r.dt
         AND quantidade = it_qty
         AND related_sale_id IS NULL
       ORDER BY created_at
       LIMIT 1;

      IF sm_id IS NOT NULL THEN
        UPDATE public.stock_movements
           SET related_sale_id = r.id, related_sale_type = 'prazo'
         WHERE id = sm_id;
      END IF;
    END LOOP;
  END LOOP;

  -- Backfill transactions (vendas à vista)
  FOR r IN
    SELECT id, company_id, data AS dt, descricao
    FROM public.transactions
    WHERE tipo = 'entrada' AND descricao ILIKE 'Venda%'
      AND NOT EXISTS (
        SELECT 1 FROM public.stock_movements sm
        WHERE sm.related_sale_id = transactions.id
      )
  LOOP
    items_text := substring(r.descricao FROM '\(([^()]*)\)\s*$');
    IF items_text IS NULL THEN CONTINUE; END IF;

    FOR item_line IN SELECT trim(unnest(string_to_array(items_text, ','))) LOOP
      it_qty := COALESCE(NULLIF(substring(item_line FROM '^(\d+(?:\.\d+)?)x'), '')::numeric, 1);
      it_name := trim(regexp_replace(item_line, '^\d+(?:\.\d+)?x\s*', ''));
      it_name := trim(regexp_replace(it_name, '\s*@[0-9.]+(\|c[0-9.]+)?\s*$', ''));
      IF it_name = '' THEN CONTINUE; END IF;

      SELECT id INTO prod_id FROM public.products
       WHERE company_id = r.company_id AND lower(nome) = lower(it_name)
       LIMIT 1;
      IF prod_id IS NULL THEN CONTINUE; END IF;

      SELECT id INTO sm_id FROM public.stock_movements
       WHERE company_id = r.company_id
         AND product_id = prod_id
         AND tipo = 'saida'
         AND motivo = 'Venda'
         AND data = r.dt
         AND quantidade = it_qty
         AND related_sale_id IS NULL
       ORDER BY created_at
       LIMIT 1;

      IF sm_id IS NOT NULL THEN
        UPDATE public.stock_movements
           SET related_sale_id = r.id, related_sale_type = 'vista'
         WHERE id = sm_id;
      END IF;
    END LOOP;
  END LOOP;
END $$;
