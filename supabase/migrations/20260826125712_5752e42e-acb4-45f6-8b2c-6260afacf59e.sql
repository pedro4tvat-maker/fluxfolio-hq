ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_non_operating boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_internal_transfer boolean NOT NULL DEFAULT false;

-- Categorias padrão novas para TODAS as empresas existentes (sem alterar nada existente)
INSERT INTO public.categories (company_id, nome, tipo, is_non_operating, is_internal_transfer, description)
SELECT c.id, 'Aporte de sócio', 'entrada'::transaction_type, true, false,
       'Aporte, empréstimo recebido ou outra entrada que não é venda/serviço'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories k
  WHERE k.company_id = c.id AND k.nome = 'Aporte de sócio' AND k.deleted_at IS NULL
);

INSERT INTO public.categories (company_id, nome, tipo, is_non_operating, is_internal_transfer, description)
SELECT c.id, 'Transferência entre contas', 'entrada'::transaction_type, false, true,
       'Transferência entre contas da própria empresa (não é receita nem despesa)'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories k
  WHERE k.company_id = c.id AND k.nome = 'Transferência entre contas' AND k.deleted_at IS NULL
);

INSERT INTO public.categories (company_id, nome, tipo, is_non_operating, is_internal_transfer, description)
SELECT c.id, 'Transferência entre contas (saída)', 'saida'::transaction_type, false, true,
       'Transferência entre contas da própria empresa (não é receita nem despesa)'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories k
  WHERE k.company_id = c.id AND k.nome = 'Transferência entre contas (saída)' AND k.deleted_at IS NULL
);

-- Novas empresas passam a receber essas categorias automaticamente
CREATE OR REPLACE FUNCTION public.seed_default_non_operating_categories()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.categories (company_id, nome, tipo, is_non_operating, is_internal_transfer, description)
  VALUES
    (NEW.id, 'Aporte de sócio', 'entrada'::transaction_type, true, false,
     'Aporte, empréstimo recebido ou outra entrada que não é venda/serviço'),
    (NEW.id, 'Transferência entre contas', 'entrada'::transaction_type, false, true,
     'Transferência entre contas da própria empresa (não é receita nem despesa)'),
    (NEW.id, 'Transferência entre contas (saída)', 'saida'::transaction_type, false, true,
     'Transferência entre contas da própria empresa (não é receita nem despesa)')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_non_operating_categories ON public.companies;
CREATE TRIGGER trg_seed_non_operating_categories
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.seed_default_non_operating_categories();