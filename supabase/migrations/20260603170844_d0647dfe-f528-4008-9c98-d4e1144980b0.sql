
-- 1) Restrict company_members DELETE to consultants with access to that company
DROP POLICY IF EXISTS "Members delete" ON public.company_members;
CREATE POLICY "Members delete"
ON public.company_members
FOR DELETE
TO authenticated
USING (
  public.is_consultant(auth.uid())
  AND public.user_has_company_access(auth.uid(), company_id)
);

-- 2) Revoke EXECUTE from anon (and PUBLIC) on SECURITY DEFINER functions
--    that should not be callable by unauthenticated visitors.
REVOKE EXECUTE ON FUNCTION public.is_consultant(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_transaction() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_payable_transaction() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_demo_data(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.find_consultant_by_code(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_on_insert() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_main_branch() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.search_consultants(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_default_cost_centers(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tg_seed_company_cost_centers() FROM PUBLIC, anon;
