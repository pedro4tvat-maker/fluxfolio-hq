-- Defense in depth: only the owning consultant may flip client-visibility flags.
CREATE OR REPLACE FUNCTION public.tg_guard_client_visibility_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_consultant boolean;
  flag_changed boolean := false;
BEGIN
  IF TG_TABLE_NAME = 'company_journeys' THEN
    flag_changed := NEW.allow_client_view IS DISTINCT FROM OLD.allow_client_view;
  ELSIF TG_TABLE_NAME = 'financial_diagnostics' THEN
    flag_changed := NEW.allow_client_view IS DISTINCT FROM OLD.allow_client_view;
  ELSIF TG_TABLE_NAME = 'meeting_minutes' THEN
    flag_changed := NEW.shared_with_client IS DISTINCT FROM OLD.shared_with_client;
  ELSIF TG_TABLE_NAME = 'generated_documents' THEN
    flag_changed := NEW.shared_with_client IS DISTINCT FROM OLD.shared_with_client;
  END IF;

  IF NOT flag_changed THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.consultants c
    WHERE c.id = NEW.consultant_id AND c.user_id = auth.uid()
  ) INTO is_consultant;

  IF NOT is_consultant THEN
    RAISE EXCEPTION 'Only the owning consultant can change client visibility' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_guard_client_visibility_flags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_flags_company_journeys ON public.company_journeys;
CREATE TRIGGER trg_guard_flags_company_journeys
BEFORE UPDATE ON public.company_journeys
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_client_visibility_flags();

DROP TRIGGER IF EXISTS trg_guard_flags_financial_diagnostics ON public.financial_diagnostics;
CREATE TRIGGER trg_guard_flags_financial_diagnostics
BEFORE UPDATE ON public.financial_diagnostics
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_client_visibility_flags();

DROP TRIGGER IF EXISTS trg_guard_flags_meeting_minutes ON public.meeting_minutes;
CREATE TRIGGER trg_guard_flags_meeting_minutes
BEFORE UPDATE ON public.meeting_minutes
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_client_visibility_flags();

DROP TRIGGER IF EXISTS trg_guard_flags_generated_documents ON public.generated_documents;
CREATE TRIGGER trg_guard_flags_generated_documents
BEFORE UPDATE ON public.generated_documents
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_client_visibility_flags();