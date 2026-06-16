ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS commission_value NUMERIC(14,2);
CREATE INDEX IF NOT EXISTS idx_payables_reseller_id ON public.payables(reseller_id);