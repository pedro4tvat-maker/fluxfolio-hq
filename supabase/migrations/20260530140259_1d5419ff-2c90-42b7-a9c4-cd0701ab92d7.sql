REVOKE EXECUTE ON FUNCTION public.find_consultant_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_consultants(text) FROM PUBLIC;
-- Keep explicit grants for anon (used pre-auth during signup) and authenticated
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_consultants(text) TO anon, authenticated;