-- 1. Permitir leitura de versões de templates
CREATE POLICY "Template versions viewable by everyone" ON public.consultant_library_template_versions
FOR SELECT TO authenticated USING (true);

-- 2. Permitir que consultores vejam perfis de seus clientes
-- Primeiro removemos a antiga para evitar conflitos
DROP POLICY IF EXISTS "Profiles viewable by self" ON public.profiles;

CREATE POLICY "Profiles viewable by owner or consultant" ON public.profiles
FOR SELECT TO authenticated 
USING (
    auth.uid() = id
    OR 
    EXISTS (
      SELECT 1 FROM public.consultants c
      JOIN public.companies comp ON comp.consultant_id = c.id
      JOIN public.company_members cm ON cm.company_id = comp.id
      WHERE c.user_id = auth.uid() AND cm.user_id = profiles.id
    )
);

-- 3. Melhoria na segurança de storage (Exemplo de política para bucket 'attachments')
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'attachments') THEN
        DROP POLICY IF EXISTS "Enforce secure path convention" ON storage.objects;
        
        CREATE POLICY "Enforce secure path convention" ON storage.objects
        FOR ALL TO authenticated
        USING (
            (storage.foldername(name))[1] = auth.uid()::text
            OR
            EXISTS (
                SELECT 1 FROM public.companies comp
                WHERE comp.id::text = (storage.foldername(name))[1]
                AND public.user_has_company_access(auth.uid(), comp.id)
            )
        );
    END IF;
END $$;
