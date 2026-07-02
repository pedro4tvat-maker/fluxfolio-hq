WITH sale_totals AS (
  SELECT id AS sale_id, 'vista'::text AS sale_type, valor::numeric AS sale_value
  FROM public.transactions
  WHERE deleted_at IS NULL AND tipo = 'entrada'
  UNION ALL
  SELECT id AS sale_id, 'prazo'::text AS sale_type, valor::numeric AS sale_value
  FROM public.receivables
  WHERE deleted_at IS NULL
), item_ratios AS (
  SELECT
    si.id,
    si.sale_id,
    si.sale_type,
    si.total_revenue,
    CASE
      WHEN COALESCE(p.preco_venda, 0) > 0 AND si.unit_price > 0 THEN si.unit_price / p.preco_venda
      ELSE NULL
    END AS price_ratio,
    st.sale_value
  FROM public.sale_items si
  JOIN sale_totals st ON st.sale_id = si.sale_id AND st.sale_type = si.sale_type
  LEFT JOIN public.products p ON p.id = si.product_id
  WHERE si.deleted_at IS NULL
), suspicious_sales AS (
  SELECT
    sale_id,
    sale_type
  FROM item_ratios
  WHERE price_ratio IS NOT NULL
  GROUP BY sale_id, sale_type, sale_value
  HAVING count(*) >= 2
     AND abs(sum(total_revenue) - max(sale_value)) <= 0.05
     AND max(price_ratio) - min(price_ratio) <= 0.02
     AND avg(price_ratio) > 0
     AND avg(price_ratio) < 0.70
)
UPDATE public.sale_items si
SET
  needs_review = true,
  review_reason = COALESCE(
    NULLIF(si.review_reason, ''),
    'Preço unitário estimado por reconstrução proporcional; confirmar preço real lançado na venda.'
  )
FROM suspicious_sales ss
WHERE si.sale_id = ss.sale_id
  AND si.sale_type = ss.sale_type
  AND si.deleted_at IS NULL;