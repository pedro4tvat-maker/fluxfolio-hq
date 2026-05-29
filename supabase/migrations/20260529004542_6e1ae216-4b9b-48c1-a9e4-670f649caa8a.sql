
-- 1) Classificação financeira nas categorias
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS kpi_classification text;

-- 2) Tabela de ações para ROI
CREATE TABLE IF NOT EXISTS public.kpi_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid,
  nome text NOT NULL,
  tipo text,
  valor_investido numeric NOT NULL DEFAULT 0,
  retorno_obtido numeric NOT NULL DEFAULT 0,
  data_inicio date,
  data_fim date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_actions TO authenticated;
GRANT ALL ON public.kpi_actions TO service_role;

ALTER TABLE public.kpi_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "KPI actions select"
  ON public.kpi_actions FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "KPI actions write"
  ON public.kpi_actions FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER kpi_actions_set_updated_at
  BEFORE UPDATE ON public.kpi_actions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3) Premissas manuais por empresa (depreciação, amortização, novos clientes, LTV)
CREATE TABLE IF NOT EXISTS public.kpi_assumptions (
  company_id uuid PRIMARY KEY,
  depreciacao numeric NOT NULL DEFAULT 0,
  amortizacao numeric NOT NULL DEFAULT 0,
  novos_clientes integer NOT NULL DEFAULT 0,
  compras_medias_cliente numeric NOT NULL DEFAULT 0,
  tempo_medio_meses numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_assumptions TO authenticated;
GRANT ALL ON public.kpi_assumptions TO service_role;

ALTER TABLE public.kpi_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "KPI assumptions select"
  ON public.kpi_assumptions FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "KPI assumptions write"
  ON public.kpi_assumptions FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER kpi_assumptions_set_updated_at
  BEFORE UPDATE ON public.kpi_assumptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
