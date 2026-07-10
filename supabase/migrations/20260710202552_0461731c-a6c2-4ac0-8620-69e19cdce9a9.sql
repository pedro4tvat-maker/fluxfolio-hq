
-- 1) Restrict client updates on action_plans to status/completion fields only
CREATE OR REPLACE FUNCTION public.tg_action_plans_restrict_client_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = NEW.company_id AND c.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.company_members m
    WHERE m.company_id = NEW.company_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin','consultant')
  ) INTO is_owner;

  IF is_owner THEN
    RETURN NEW;
  END IF;

  IF NEW.company_id           IS DISTINCT FROM OLD.company_id
  OR NEW.branch_id            IS DISTINCT FROM OLD.branch_id
  OR NEW.titulo               IS DISTINCT FROM OLD.titulo
  OR NEW.descricao            IS DISTINCT FROM OLD.descricao
  OR NEW.prioridade           IS DISTINCT FROM OLD.prioridade
  OR NEW.due_date             IS DISTINCT FROM OLD.due_date
  OR NEW.responsible_user_id  IS DISTINCT FROM OLD.responsible_user_id
  OR NEW.responsavel          IS DISTINCT FROM OLD.responsavel
  OR NEW.allow_client_view    IS DISTINCT FROM OLD.allow_client_view
  OR NEW.allow_client_complete IS DISTINCT FROM OLD.allow_client_complete
  OR NEW.consultant_id        IS DISTINCT FROM OLD.consultant_id
  OR NEW.created_by           IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'Clients can only update status/completion fields on action plans' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_plans_restrict_client_update ON public.action_plans;
CREATE TRIGGER trg_action_plans_restrict_client_update
BEFORE UPDATE ON public.action_plans
FOR EACH ROW EXECUTE FUNCTION public.tg_action_plans_restrict_client_update();

-- 2) Storage policies for system-backups bucket (INSERT/UPDATE/DELETE scoped by company ownership)
CREATE POLICY "system-backups insert by company member"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'system-backups'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = public.attachment_company_from_path(name)
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = c.id AND m.user_id = auth.uid())
      )
  )
);

CREATE POLICY "system-backups update by company member"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'system-backups'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = public.attachment_company_from_path(name)
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = c.id AND m.user_id = auth.uid())
      )
  )
)
WITH CHECK (
  bucket_id = 'system-backups'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = public.attachment_company_from_path(name)
      AND (
        c.owner_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = c.id AND m.user_id = auth.uid())
      )
  )
);

CREATE POLICY "system-backups delete by company owner"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'system-backups'
  AND EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = public.attachment_company_from_path(name)
      AND c.owner_id = auth.uid()
  )
);
