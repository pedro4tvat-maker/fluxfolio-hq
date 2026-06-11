-- Add consultant_id to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS consultant_id UUID REFERENCES public.consultants(id);

-- Update RLS for companies to allow consultant access
CREATE POLICY "Consultants can view their linked companies" ON public.companies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.consultants c
    WHERE c.user_id = auth.uid() AND c.id = public.companies.consultant_id
  )
);

CREATE POLICY "Consultants can update their linked companies" ON public.companies
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.consultants c
    WHERE c.user_id = auth.uid() AND c.id = public.companies.consultant_id
  )
);

-- Backfill consultant_id for existing companies owned by users who are consultants
-- This helps if a consultant created companies directly as owner before the linking system
UPDATE public.companies
SET consultant_id = c.id
FROM public.consultants c
WHERE public.companies.owner_id = c.user_id AND public.companies.consultant_id IS NULL;