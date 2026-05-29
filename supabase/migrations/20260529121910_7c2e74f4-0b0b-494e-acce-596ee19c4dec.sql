
-- ============= CRM CONTACTS =============
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID,
  name TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'cliente',
  cpf_cnpj TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  lead_source TEXT,
  status TEXT NOT NULL DEFAULT 'novo',
  responsible TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_company ON public.crm_contacts(company_id);
CREATE UNIQUE INDEX idx_crm_company_doc
  ON public.crm_contacts(company_id, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL AND length(trim(cpf_cnpj)) > 0;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM contacts select" ON public.crm_contacts
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "CRM contacts write" ON public.crm_contacts
  FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER tg_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============= ATTACHMENTS =============
CREATE TABLE public.attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID,
  related_module TEXT NOT NULL,
  related_record_id UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  document_type TEXT,
  description TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_company ON public.attachments(company_id);
CREATE INDEX idx_attachments_record ON public.attachments(related_module, related_record_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Attachments select" ON public.attachments
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Attachments write" ON public.attachments
  FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

-- ============= PRICING RECORDS =============
CREATE TABLE public.pricing_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID,
  product_id UUID,
  nome TEXT NOT NULL,
  categoria TEXT,
  unidade TEXT,
  observacoes TEXT,
  -- Custos diretos
  custo_compra NUMERIC NOT NULL DEFAULT 0,
  custo_materia_prima NUMERIC NOT NULL DEFAULT 0,
  custo_embalagem NUMERIC NOT NULL DEFAULT 0,
  custo_frete NUMERIC NOT NULL DEFAULT 0,
  custo_mao_obra NUMERIC NOT NULL DEFAULT 0,
  outros_custos_diretos NUMERIC NOT NULL DEFAULT 0,
  -- Despesas variáveis (em %)
  taxa_cartao NUMERIC NOT NULL DEFAULT 0,
  comissao NUMERIC NOT NULL DEFAULT 0,
  impostos NUMERIC NOT NULL DEFAULT 0,
  marketplace NUMERIC NOT NULL DEFAULT 0,
  desconto_medio NUMERIC NOT NULL DEFAULT 0,
  outras_despesas_variaveis NUMERIC NOT NULL DEFAULT 0,
  -- Rateios (em %)
  rateio_fixo NUMERIC NOT NULL DEFAULT 0,
  rateio_administrativo NUMERIC NOT NULL DEFAULT 0,
  rateio_comercial NUMERIC NOT NULL DEFAULT 0,
  -- Margem & preço
  margem_desejada NUMERIC NOT NULL DEFAULT 30,
  preco_atual NUMERIC NOT NULL DEFAULT 0,
  preco_sugerido NUMERIC NOT NULL DEFAULT 0,
  preco_minimo NUMERIC NOT NULL DEFAULT 0,
  markup NUMERIC NOT NULL DEFAULT 0,
  margem_atual NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pricing_company ON public.pricing_records(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_records TO authenticated;
GRANT ALL ON public.pricing_records TO service_role;

ALTER TABLE public.pricing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pricing select" ON public.pricing_records
  FOR SELECT TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id));

CREATE POLICY "Pricing write" ON public.pricing_records
  FOR ALL TO authenticated
  USING (public.user_has_company_access(auth.uid(), company_id))
  WITH CHECK (public.user_has_company_access(auth.uid(), company_id));

CREATE TRIGGER tg_pricing_records_updated_at
  BEFORE UPDATE ON public.pricing_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============= CRM LINKS NAS TABELAS EXISTENTES =============
ALTER TABLE public.receivables ADD COLUMN crm_contact_id UUID;
ALTER TABLE public.transactions ADD COLUMN crm_contact_id UUID;

-- ============= STORAGE BUCKET =============
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: caminho começa por {company_id}/...
CREATE OR REPLACE FUNCTION public.attachment_company_from_path(_name text)
RETURNS UUID
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF(split_part(_name, '/', 1), '')::uuid
$$;

CREATE POLICY "Attachments storage select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  );

CREATE POLICY "Attachments storage insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND public.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  );

CREATE POLICY "Attachments storage delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  );

CREATE POLICY "Attachments storage update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.user_has_company_access(auth.uid(), public.attachment_company_from_path(name))
  );
