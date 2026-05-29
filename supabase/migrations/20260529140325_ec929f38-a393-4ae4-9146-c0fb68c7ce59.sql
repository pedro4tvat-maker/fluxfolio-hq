
-- Tabela principal de ações
CREATE TABLE public.action_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  branch_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  related_area TEXT NOT NULL DEFAULT 'gestao',
  origin TEXT NOT NULL DEFAULT 'analise_consultor',
  responsible_type TEXT NOT NULL DEFAULT 'consultor',
  responsible_user_id UUID,
  responsible_name TEXT,
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  notes TEXT,
  related_module TEXT,
  related_record_id UUID,
  diagnostic_id UUID,
  activity_id UUID,
  allow_client_view BOOLEAN NOT NULL DEFAULT false,
  allow_client_complete BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plans TO authenticated;
GRANT ALL ON public.action_plans TO service_role;

ALTER TABLE public.action_plans ENABLE ROW LEVEL SECURITY;

-- Consultor: full manage
CREATE POLICY "Action plans consultant manage"
ON public.action_plans
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = action_plans.consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = action_plans.consultant_id AND c.user_id = auth.uid()));

-- Cliente: visualizar quando liberado
CREATE POLICY "Action plans client view"
ON public.action_plans
FOR SELECT
TO authenticated
USING (allow_client_view = true AND public.user_has_company_access(auth.uid(), company_id));

-- Cliente: atualizar (apenas se atribuido a ele e permitido)
CREATE POLICY "Action plans client update assigned"
ON public.action_plans
FOR UPDATE
TO authenticated
USING (
  allow_client_view = true
  AND allow_client_complete = true
  AND responsible_user_id = auth.uid()
  AND public.user_has_company_access(auth.uid(), company_id)
)
WITH CHECK (
  allow_client_view = true
  AND allow_client_complete = true
  AND responsible_user_id = auth.uid()
  AND public.user_has_company_access(auth.uid(), company_id)
);

CREATE INDEX idx_action_plans_company ON public.action_plans(company_id);
CREATE INDEX idx_action_plans_consultant ON public.action_plans(consultant_id);
CREATE INDEX idx_action_plans_status ON public.action_plans(status);
CREATE INDEX idx_action_plans_due ON public.action_plans(due_date);

CREATE TRIGGER trg_action_plans_updated_at
BEFORE UPDATE ON public.action_plans
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Comentários
CREATE TABLE public.action_plan_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_plan_id UUID NOT NULL REFERENCES public.action_plans(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL,
  author_name TEXT,
  comment_type TEXT NOT NULL DEFAULT 'observacao',
  comment TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_plan_comments TO authenticated;
GRANT ALL ON public.action_plan_comments TO service_role;

ALTER TABLE public.action_plan_comments ENABLE ROW LEVEL SECURITY;

-- Consultor: tudo nas ações próprias
CREATE POLICY "Action plan comments consultant manage"
ON public.action_plan_comments
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.action_plans ap
  JOIN public.consultants c ON c.id = ap.consultant_id
  WHERE ap.id = action_plan_comments.action_plan_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.action_plans ap
  JOIN public.consultants c ON c.id = ap.consultant_id
  WHERE ap.id = action_plan_comments.action_plan_id AND c.user_id = auth.uid()
));

-- Cliente: visualizar comentários quando ação visível
CREATE POLICY "Action plan comments client view"
ON public.action_plan_comments
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.action_plans ap
  WHERE ap.id = action_plan_comments.action_plan_id
    AND ap.allow_client_view = true
    AND public.user_has_company_access(auth.uid(), ap.company_id)
));

-- Cliente: inserir comentários como autor próprio quando ação visível
CREATE POLICY "Action plan comments client insert"
ON public.action_plan_comments
FOR INSERT
TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.action_plans ap
    WHERE ap.id = action_plan_comments.action_plan_id
      AND ap.allow_client_view = true
      AND public.user_has_company_access(auth.uid(), ap.company_id)
  )
);

CREATE INDEX idx_action_plan_comments_plan ON public.action_plan_comments(action_plan_id);
