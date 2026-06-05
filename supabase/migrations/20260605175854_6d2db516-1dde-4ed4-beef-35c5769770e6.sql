-- Finalizing security fixes for SECURITY DEFINER functions
-- Switching to SECURITY INVOKER for functions where possible or revoking public execute.

-- These functions are triggers, they need SECURITY DEFINER but execute should be restricted
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_main_branch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_seed_company_cost_centers() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_transaction() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_payable_transaction() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_on_insert() FROM PUBLIC;

-- seed_demo_data is only for authenticated users, but let's be safe
REVOKE EXECUTE ON FUNCTION public.seed_demo_data(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_demo_data(UUID) TO authenticated;

-- Ensure RLS on all newly created tables
ALTER TABLE IF EXISTS public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.privacy_policy_versions ENABLE ROW LEVEL SECURITY;
