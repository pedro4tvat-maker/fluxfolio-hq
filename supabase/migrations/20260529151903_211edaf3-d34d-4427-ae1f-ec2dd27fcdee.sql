
-- Templates de jornada (método de consultoria)
CREATE TABLE IF NOT EXISTS public.consultancy_journey_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_journey_templates TO authenticated;
GRANT ALL ON public.consultancy_journey_templates TO service_role;
ALTER TABLE public.consultancy_journey_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey templates consultant manage" ON public.consultancy_journey_templates
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));
CREATE TRIGGER set_updated_at_journey_templates BEFORE UPDATE ON public.consultancy_journey_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.consultancy_journey_template_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.consultancy_journey_templates(id) ON DELETE CASCADE,
  phase_order INT NOT NULL DEFAULT 0,
  phase_key TEXT NOT NULL,
  phase_name TEXT NOT NULL,
  objective TEXT,
  description TEXT,
  suggested_duration_days INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_journey_template_phases TO authenticated;
GRANT ALL ON public.consultancy_journey_template_phases TO service_role;
ALTER TABLE public.consultancy_journey_template_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey template phases consultant manage" ON public.consultancy_journey_template_phases
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM consultancy_journey_templates t
    JOIN consultants c ON c.id = t.consultant_id
    WHERE t.id = template_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM consultancy_journey_templates t
    JOIN consultants c ON c.id = t.consultant_id
    WHERE t.id = template_id AND c.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.consultancy_journey_template_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_phase_id UUID NOT NULL REFERENCES public.consultancy_journey_template_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  responsible_type TEXT NOT NULL DEFAULT 'consultor',
  suggested_due_days INT,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_journey_template_checklist TO authenticated;
GRANT ALL ON public.consultancy_journey_template_checklist TO service_role;
ALTER TABLE public.consultancy_journey_template_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "journey template checklist consultant manage" ON public.consultancy_journey_template_checklist
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM consultancy_journey_template_phases p
    JOIN consultancy_journey_templates t ON t.id = p.template_id
    JOIN consultants c ON c.id = t.consultant_id
    WHERE p.id = template_phase_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM consultancy_journey_template_phases p
    JOIN consultancy_journey_templates t ON t.id = p.template_id
    JOIN consultants c ON c.id = t.consultant_id
    WHERE p.id = template_phase_id AND c.user_id = auth.uid()));

-- Jornadas aplicadas por empresa
CREATE TABLE IF NOT EXISTS public.company_journeys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  branch_id UUID,
  template_id UUID,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_phase_id UUID,
  overall_progress INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  allow_client_view BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_journeys TO authenticated;
GRANT ALL ON public.company_journeys TO service_role;
ALTER TABLE public.company_journeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company journeys consultant manage" ON public.company_journeys
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));
CREATE POLICY "company journeys client view" ON public.company_journeys
  FOR SELECT TO authenticated
  USING (allow_client_view = true AND public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER set_updated_at_company_journeys BEFORE UPDATE ON public.company_journeys
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_company_journeys_consultant ON public.company_journeys(consultant_id);
CREATE INDEX IF NOT EXISTS idx_company_journeys_company ON public.company_journeys(company_id);

CREATE TABLE IF NOT EXISTS public.company_journey_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id UUID NOT NULL REFERENCES public.company_journeys(id) ON DELETE CASCADE,
  phase_order INT NOT NULL DEFAULT 0,
  phase_key TEXT NOT NULL,
  phase_name TEXT NOT NULL,
  objective TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'nao_iniciada',
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_journey_phases TO authenticated;
GRANT ALL ON public.company_journey_phases TO service_role;
ALTER TABLE public.company_journey_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company journey phases consultant manage" ON public.company_journey_phases
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_journeys j
    JOIN consultants c ON c.id = j.consultant_id
    WHERE j.id = journey_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_journeys j
    JOIN consultants c ON c.id = j.consultant_id
    WHERE j.id = journey_id AND c.user_id = auth.uid()));
CREATE POLICY "company journey phases client view" ON public.company_journey_phases
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_journeys j
    WHERE j.id = journey_id AND j.allow_client_view = true
    AND public.user_has_company_access(auth.uid(), j.company_id)));
CREATE TRIGGER set_updated_at_company_journey_phases BEFORE UPDATE ON public.company_journey_phases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_company_journey_phases_journey ON public.company_journey_phases(journey_id);

CREATE TABLE IF NOT EXISTS public.company_journey_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_phase_id UUID NOT NULL REFERENCES public.company_journey_phases(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  responsible_type TEXT NOT NULL DEFAULT 'consultor',
  responsible_user_id UUID,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  related_module TEXT,
  related_record_id UUID,
  position INT NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_journey_checklist TO authenticated;
GRANT ALL ON public.company_journey_checklist TO service_role;
ALTER TABLE public.company_journey_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company journey checklist consultant manage" ON public.company_journey_checklist
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_journey_phases p
    JOIN company_journeys j ON j.id = p.journey_id
    JOIN consultants c ON c.id = j.consultant_id
    WHERE p.id = journey_phase_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_journey_phases p
    JOIN company_journeys j ON j.id = p.journey_id
    JOIN consultants c ON c.id = j.consultant_id
    WHERE p.id = journey_phase_id AND c.user_id = auth.uid()));
CREATE POLICY "company journey checklist client view" ON public.company_journey_checklist
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_journey_phases p
    JOIN company_journeys j ON j.id = p.journey_id
    WHERE p.id = journey_phase_id AND j.allow_client_view = true
    AND public.user_has_company_access(auth.uid(), j.company_id)));
CREATE TRIGGER set_updated_at_company_journey_checklist BEFORE UPDATE ON public.company_journey_checklist
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_company_journey_checklist_phase ON public.company_journey_checklist(journey_phase_id);

CREATE TABLE IF NOT EXISTS public.company_journey_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_phase_id UUID NOT NULL REFERENCES public.company_journey_phases(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  responsible_type TEXT NOT NULL DEFAULT 'consultor',
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_journey_deliverables TO authenticated;
GRANT ALL ON public.company_journey_deliverables TO service_role;
ALTER TABLE public.company_journey_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company journey deliverables consultant manage" ON public.company_journey_deliverables
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_journey_phases p
    JOIN company_journeys j ON j.id = p.journey_id
    JOIN consultants c ON c.id = j.consultant_id
    WHERE p.id = journey_phase_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM company_journey_phases p
    JOIN company_journeys j ON j.id = p.journey_id
    JOIN consultants c ON c.id = j.consultant_id
    WHERE p.id = journey_phase_id AND c.user_id = auth.uid()));
CREATE POLICY "company journey deliverables client view" ON public.company_journey_deliverables
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM company_journey_phases p
    JOIN company_journeys j ON j.id = p.journey_id
    WHERE p.id = journey_phase_id AND j.allow_client_view = true
    AND public.user_has_company_access(auth.uid(), j.company_id)));
CREATE TRIGGER set_updated_at_company_journey_deliverables BEFORE UPDATE ON public.company_journey_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX IF NOT EXISTS idx_company_journey_deliverables_phase ON public.company_journey_deliverables(journey_phase_id);
