
CREATE TYPE public.stock_location_type AS ENUM (
  'principal','deposito','loja','filial','revendedor','consignado','producao','transito','outros'
);

CREATE TABLE public.stock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo public.stock_location_type NOT NULL DEFAULT 'principal',
  responsavel TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_locations_company ON public.stock_locations(company_id);
CREATE INDEX idx_stock_locations_branch ON public.stock_locations(branch_id);
CREATE UNIQUE INDEX uniq_stock_locations_default ON public.stock_locations(company_id) WHERE is_default;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_locations TO authenticated;
GRANT ALL ON public.stock_locations TO service_role;

ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_locations select" ON public.stock_locations FOR SELECT TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "stock_locations write" ON public.stock_locations FOR ALL TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_stock_locations_updated BEFORE UPDATE ON public.stock_locations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.stock_movements
  ADD COLUMN stock_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL;
CREATE INDEX idx_stk_location ON public.stock_movements(stock_location_id);

CREATE OR REPLACE FUNCTION public.product_stock_by_location(_product_id UUID, _location_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(
    CASE WHEN tipo = 'entrada' THEN quantidade
         WHEN tipo = 'saida'   THEN -quantidade
         ELSE 0 END
  ), 0)
  FROM public.stock_movements
  WHERE product_id = _product_id AND stock_location_id = _location_id
$$;

INSERT INTO public.stock_locations (company_id, nome, tipo, is_default)
SELECT DISTINCT company_id, 'Estoque Principal', 'principal'::public.stock_location_type, true
FROM public.products
WHERE company_id NOT IN (SELECT company_id FROM public.stock_locations WHERE is_default);

UPDATE public.stock_movements sm
SET stock_location_id = sl.id
FROM public.stock_locations sl
WHERE sl.company_id = sm.company_id
  AND sl.is_default = true
  AND sm.stock_location_id IS NULL;
