
-- gen_invite_code é interno (chamado apenas pela trigger), bloqueia execução externa
REVOKE EXECUTE ON FUNCTION public.gen_invite_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gen_invite_code(text) TO service_role;

-- search_consultants e find_consultant_by_code são intencionalmente públicas:
-- usadas no fluxo de signup (anon) e por clientes autenticados procurando consultor.
-- Apenas dados não sensíveis são retornados.
GRANT EXECUTE ON FUNCTION public.search_consultants(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO anon, authenticated;
