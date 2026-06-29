-- Adicionar coluna deleted_at + índice para tabelas do Grupo Verde (soft delete)
ALTER TABLE public.meeting_minutes ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.consultancy_activities ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.import_rules ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.consultant_library_templates ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.pricing_records ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.cost_centers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS meeting_minutes_deleted_at_idx ON public.meeting_minutes (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS consultancy_activities_deleted_at_idx ON public.consultancy_activities (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS attachments_deleted_at_idx ON public.attachments (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS import_rules_deleted_at_idx ON public.import_rules (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS consultant_library_templates_deleted_at_idx ON public.consultant_library_templates (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS budgets_deleted_at_idx ON public.budgets (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pricing_records_deleted_at_idx ON public.pricing_records (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS categories_deleted_at_idx ON public.categories (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS cost_centers_deleted_at_idx ON public.cost_centers (deleted_at) WHERE deleted_at IS NULL;