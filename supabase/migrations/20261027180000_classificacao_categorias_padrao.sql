-- Categorias-padrão já nascem classificadas para a DRE:
--   Fornecedores (compras de mercadoria/insumo) -> custo variável (entra no CMV)
--   Aluguel                                     -> custo fixo
-- Vale para empresas novas (as categorias criadas no cadastro) e para quem criar essas
-- categorias à mão. Só age quando a categoria chega SEM nenhuma classificação; o usuário
-- pode desmarcar depois em Configurações da Empresa.

CREATE OR REPLACE FUNCTION public.classifica_categoria_padrao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo = 'saida'
     AND NOT COALESCE(NEW.is_variable_cost, false)
     AND NOT COALESCE(NEW.is_fixed_cost, false)
     AND NOT COALESCE(NEW.is_deduction, false)
     AND NOT COALESCE(NEW.is_financial_expense, false)
     AND NOT COALESCE(NEW.is_non_operating, false)
     AND NOT COALESCE(NEW.is_internal_transfer, false)
     AND NEW.kpi_classification IS NULL THEN
    IF lower(trim(NEW.nome)) IN ('fornecedores', 'fornecedor') THEN
      NEW.is_variable_cost := true;
    ELSIF lower(trim(NEW.nome)) = 'aluguel' THEN
      NEW.is_fixed_cost := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.classifica_categoria_padrao() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_classifica_categoria_padrao ON public.categories;
CREATE TRIGGER trg_classifica_categoria_padrao
  BEFORE INSERT ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.classifica_categoria_padrao();

-- Empresas que já existem: aplica a mesma regra só nas categorias ainda sem nenhuma classificação.
-- (Não toca em categoria que alguém já classificou.)
UPDATE public.categories
   SET is_variable_cost = true
 WHERE deleted_at IS NULL
   AND tipo = 'saida'
   AND lower(trim(nome)) IN ('fornecedores', 'fornecedor')
   AND NOT COALESCE(is_variable_cost, false) AND NOT COALESCE(is_fixed_cost, false) AND NOT COALESCE(is_deduction, false)
   AND NOT COALESCE(is_financial_expense, false) AND NOT COALESCE(is_non_operating, false) AND NOT COALESCE(is_internal_transfer, false)
   AND kpi_classification IS NULL;

UPDATE public.categories
   SET is_fixed_cost = true
 WHERE deleted_at IS NULL
   AND tipo = 'saida'
   AND lower(trim(nome)) = 'aluguel'
   AND NOT COALESCE(is_variable_cost, false) AND NOT COALESCE(is_fixed_cost, false) AND NOT COALESCE(is_deduction, false)
   AND NOT COALESCE(is_financial_expense, false) AND NOT COALESCE(is_non_operating, false) AND NOT COALESCE(is_internal_transfer, false)
   AND kpi_classification IS NULL;
