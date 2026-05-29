
CREATE TABLE public.consultant_library_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outros',
  template_type TEXT NOT NULL DEFAULT 'documento',
  description TEXT,
  content TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  visibility TEXT NOT NULL DEFAULT 'privado',
  file_url TEXT,
  created_by UUID,
  is_default BOOLEAN NOT NULL DEFAULT false,
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_library_templates TO authenticated;
GRANT ALL ON public.consultant_library_templates TO service_role;

ALTER TABLE public.consultant_library_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Library templates consultant manage"
ON public.consultant_library_templates
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE INDEX idx_lib_templates_consultant ON public.consultant_library_templates(consultant_id);
CREATE INDEX idx_lib_templates_category ON public.consultant_library_templates(category);

CREATE TRIGGER trg_lib_templates_updated_at
BEFORE UPDATE ON public.consultant_library_templates
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

---

CREATE TABLE public.consultant_library_template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.consultant_library_templates(id) ON DELETE CASCADE,
  consultant_id UUID NOT NULL,
  company_id UUID,
  branch_id UUID,
  related_module TEXT,
  related_record_id UUID,
  period TEXT,
  generated_title TEXT NOT NULL,
  generated_content TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  shared_with_client BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_library_template_usage TO authenticated;
GRANT ALL ON public.consultant_library_template_usage TO service_role;

ALTER TABLE public.consultant_library_template_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Library usage consultant manage"
ON public.consultant_library_template_usage
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Library usage client view shared"
ON public.consultant_library_template_usage
FOR SELECT TO authenticated
USING (shared_with_client = true AND company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id));

CREATE INDEX idx_lib_usage_template ON public.consultant_library_template_usage(template_id);
CREATE INDEX idx_lib_usage_company ON public.consultant_library_template_usage(company_id);

CREATE TRIGGER trg_lib_usage_updated_at
BEFORE UPDATE ON public.consultant_library_template_usage
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

---

CREATE TABLE public.consultant_library_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.consultant_library_templates(id) ON DELETE CASCADE,
  content_snapshot TEXT,
  changed_by UUID,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_library_template_versions TO authenticated;
GRANT ALL ON public.consultant_library_template_versions TO service_role;

ALTER TABLE public.consultant_library_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Library versions consultant manage"
ON public.consultant_library_template_versions
FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.consultant_library_templates t
  JOIN public.consultants c ON c.id = t.consultant_id
  WHERE t.id = template_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.consultant_library_templates t
  JOIN public.consultants c ON c.id = t.consultant_id
  WHERE t.id = template_id AND c.user_id = auth.uid()
));

CREATE INDEX idx_lib_versions_template ON public.consultant_library_template_versions(template_id);
