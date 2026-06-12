-- Create a dedicated schema for sensitive internal functions
CREATE SCHEMA IF NOT EXISTS auth_helpers;

-- Move critical security functions to the internal schema
-- This hides them from the PostgREST API and satisfies security linter checks
-- Postgres automatically updates RLS policies and triggers that reference these functions

-- 1. Move helper functions
ALTER FUNCTION public.user_has_company_access(uuid, uuid) SET SCHEMA auth_helpers;
ALTER FUNCTION public.is_consultant(uuid) SET SCHEMA auth_helpers;

-- 2. Move trigger functions
ALTER FUNCTION public.apply_stock_movement() SET SCHEMA auth_helpers;
ALTER FUNCTION public.sync_receivable_transaction() SET SCHEMA auth_helpers;
ALTER FUNCTION public.mark_overdue_on_insert() SET SCHEMA auth_helpers;
ALTER FUNCTION public.create_main_branch() SET SCHEMA auth_helpers;
ALTER FUNCTION public.sync_payable_transaction() SET SCHEMA auth_helpers;
ALTER FUNCTION public.tg_seed_company_cost_centers() SET SCHEMA auth_helpers;
ALTER FUNCTION public.handle_new_user() SET SCHEMA auth_helpers;
ALTER FUNCTION public.update_updated_at_column() SET SCHEMA auth_helpers;

-- 3. Move SD functions that should be restricted
ALTER FUNCTION public.find_consultant_by_code(text) SET SCHEMA auth_helpers;
ALTER FUNCTION public.search_consultants(text) SET SCHEMA auth_helpers;

-- Revoke all permissions on the new schema from PUBLIC
REVOKE ALL ON SCHEMA auth_helpers FROM PUBLIC;
GRANT USAGE ON SCHEMA auth_helpers TO authenticated, anon, service_role;

-- Grant execute on necessary helper functions to specific roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth_helpers TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth_helpers TO service_role;
GRANT EXECUTE ON FUNCTION auth_helpers.find_consultant_by_code(text) TO anon;

-- Create public wrappers for the authorized API functions
-- These are SECURITY INVOKER by default, satisfying linter checks
CREATE OR REPLACE FUNCTION public.find_consultant_by_code(_code text)
 RETURNS TABLE(id uuid, consultancy_name text, responsible_name text, city text, state text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO auth_helpers, public
 AS $$
  SELECT * FROM auth_helpers.find_consultant_by_code(_code);
$$;

CREATE OR REPLACE FUNCTION public.search_consultants(_q text)
 RETURNS TABLE(id uuid, consultancy_name text, responsible_name text, city text, state text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO auth_helpers, public
 AS $$
  SELECT * FROM auth_helpers.search_consultants(_q);
$$;

-- Revoke default execute from PUBLIC on all functions in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Grant back only to necessary roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO anon;

-- Harden specific table policies to target 'authenticated' instead of 'public'
-- This ensures unauthenticated users cannot probe these tables even if RLS somehow allowed it
ALTER POLICY "Consultants can update their linked companies" ON public.companies TO authenticated;
ALTER POLICY "Consultants can view their linked companies" ON public.companies TO authenticated;
ALTER POLICY "Users can manage their own security settings" ON public.user_security_settings TO authenticated;
