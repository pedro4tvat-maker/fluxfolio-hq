-- Backfill seguro para vendas antigas: cria snapshots em sale_items a partir
-- das movimentações de estoque vinculadas à venda. Não duplica registros.
WITH sale_refs AS (
  SELECT id AS sale_id, company_id, branch_id, 'vista'::text AS sale_type, valor::numeric AS sale_value
  FROM public.transactions
  WHERE tipo = 'entrada'
  UNION ALL
  SELECT id AS sale_id, company_id, branch_id, 'prazo'::text AS sale_type, valor::numeric AS sale_value
  FROM public.receivables
), mov AS (
  SELECT
    sm.related_sale_id AS sale_id,
    sm.related_sale_type AS sale_type,
    sm.company_id,
    sm.branch_id,
    sm.product_id,
    sm.stock_location_id,
    SUM(sm.quantidade)::numeric AS quantity,
    MAX(COALESCE(sm.custo_unitario, p.custo_unitario, 0))::numeric AS unit_cost,
    MAX(COALESCE(p.preco_venda, 0))::numeric AS current_unit_price,
    MAX(p.nome) AS product_name_snapshot
  FROM public.stock_movements sm
  JOIN public.products p ON p.id = sm.product_id
  WHERE sm.tipo = 'saida'
    AND sm.motivo = 'Venda'
    AND sm.related_sale_id IS NOT NULL
    AND sm.related_sale_type IN ('vista', 'prazo')
  GROUP BY sm.related_sale_id, sm.related_sale_type, sm.company_id, sm.branch_id, sm.product_id, sm.stock_location_id
), weighted AS (
  SELECT
    m.*,
    sr.sale_value,
    SUM(m.quantity * NULLIF(m.current_unit_price, 0)) OVER (PARTITION BY m.sale_id, m.sale_type) AS current_total,
    SUM(m.quantity) OVER (PARTITION BY m.sale_id, m.sale_type) AS total_qty
  FROM mov m
  JOIN sale_refs sr ON sr.sale_id = m.sale_id AND sr.sale_type = m.sale_type
), final_rows AS (
  SELECT
    company_id,
    branch_id,
    sale_id,
    sale_type,
    product_id,
    COALESCE(product_name_snapshot, 'Produto') AS product_name_snapshot,
    quantity,
    CASE
      WHEN current_total > 0 AND sale_value > 0 THEN current_unit_price * (sale_value / current_total)
      WHEN total_qty > 0 AND sale_value > 0 THEN sale_value / total_qty
      ELSE current_unit_price
    END AS unit_price,
    unit_cost,
    stock_location_id
  FROM weighted
)
INSERT INTO public.sale_items (
  company_id, branch_id, sale_id, sale_type, product_id, product_name_snapshot,
  quantity, unit_price, unit_cost, total_revenue, total_cost, margin_value, margin_percentage,
  stock_location_id, needs_review, review_reason
)
SELECT
  company_id,
  branch_id,
  sale_id,
  sale_type,
  product_id,
  product_name_snapshot,
  quantity,
  unit_price,
  unit_cost,
  quantity * unit_price,
  quantity * unit_cost,
  (quantity * unit_price) - (quantity * unit_cost),
  CASE WHEN quantity * unit_price > 0 THEN (((quantity * unit_price) - (quantity * unit_cost)) / (quantity * unit_price)) * 100 ELSE 0 END,
  stock_location_id,
  unit_price <= 0 OR unit_cost <= 0,
  CASE
    WHEN unit_price <= 0 THEN 'Preço unitário ausente no reprocessamento'
    WHEN unit_cost <= 0 THEN 'Custo zerado no reprocessamento'
    ELSE NULL
  END
FROM final_rows
ON CONFLICT DO NOTHING;
