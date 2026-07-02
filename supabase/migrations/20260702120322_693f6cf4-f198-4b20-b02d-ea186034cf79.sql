CREATE OR REPLACE FUNCTION public.recover_sale_from_stock_movements(
  _sale_id uuid,
  _sale_type text,
  _dry_run boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_branch_id uuid;
  v_total_sale numeric;
  v_os text;
  v_existing_items int;
  v_existing_log int;
  v_mov_count int;
  v_items jsonb := '[]'::jsonb;
  v_total_items numeric := 0;
  v_log_id uuid;
  v_item jsonb;
  m record;
  v_unit_price numeric;
  v_total_revenue numeric;
  v_status text;
  v_margin_value numeric;
  v_margin_pct numeric;
  v_distinct_products int;
  v_total_qty numeric;
BEGIN
  IF _sale_type = 'vista' THEN
    SELECT company_id, branch_id, valor, os_code
      INTO v_company_id, v_branch_id, v_total_sale, v_os
      FROM public.transactions
     WHERE id = _sale_id;
  ELSIF _sale_type = 'prazo' THEN
    SELECT company_id, branch_id, valor, os_code
      INTO v_company_id, v_branch_id, v_total_sale, v_os
      FROM public.receivables
     WHERE id = _sale_id;
  ELSE
    RAISE EXCEPTION 'sale_type inválido';
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members mm WHERE mm.company_id = v_company_id AND mm.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa' USING ERRCODE='42501';
  END IF;

  -- Bloqueia apenas reconstruções reais/ativas da mesma empresa e do mesmo tipo.
  -- Rascunhos antigos zerados, sem log e sem vínculo de recuperação não podem impedir a reconstrução correta.
  SELECT count(*) INTO v_existing_items
    FROM public.sale_items
   WHERE company_id = v_company_id
     AND sale_id = _sale_id
     AND sale_type = _sale_type
     AND deleted_at IS NULL
     AND (
       recovery_log_id IS NOT NULL
       OR recovered_from_stock_movement IS TRUE
       OR COALESCE(unit_price, 0) > 0
       OR COALESCE(total_revenue, 0) > 0
     );

  SELECT count(*) INTO v_existing_log
    FROM public.sales_recovery_log
   WHERE company_id = v_company_id
     AND sale_id = _sale_id
     AND sale_type = _sale_type
     AND reverted_at IS NULL;

  IF v_existing_items > 0 OR v_existing_log > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Esta venda já possui itens estruturados ou recuperação registrada. Revise antes de criar novos itens.',
      'existing_items', v_existing_items,
      'existing_active_logs', v_existing_log
    );
  END IF;

  SELECT count(DISTINCT product_id), COALESCE(SUM(quantidade),0)
    INTO v_distinct_products, v_total_qty
    FROM public.stock_movements
   WHERE company_id = v_company_id
     AND related_sale_id = _sale_id
     AND related_sale_type = _sale_type
     AND tipo = 'saida'
     AND deleted_at IS NULL;

  SELECT count(*) INTO v_mov_count
    FROM public.stock_movements
   WHERE company_id = v_company_id
     AND related_sale_id = _sale_id
     AND related_sale_type = _sale_type
     AND tipo = 'saida'
     AND deleted_at IS NULL;

  IF v_mov_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sem stock_movements vinculados a esta venda.');
  END IF;

  IF NOT _dry_run THEN
    INSERT INTO public.sales_recovery_log
      (company_id, sale_id, sale_type, os_number, recovery_method, status,
       items_created_count, total_sale_amount, created_by)
    VALUES
      (v_company_id, _sale_id, _sale_type, v_os, 'stock_movements', 'em_andamento',
       0, v_total_sale, auth.uid())
    RETURNING id INTO v_log_id;
  END IF;

  FOR m IN
    SELECT sm.id AS mov_id, sm.product_id, sm.quantidade, sm.custo_unitario,
           sm.stock_location_id, p.nome AS product_name, p.custo_unitario AS product_cost
      FROM public.stock_movements sm
      LEFT JOIN public.products p ON p.id = sm.product_id
     WHERE sm.company_id = v_company_id
       AND sm.related_sale_id = _sale_id
       AND sm.related_sale_type = _sale_type
       AND sm.tipo = 'saida'
       AND sm.deleted_at IS NULL
  LOOP
    DECLARE
      v_unit_cost numeric := COALESCE(NULLIF(m.custo_unitario,0), m.product_cost, 0);
      v_total_cost numeric;
    BEGIN
      v_total_cost := v_unit_cost * COALESCE(m.quantidade,0);

      IF v_distinct_products = 1 AND v_total_sale IS NOT NULL AND v_total_qty > 0 THEN
        v_unit_price := v_total_sale / v_total_qty;
        v_total_revenue := v_unit_price * m.quantidade;
        v_status := 'recuperado_por_movimento_estoque';
      ELSE
        v_unit_price := NULL;
        v_total_revenue := NULL;
        v_status := 'produto_recuperado_sem_preco_de_venda';
      END IF;

      IF v_unit_price IS NOT NULL AND v_unit_cost > 0 THEN
        v_margin_value := v_total_revenue - v_total_cost;
        v_margin_pct := CASE WHEN v_total_revenue > 0 THEN (v_margin_value / v_total_revenue) * 100 ELSE NULL END;
      ELSE
        v_margin_value := NULL;
        v_margin_pct := NULL;
      END IF;

      v_item := jsonb_build_object(
        'product_id', m.product_id,
        'product_name_snapshot', m.product_name,
        'quantity', m.quantidade,
        'unit_cost', v_unit_cost,
        'total_cost', v_total_cost,
        'unit_price', v_unit_price,
        'total_revenue', v_total_revenue,
        'margin_value', v_margin_value,
        'margin_percentage', v_margin_pct,
        'stock_location_id', m.stock_location_id,
        'related_stock_movement_id', m.mov_id,
        'recovery_status', v_status
      );
      v_items := v_items || v_item;
      v_total_items := v_total_items + COALESCE(v_total_revenue,0);

      IF NOT _dry_run THEN
        INSERT INTO public.sale_items (
          company_id, branch_id, sale_id, sale_type, product_id, product_name_snapshot,
          quantity, unit_price, unit_cost, total_revenue, total_cost,
          margin_value, margin_percentage, stock_location_id,
          needs_review, review_reason,
          recovered_from_stock_movement, related_stock_movement_id, recovery_status, recovery_log_id
        ) VALUES (
          v_company_id, v_branch_id, _sale_id, _sale_type, m.product_id, COALESCE(m.product_name, 'Produto'),
          m.quantidade, COALESCE(v_unit_price, 0), v_unit_cost, COALESCE(v_total_revenue, 0), v_total_cost,
          COALESCE(v_margin_value, 0), COALESCE(v_margin_pct, 0), m.stock_location_id,
          (v_unit_price IS NULL OR v_unit_cost = 0),
          CASE WHEN v_unit_price IS NULL THEN 'Preço de venda não pôde ser determinado com segurança'
               WHEN v_unit_cost = 0 THEN 'Custo unitário ausente'
               ELSE NULL END,
          true, m.mov_id, v_status, v_log_id
        );
      END IF;
    END;
  END LOOP;

  IF NOT _dry_run THEN
    UPDATE public.sales_recovery_log
       SET items_created_count = jsonb_array_length(v_items),
           total_items_amount  = v_total_items,
           difference_amount   = COALESCE(v_total_sale,0) - v_total_items,
           status              = 'concluido'
     WHERE id = v_log_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'dry_run', _dry_run,
    'sale_id', _sale_id,
    'sale_type', _sale_type,
    'os_number', v_os,
    'total_sale', v_total_sale,
    'total_items', v_total_items,
    'difference', COALESCE(v_total_sale,0) - v_total_items,
    'distinct_products', v_distinct_products,
    'movements_found', v_mov_count,
    'log_id', v_log_id,
    'items', v_items
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid,text,boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid,text,boolean) TO authenticated;