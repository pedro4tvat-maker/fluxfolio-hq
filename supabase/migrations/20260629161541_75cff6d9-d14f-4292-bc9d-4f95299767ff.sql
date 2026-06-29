-- 1) Log de renumeração de OS
CREATE TABLE public.os_renumbering_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('vista','prazo')),
  source_id uuid NOT NULL,
  old_os_code text,
  new_os_code text NOT NULL,
  stock_location_id uuid,
  stock_location_name text,
  prefix_used text,
  recovery_method text NOT NULL DEFAULT 'os_renumbering',
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz,
  reverted_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.os_renumbering_log TO authenticated;
GRANT ALL ON public.os_renumbering_log TO service_role;

ALTER TABLE public.os_renumbering_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read os renumbering log"
  ON public.os_renumbering_log FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = os_renumbering_log.company_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Members can insert os renumbering log"
  ON public.os_renumbering_log FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = os_renumbering_log.company_id AND m.user_id = auth.uid())
  );

CREATE INDEX ON public.os_renumbering_log (company_id, source_type, source_id);

-- 2) RPC: aplicar renumeração de UMA venda em transação atômica
CREATE OR REPLACE FUNCTION public.apply_os_renumbering(
  _sale_id uuid,
  _sale_type text,
  _new_os_code text,
  _stock_location_id uuid,
  _reason text DEFAULT 'Correção manual de OS'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_old text;
  v_loc_name text;
  v_prefix text;
  v_collision int;
  v_log_id uuid;
BEGIN
  IF _sale_type = 'vista' THEN
    SELECT company_id, os_code INTO v_company_id, v_old FROM public.transactions WHERE id = _sale_id;
  ELSIF _sale_type = 'prazo' THEN
    SELECT company_id, os_code INTO v_company_id, v_old FROM public.receivables WHERE id = _sale_id;
  ELSE
    RAISE EXCEPTION 'sale_type inválido';
  END IF;

  IF v_company_id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = v_company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = v_company_id AND m.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  IF _new_os_code IS NULL OR _new_os_code = '' THEN RAISE EXCEPTION 'Novo os_code vazio'; END IF;

  -- garantir unicidade por empresa (transactions + receivables)
  SELECT count(*) INTO v_collision FROM (
    SELECT 1 FROM public.transactions WHERE company_id=v_company_id AND os_code=_new_os_code AND id<>_sale_id
    UNION ALL
    SELECT 1 FROM public.receivables WHERE company_id=v_company_id AND os_code=_new_os_code AND id<>_sale_id
  ) x;
  IF v_collision > 0 THEN
    RAISE EXCEPTION 'os_code % já existe nesta empresa', _new_os_code;
  END IF;

  IF _stock_location_id IS NOT NULL THEN
    SELECT nome INTO v_loc_name FROM public.stock_locations WHERE id = _stock_location_id;
  END IF;
  v_prefix := UPPER(SUBSTRING(regexp_replace(COALESCE(_new_os_code,''),'[^A-Za-z]','','g'),1,1));

  IF _sale_type = 'vista' THEN
    UPDATE public.transactions SET os_code = _new_os_code WHERE id = _sale_id;
  ELSE
    UPDATE public.receivables SET os_code = _new_os_code WHERE id = _sale_id;
  END IF;

  INSERT INTO public.os_renumbering_log
    (company_id, source_type, source_id, old_os_code, new_os_code,
     stock_location_id, stock_location_name, prefix_used, recovery_method, reason, created_by)
  VALUES
    (v_company_id, _sale_type, _sale_id, v_old, _new_os_code,
     _stock_location_id, v_loc_name, v_prefix, 'os_renumbering', _reason, auth.uid())
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id, 'old_os', v_old, 'new_os', _new_os_code);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_os_renumbering(uuid,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_os_renumbering(uuid,text,text,uuid,text) TO authenticated;

-- 3) RPC: reverter uma entrada do log
CREATE OR REPLACE FUNCTION public.revert_os_renumbering(_log_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_collision int;
BEGIN
  SELECT * INTO r FROM public.os_renumbering_log WHERE id = _log_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Log não encontrado'; END IF;
  IF r.reverted_at IS NOT NULL THEN RAISE EXCEPTION 'Log já revertido'; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.companies c WHERE c.id = r.company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = r.company_id AND m.user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501';
  END IF;

  -- conflito de uniqueness só importa se old_os_code ainda existir em outra venda
  IF r.old_os_code IS NOT NULL THEN
    SELECT count(*) INTO v_collision FROM (
      SELECT 1 FROM public.transactions WHERE company_id=r.company_id AND os_code=r.old_os_code AND id<>r.source_id
      UNION ALL
      SELECT 1 FROM public.receivables WHERE company_id=r.company_id AND os_code=r.old_os_code AND id<>r.source_id
    ) x;
    IF v_collision > 0 THEN
      RAISE EXCEPTION 'Não é possível reverter: os_code % já está em uso por outra venda', r.old_os_code;
    END IF;
  END IF;

  IF r.source_type = 'vista' THEN
    UPDATE public.transactions SET os_code = r.old_os_code WHERE id = r.source_id;
  ELSE
    UPDATE public.receivables SET os_code = r.old_os_code WHERE id = r.source_id;
  END IF;

  UPDATE public.os_renumbering_log SET reverted_at = now(), reverted_by = auth.uid() WHERE id = _log_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revert_os_renumbering(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revert_os_renumbering(uuid) TO authenticated;