
-- Restrict client-side UPDATE on client_pending_items to only the 'status' (and completion_notes) field.
-- Consultants (owners) still have full management via the existing "Pending items consultant manage" policy.
CREATE OR REPLACE FUNCTION public.tg_client_pending_items_restrict_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_owner boolean;
BEGIN
  -- If the caller is the owning consultant, allow any change.
  SELECT EXISTS (
    SELECT 1 FROM public.consultants c
    WHERE c.id = NEW.consultant_id AND c.user_id = auth.uid()
  ) INTO is_owner;

  IF is_owner THEN
    RETURN NEW;
  END IF;

  -- Non-owner (client/company member) may only modify status and completion_notes.
  IF NEW.consultant_id      IS DISTINCT FROM OLD.consultant_id
  OR NEW.company_id         IS DISTINCT FROM OLD.company_id
  OR NEW.branch_id          IS DISTINCT FROM OLD.branch_id
  OR NEW.title              IS DISTINCT FROM OLD.title
  OR NEW.description        IS DISTINCT FROM OLD.description
  OR NEW.priority           IS DISTINCT FROM OLD.priority
  OR NEW.due_date           IS DISTINCT FROM OLD.due_date
  OR NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id
  OR NEW.responsible_name   IS DISTINCT FROM OLD.responsible_name
  OR NEW.allow_client_view  IS DISTINCT FROM OLD.allow_client_view
  OR NEW.allow_client_complete IS DISTINCT FROM OLD.allow_client_complete
  OR NEW.related_module     IS DISTINCT FROM OLD.related_module
  OR NEW.related_record_id  IS DISTINCT FROM OLD.related_record_id
  OR NEW.created_by         IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Clients can only update status of pending items' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_pending_items_restrict_client_update ON public.client_pending_items;
CREATE TRIGGER trg_client_pending_items_restrict_client_update
BEFORE UPDATE ON public.client_pending_items
FOR EACH ROW EXECUTE FUNCTION public.tg_client_pending_items_restrict_client_update();
