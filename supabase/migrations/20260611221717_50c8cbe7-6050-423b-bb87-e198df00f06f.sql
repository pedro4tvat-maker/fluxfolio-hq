-- Redefinir find_consultant_by_code como SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.find_consultant_by_code(_code text)
 RETURNS TABLE(id uuid, consultancy_name text, responsible_name text, city text, state text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT id, consultancy_name, responsible_name, city, state
  FROM public.consultants
  WHERE invite_code = UPPER(_code) AND is_active = true
  LIMIT 1;
$function$;

-- Redefinir search_consultants como SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.search_consultants(_q text)
 RETURNS TABLE(id uuid, consultancy_name text, responsible_name text, email text, city text, state text, invite_code text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT id, consultancy_name, responsible_name, email, city, state, invite_code
  FROM public.consultants
  WHERE is_active = true
    AND (
      _q IS NULL OR length(trim(_q)) = 0
      OR consultancy_name ILIKE '%' || _q || '%'
      OR responsible_name ILIKE '%' || _q || '%'
      OR email ILIKE _q
      OR invite_code = UPPER(_q)
    )
  ORDER BY consultancy_name
  LIMIT 20;
$function$;

-- Garantir que usuários autenticados possam executar as funções
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_consultants(text) TO authenticated;

-- Adicionar política para permitir SELECT básico na tabela consultants para usuários autenticados
-- Isso é necessário para que as buscas funcionem corretamente e para visualização posterior
CREATE POLICY "Allow authenticated to view active consultants" 
ON public.consultants 
FOR SELECT 
TO authenticated 
USING (is_active = true);
