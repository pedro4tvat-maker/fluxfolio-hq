-- Adicionar política de SELECT para consultant_library_template_versions
-- Permitir que usuários autenticados (consultores e seus clientes) vejam os modelos
ALTER TABLE public.consultant_library_template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to view template versions" 
ON public.consultant_library_template_versions 
FOR SELECT 
TO authenticated 
USING (true);

GRANT SELECT ON public.consultant_library_template_versions TO authenticated;
GRANT ALL ON public.consultant_library_template_versions TO service_role;
