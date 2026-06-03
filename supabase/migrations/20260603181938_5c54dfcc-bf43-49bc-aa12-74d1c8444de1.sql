-- 1) Tornar company_id opcional na tabela financial_diagnostics
ALTER TABLE public.financial_diagnostics ALTER COLUMN company_id DROP NOT NULL;

-- 2) Adicionar colunas para prospectos (empresas não cadastradas ainda)
ALTER TABLE public.financial_diagnostics 
ADD COLUMN IF NOT EXISTS prospect_name TEXT,
ADD COLUMN IF NOT EXISTS prospect_responsible TEXT;

-- 3) Atualizar políticas de RLS para permitir acesso a diagnósticos sem company_id (baseado no consultant_id)
-- Primeiro, vamos ver as políticas atuais (ajustando se necessário)
DROP POLICY IF EXISTS "Consultants can manage their own diagnostics" ON public.financial_diagnostics;
CREATE POLICY "Consultants can manage their own diagnostics"
ON public.financial_diagnostics
FOR ALL
TO authenticated
USING (
  (public.is_consultant(auth.uid()) AND consultant_id IN (SELECT id FROM public.consultants WHERE user_id = auth.uid()))
  OR 
  (company_id IS NOT NULL AND public.user_has_company_access(auth.uid(), company_id))
);