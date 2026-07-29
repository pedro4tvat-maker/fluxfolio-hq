-- 1) Storage: don't rely only on the client-supplied path prefix
DROP POLICY IF EXISTS "Attachments storage select" ON storage.objects;
DROP POLICY IF EXISTS "Attachments storage update" ON storage.objects;
DROP POLICY IF EXISTS "Attachments storage delete" ON storage.objects;
DROP POLICY IF EXISTS "Attachments storage insert" ON storage.objects;

CREATE POLICY "Attachments storage insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'attachments'
  AND owner = auth.uid()
  AND auth_helpers.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
);

CREATE POLICY "Attachments storage select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'attachments'
  AND auth_helpers.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE a.file_path = storage.objects.name
        AND a.company_id = public.attachment_company_from_path(storage.objects.name)
    )
  )
);

CREATE POLICY "Attachments storage update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'attachments'
  AND auth_helpers.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE a.file_path = storage.objects.name
        AND a.company_id = public.attachment_company_from_path(storage.objects.name)
    )
  )
)
WITH CHECK (
  bucket_id = 'attachments'
  AND owner = auth.uid()
  AND auth_helpers.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
);

CREATE POLICY "Attachments storage delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'attachments'
  AND auth_helpers.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.attachments a
      WHERE a.file_path = storage.objects.name
        AND a.company_id = public.attachment_company_from_path(storage.objects.name)
    )
  )
);

-- 2) companies: consultant access requires ownership or an approved link
DROP POLICY IF EXISTS "Consultants can view their linked companies" ON public.companies;
DROP POLICY IF EXISTS "Consultants can update their linked companies" ON public.companies;

CREATE POLICY "Consultants can view their linked companies" ON public.companies
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.consultants c
    JOIN public.consultant_company_links l
      ON l.consultant_id = c.id AND l.company_id = companies.id AND l.status = 'approved'
    WHERE c.user_id = auth.uid() AND c.id = companies.consultant_id
  )
);

CREATE POLICY "Consultants can update their linked companies" ON public.companies
FOR UPDATE TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.consultants c
    JOIN public.consultant_company_links l
      ON l.consultant_id = c.id AND l.company_id = companies.id AND l.status = 'approved'
    WHERE c.user_id = auth.uid() AND c.id = companies.consultant_id
  )
);

-- 3) Only the company owner may change consultant_id
CREATE OR REPLACE FUNCTION public.tg_companies_guard_consultant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.consultant_id IS DISTINCT FROM OLD.consultant_id
     AND OLD.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the company owner can change the assigned consultant'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_companies_guard_consultant_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS companies_guard_consultant_id ON public.companies;
CREATE TRIGGER companies_guard_consultant_id
BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.tg_companies_guard_consultant_id();