-- Table for security logging
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'login', 'password_change', 'mfa_enabled', 'data_export'
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for user security preferences
CREATE TABLE IF NOT EXISTS public.user_security_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    two_factor_enabled BOOLEAN DEFAULT false,
    session_timeout_minutes INTEGER DEFAULT 1440, -- 24 hours
    marketing_accepted BOOLEAN DEFAULT false,
    privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT ON public.security_logs TO authenticated;
GRANT ALL ON public.security_logs TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.user_security_settings TO authenticated;
GRANT ALL ON public.user_security_settings TO service_role;

-- RLS
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_settings ENABLE ROW LEVEL SECURITY;

-- Policies for security_logs
CREATE POLICY "Users can view their own security logs" ON public.security_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert security logs" ON public.security_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_security_settings
CREATE POLICY "Users can manage their own security settings" ON public.user_security_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_user_security_settings_updated_at
    BEFORE UPDATE ON public.user_security_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
