
ALTER TABLE public.executive_reports
  ADD COLUMN IF NOT EXISTS snapshot jsonb,
  ADD COLUMN IF NOT EXISTS ia_analysis text,
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date;

CREATE INDEX IF NOT EXISTS idx_executive_reports_periodo
  ON public.executive_reports (company_id, branch_id, periodo_inicio, periodo_fim);
