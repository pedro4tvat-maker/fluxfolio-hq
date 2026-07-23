
-- Fix tautology in historical_financial_snapshots policies
DROP POLICY IF EXISTS hist_snap_select ON public.historical_financial_snapshots;
DROP POLICY IF EXISTS hist_snap_write ON public.historical_financial_snapshots;

CREATE POLICY hist_snap_select ON public.historical_financial_snapshots
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = historical_financial_snapshots.company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = historical_financial_snapshots.company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshots.company_id AND co.user_id = auth.uid())
);

CREATE POLICY hist_snap_write ON public.historical_financial_snapshots
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = historical_financial_snapshots.company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = historical_financial_snapshots.company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshots.company_id AND co.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = historical_financial_snapshots.company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = historical_financial_snapshots.company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshots.company_id AND co.user_id = auth.uid())
);

-- Fix tautology + open insert on historical_financial_snapshot_versions
DROP POLICY IF EXISTS hist_snap_ver_select ON public.historical_financial_snapshot_versions;
DROP POLICY IF EXISTS hist_snap_ver_insert ON public.historical_financial_snapshot_versions;

CREATE POLICY hist_snap_ver_select ON public.historical_financial_snapshot_versions
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.companies c WHERE c.id = historical_financial_snapshot_versions.company_id AND c.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = historical_financial_snapshot_versions.company_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.consultant_company_links l JOIN public.consultants co ON co.id = l.consultant_id WHERE l.company_id = historical_financial_snapshot_versions.company_id AND co.user_id = auth.uid())
);

-- Versions are written exclusively by the SECURITY DEFINER trigger tg_historical_snapshot_version.
-- Block direct inserts from authenticated clients entirely.
CREATE POLICY hist_snap_ver_no_direct_insert ON public.historical_financial_snapshot_versions
FOR INSERT TO authenticated
WITH CHECK (false);

-- Revoke EXECUTE on trigger functions from anon/public (they're only called by triggers as postgres)
REVOKE EXECUTE ON FUNCTION public.tg_action_plans_restrict_client_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_historical_snapshot_version() FROM PUBLIC, anon, authenticated;
