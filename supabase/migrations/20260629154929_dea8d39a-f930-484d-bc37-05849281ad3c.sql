
-- =========================================
-- FASE 0 — Infraestrutura segura de recuperação
-- =========================================

-- 1) Tabela de log
CREATE TABLE IF NOT EXISTS public.sales_recovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL,
  sale_type text NOT NULL CHECK (sale_type IN ('vista','prazo')),
  os_number text,
  recovery_method text NOT NULL CHECK (recovery_method IN ('stock_movements','manual','importacao_planilha','pdf','print','whatsapp')),
  status text NOT NULL,
  items_created_count integer NOT NULL DEFAULT 0,
  total_sale_amount numeric,
  total_items_amount numeric,
  difference_amount numeric,
  notes text,
  reverted_at timestamptz,
  reverted_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.sales_recovery_log TO authenticated;
GRANT ALL ON public.sales_recovery_log TO service_role;

ALTER TABLE public.sales_recovery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can view recovery log of their company"
  ON public.sales_recovery_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = sales_recovery_log.company_id AND m.user_id = auth.uid())
  );

CREATE POLICY "members can insert recovery log of their company"
  ON public.sales_recovery_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = sales_recovery_log.company_id AND m.user_id = auth.uid())
  );

CREATE POLICY "members can update recovery log of their company"
  ON public.sales_recovery_log FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = sales_recovery_log.company_id AND m.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_srl_company ON public.sales_recovery_log(company_id);
CREATE INDEX IF NOT EXISTS idx_srl_sale ON public.sales_recovery_log(sale_id, sale_type);

-- 2) Novas colunas em sale_items
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS recovered_from_stock_movement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS related_stock_movement_id uuid,
  ADD COLUMN IF NOT EXISTS recovery_status text,
  ADD COLUMN IF NOT EXISTS recovery_log_id uuid REFERENCES public.sales_recovery_log(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sale_items_recovery_log ON public.sale_items(recovery_log_id);

-- 3) Novas colunas em transactions e receivables (aditivas, não tocam valor)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS needs_manual_item_reconstruction boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconstruction_reason text,
  ADD COLUMN IF NOT EXISTS reconstruction_status text;

ALTER TABLE public.receivables
  ADD COLUMN IF NOT EXISTS needs_manual_item_reconstruction boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reconstruction_reason text,
  ADD COLUMN IF NOT EXISTS reconstruction_status text;

-- 4) RPC de recuperação (com dry-run)
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
  v_movements jsonb;
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
  -- Carrega venda
  IF _sale_type = 'vista' THEN
    SELECT company_id, branch_id, valor, os_code
      INTO v_company_id, v_branch_id, v_total_sale, v_os
      FROM public.transactions WHERE id = _sale_id;
  ELSIF _sale_type = 'prazo' THEN
    SELECT company_id, branch_id, valor, os_code
      INTO v_company_id, v_branch_id, v_total_sale, v_os
      FROM public.receivables WHERE id = _sale_id;
  ELSE
    RAISE EXCEPTION 'sale_type inválido';
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  -- Autorização: somente owner/membro da empresa
  IF NOT (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members mm WHERE mm.company_id = v_company_id AND mm.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão para esta empresa' USING ERRCODE='42501';
  END IF;

  -- Bloqueios de duplicidade
  SELECT count(*) INTO v_existing_items FROM public.sale_items WHERE sale_id = _sale_id;
  SELECT count(*) INTO v_existing_log FROM public.sales_recovery_log
    WHERE sale_id = _sale_id AND reverted_at IS NULL;

  IF v_existing_items > 0 OR v_existing_log > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Esta venda já possui itens estruturados ou recuperação registrada. Revise antes de criar novos itens.',
      'existing_items', v_existing_items,
      'existing_active_logs', v_existing_log
    );
  END IF;

  -- Conta produtos distintos e quantidade total (para regra de preço)
  SELECT count(DISTINCT product_id), COALESCE(SUM(quantidade),0)
    INTO v_distinct_products, v_total_qty
    FROM public.stock_movements
   WHERE related_sale_id = _sale_id
     AND related_sale_type = _sale_type
     AND tipo = 'saida';

  SELECT count(*) INTO v_mov_count
    FROM public.stock_movements
   WHERE related_sale_id = _sale_id
     AND related_sale_type = _sale_type
     AND tipo = 'saida';

  IF v_mov_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sem stock_movements vinculados a esta venda.');
  END IF;

  -- Cria log (somente se não for dry-run)
  IF NOT _dry_run THEN
    INSERT INTO public.sales_recovery_log
      (company_id, sale_id, sale_type, os_number, recovery_method, status,
       items_created_count, total_sale_amount, created_by)
    VALUES
      (v_company_id, _sale_id, _sale_type, v_os, 'stock_movements', 'em_andamento',
       0, v_total_sale, auth.uid())
    RETURNING id INTO v_log_id;
  END IF;

  -- Itera movimentos
  FOR m IN
    SELECT sm.id AS mov_id, sm.product_id, sm.quantidade, sm.custo_unitario,
           sm.stock_location_id, p.nome AS product_name, p.custo_unitario AS product_cost
      FROM public.stock_movements sm
      LEFT JOIN public.products p ON p.id = sm.product_id
     WHERE sm.related_sale_id = _sale_id
       AND sm.related_sale_type = _sale_type
       AND sm.tipo = 'saida'
  LOOP
    -- Custo unitário: prioriza movimento, fallback para produto
    DECLARE
      v_unit_cost numeric := COALESCE(NULLIF(m.custo_unitario,0), m.product_cost, 0);
      v_total_cost numeric;
    BEGIN
      v_total_cost := v_unit_cost * COALESCE(m.quantidade,0);

      -- Regra estrita de preço
      IF v_distinct_products = 1 AND v_total_sale IS NOT NULL AND v_total_qty > 0 THEN
        v_unit_price := v_total_sale / v_total_qty;
        v_total_revenue := v_unit_price * m.quantidade;
        v_status := 'recuperado_por_movimento_estoque';
      ELSE
        v_unit_price := NULL;
        v_total_revenue := NULL;
        v_status := 'produto_recuperado_sem_preco_de_venda';
      END IF;

      -- Margem só quando preço e custo confiáveis
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
          v_company_id, v_branch_id, _sale_id, _sale_type, m.product_id, m.product_name,
          m.quantidade, v_unit_price, v_unit_cost, v_total_revenue, v_total_cost,
          v_margin_value, v_margin_pct, m.stock_location_id,
          (v_unit_price IS NULL OR v_unit_cost = 0),
          CASE WHEN v_unit_price IS NULL THEN 'Preço de venda não pôde ser determinado com segurança'
               WHEN v_unit_cost = 0 THEN 'Custo unitário ausente'
               ELSE NULL END,
          true, m.mov_id, v_status, v_log_id
        );
      END IF;
    END;
  END LOOP;

  -- Atualiza log final
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

REVOKE EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recover_sale_from_stock_movements(uuid,text,boolean) TO authenticated;

-- 5) RPC de reversão
CREATE OR REPLACE FUNCTION public.revert_sales_recovery(_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_deleted int;
BEGIN
  SELECT company_id INTO v_company_id FROM public.sales_recovery_log WHERE id = _log_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Log não encontrado';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members mm WHERE mm.company_id = v_company_id AND mm.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  DELETE FROM public.sale_items WHERE recovery_log_id = _log_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.sales_recovery_log
     SET reverted_at = now(), reverted_by = auth.uid(), status = 'revertido'
   WHERE id = _log_id;

  RETURN jsonb_build_object('ok', true, 'deleted_items', v_deleted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revert_sales_recovery(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revert_sales_recovery(uuid) TO authenticated;
