
-- ============================================================
-- Gerador de Documentos Profissionais — Biblioteca do Consultor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.generated_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL,
  company_id UUID,
  branch_id UUID,
  template_id UUID,
  document_type TEXT NOT NULL,
  title TEXT NOT NULL,
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_content TEXT,
  final_content TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho',
  shared_with_client BOOLEAN NOT NULL DEFAULT false,
  signature_status TEXT NOT NULL DEFAULT 'nao_enviado',
  pdf_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalized_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_documents TO authenticated;
GRANT ALL ON public.generated_documents TO service_role;

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Generated docs consultant manage"
ON public.generated_documents FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = generated_documents.consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = generated_documents.consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Generated docs client view shared"
ON public.generated_documents FOR SELECT TO authenticated
USING (shared_with_client = true AND company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER tg_generated_documents_updated
BEFORE UPDATE ON public.generated_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_gendocs_consultant ON public.generated_documents(consultant_id);
CREATE INDEX idx_gendocs_company ON public.generated_documents(company_id);
CREATE INDEX idx_gendocs_type ON public.generated_documents(document_type);

-- versions
CREATE TABLE IF NOT EXISTS public.generated_document_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  content_snapshot TEXT,
  form_data_snapshot JSONB,
  changed_by UUID,
  change_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_document_versions TO authenticated;
GRANT ALL ON public.generated_document_versions TO service_role;

ALTER TABLE public.generated_document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Generated doc versions consultant manage"
ON public.generated_document_versions FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.generated_documents d
  JOIN public.consultants c ON c.id = d.consultant_id
  WHERE d.id = generated_document_versions.document_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.generated_documents d
  JOIN public.consultants c ON c.id = d.consultant_id
  WHERE d.id = generated_document_versions.document_id AND c.user_id = auth.uid()
));

-- attachments
CREATE TABLE IF NOT EXISTS public.generated_document_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.generated_documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_document_attachments TO authenticated;
GRANT ALL ON public.generated_document_attachments TO service_role;

ALTER TABLE public.generated_document_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Generated doc attachments consultant manage"
ON public.generated_document_attachments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.generated_documents d
  JOIN public.consultants c ON c.id = d.consultant_id
  WHERE d.id = generated_document_attachments.document_id AND c.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.generated_documents d
  JOIN public.consultants c ON c.id = d.consultant_id
  WHERE d.id = generated_document_attachments.document_id AND c.user_id = auth.uid()
));

CREATE POLICY "Generated doc attachments client view shared"
ON public.generated_document_attachments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.generated_documents d
  WHERE d.id = generated_document_attachments.document_id
    AND d.shared_with_client = true
    AND d.company_id IS NOT NULL
    AND public.user_has_company_access(auth.uid(), d.company_id)
));

-- Extend templates with schema_fields for type-specific forms
ALTER TABLE public.consultant_library_templates
  ADD COLUMN IF NOT EXISTS schema_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
