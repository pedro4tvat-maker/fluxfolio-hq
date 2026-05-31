CREATE OR REPLACE FUNCTION public.seed_default_cost_centers(_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.cost_centers (company_id, nome, kpi_classification) VALUES
    (_company_id, 'RECEITA (VENDAS)',     'Receita Bruta'),
    (_company_id, 'DEDUÇÕES E IMPOSTOS',  'Impostos'),
    (_company_id, 'CUSTOS VARIÁVEIS',     'Custos Variáveis'),
    (_company_id, 'CUSTOS FIXOS',          'Custos Fixos'),
    (_company_id, 'DESPESAS OPERACIONAIS', 'Despesas Operacionais'),
    (_company_id, 'DESPESAS FINANCEIRAS',  'Despesas Financeiras')
  ON CONFLICT DO NOTHING;
END $function$;

-- Rename existing seeded centers to match the canonical names
UPDATE public.cost_centers SET nome = 'RECEITA (VENDAS)'      WHERE nome = 'VENDAS'                AND kpi_classification = 'Receita Bruta';
UPDATE public.cost_centers SET nome = 'DEDUÇÕES E IMPOSTOS'   WHERE nome = 'DEDUÇÕES / IMPOSTOS'   AND kpi_classification = 'Impostos';
