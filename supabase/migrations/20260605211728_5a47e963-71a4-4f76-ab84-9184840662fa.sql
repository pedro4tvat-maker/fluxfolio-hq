-- 1) Tighten company_members INSERT: require consultant access to the target company
DROP POLICY IF EXISTS "Members insert" ON public.company_members;
CREATE POLICY "Members insert" ON public.company_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_consultant(auth.uid())
  AND public.user_has_company_access(auth.uid(), company_id)
);

-- 2) Drop overly broad ALL policy on financial_diagnostics.
-- The remaining policies already cover the legitimate cases:
--  * "Diagnostics consultant manage" (ALL) — consultant who owns the record
--  * "Diagnostics client view finalized" (SELECT) — client read-only on finalized
DROP POLICY IF EXISTS "Consultants can manage their own diagnostics" ON public.financial_diagnostics;