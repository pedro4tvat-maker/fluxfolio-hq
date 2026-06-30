
ALTER TABLE public.consultancy_journey_stages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_cjs_active ON public.consultancy_journey_stages(consultant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_active ON public.transactions(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_receivables_active ON public.receivables(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(company_id) WHERE deleted_at IS NULL;
