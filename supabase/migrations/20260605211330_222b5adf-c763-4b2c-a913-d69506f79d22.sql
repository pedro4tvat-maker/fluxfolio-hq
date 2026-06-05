CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.consultant_company_links l
      JOIN public.consultants c ON c.id = l.consultant_id
      WHERE l.company_id = _company_id
        AND c.user_id = _user_id
        AND l.status = 'approved'
    )
$$;