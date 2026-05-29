
CREATE TABLE public.consultancy_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID,
  branch_id UUID,
  title TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'tarefa_interna',
  responsible_name TEXT,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  end_time TIME,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  description TEXT,
  notes TEXT,
  meeting_link TEXT,
  location TEXT,
  reminder_type TEXT,
  reminder_datetime TIMESTAMPTZ,
  recurrence_type TEXT NOT NULL DEFAULT 'none',
  recurrence_until DATE,
  related_module TEXT,
  related_record_id UUID,
  completed_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_activities TO authenticated;
GRANT ALL ON public.consultancy_activities TO service_role;

ALTER TABLE public.consultancy_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activities select" ON public.consultancy_activities
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultancy_activities.consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Activities write" ON public.consultancy_activities
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultancy_activities.consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultancy_activities.consultant_id AND c.user_id = auth.uid()));

CREATE TRIGGER set_updated_at_consultancy_activities
BEFORE UPDATE ON public.consultancy_activities
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_consultancy_activities_consultant ON public.consultancy_activities(consultant_id, activity_date);
CREATE INDEX idx_consultancy_activities_company ON public.consultancy_activities(company_id);
