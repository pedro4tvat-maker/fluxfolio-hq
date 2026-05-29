
-- 1. Extend companies with new optional fields
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS nome_fantasia TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual TEXT,
  ADD COLUMN IF NOT EXISTS endereco TEXT,
  ADD COLUMN IF NOT EXISTS bairro TEXT,
  ADD COLUMN IF NOT EXISTS cep TEXT;

-- 2. Create branches table
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  cidade TEXT,
  estado TEXT,
  endereco TEXT,
  telefone TEXT,
  email TEXT,
  responsavel TEXT,
  is_main_branch BOOLEAN NOT NULL DEFAULT false,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branches select" ON public.branches FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Branches write" ON public.branches FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE INDEX IF NOT EXISTS idx_branches_company ON public.branches(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_branches_main_per_company ON public.branches(company_id) WHERE is_main_branch;

CREATE TRIGGER trg_branches_updated
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 3. Auto-create main branch when a company is created
CREATE OR REPLACE FUNCTION public.create_main_branch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.branches (company_id, nome, nome_fantasia, cnpj, cidade, estado, endereco, telefone, email, responsavel, is_main_branch, ativa)
  VALUES (NEW.id, 'Matriz', NEW.nome_fantasia, NEW.cnpj, NEW.cidade, NEW.estado, NEW.endereco, NEW.telefone, NEW.email, NEW.responsavel, true, true);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_companies_main_branch ON public.companies;
CREATE TRIGGER trg_companies_main_branch
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.create_main_branch();

-- 4. Backfill matriz for existing companies
INSERT INTO public.branches (company_id, nome, nome_fantasia, cnpj, cidade, estado, endereco, telefone, email, responsavel, is_main_branch, ativa)
SELECT c.id, 'Matriz', c.nome_fantasia, c.cnpj, c.cidade, c.estado, c.endereco, c.telefone, c.email, c.responsavel, true, true
FROM public.companies c
WHERE NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.company_id = c.id AND b.is_main_branch);

-- 5. Add branch_id to operational tables
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.budgets ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_id UUID;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS branch_id UUID;

CREATE INDEX IF NOT EXISTS idx_tx_branch ON public.transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_pay_branch ON public.payables(branch_id);
CREATE INDEX IF NOT EXISTS idx_rec_branch ON public.receivables(branch_id);
CREATE INDEX IF NOT EXISTS idx_bud_branch ON public.budgets(branch_id);
CREATE INDEX IF NOT EXISTS idx_prod_branch ON public.products(branch_id);
CREATE INDEX IF NOT EXISTS idx_stk_branch ON public.stock_movements(branch_id);

-- 6. Backfill: link existing rows to matriz of each company
UPDATE public.transactions t SET branch_id = b.id FROM public.branches b WHERE t.company_id = b.company_id AND b.is_main_branch AND t.branch_id IS NULL;
UPDATE public.payables t SET branch_id = b.id FROM public.branches b WHERE t.company_id = b.company_id AND b.is_main_branch AND t.branch_id IS NULL;
UPDATE public.receivables t SET branch_id = b.id FROM public.branches b WHERE t.company_id = b.company_id AND b.is_main_branch AND t.branch_id IS NULL;
UPDATE public.budgets t SET branch_id = b.id FROM public.branches b WHERE t.company_id = b.company_id AND b.is_main_branch AND t.branch_id IS NULL;
UPDATE public.products t SET branch_id = b.id FROM public.branches b WHERE t.company_id = b.company_id AND b.is_main_branch AND t.branch_id IS NULL;
UPDATE public.stock_movements t SET branch_id = b.id FROM public.branches b WHERE t.company_id = b.company_id AND b.is_main_branch AND t.branch_id IS NULL;

-- 7. Update handle_new_user to capture all new company fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_count INT;
  assigned_role app_role;
  new_company_id UUID;
  m JSONB;
BEGIN
  m := NEW.raw_user_meta_data;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(m->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'consultant';
  ELSE
    assigned_role := COALESCE((m->>'role')::app_role, 'client_manager');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  IF assigned_role = 'client_manager' THEN
    INSERT INTO public.companies (
      nome, nome_fantasia, cnpj, inscricao_estadual, segmento,
      cidade, estado, endereco, bairro, cep,
      telefone, email, responsavel, owner_id
    )
    VALUES (
      COALESCE(NULLIF(TRIM(m->>'company_name'), ''), 'Minha Empresa'),
      NULLIF(TRIM(m->>'company_trade_name'), ''),
      NULLIF(TRIM(m->>'company_cnpj'), ''),
      NULLIF(TRIM(m->>'company_ie'), ''),
      NULLIF(TRIM(m->>'company_segment'), ''),
      NULLIF(TRIM(m->>'company_city'), ''),
      NULLIF(TRIM(m->>'company_state'), ''),
      NULLIF(TRIM(m->>'company_address'), ''),
      NULLIF(TRIM(m->>'company_district'), ''),
      NULLIF(TRIM(m->>'company_zip'), ''),
      COALESCE(NULLIF(TRIM(m->>'company_phone'), ''), NULLIF(TRIM(m->>'user_phone'), '')),
      COALESCE(NULLIF(TRIM(m->>'company_email'), ''), NEW.email),
      COALESCE(NULLIF(TRIM(m->>'full_name'), ''), NEW.email),
      NEW.id
    )
    RETURNING id INTO new_company_id;

    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'client_manager')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.financial_accounts (company_id, nome, tipo, saldo_inicial)
    VALUES (new_company_id, 'Conta principal', 'banco', 0);
    INSERT INTO public.categories (company_id, nome, tipo) VALUES
      (new_company_id, 'Vendas', 'entrada'),
      (new_company_id, 'Serviços', 'entrada'),
      (new_company_id, 'Fornecedores', 'saida'),
      (new_company_id, 'Aluguel', 'saida'),
      (new_company_id, 'Outras despesas', 'saida');
  END IF;

  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_main_branch() FROM PUBLIC, anon, authenticated;
