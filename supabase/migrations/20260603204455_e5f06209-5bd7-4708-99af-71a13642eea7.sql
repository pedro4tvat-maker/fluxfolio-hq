-- 1. Categorias: campos para classificação automática na DRE
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS is_deduction BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_fixed_cost BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_variable_cost BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_financial_expense BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.categories.is_deduction IS 'Define se a categoria entra como dedução da receita bruta na DRE';
COMMENT ON COLUMN public.categories.is_fixed_cost IS 'Define se a categoria entra como custo/despesa fixa na DRE';
COMMENT ON COLUMN public.categories.is_variable_cost IS 'Define se a categoria entra como custo variável (CMV/Serviços) na DRE';
COMMENT ON COLUMN public.categories.is_financial_expense IS 'Define se a categoria entra como despesa financeira/juros na DRE';

-- 2. Centro de Custo em Produtos
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- 3. Centro de Custo em Recebíveis (já existe em payables e transactions, mas garantir consistência)
ALTER TABLE public.receivables 
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL;

-- 4. Garantir permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.receivables TO service_role;
