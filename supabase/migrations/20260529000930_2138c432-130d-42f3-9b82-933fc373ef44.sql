
-- Attach missing triggers so payables/receivables auto-sync into transactions
-- and stock movements update product quantities.

DROP TRIGGER IF EXISTS trg_sync_payable_transaction ON public.payables;
CREATE TRIGGER trg_sync_payable_transaction
AFTER INSERT OR UPDATE OF status, data_pagamento, valor, descricao, categoria_id, centro_custo_id, conta_id, forma_pagamento
ON public.payables
FOR EACH ROW EXECUTE FUNCTION public.sync_payable_transaction();

DROP TRIGGER IF EXISTS trg_sync_receivable_transaction ON public.receivables;
CREATE TRIGGER trg_sync_receivable_transaction
AFTER INSERT OR UPDATE OF status, data_recebimento, valor, descricao, categoria_id, centro_custo_id, conta_id, forma_recebimento
ON public.receivables
FOR EACH ROW EXECUTE FUNCTION public.sync_receivable_transaction();

DROP TRIGGER IF EXISTS trg_apply_stock_movement ON public.stock_movements;
CREATE TRIGGER trg_apply_stock_movement
AFTER INSERT ON public.stock_movements
FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Updated_at maintenance on tables that have updated_at
DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_payables_updated_at ON public.payables;
CREATE TRIGGER trg_payables_updated_at BEFORE UPDATE ON public.payables
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_receivables_updated_at ON public.receivables;
CREATE TRIGGER trg_receivables_updated_at BEFORE UPDATE ON public.receivables
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-mark overdue payables/receivables: helper trigger function and a daily marker
-- Simple approach: a function clients can call (or that runs whenever status is updated)
CREATE OR REPLACE FUNCTION public.mark_overdue_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'payables' THEN
    IF NEW.status = 'em_aberto' AND NEW.vencimento < CURRENT_DATE THEN
      NEW.status := 'vencido';
    END IF;
  ELSIF TG_TABLE_NAME = 'receivables' THEN
    IF NEW.status = 'em_aberto' AND NEW.vencimento < CURRENT_DATE THEN
      NEW.status := 'vencido';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payables_overdue ON public.payables;
CREATE TRIGGER trg_payables_overdue BEFORE INSERT OR UPDATE OF vencimento, status ON public.payables
FOR EACH ROW EXECUTE FUNCTION public.mark_overdue_on_insert();

DROP TRIGGER IF EXISTS trg_receivables_overdue ON public.receivables;
CREATE TRIGGER trg_receivables_overdue BEFORE INSERT OR UPDATE OF vencimento, status ON public.receivables
FOR EACH ROW EXECUTE FUNCTION public.mark_overdue_on_insert();
