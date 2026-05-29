
-- ============================================================
-- CONSULTANCY CONTRACTS
-- ============================================================
CREATE TABLE public.consultancy_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  client_name TEXT,
  service_type TEXT,
  plan_name TEXT,
  monthly_amount NUMERIC NOT NULL DEFAULT 0,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  due_day INTEGER NOT NULL DEFAULT 5 CHECK (due_day BETWEEN 1 AND 28),
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','encerrado','cancelado')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_contracts TO authenticated;
GRANT ALL ON public.consultancy_contracts TO service_role;
ALTER TABLE public.consultancy_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultancy contracts select"
  ON public.consultancy_contracts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Consultancy contracts write"
  ON public.consultancy_contracts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_consultancy_contracts_updated
  BEFORE UPDATE ON public.consultancy_contracts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- CONSULTANCY RECEIVABLES
-- ============================================================
CREATE TABLE public.consultancy_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.consultancy_contracts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  client_name TEXT,
  description TEXT NOT NULL,
  revenue_type TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  received_date DATE,
  status TEXT NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto','recebido','vencido')),
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_receivables TO authenticated;
GRANT ALL ON public.consultancy_receivables TO service_role;
ALTER TABLE public.consultancy_receivables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultancy receivables select"
  ON public.consultancy_receivables FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Consultancy receivables write"
  ON public.consultancy_receivables FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_consultancy_receivables_updated
  BEFORE UPDATE ON public.consultancy_receivables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- CONSULTANCY PAYABLES
-- ============================================================
CREATE TABLE public.consultancy_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  payment_date DATE,
  status TEXT NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto','pago','vencido')),
  payment_method TEXT,
  attachment_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_payables TO authenticated;
GRANT ALL ON public.consultancy_payables TO service_role;
ALTER TABLE public.consultancy_payables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultancy payables select"
  ON public.consultancy_payables FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Consultancy payables write"
  ON public.consultancy_payables FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_consultancy_payables_updated
  BEFORE UPDATE ON public.consultancy_payables
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- CONSULTANCY TRANSACTIONS (unified cash flow)
-- ============================================================
CREATE TABLE public.consultancy_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id UUID NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('receita','despesa')),
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'realizado' CHECK (status IN ('realizado','pendente','vencido')),
  due_date DATE,
  payment_date DATE,
  related_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  receivable_id UUID REFERENCES public.consultancy_receivables(id) ON DELETE SET NULL,
  payable_id UUID REFERENCES public.consultancy_payables(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultancy_transactions TO authenticated;
GRANT ALL ON public.consultancy_transactions TO service_role;
ALTER TABLE public.consultancy_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultancy transactions select"
  ON public.consultancy_transactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE POLICY "Consultancy transactions write"
  ON public.consultancy_transactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants c WHERE c.id = consultant_id AND c.user_id = auth.uid()));

CREATE TRIGGER trg_consultancy_transactions_updated
  BEFORE UPDATE ON public.consultancy_transactions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Indexes
CREATE INDEX idx_consultancy_contracts_consultant ON public.consultancy_contracts(consultant_id);
CREATE INDEX idx_consultancy_receivables_consultant ON public.consultancy_receivables(consultant_id, status);
CREATE INDEX idx_consultancy_payables_consultant ON public.consultancy_payables(consultant_id, status);
CREATE INDEX idx_consultancy_transactions_consultant ON public.consultancy_transactions(consultant_id, payment_date);
