
-- Central de Pendências do Cliente
CREATE TABLE public.client_pending_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  branch_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  pending_type TEXT NOT NULL DEFAULT 'outro',
  requested_by_user_id UUID,
  responsible_user_id UUID,
  responsible_name TEXT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente',
  notes TEXT,
  related_module TEXT,
  related_record_id UUID,
  allow_client_view BOOLEAN NOT NULL DEFAULT true,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_pending_items TO authenticated;
GRANT ALL ON public.client_pending_items TO service_role;

ALTER TABLE public.client_pending_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pending items consultant manage" ON public.client_pending_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Pending items client view" ON public.client_pending_items
  FOR SELECT TO authenticated
  USING (allow_client_view = true AND public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Pending items client update status" ON public.client_pending_items
  FOR UPDATE TO authenticated
  USING (allow_client_view = true AND public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (allow_client_view = true AND public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_client_pending_items_updated
  BEFORE UPDATE ON public.client_pending_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_pending_company ON public.client_pending_items(company_id);
CREATE INDEX idx_pending_consultant ON public.client_pending_items(consultant_id);
CREATE INDEX idx_pending_status ON public.client_pending_items(status);

-- Respostas
CREATE TABLE public.client_pending_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pending_item_id UUID NOT NULL,
  user_id UUID NOT NULL,
  author_name TEXT,
  response_text TEXT,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_pending_responses TO authenticated;
GRANT ALL ON public.client_pending_responses TO service_role;

ALTER TABLE public.client_pending_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pending responses consultant manage" ON public.client_pending_responses
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_pending_items p
    JOIN public.consultants c ON c.id = p.consultant_id
    WHERE p.id = pending_item_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.client_pending_items p
    JOIN public.consultants c ON c.id = p.consultant_id
    WHERE p.id = pending_item_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Pending responses client view" ON public.client_pending_responses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_pending_items p
    WHERE p.id = pending_item_id AND p.allow_client_view = true
      AND public.user_has_company_access(auth.uid(), p.company_id)
  ));

CREATE POLICY "Pending responses client insert" ON public.client_pending_responses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.client_pending_items p
    WHERE p.id = pending_item_id AND p.allow_client_view = true
      AND public.user_has_company_access(auth.uid(), p.company_id)
  ));

-- Jornada da Consultoria
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS consultancy_stage TEXT NOT NULL DEFAULT 'novo_cliente',
  ADD COLUMN IF NOT EXISTS consultancy_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consultancy_status TEXT NOT NULL DEFAULT 'ativo';

CREATE TABLE public.consultancy_stage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID NOT NULL,
  previous_stage TEXT,
  new_stage TEXT NOT NULL,
  changed_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_stage_history TO authenticated;
GRANT ALL ON public.consultancy_stage_history TO service_role;

ALTER TABLE public.consultancy_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Stage history consultant manage" ON public.consultancy_stage_history
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Stage history client view" ON public.consultancy_stage_history
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE INDEX idx_stage_history_company ON public.consultancy_stage_history(company_id);
