ALTER TABLE public.attachments ALTER COLUMN company_id DROP NOT NULL;

CREATE POLICY "Personal attachments select" ON public.attachments
FOR SELECT TO authenticated
USING (company_id IS NULL AND uploaded_by = auth.uid());

CREATE POLICY "Personal attachments insert" ON public.attachments
FOR INSERT TO authenticated
WITH CHECK (company_id IS NULL AND uploaded_by = auth.uid());

CREATE POLICY "Personal attachments update" ON public.attachments
FOR UPDATE TO authenticated
USING (company_id IS NULL AND uploaded_by = auth.uid())
WITH CHECK (company_id IS NULL AND uploaded_by = auth.uid());

CREATE POLICY "Personal attachments delete" ON public.attachments
FOR DELETE TO authenticated
USING (company_id IS NULL AND uploaded_by = auth.uid());

CREATE POLICY "Personal attachments storage select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'attachments' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Personal attachments storage insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'attachments' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Personal attachments storage update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'attachments' AND split_part(name, '/', 1) = auth.uid()::text)
WITH CHECK (bucket_id = 'attachments' AND split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "Personal attachments storage delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'attachments' AND split_part(name, '/', 1) = auth.uid()::text);