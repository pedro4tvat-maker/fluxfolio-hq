
CREATE TABLE public.financial_diagnostics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  branch_id UUID,
  diagnostic_date DATE NOT NULL DEFAULT CURRENT_DATE,
  responsible_name TEXT,
  status TEXT NOT NULL DEFAULT 'nao_iniciado',
  overall_score NUMERIC NOT NULL DEFAULT 0,
  classification TEXT,
  strengths TEXT,
  weaknesses TEXT,
  recommendations TEXT,
  next_steps TEXT,
  notes TEXT,
  allow_client_view BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_diagnostics TO authenticated;
GRANT ALL ON public.financial_diagnostics TO service_role;

ALTER TABLE public.financial_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diagnostics consultant manage"
ON public.financial_diagnostics
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = financial_diagnostics.consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = financial_diagnostics.consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Diagnostics client view finalized"
ON public.financial_diagnostics
FOR SELECT
TO authenticated
USING (
  allow_client_view = true
  AND status IN ('finalizado','revisado')
  AND public.user_has_company_access(auth.uid(), company_id)
);

CREATE INDEX idx_financial_diagnostics_company ON public.financial_diagnostics(company_id);
CREATE INDEX idx_financial_diagnostics_consultant ON public.financial_diagnostics(consultant_id);

CREATE TRIGGER trg_financial_diagnostics_updated
BEFORE UPDATE ON public.financial_diagnostics
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.financial_diagnostic_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES public.financial_diagnostics(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,
  score NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (diagnostic_id, question_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_diagnostic_answers TO authenticated;
GRANT ALL ON public.financial_diagnostic_answers TO service_role;

ALTER TABLE public.financial_diagnostic_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Diagnostic answers consultant manage"
ON public.financial_diagnostic_answers
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financial_diagnostics d
  JOIN public.consultants c ON c.id = d.consultant_id
  WHERE d.id = financial_diagnostic_answers.diagnostic_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.financial_diagnostics d
  JOIN public.consultants c ON c.id = d.consultant_id
  WHERE d.id = financial_diagnostic_answers.diagnostic_id AND c.user_id = auth.uid()
));

CREATE POLICY "Diagnostic answers client view"
ON public.financial_diagnostic_answers
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financial_diagnostics d
  WHERE d.id = financial_diagnostic_answers.diagnostic_id
    AND d.allow_client_view = true
    AND d.status IN ('finalizado','revisado')
    AND public.user_has_company_access(auth.uid(), d.company_id)
));

CREATE INDEX idx_diagnostic_answers_diag ON public.financial_diagnostic_answers(diagnostic_id);

CREATE TRIGGER trg_financial_diagnostic_answers_updated
BEFORE UPDATE ON public.financial_diagnostic_answers
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
