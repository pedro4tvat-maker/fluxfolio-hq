
CREATE TYPE public.historical_source_type AS ENUM ('manual','planilha','relatorio_antigo','extrato','sistema_anterior','contabilidade','estimativa_cliente','outro');
CREATE TYPE public.historical_snapshot_status AS ENUM ('rascunho','conferido','aprovado','substituido');

CREATE TABLE public.historical_financial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  reference_month int NOT NULL CHECK (reference_month BETWEEN 1 AND 12),
  reference_year int NOT NULL CHECK (reference_year BETWEEN 2000 AND 2100),
  period_start date,
  period_end date,
  source_type public.historical_source_type NOT NULL DEFAULT 'manual',
  source_description text,
  revenue_gross numeric(14,2) DEFAULT 0,
  revenue_net numeric(14,2) DEFAULT 0,
  sales_count int DEFAULT 0,
  average_ticket numeric(14,2) DEFAULT 0,
  variable_costs numeric(14,2) DEFAULT 0,
  fixed_costs numeric(14,2) DEFAULT 0,
  variable_expenses numeric(14,2) DEFAULT 0,
  fixed_expenses numeric(14,2) DEFAULT 0,
  financial_expenses numeric(14,2) DEFAULT 0,
  taxes numeric(14,2) DEFAULT 0,
  discounts numeric(14,2) DEFAULT 0,
  refunds numeric(14,2) DEFAULT 0,
  payroll_costs numeric(14,2) DEFAULT 0,
  marketing_expenses numeric(14,2) DEFAULT 0,
  administrative_expenses numeric(14,2) DEFAULT 0,
  operational_expenses numeric(14,2) DEFAULT 0,
  other_expenses numeric(14,2) DEFAULT 0,
  gross_margin_value numeric(14,2) DEFAULT 0,
  gross_margin_percentage numeric(8,2) DEFAULT 0,
  contribution_margin_value numeric(14,2) DEFAULT 0,
  contribution_margin_percentage numeric(8,2) DEFAULT 0,
  operational_result numeric(14,2) DEFAULT 0,
  operational_margin_percentage numeric(8,2) DEFAULT 0,
  net_result numeric(14,2) DEFAULT 0,
  accounts_receivable_open numeric(14,2) DEFAULT 0,
  accounts_receivable_overdue numeric(14,2) DEFAULT 0,
  accounts_payable_open numeric(14,2) DEFAULT 0,
  accounts_payable_overdue numeric(14,2) DEFAULT 0,
  inventory_value numeric(14,2),
  notes text,
  status public.historical_snapshot_status NOT NULL DEFAULT 'rascunho',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX historical_snapshots_unique_period
  ON public.historical_financial_snapshots (company_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), reference_year, reference_month)
  WHERE deleted_at IS NULL;

CREATE INDEX historical_snapshots_company_idx ON public.historical_financial_snapshots (company_id, reference_year, reference_month);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historical_financial_snapshots TO authenticated;
GRANT ALL ON public.historical_financial_snapshots TO service_role;

ALTER TABLE public.historical_financial_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hist_snap_select" ON public.historical_financial_snapshots
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshots.company_id AND co.user_id = auth.uid())
);

CREATE POLICY "hist_snap_write" ON public.historical_financial_snapshots
FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshots.company_id AND co.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshots.company_id AND co.user_id = auth.uid())
);

CREATE TRIGGER trg_hist_snap_updated_at BEFORE UPDATE ON public.historical_financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.historical_financial_snapshot_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.historical_financial_snapshots(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  change_reason text
);

CREATE INDEX hist_snap_versions_snap_idx ON public.historical_financial_snapshot_versions (snapshot_id, changed_at DESC);

GRANT SELECT, INSERT ON public.historical_financial_snapshot_versions TO authenticated;
GRANT ALL ON public.historical_financial_snapshot_versions TO service_role;

ALTER TABLE public.historical_financial_snapshot_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hist_snap_ver_select" ON public.historical_financial_snapshot_versions
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshot_versions.company_id AND co.user_id = auth.uid())
);

CREATE POLICY "hist_snap_ver_insert" ON public.historical_financial_snapshot_versions
FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_historical_snapshot_version()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.historical_financial_snapshot_versions
      (snapshot_id, company_id, old_data, new_data, changed_by, change_reason)
    VALUES
      (OLD.id, OLD.company_id, to_jsonb(OLD), to_jsonb(NEW), auth.uid(),
       COALESCE(current_setting('app.snapshot_change_reason', true), NULL));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_hist_snap_version AFTER UPDATE ON public.historical_financial_snapshots
FOR EACH ROW EXECUTE FUNCTION public.tg_historical_snapshot_version();
