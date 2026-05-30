
-- Helper function: seeds the default DRE-aligned cost centers for a company
CREATE OR REPLACE FUNCTION public.seed_default_cost_centers(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cost_centers (company_id, nome, kpi_classification) VALUES
    (_company_id, 'VENDAS',                'Receita Bruta'),
    (_company_id, 'DEDUÇÕES / IMPOSTOS',  'Impostos'),
    (_company_id, 'CUSTOS VARIÁVEIS',     'Custos Variáveis'),
    (_company_id, 'CUSTOS FIXOS',          'Custos Fixos'),
    (_company_id, 'DESPESAS OPERACIONAIS', 'Despesas Operacionais'),
    (_company_id, 'DESPESAS FINANCEIRAS',  'Despesas Financeiras')
  ON CONFLICT DO NOTHING;
END $$;

-- Trigger: every newly-created company gets the default cost centers
CREATE OR REPLACE FUNCTION public.tg_seed_company_cost_centers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_cost_centers(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_seed_company_cost_centers ON public.companies;
CREATE TRIGGER trg_seed_company_cost_centers
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.tg_seed_company_cost_centers();

-- Backfill: companies that currently have no cost centers get the defaults
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT co.id FROM public.companies co
    WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers cc WHERE cc.company_id = co.id)
  LOOP
    PERFORM public.seed_default_cost_centers(c.id);
  END LOOP;
END $$;
