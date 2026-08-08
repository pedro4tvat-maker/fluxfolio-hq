CREATE TABLE public.company_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid,
  title text NOT NULL,
  description text,
  activity_date timestamptz NOT NULL,
  activity_type text NOT NULL DEFAULT 'outro',
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendente',
  responsible text,
  location text,
  meeting_link text,
  reminder text,
  completed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_activities_company_date ON public.company_activities (company_id, activity_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_activities TO authenticated;
GRANT ALL ON public.company_activities TO service_role;

ALTER TABLE public.company_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company activities select" ON public.company_activities
  FOR SELECT TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Company activities insert" ON public.company_activities
  FOR INSERT TO authenticated
  WITH CHECK (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Company activities update" ON public.company_activities
  FOR UPDATE TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Company activities delete" ON public.company_activities
  FOR DELETE TO authenticated
  USING (auth_helpers.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER set_updated_at_company_activities
  BEFORE UPDATE ON public.company_activities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();