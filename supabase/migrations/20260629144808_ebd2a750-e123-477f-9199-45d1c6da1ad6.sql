CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  sale_id uuid NOT NULL,
  sale_type text NOT NULL CHECK (sale_type IN ('vista', 'prazo')),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name_snapshot text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_revenue numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  margin_value numeric NOT NULL DEFAULT 0,
  margin_percentage numeric NOT NULL DEFAULT 0,
  stock_location_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sale_id, sale_type, product_id, product_name_snapshot, quantity, unit_price, stock_location_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sale items select"
ON public.sale_items
FOR SELECT
TO authenticated
USING (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Sale items write"
ON public.sale_items
FOR ALL
TO authenticated
USING (auth_helpers.user_has_company_access(auth.uid(), company_id))
WITH CHECK (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE INDEX idx_sale_items_sale ON public.sale_items (sale_id, sale_type);
CREATE INDEX idx_sale_items_company_created ON public.sale_items (company_id, created_at DESC);
CREATE INDEX idx_sale_items_product ON public.sale_items (product_id);
CREATE INDEX idx_sale_items_location ON public.sale_items (stock_location_id);

CREATE TRIGGER tg_sale_items_updated_at
BEFORE UPDATE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();