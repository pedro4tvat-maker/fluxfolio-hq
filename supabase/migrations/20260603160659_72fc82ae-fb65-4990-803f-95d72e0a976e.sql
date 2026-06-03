ALTER TABLE public.financial_diagnostics 
ADD COLUMN IF NOT EXISTS business_segment TEXT,
ADD COLUMN IF NOT EXISTS business_city TEXT,
ADD COLUMN IF NOT EXISTS business_phone TEXT,
ADD COLUMN IF NOT EXISTS business_email TEXT,
ADD COLUMN IF NOT EXISTS employee_count TEXT,
ADD COLUMN IF NOT EXISTS avg_monthly_revenue TEXT,
ADD COLUMN IF NOT EXISTS total_points NUMERIC;

COMMENT ON COLUMN public.financial_diagnostics.total_points IS 'Pontuação total absoluta (ex: 127 de 180)';