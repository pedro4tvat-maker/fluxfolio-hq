-- Garantir que anon também possa executar as funções (necessário para a página de signup)
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_consultants(text) TO anon, authenticated;

-- Adicionar política para permitir que usuários anônimos vejam informações básicas de consultores ativos
-- (Necessário se houver selects diretos na tabela ou se os RPCs forem SECURITY INVOKER no futuro)
CREATE POLICY "Allow anon to view active consultants" 
ON public.consultants 
FOR SELECT 
TO anon 
USING (is_active = true);
