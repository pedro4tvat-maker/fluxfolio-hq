
CREATE OR REPLACE FUNCTION public.attachment_company_from_path(_name text)
RETURNS UUID
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(split_part(_name, '/', 1), '')::uuid
$$;

REVOKE EXECUTE ON FUNCTION public.attachment_company_from_path(text) FROM PUBLIC, anon;
