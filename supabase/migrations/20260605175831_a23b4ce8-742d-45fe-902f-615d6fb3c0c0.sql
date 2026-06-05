-- Fixing SECURITY DEFINER functions to use SECURITY INVOKER or setting explicit search_path
-- Note: 'has_role' uses a custom type 'app_role', using correct signature.

ALTER FUNCTION public.is_consultant(UUID) SECURITY INVOKER;
ALTER FUNCTION public.user_has_company_access(UUID, UUID) SECURITY INVOKER;
ALTER FUNCTION public.has_role(UUID, public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.find_consultant_by_code(TEXT) SECURITY INVOKER;
ALTER FUNCTION public.search_consultants(TEXT) SECURITY INVOKER;

-- For functions that remain SECURITY DEFINER, we ensure they have an explicit search_path.
ALTER FUNCTION public.handle_new_user() SET search_path = public, auth;
ALTER FUNCTION public.seed_demo_data(UUID) SET search_path = public;
ALTER FUNCTION public.create_main_branch() SET search_path = public;
ALTER FUNCTION public.tg_seed_company_cost_centers() SET search_path = public;
ALTER FUNCTION public.seed_default_cost_centers(UUID) SET search_path = public;
ALTER FUNCTION public.apply_stock_movement() SET search_path = public;
ALTER FUNCTION public.sync_receivable_transaction() SET search_path = public;
ALTER FUNCTION public.sync_payable_transaction() SET search_path = public;
ALTER FUNCTION public.mark_overdue_on_insert() SET search_path = public;

-- Table for privacy policy versions
CREATE TABLE IF NOT EXISTS public.privacy_policy_versions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    version_text TEXT NOT NULL,
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.privacy_policy_versions TO anon, authenticated;
GRANT ALL ON public.privacy_policy_versions TO service_role;

ALTER TABLE public.privacy_policy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view privacy policy versions" ON public.privacy_policy_versions FOR SELECT USING (true);
