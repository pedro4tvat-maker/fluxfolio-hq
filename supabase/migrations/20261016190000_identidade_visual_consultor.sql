-- Identidade visual do consultor (logo e cores) usada nas atas em PDF.

ALTER TABLE public.consultants
  ADD COLUMN IF NOT EXISTS brand_primary text NOT NULL DEFAULT '#6B6D3C',
  ADD COLUMN IF NOT EXISTS brand_dark text NOT NULL DEFAULT '#4A4B29',
  ADD COLUMN IF NOT EXISTS brand_light text NOT NULL DEFAULT '#EEEFE3';

ALTER TABLE public.consultants DROP CONSTRAINT IF EXISTS consultants_brand_colors_hex;
ALTER TABLE public.consultants ADD CONSTRAINT consultants_brand_colors_hex CHECK (
  brand_primary ~ '^#[0-9a-fA-F]{6}$' AND brand_dark ~ '^#[0-9a-fA-F]{6}$' AND brand_light ~ '^#[0-9a-fA-F]{6}$'
);

-- Logos ficam num bucket público (só imagens, até 2 MB), cada consultor na pasta do próprio usuário.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('branding', 'branding', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Branding upload own folder" ON storage.objects;
CREATE POLICY "Branding upload own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Branding update own folder" ON storage.objects;
CREATE POLICY "Branding update own folder" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Branding delete own folder" ON storage.objects;
CREATE POLICY "Branding delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND (storage.foldername(name))[1] = auth.uid()::text);

-- O cliente que abre uma ata compartilhada precisa da marca do consultor, mas não
-- pode ler a linha inteira de consultants. Esta função devolve só a identidade visual
-- de um consultor vinculado (aprovado) a uma empresa que o usuário acessa.
CREATE OR REPLACE FUNCTION public.consultant_branding(_consultant_id uuid)
RETURNS TABLE (consultancy_name text, logo_url text, brand_primary text, brand_dark text, brand_light text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.consultancy_name, c.logo_url, c.brand_primary, c.brand_dark, c.brand_light
  FROM public.consultants c
  WHERE c.id = _consultant_id
    AND (
      c.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.consultant_company_links l
        WHERE l.consultant_id = c.id
          AND l.status = 'approved'
          AND auth_helpers.user_has_company_access(auth.uid(), l.company_id)
      )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.consultant_branding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultant_branding(uuid) TO authenticated;
