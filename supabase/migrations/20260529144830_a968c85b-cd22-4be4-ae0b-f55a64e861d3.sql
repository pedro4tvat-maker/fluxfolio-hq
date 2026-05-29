CREATE TABLE public.consultancy_journey_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL,
  stage_key text NOT NULL,
  label text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  is_terminal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultant_id, stage_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_journey_stages TO authenticated;
GRANT ALL ON public.consultancy_journey_stages TO service_role;

ALTER TABLE public.consultancy_journey_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Journey stages consultant manage"
  ON public.consultancy_journey_stages
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Journey stages client view"
  ON public.consultancy_journey_stages
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultant_company_links l
     WHERE l.consultant_id = consultancy_journey_stages.consultant_id
       AND l.status = 'approved'
       AND public.user_has_company_access(auth.uid(), l.company_id)
  ));

CREATE TRIGGER tg_journey_stages_updated_at
  BEFORE UPDATE ON public.consultancy_journey_stages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_journey_stages_consultant ON public.consultancy_journey_stages(consultant_id, position);