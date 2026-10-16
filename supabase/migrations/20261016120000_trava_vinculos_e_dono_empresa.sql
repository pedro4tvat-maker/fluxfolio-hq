-- Correções de segurança (auditoria de 16/10/2026)
--
-- 1) Vínculo consultor <-> empresa: a policy "Consultant updates own links" deixava o
--    consultor editar qualquer coluna do próprio vínculo, inclusive company_id e status.
--    Com isso ele podia apontar o vínculo para outra empresa e se aprovar sozinho.
--    Agora: empresa, consultor e solicitante de um vínculo são imutáveis, e o consultor
--    só pode mudar o status de 'pending' para 'approved' ou 'rejected'.
--
-- 2) Empresa: a policy de update do consultor vinculado permitia trocar owner_id e
--    tomar a empresa do cliente. Agora só o dono atual transfere a empresa.
--
-- Chamadas sem usuário (service_role / SQL editor) continuam liberadas.

CREATE OR REPLACE FUNCTION public.tg_links_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.consultant_id IS DISTINCT FROM OLD.consultant_id
     OR NEW.requested_by IS DISTINCT FROM OLD.requested_by THEN
    RAISE EXCEPTION 'Não é permitido alterar a empresa, o consultor ou o solicitante de um vínculo existente'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = OLD.company_id AND owner_id = auth.uid()
  ) INTO is_owner;

  IF NOT is_owner
     AND NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected')) THEN
    RAISE EXCEPTION 'O consultor só pode aprovar ou recusar solicitações pendentes'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_links_guard_update ON public.consultant_company_links;
CREATE TRIGGER trg_links_guard_update
  BEFORE UPDATE ON public.consultant_company_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_links_guard_update();

CREATE OR REPLACE FUNCTION public.tg_companies_guard_owner_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND OLD.owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o dono atual pode transferir a empresa'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_guard_owner_id ON public.companies;
CREATE TRIGGER trg_companies_guard_owner_id
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.tg_companies_guard_owner_id();

REVOKE EXECUTE ON FUNCTION public.tg_links_guard_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_companies_guard_owner_id() FROM PUBLIC, anon, authenticated;
