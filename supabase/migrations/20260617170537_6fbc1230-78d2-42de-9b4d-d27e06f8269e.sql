UPDATE public.stock_movements sm
SET stock_location_id = sl.id
FROM public.stock_locations sl
WHERE sm.stock_location_id IS NULL
  AND sl.company_id = sm.company_id
  AND sl.is_default = true
  AND sl.ativa = true;

UPDATE public.stock_movements sm
SET stock_location_id = sl.id
FROM public.stock_locations sl
WHERE sm.stock_location_id IS NULL
  AND sl.company_id = sm.company_id
  AND sl.tipo = 'principal'
  AND sl.ativa = true;