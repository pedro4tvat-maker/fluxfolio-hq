
-- Fix security_logs INSERT to authenticated only
DROP POLICY IF EXISTS "System can insert security logs" ON public.security_logs;
CREATE POLICY "Authenticated users insert their security logs"
  ON public.security_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Also tighten SELECT to authenticated
DROP POLICY IF EXISTS "Users can view their own security logs" ON public.security_logs;
CREATE POLICY "Users view their own security logs"
  ON public.security_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Explicit SELECT policy for consultancy_journey_template_checklist
CREATE POLICY "journey checklist owner select"
  ON public.consultancy_journey_template_checklist FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM consultancy_journey_template_phases p
    JOIN consultancy_journey_templates t ON t.id = p.template_id
    JOIN consultants c ON c.id = t.consultant_id
    WHERE p.id = consultancy_journey_template_checklist.template_phase_id
      AND c.user_id = auth.uid()
  ));

-- Explicit SELECT policy for generated_document_versions
CREATE POLICY "Generated doc versions consultant select"
  ON public.generated_document_versions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM generated_documents d
    JOIN consultants c ON c.id = d.consultant_id
    WHERE d.id = generated_document_versions.document_id
      AND c.user_id = auth.uid()
  ));
