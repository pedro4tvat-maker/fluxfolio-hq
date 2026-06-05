-- Hardening remaining functions
ALTER FUNCTION public.seed_default_cost_centers(UUID) SECURITY INVOKER;

-- Explicitly revoke from authenticated to satisfy linter if logic is internal
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_main_branch() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seed_company_cost_centers() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_transaction() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_payable_transaction() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_on_insert() FROM authenticated;
