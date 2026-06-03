-- Create or replace updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Alter categories table to include managerial fields
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS management_group TEXT,
ADD COLUMN IF NOT EXISTS dre_line TEXT,
ADD COLUMN IF NOT EXISTS cash_flow_line TEXT,
ADD COLUMN IF NOT EXISTS financial_classification TEXT,
ADD COLUMN IF NOT EXISTS nature TEXT,
ADD COLUMN IF NOT EXISTS fixed_or_variable TEXT,
ADD COLUMN IF NOT EXISTS impacts_gross_revenue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_net_revenue BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_contribution_margin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_operating_profit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_ebitda BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_net_profit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_break_even BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_working_capital BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS impacts_debt BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update cost_centers table
ALTER TABLE public.cost_centers
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS responsible TEXT,
ADD COLUMN IF NOT EXISTS center_type TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Ensure transactions has necessary columns
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Ensure payables has necessary columns
ALTER TABLE public.payables
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- Ensure receivables has necessary columns
ALTER TABLE public.receivables
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id),
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES public.cost_centers(id);

-- Create trigger for updated_at on categories if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_categories_updated_at') THEN
        CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Create trigger for updated_at on cost_centers if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cost_centers_updated_at') THEN
        CREATE TRIGGER update_cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.categories TO service_role;
GRANT ALL ON public.cost_centers TO service_role;
GRANT ALL ON public.transactions TO service_role;
GRANT ALL ON public.payables TO service_role;
GRANT ALL ON public.receivables TO service_role;
