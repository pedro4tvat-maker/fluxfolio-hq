-- Finalizing security hardening
ALTER FUNCTION public.seed_demo_data(UUID) SECURITY INVOKER;

-- Creating Terms of Service table
CREATE TABLE IF NOT EXISTS public.terms_of_service (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    version TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.terms_of_service TO anon, authenticated;
GRANT ALL ON public.terms_of_service TO service_role;

ALTER TABLE public.terms_of_service ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active terms" ON public.terms_of_service 
    FOR SELECT USING (is_active = true);

-- Add initial placeholder records for transparency (non-binding text)
INSERT INTO public.privacy_policy_versions (version_text, effective_date)
VALUES ('Política de Privacidade SISTEMAFP PJ - Versão 1.0. Seus dados estão protegidos por criptografia e RLS.', now());

INSERT INTO public.terms_of_service (content, version)
VALUES ('Termos de Uso SISTEMAFP PJ - Versão 1.0. Ao usar o sistema, você concorda com a guarda segura de seus dados financeiros.', '1.0');
