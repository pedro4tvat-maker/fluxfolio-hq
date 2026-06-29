
-- =====================================================================
-- FASE 1: Proteção de dados — auditoria + soft delete (coluna) + diagnóstico
-- Tudo NÃO DESTRUTIVO. Triggers anti-sobrescrita em MODO DIAGNÓSTICO.
-- =====================================================================

-- 1) TABELA audit_log -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name      text NOT NULL,
  record_id       text,
  operation       text NOT NULL CHECK (operation IN ('UPDATE','DELETE','ALERT')),
  company_id      uuid,
  user_id         uuid,
  old_data        jsonb,
  new_data        jsonb,
  changed_fields  jsonb,
  source          text DEFAULT 'trigger',
  alert_reason    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company ON public.audit_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read company audit logs"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL
    OR EXISTS (SELECT 1 FROM public.companies c WHERE c.id = audit_log.company_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = audit_log.company_id AND m.user_id = auth.uid())
  );

-- 2) FUNÇÃO GENÉRICA DE AUDITORIA ------------------------------------
CREATE OR REPLACE FUNCTION public.tg_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_changed jsonb := '{}'::jsonb;
  v_company uuid;
  v_record text;
  k text;
BEGIN
  BEGIN
    IF TG_OP = 'UPDATE' THEN
      v_old := to_jsonb(OLD);
      v_new := to_jsonb(NEW);
      FOR k IN SELECT jsonb_object_keys(v_new) LOOP
        IF v_old->k IS DISTINCT FROM v_new->k THEN
          v_changed := v_changed || jsonb_build_object(k, jsonb_build_object('old', v_old->k, 'new', v_new->k));
        END IF;
      END LOOP;
      IF v_changed = '{}'::jsonb THEN RETURN NEW; END IF;
      v_company := COALESCE((v_new->>'company_id')::uuid, (v_old->>'company_id')::uuid);
      v_record := COALESCE(v_new->>'id', v_old->>'id');
    ELSIF TG_OP = 'DELETE' THEN
      v_old := to_jsonb(OLD);
      v_company := (v_old->>'company_id')::uuid;
      v_record := v_old->>'id';
    END IF;

    INSERT INTO public.audit_log
      (table_name, record_id, operation, company_id, user_id, old_data, new_data, changed_fields, source)
    VALUES
      (TG_TABLE_NAME, v_record, TG_OP, v_company, auth.uid(), v_old, v_new, NULLIF(v_changed,'{}'::jsonb), 'trigger');
  EXCEPTION WHEN OTHERS THEN
    -- Nunca bloquear operação normal por erro de log
    NULL;
  END;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$fn$;

-- 3) ANEXAR AUDITORIA ÀS TABELAS CRÍTICAS ----------------------------
DO $do$
DECLARE
  t text;
  critical_tables text[] := ARRAY[
    'transactions','receivables','sale_items','stock_movements',
    'products','crm_contacts','companies','company_members',
    'profiles','consultants'
  ];
BEGIN
  FOREACH t IN ARRAY critical_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS audit_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER audit_%I AFTER UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tg_audit_log()', t, t);
    END IF;
  END LOOP;
END
$do$;

-- 4) SOFT DELETE: apenas adicionar coluna (não altera queries) -------
DO $do$
DECLARE
  t text;
  soft_tables text[] := ARRAY[
    'transactions','receivables','sale_items','stock_movements','products','crm_contacts'
  ];
BEGIN
  FOREACH t IN ARRAY soft_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t)
       AND NOT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema='public' AND table_name=t AND column_name='deleted_at'
       )
    THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN deleted_at timestamptz', t);
      EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_deleted_at ON public.%I(deleted_at)', t, t);
    END IF;
  END LOOP;
END
$do$;

-- 5) TRIGGER ANTI-SOBRESCRITA EM DESCRICAO (MODO DIAGNÓSTICO) --------
-- Detecta UPDATE perigoso e LOGA em audit_log; NÃO bloqueia.
CREATE OR REPLACE FUNCTION public.tg_descricao_diagnostico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_old text := COALESCE(OLD.descricao, '');
  v_new text := COALESCE(NEW.descricao, '');
  v_reason text;
  v_looks_like_os boolean;
BEGIN
  IF v_old IS NOT DISTINCT FROM v_new THEN RETURN NEW; END IF;
  IF v_old = '' THEN RETURN NEW; END IF;

  -- Padrão "OS #XXXX" / "OS E0010" / só "E0010"
  v_looks_like_os := v_new ~* '^(OS\s*#?\s*)?[A-Z]?\s*\d{3,6}\s*$';

  IF v_looks_like_os AND length(v_old) > 15 THEN
    v_reason := 'Descrição com conteúdo substituída por número de OS';
  ELSIF length(v_new) < length(v_old) / 3 AND length(v_old) > 30 THEN
    v_reason := 'Descrição encurtada drasticamente (>66%)';
  END IF;

  IF v_reason IS NOT NULL THEN
    BEGIN
      INSERT INTO public.audit_log
        (table_name, record_id, operation, company_id, user_id, old_data, new_data, source, alert_reason)
      VALUES
        (TG_TABLE_NAME, NEW.id::text, 'ALERT', NEW.company_id, auth.uid(),
         jsonb_build_object('descricao', v_old),
         jsonb_build_object('descricao', v_new),
         'diagnostico', v_reason);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS descricao_diagnostico_transactions ON public.transactions;
CREATE TRIGGER descricao_diagnostico_transactions
  BEFORE UPDATE OF descricao ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_descricao_diagnostico();

DROP TRIGGER IF EXISTS descricao_diagnostico_receivables ON public.receivables;
CREATE TRIGGER descricao_diagnostico_receivables
  BEFORE UPDATE OF descricao ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.tg_descricao_diagnostico();
