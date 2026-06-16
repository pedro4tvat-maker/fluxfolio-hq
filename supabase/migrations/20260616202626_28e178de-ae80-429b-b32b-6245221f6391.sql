
WITH reseller_loc AS (
  SELECT DISTINCT ON (company_id) company_id, id AS loc_id
  FROM public.stock_locations
  WHERE tipo = 'revendedor' AND ativa = true
  ORDER BY company_id, created_at
)
UPDATE public.stock_movements sm
SET stock_location_id = r.loc_id
FROM reseller_loc r
WHERE sm.stock_location_id IS NULL
  AND sm.motivo ILIKE 'Transfer%'
  AND sm.company_id = r.company_id;

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_stock_location_id_fkey;

ALTER TABLE public.stock_movements
  ADD CONSTRAINT stock_movements_stock_location_id_fkey
  FOREIGN KEY (stock_location_id) REFERENCES public.stock_locations(id) ON DELETE RESTRICT;
