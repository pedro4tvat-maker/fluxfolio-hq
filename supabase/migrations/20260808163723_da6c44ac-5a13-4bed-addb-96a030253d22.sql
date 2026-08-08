-- Backups are written exclusively by the server-side backup routine (service role).
-- Remove client-writable paths derived from client-supplied object names.
DROP POLICY IF EXISTS "system-backups insert by company member" ON storage.objects;
DROP POLICY IF EXISTS "system-backups update by company member" ON storage.objects;

-- Tighten read/delete: path-derived company must match an existing backup record.
DROP POLICY IF EXISTS "Owners read their company backup files" ON storage.objects;
CREATE POLICY "Owners read their company backup files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'system-backups'
  AND EXISTS (
    SELECT 1 FROM public.backup_logs b
    JOIN public.companies c ON c.id = b.company_id
    WHERE b.company_id = public.attachment_company_from_path(storage.objects.name)
      AND b.bucket_name = 'system-backups'
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.company_members m
                   WHERE m.company_id = c.id AND m.user_id = auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "system-backups delete by company owner" ON storage.objects;
CREATE POLICY "system-backups delete by company owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'system-backups'
  AND EXISTS (
    SELECT 1 FROM public.backup_logs b
    JOIN public.companies c ON c.id = b.company_id
    WHERE b.company_id = public.attachment_company_from_path(storage.objects.name)
      AND b.bucket_name = 'system-backups'
      AND c.owner_id = auth.uid()
  )
);