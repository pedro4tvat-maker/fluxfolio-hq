
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('consultant', 'client_manager', 'operator');
CREATE TYPE public.transaction_type AS ENUM ('entrada', 'saida');
CREATE TYPE public.transaction_status AS ENUM ('realizado', 'pendente', 'previsto');
CREATE TYPE public.payable_status AS ENUM ('em_aberto', 'pago', 'vencido');
CREATE TYPE public.receivable_status AS ENUM ('em_aberto', 'recebido', 'vencido');
CREATE TYPE public.recurrence AS ENUM ('unica', 'semanal', 'mensal', 'anual');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by self" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_consultant(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'consultant')
$$;

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  responsavel TEXT,
  documento TEXT,
  telefone TEXT,
  email TEXT,
  segmento TEXT,
  cidade TEXT,
  estado TEXT,
  observacoes TEXT,
  data_inicio DATE DEFAULT CURRENT_DATE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'client_manager',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_consultant(_user_id)
    OR EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company_id AND user_id = _user_id)
$$;

CREATE POLICY "Companies access" ON public.companies FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), id));
CREATE POLICY "Consultants create companies" ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.is_consultant(auth.uid()) AND owner_id = auth.uid());
CREATE POLICY "Consultants update companies" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_consultant(auth.uid()));
CREATE POLICY "Consultants delete companies" ON public.companies FOR DELETE TO authenticated
  USING (public.is_consultant(auth.uid()));

CREATE POLICY "Members select" ON public.company_members FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Members insert" ON public.company_members FOR INSERT TO authenticated
  WITH CHECK (public.is_consultant(auth.uid()));
CREATE POLICY "Members delete" ON public.company_members FOR DELETE TO authenticated
  USING (public.is_consultant(auth.uid()));

-- ============ GENERIC company-scoped helper ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo transaction_type NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories select" ON public.categories FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Categories write" ON public.categories FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- ============ COST CENTERS ============
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cost centers select" ON public.cost_centers FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Cost centers write" ON public.cost_centers FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- ============ FINANCIAL ACCOUNTS ============
CREATE TABLE public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'banco',
  saldo_inicial NUMERIC(14,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_accounts TO authenticated;
GRANT ALL ON public.financial_accounts TO service_role;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounts select" ON public.financial_accounts FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Accounts write" ON public.financial_accounts FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- ============ PAYABLES ============
CREATE TABLE public.payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  fornecedor TEXT,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  valor NUMERIC(14,2) NOT NULL,
  vencimento DATE NOT NULL,
  data_pagamento DATE,
  status payable_status NOT NULL DEFAULT 'em_aberto',
  recorrencia recurrence DEFAULT 'unica',
  parcelas INT DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payables TO authenticated;
GRANT ALL ON public.payables TO service_role;
ALTER TABLE public.payables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payables select" ON public.payables FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Payables write" ON public.payables FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER payables_updated BEFORE UPDATE ON public.payables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ RECEIVABLES ============
CREATE TABLE public.receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  cliente TEXT,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  forma_recebimento TEXT,
  valor NUMERIC(14,2) NOT NULL,
  vencimento DATE NOT NULL,
  data_recebimento DATE,
  status receivable_status NOT NULL DEFAULT 'em_aberto',
  recorrencia recurrence DEFAULT 'unica',
  parcelas INT DEFAULT 1,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receivables TO authenticated;
GRANT ALL ON public.receivables TO service_role;
ALTER TABLE public.receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Receivables select" ON public.receivables FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Receivables write" ON public.receivables FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER receivables_updated BEFORE UPDATE ON public.receivables FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ TRANSACTIONS ============
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo transaction_type NOT NULL,
  descricao TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  centro_custo_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  forma_pagamento TEXT,
  valor NUMERIC(14,2) NOT NULL,
  status transaction_status NOT NULL DEFAULT 'realizado',
  observacoes TEXT,
  payable_id UUID REFERENCES public.payables(id) ON DELETE CASCADE,
  receivable_id UUID REFERENCES public.receivables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Transactions select" ON public.transactions FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Transactions write" ON public.transactions FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_tx_company_data ON public.transactions(company_id, data);

-- ============ Auto-generate transactions for payables/receivables ============
CREATE OR REPLACE FUNCTION public.sync_payable_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- When paid, ensure a transaction exists
  IF NEW.status = 'pago' THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE payable_id = NEW.id) THEN
      INSERT INTO public.transactions (company_id, data, tipo, descricao, categoria_id, centro_custo_id, conta_id, forma_pagamento, valor, status, payable_id)
      VALUES (NEW.company_id, COALESCE(NEW.data_pagamento, CURRENT_DATE), 'saida', NEW.descricao, NEW.categoria_id, NEW.centro_custo_id, NEW.conta_id, NEW.forma_pagamento, NEW.valor, 'realizado', NEW.id);
    END IF;
  ELSE
    -- If reverted from paid, remove auto transaction
    DELETE FROM public.transactions WHERE payable_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER payable_tx_sync AFTER INSERT OR UPDATE OF status, data_pagamento, valor, categoria_id, conta_id ON public.payables
  FOR EACH ROW EXECUTE FUNCTION public.sync_payable_transaction();

CREATE OR REPLACE FUNCTION public.sync_receivable_transaction() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'recebido' THEN
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE receivable_id = NEW.id) THEN
      INSERT INTO public.transactions (company_id, data, tipo, descricao, categoria_id, centro_custo_id, conta_id, forma_pagamento, valor, status, receivable_id)
      VALUES (NEW.company_id, COALESCE(NEW.data_recebimento, CURRENT_DATE), 'entrada', NEW.descricao, NEW.categoria_id, NEW.centro_custo_id, NEW.conta_id, NEW.forma_recebimento, NEW.valor, 'realizado', NEW.id);
    END IF;
  ELSE
    DELETE FROM public.transactions WHERE receivable_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER receivable_tx_sync AFTER INSERT OR UPDATE OF status, data_recebimento, valor, categoria_id, conta_id ON public.receivables
  FOR EACH ROW EXECUTE FUNCTION public.sync_receivable_transaction();

-- ============ BUDGETS ============
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INT NOT NULL,
  categoria_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  valor_orcado NUMERIC(14,2) NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, mes, ano, categoria_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Budgets select" ON public.budgets FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Budgets write" ON public.budgets FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria TEXT,
  fornecedor TEXT,
  quantidade NUMERIC(14,3) NOT NULL DEFAULT 0,
  custo_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_venda NUMERIC(14,2) NOT NULL DEFAULT 0,
  estoque_minimo NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products select" ON public.products FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Products write" ON public.products FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tipo transaction_type NOT NULL,
  quantidade NUMERIC(14,3) NOT NULL,
  custo_unitario NUMERIC(14,2),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock select" ON public.stock_movements FOR SELECT TO authenticated USING (public.user_has_company_access(auth.uid(), company_id));
CREATE POLICY "Stock write" ON public.stock_movements FOR ALL TO authenticated USING (public.user_has_company_access(auth.uid(), company_id)) WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- Update product quantity on stock movement
CREATE OR REPLACE FUNCTION public.apply_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.tipo = 'entrada' THEN
      UPDATE public.products SET quantidade = quantidade + NEW.quantidade,
        custo_unitario = COALESCE(NEW.custo_unitario, custo_unitario)
        WHERE id = NEW.product_id;
    ELSE
      UPDATE public.products SET quantidade = quantidade - NEW.quantidade WHERE id = NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stock_apply AFTER INSERT ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- ============ HANDLE NEW USER (create profile + assign consultant role on first signup) ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Default role: consultant for first user, client_manager otherwise
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'consultant';
  ELSE
    -- Read role hint from metadata, default to client_manager
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client_manager');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SEED DEMO DATA FUNCTION ============
CREATE OR REPLACE FUNCTION public.seed_demo_data(_owner UUID) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c1 UUID; c2 UUID; c3 UUID;
  acc UUID; cat_vendas UUID; cat_servicos UUID; cat_forn UUID; cat_aluguel UUID; cat_marketing UUID;
  p1 UUID;
BEGIN
  -- Empresa 1: Padaria Pão Quente
  INSERT INTO public.companies (nome, responsavel, documento, telefone, email, segmento, cidade, estado, owner_id)
  VALUES ('Padaria Pão Quente', 'Carlos Silva', '12.345.678/0001-90', '(11) 99999-1111', 'contato@paoquente.com', 'Alimentício', 'São Paulo', 'SP', _owner)
  RETURNING id INTO c1;

  INSERT INTO public.companies (nome, responsavel, documento, telefone, email, segmento, cidade, estado, owner_id)
  VALUES ('Moda Bella Boutique', 'Marina Souza', '23.456.789/0001-01', '(11) 98888-2222', 'marina@modabella.com', 'Vestuário', 'Campinas', 'SP', _owner)
  RETURNING id INTO c2;

  INSERT INTO public.companies (nome, responsavel, documento, telefone, email, segmento, cidade, estado, owner_id)
  VALUES ('TechSolutions ME', 'Ricardo Lima', '34.567.890/0001-12', '(21) 97777-3333', 'ricardo@techsolutions.com', 'Tecnologia', 'Rio de Janeiro', 'RJ', _owner)
  RETURNING id INTO c3;

  -- Seed for company 1
  INSERT INTO public.financial_accounts (company_id, nome, tipo, saldo_inicial) VALUES (c1, 'Conta PJ Itaú', 'banco', 15000) RETURNING id INTO acc;
  INSERT INTO public.financial_accounts (company_id, nome, tipo) VALUES (c1, 'Caixa físico', 'caixa');

  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c1, 'Vendas', 'entrada') RETURNING id INTO cat_vendas;
  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c1, 'Serviços', 'entrada') RETURNING id INTO cat_servicos;
  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c1, 'Fornecedores', 'saida') RETURNING id INTO cat_forn;
  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c1, 'Aluguel', 'saida') RETURNING id INTO cat_aluguel;
  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c1, 'Marketing', 'saida') RETURNING id INTO cat_marketing;

  INSERT INTO public.cost_centers (company_id, nome) VALUES (c1, 'Administrativo'), (c1, 'Comercial'), (c1, 'Produção');

  -- Lançamentos
  INSERT INTO public.transactions (company_id, data, tipo, descricao, categoria_id, conta_id, forma_pagamento, valor, status) VALUES
    (c1, CURRENT_DATE - 1, 'entrada', 'Vendas do balcão', cat_vendas, acc, 'Pix', 2400, 'realizado'),
    (c1, CURRENT_DATE - 2, 'entrada', 'Encomenda evento', cat_servicos, acc, 'Transferência bancária', 1800, 'realizado'),
    (c1, CURRENT_DATE - 3, 'saida', 'Compra de farinha', cat_forn, acc, 'Boleto', 920, 'realizado'),
    (c1, CURRENT_DATE - 5, 'saida', 'Anúncios Instagram', cat_marketing, acc, 'Cartão de crédito', 350, 'realizado'),
    (c1, CURRENT_DATE - 6, 'entrada', 'Vendas do balcão', cat_vendas, acc, 'Dinheiro', 1950, 'realizado'),
    (c1, CURRENT_DATE - 8, 'saida', 'Aluguel da loja', cat_aluguel, acc, 'Boleto', 3200, 'realizado'),
    (c1, CURRENT_DATE - 10, 'entrada', 'Vendas do balcão', cat_vendas, acc, 'Pix', 2100, 'realizado'),
    (c1, CURRENT_DATE - 12, 'saida', 'Manutenção de forno', cat_forn, acc, 'Pix', 480, 'realizado'),
    (c1, CURRENT_DATE - 14, 'entrada', 'Vendas do balcão', cat_vendas, acc, 'Pix', 1750, 'realizado'),
    (c1, CURRENT_DATE - 15, 'saida', 'Insumos diversos', cat_forn, acc, 'Pix', 640, 'realizado');

  -- Contas a pagar
  INSERT INTO public.payables (company_id, descricao, fornecedor, categoria_id, conta_id, valor, vencimento, status) VALUES
    (c1, 'Aluguel do mês', 'Imobiliária Central', cat_aluguel, acc, 3200, CURRENT_DATE + 5, 'em_aberto'),
    (c1, 'Energia elétrica', 'CPFL', cat_forn, acc, 740, CURRENT_DATE - 2, 'vencido'),
    (c1, 'Internet', 'Vivo', cat_forn, acc, 180, CURRENT_DATE + 10, 'em_aberto'),
    (c1, 'Fornecedor de embalagens', 'EmbalaPlus', cat_forn, acc, 560, CURRENT_DATE + 15, 'em_aberto'),
    (c1, 'Campanha de marketing', 'AgênciaXP', cat_marketing, acc, 900, CURRENT_DATE - 5, 'vencido');

  -- Contas a receber
  INSERT INTO public.receivables (company_id, descricao, cliente, categoria_id, conta_id, valor, vencimento, status) VALUES
    (c1, 'Evento empresarial', 'Empresa ABC', cat_servicos, acc, 2500, CURRENT_DATE + 7, 'em_aberto'),
    (c1, 'Pedido mensal escola', 'Escola Aprender', cat_vendas, acc, 1850, CURRENT_DATE + 3, 'em_aberto'),
    (c1, 'Buffet corporativo', 'Tech Co', cat_servicos, acc, 3200, CURRENT_DATE - 4, 'vencido'),
    (c1, 'Pedido recorrente', 'Café Aroma', cat_vendas, acc, 690, CURRENT_DATE + 12, 'em_aberto'),
    (c1, 'Festa de aniversário', 'Cliente PF', cat_vendas, acc, 480, CURRENT_DATE - 1, 'vencido');

  -- Orçamentos
  INSERT INTO public.budgets (company_id, mes, ano, categoria_id, valor_orcado) VALUES
    (c1, EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, cat_forn, 3000),
    (c1, EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, cat_aluguel, 3500),
    (c1, EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, cat_marketing, 1000),
    (c1, EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, cat_vendas, 12000),
    (c1, EXTRACT(MONTH FROM CURRENT_DATE)::INT, EXTRACT(YEAR FROM CURRENT_DATE)::INT, cat_servicos, 6000);

  -- Produtos
  INSERT INTO public.products (company_id, nome, categoria, fornecedor, quantidade, custo_unitario, preco_venda, estoque_minimo) VALUES
    (c1, 'Pão francês (kg)', 'Padaria', 'Moinho SP', 35, 6.00, 14.00, 20),
    (c1, 'Bolo de chocolate', 'Confeitaria', 'Própria', 4, 22.00, 55.00, 5),
    (c1, 'Café em grão (kg)', 'Bebidas', 'Café do Sul', 8, 35.00, 70.00, 10),
    (c1, 'Embalagem 500ml', 'Embalagens', 'EmbalaPlus', 0, 0.45, 1.20, 200),
    (c1, 'Leite (L)', 'Insumos', 'Laticínio MG', 60, 4.50, 8.00, 30);

  -- Empresa 2 mínima
  INSERT INTO public.financial_accounts (company_id, nome, tipo, saldo_inicial) VALUES (c2, 'Conta PJ', 'banco', 8500);
  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c2, 'Vendas', 'entrada'), (c2, 'Fornecedores', 'saida');

  -- Empresa 3 mínima
  INSERT INTO public.financial_accounts (company_id, nome, tipo, saldo_inicial) VALUES (c3, 'Conta PJ', 'banco', 22000);
  INSERT INTO public.categories (company_id, nome, tipo) VALUES (c3, 'Serviços', 'entrada'), (c3, 'Fornecedores', 'saida');
END $$;
