
CREATE TABLE public.resellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  documento TEXT,
  stock_location_id UUID REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  commission_pct NUMERIC(7,4) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_resellers_company ON public.resellers(company_id);
CREATE INDEX idx_resellers_location ON public.resellers(stock_location_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.resellers TO authenticated;
GRANT ALL ON public.resellers TO service_role;

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resellers select" ON public.resellers FOR SELECT TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "resellers write" ON public.resellers FOR ALL TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_resellers_updated BEFORE UPDATE ON public.resellers
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.transactions
  ADD COLUMN reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  ADD COLUMN commission_value NUMERIC(14,2);
CREATE INDEX idx_transactions_reseller ON public.transactions(reseller_id);

ALTER TABLE public.receivables
  ADD COLUMN reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL,
  ADD COLUMN commission_value NUMERIC(14,2);
CREATE INDEX idx_receivables_reseller ON public.receivables(reseller_id);
