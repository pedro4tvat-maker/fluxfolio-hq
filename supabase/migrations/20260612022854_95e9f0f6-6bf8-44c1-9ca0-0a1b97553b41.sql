-- Grant USAGE and EXECUTE permissions to system roles for the auth_helpers schema
-- This ensures triggers (like the one on auth.users for new user handling) continue to work
GRANT USAGE ON SCHEMA auth_helpers TO postgres, supabase_auth_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth_helpers TO postgres, supabase_auth_admin;
