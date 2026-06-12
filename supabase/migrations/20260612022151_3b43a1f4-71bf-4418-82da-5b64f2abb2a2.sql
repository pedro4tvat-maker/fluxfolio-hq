-- ALERTA 1: consultant_library_template_versions
DROP POLICY IF EXISTS "Allow authenticated users to view template versions" ON public.consultant_library_template_versions;
DROP POLICY IF EXISTS "Template versions viewable by everyone" ON public.consultant_library_template_versions;

CREATE POLICY "Template versions viewable by template owner" 
ON public.consultant_library_template_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consultant_library_templates t
    JOIN public.consultants c ON c.id = t.consultant_id
    WHERE t.id = public.consultant_library_template_versions.template_id
    AND c.user_id = auth.uid()
  )
);

-- ALERTA 2 & 6: consultants e invite_code
DROP POLICY IF EXISTS "Allow anon to view active consultants" ON public.consultants;
DROP POLICY IF EXISTS "Allow authenticated to view active consultants" ON public.consultants;

-- ALERTA 2, 5 & 6: Funções de busca seguras
-- Precisamos dropar antes de recriar devido à mudança na assinatura (OUT parameters)
DROP FUNCTION IF EXISTS public.find_consultant_by_code(text);
CREATE OR REPLACE FUNCTION public.find_consultant_by_code(_code text)
 RETURNS TABLE(id uuid, consultancy_name text, responsible_name text, city text, state text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, consultancy_name, responsible_name, city, state
  FROM public.consultants
  WHERE invite_code = UPPER(TRIM(_code)) AND is_active = true
  LIMIT 1;
$function$;

DROP FUNCTION IF EXISTS public.search_consultants(text);
CREATE OR REPLACE FUNCTION public.search_consultants(_q text)
 RETURNS TABLE(id uuid, consultancy_name text, responsible_name text, city text, state text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, consultancy_name, responsible_name, city, state
  FROM public.consultants
  WHERE is_active = true
    AND (
      _q IS NULL OR length(trim(_q)) >= 3
      AND (
        consultancy_name ILIKE '%' || _q || '%'
        OR responsible_name ILIKE '%' || _q || '%'
      )
    )
  ORDER BY consultancy_name
  LIMIT 10;
$function$;

-- ALERTA 3 & 4: consultancy_journey_templates e checklist
DROP POLICY IF EXISTS "journey templates consultant manage" ON public.consultancy_journey_templates;
CREATE POLICY "journey templates owner manage" 
ON public.consultancy_journey_templates
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "journey template checklist consultant manage" ON public.consultancy_journey_template_checklist;
CREATE POLICY "journey checklist owner manage" 
ON public.consultancy_journey_template_checklist
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.consultancy_journey_template_phases p
    JOIN public.consultancy_journey_templates t ON t.id = p.template_id
    JOIN public.consultants c ON c.id = t.consultant_id
    WHERE p.id = template_phase_id AND c.user_id = auth.uid()
  )
);

-- ALERTA 5: SECURITY DEFINER functions (Revogação de acesso público)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seed_company_cost_centers() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_main_branch() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_on_insert() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_payable_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_receivable_transaction() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_movement() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_consultants(text) TO anon, authenticated;

-- ALERTA 7: profiles
DROP POLICY IF EXISTS "Profiles viewable by owner or consultant" ON public.profiles;
CREATE POLICY "Profiles viewable by self or linked consultant" 
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id)
  OR 
  (EXISTS (
    SELECT 1 FROM public.consultants c
    JOIN public.companies comp ON comp.consultant_id = c.id
    JOIN public.company_members cm ON cm.company_id = comp.id
    WHERE c.user_id = auth.uid() AND cm.user_id = public.profiles.id
  ))
);
