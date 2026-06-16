-- Profiles: restrict consultant access to approved links only
DROP POLICY IF EXISTS "Profiles viewable by self or linked consultant" ON public.profiles;

CREATE POLICY "Profiles viewable by self or approved-linked consultant"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1
    FROM public.consultant_company_links l
    JOIN public.consultants c ON c.id = l.consultant_id
    JOIN public.company_members cm ON cm.company_id = l.company_id
    WHERE c.user_id = auth.uid()
      AND cm.user_id = public.profiles.id
      AND l.status = 'approved'
  )
);

-- Storage: drop redundant broad ALL-commands policy
DROP POLICY IF EXISTS "Enforce secure path convention" ON storage.objects;