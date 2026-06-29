
-- 1) Tabela de logs de backup
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date     date NOT NULL DEFAULT CURRENT_DATE,
  company_id      uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','completed','failed','partial')),
  file_path       text,
  bucket_name     text DEFAULT 'system-backups',
  tables_exported jsonb DEFAULT '[]'::jsonb,
  total_files     int DEFAULT 0,
  total_rows      bigint DEFAULT 0,
  error_message   text,
  created_by      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_company ON public.backup_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_date ON public.backup_logs(backup_date DESC);

GRANT SELECT ON public.backup_logs TO authenticated;
GRANT ALL ON public.backup_logs TO service_role;

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company owners and members can view their backups"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = backup_logs.company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = backup_logs.company_id AND m.user_id = auth.uid())
  );

-- 2) Storage policies para bucket system-backups
-- Caminho esperado: {company_id}/{YYYY-MM-DD}/{table}.csv
CREATE POLICY "Owners read their company backup files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'system-backups'
    AND public.attachment_company_from_path(name) IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );
