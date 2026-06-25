
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS related_sale_id uuid,
  ADD COLUMN IF NOT EXISTS related_sale_type text;

CREATE INDEX IF NOT EXISTS idx_stk_related_sale ON public.stock_movements(related_sale_id);
