DROP POLICY IF EXISTS "Consultants can view their linked companies" ON public.companies;
DROP POLICY IF EXISTS "Consultants can update their linked companies" ON public.companies;
CREATE POLICY "Owner or linked consultant can update company"
ON public.companies FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR auth_helpers.user_has_company_access(auth.uid(), id))
WITH CHECK (owner_id = auth.uid() OR auth_helpers.user_has_company_access(auth.uid(), id));