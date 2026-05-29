
CREATE TABLE public.executive_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  diagnostico TEXT,
  problemas TEXT,
  recomendacoes TEXT,
  plano_acao TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, branch_id, mes, ano)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.executive_reports TO authenticated;
GRANT ALL ON public.executive_reports TO service_role;

ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exec reports select" ON public.executive_reports
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Exec reports write consultant" ON public.executive_reports
  FOR ALL TO authenticated
  USING (public.is_consultant(auth.uid()) AND public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.is_consultant(auth.uid()) AND public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER tg_exec_reports_updated
BEFORE UPDATE ON public.executive_reports
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
