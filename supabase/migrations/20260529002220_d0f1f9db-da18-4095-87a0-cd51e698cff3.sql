
-- 1. Fix function search_path for tg_set_updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END
$function$;

-- 2. Revoke EXECUTE from anon/public on SECURITY DEFINER functions that should not be callable via API.
-- Helper functions used by RLS need to stay executable by authenticated.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_consultant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) FROM PUBLIC, anon;

-- Trigger / privileged functions: revoke from everyone (triggers still run as definer).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_payable_transaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_on_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_demo_data(uuid) FROM PUBLIC, anon, authenticated;

-- 3. Restrict consultant update/delete on companies: only companies they own or are members of.
DROP POLICY IF EXISTS "Consultants update companies" ON public.companies;
DROP POLICY IF EXISTS "Consultants delete companies" ON public.companies;

CREATE POLICY "Consultants update assigned companies"
ON public.companies
FOR UPDATE
TO authenticated
USING (public.is_consultant(auth.uid()) AND public.user_has_company_access(auth.uid(), id))
WITH CHECK (public.is_consultant(auth.uid()) AND public.user_has_company_access(auth.uid(), id));

CREATE POLICY "Consultants delete assigned companies"
ON public.companies
FOR DELETE
TO authenticated
USING (public.is_consultant(auth.uid()) AND public.user_has_company_access(auth.uid(), id));

-- 4. Prevent privilege escalation on user_roles: explicit restrictive policies denying writes from authenticated/anon.
CREATE POLICY "No client inserts on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "No client updates on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "No client deletes on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated, anon
USING (false);
