-- O upload da logo (Storage) precisa de permissão de leitura na própria pasta;
-- sem ela o Supabase recusa com "new row violates row-level security policy".
DROP POLICY IF EXISTS "Branding read own folder" ON storage.objects;
CREATE POLICY "Branding read own folder" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);
