-- Revisão de segurança (Security Advisor): na restauração para o banco novo,
-- as permissões de EXECUTE das funções SECURITY DEFINER voltaram ao padrão
-- (liberadas inclusive para quem não está logado). Aqui elas são restringidas.

-- 1) Funções de gatilho (trigger): só o próprio banco as chama; ninguém precisa executá-las.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS assinatura
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.assinatura);
  END LOOP;
END $$;

-- 2) Funções chamadas pelo sistema: só para usuários logados
--    (por dentro elas ainda conferem se o usuário tem acesso à empresa).
REVOKE EXECUTE ON FUNCTION public.apply_os_renumbering(uuid, text, text, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_os_renumbering(uuid, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_os_renumbering(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revert_os_renumbering(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.revert_sales_recovery(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.revert_sales_recovery(uuid) TO authenticated;
