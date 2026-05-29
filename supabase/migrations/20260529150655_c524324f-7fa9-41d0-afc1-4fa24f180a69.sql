-- Meeting minutes (Atas de Reunião)
CREATE TABLE public.meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL,
  company_id uuid NOT NULL,
  branch_id uuid,
  agenda_activity_id uuid,
  related_module text,
  related_record_id uuid,
  title text NOT NULL,
  meeting_type text NOT NULL DEFAULT 'acompanhamento',
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  meeting_time time,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  agenda_text text,
  raw_notes text,
  generated_content text,
  final_content text,
  status text NOT NULL DEFAULT 'rascunho',
  ai_generated boolean NOT NULL DEFAULT false,
  shared_with_client boolean NOT NULL DEFAULT false,
  template_used text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_minutes TO authenticated;
GRANT ALL ON public.meeting_minutes TO service_role;

ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meeting minutes consultant manage"
ON public.meeting_minutes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = meeting_minutes.consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = meeting_minutes.consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Meeting minutes client view shared"
ON public.meeting_minutes FOR SELECT TO authenticated
USING (shared_with_client = true AND status IN ('finalizada','compartilhada') AND public.user_has_company_access(auth.uid(), company_id));

CREATE INDEX idx_meeting_minutes_consultant ON public.meeting_minutes(consultant_id);
CREATE INDEX idx_meeting_minutes_company ON public.meeting_minutes(company_id);
CREATE INDEX idx_meeting_minutes_status ON public.meeting_minutes(status);

CREATE TRIGGER tg_meeting_minutes_updated
BEFORE UPDATE ON public.meeting_minutes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Tasks generated from a meeting minute
CREATE TABLE public.meeting_minutes_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_minutes_id uuid NOT NULL REFERENCES public.meeting_minutes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  responsible_type text NOT NULL DEFAULT 'consultor',
  responsible_user_id uuid,
  responsible_name text,
  due_date date,
  status text NOT NULL DEFAULT 'pendente',
  created_activity_id uuid,
  created_action_plan_id uuid,
  created_pending_item_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_minutes_tasks TO authenticated;
GRANT ALL ON public.meeting_minutes_tasks TO service_role;

ALTER TABLE public.meeting_minutes_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Meeting minutes tasks consultant manage"
ON public.meeting_minutes_tasks FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meeting_minutes m
  JOIN public.consultants c ON c.id = m.consultant_id
  WHERE m.id = meeting_minutes_tasks.meeting_minutes_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.meeting_minutes m
  JOIN public.consultants c ON c.id = m.consultant_id
  WHERE m.id = meeting_minutes_tasks.meeting_minutes_id AND c.user_id = auth.uid()
));

CREATE POLICY "Meeting minutes tasks client view"
ON public.meeting_minutes_tasks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.meeting_minutes m
  WHERE m.id = meeting_minutes_tasks.meeting_minutes_id
    AND m.shared_with_client = true
    AND m.status IN ('finalizada','compartilhada')
    AND public.user_has_company_access(auth.uid(), m.company_id)
));

CREATE INDEX idx_mm_tasks_minute ON public.meeting_minutes_tasks(meeting_minutes_id);