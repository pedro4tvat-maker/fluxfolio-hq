
-- ============ import_batches ============
CREATE TABLE public.import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid,
  user_id uuid NOT NULL,
  import_type text NOT NULL,
  file_name text,
  file_format text,
  total_rows integer NOT NULL DEFAULT 0,
  imported_rows integer NOT NULL DEFAULT 0,
  ignored_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  duplicate_rows integer NOT NULL DEFAULT 0,
  reconciled_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'concluido',
  notes text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO authenticated;
GRANT ALL ON public.import_batches TO service_role;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import batches select" ON public.import_batches
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Import batches write" ON public.import_batches
  FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id) AND user_id = auth.uid());

-- ============ import_rules ============
CREATE TABLE public.import_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  keyword text NOT NULL,
  category_id uuid,
  cost_center_id uuid,
  tipo text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_rules TO authenticated;
GRANT ALL ON public.import_rules TO service_role;

ALTER TABLE public.import_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Import rules select" ON public.import_rules
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Import rules write" ON public.import_rules
  FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_import_rules_updated
  BEFORE UPDATE ON public.import_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ Add tracking columns ============
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS import_batch_id uuid,
  ADD COLUMN IF NOT EXISTS reconciled_with_type text,
  ADD COLUMN IF NOT EXISTS reconciled_with_id uuid,
  ADD COLUMN IF NOT EXISTS reconciliation_status text;

ALTER TABLE public.payables ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.receivables ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS import_batch_id uuid;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS import_batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_import_batch ON public.transactions(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_payables_import_batch ON public.payables(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_receivables_import_batch ON public.receivables(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_products_import_batch ON public.products(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_import_batch ON public.stock_movements(import_batch_id);
