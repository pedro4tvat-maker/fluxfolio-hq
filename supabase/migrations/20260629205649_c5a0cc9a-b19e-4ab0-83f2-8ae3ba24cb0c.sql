
ALTER TABLE public.consultancy_receivables ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.consultancy_payables ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.consultancy_contracts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.stock_locations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.resellers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.action_plans ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.company_journey_checklist ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_consultancy_receivables_deleted_at ON public.consultancy_receivables (deleted_at);
CREATE INDEX IF NOT EXISTS idx_consultancy_payables_deleted_at ON public.consultancy_payables (deleted_at);
CREATE INDEX IF NOT EXISTS idx_consultancy_contracts_deleted_at ON public.consultancy_contracts (deleted_at);
CREATE INDEX IF NOT EXISTS idx_payables_deleted_at ON public.payables (deleted_at);
CREATE INDEX IF NOT EXISTS idx_stock_locations_deleted_at ON public.stock_locations (deleted_at);
CREATE INDEX IF NOT EXISTS idx_resellers_deleted_at ON public.resellers (deleted_at);
CREATE INDEX IF NOT EXISTS idx_action_plans_deleted_at ON public.action_plans (deleted_at);
CREATE INDEX IF NOT EXISTS idx_company_journey_checklist_deleted_at ON public.company_journey_checklist (deleted_at);
