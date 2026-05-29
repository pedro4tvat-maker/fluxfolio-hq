
-- ============================================================================
-- 1) Tabela: consultants (perfil da consultoria do usuário consultor)
-- ============================================================================
CREATE TABLE public.consultants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  consultancy_name text NOT NULL,
  consultancy_cnpj text,
  responsible_name text,
  email text,
  phone text,
  city text,
  state text,
  logo_url text,
  invite_code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultants TO authenticated;
GRANT ALL ON public.consultants TO service_role;

ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultants view own"
  ON public.consultants FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Consultants insert own"
  ON public.consultants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Consultants update own"
  ON public.consultants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_consultants_updated_at
  BEFORE UPDATE ON public.consultants
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================================
-- 2) Tabela: consultant_company_links (vínculo consultor x empresa cliente)
-- ============================================================================
CREATE TABLE public.consultant_company_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | inactive
  requested_by uuid,
  responded_at timestamptz,
  linked_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (consultant_id, company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultant_company_links TO authenticated;
GRANT ALL ON public.consultant_company_links TO service_role;

ALTER TABLE public.consultant_company_links ENABLE ROW LEVEL SECURITY;

-- Visível para o dono da empresa OU para o consultor envolvido
CREATE POLICY "Links select"
  ON public.consultant_company_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.consultants WHERE id = consultant_id AND user_id = auth.uid())
  );

-- Dono da empresa cria a solicitação
CREATE POLICY "Owner creates link"
  ON public.consultant_company_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid())
  );

-- Consultor aprova/recusa/inativa; dono pode atualizar (ex: cancelar)
CREATE POLICY "Consultant updates own links"
  ON public.consultant_company_links FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.consultants WHERE id = consultant_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.consultants WHERE id = consultant_id AND user_id = auth.uid()));

CREATE POLICY "Owner updates own link"
  ON public.consultant_company_links FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid()));

-- Dono pode cancelar (delete) sua solicitação
CREATE POLICY "Owner deletes own link"
  ON public.consultant_company_links FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND owner_id = auth.uid()));

CREATE TRIGGER trg_links_updated_at
  BEFORE UPDATE ON public.consultant_company_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_links_company ON public.consultant_company_links(company_id);
CREATE INDEX idx_links_consultant ON public.consultant_company_links(consultant_id);
CREATE INDEX idx_links_status ON public.consultant_company_links(status);

-- ============================================================================
-- 3) Função para gerar código de convite único
-- ============================================================================
CREATE OR REPLACE FUNCTION public.gen_invite_code(_seed text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base text;
  suffix text;
  result text;
  tries int := 0;
BEGIN
  base := UPPER(regexp_replace(COALESCE(_seed, 'CONSULT'), '[^a-zA-Z0-9]', '', 'g'));
  IF length(base) > 10 THEN base := substring(base, 1, 10); END IF;
  IF base = '' THEN base := 'FP'; END IF;
  LOOP
    suffix := UPPER(substring(md5(random()::text || clock_timestamp()::text), 1, 5));
    result := 'FP-' || base || '-' || suffix;
    IF NOT EXISTS (SELECT 1 FROM public.consultants WHERE invite_code = result) THEN
      RETURN result;
    END IF;
    tries := tries + 1;
    IF tries > 20 THEN
      RETURN 'FP-' || UPPER(substring(md5(random()::text || clock_timestamp()::text), 1, 10));
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- 4) Buscar consultores por nome / e-mail / código (SECURITY DEFINER)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.search_consultants(_q text)
RETURNS TABLE (
  id uuid,
  consultancy_name text,
  responsible_name text,
  email text,
  city text,
  state text,
  invite_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, consultancy_name, responsible_name, email, city, state, invite_code
  FROM public.consultants
  WHERE is_active = true
    AND (
      _q IS NULL OR length(trim(_q)) = 0
      OR consultancy_name ILIKE '%' || _q || '%'
      OR responsible_name ILIKE '%' || _q || '%'
      OR email ILIKE _q
      OR invite_code = UPPER(_q)
    )
  ORDER BY consultancy_name
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.find_consultant_by_code(_code text)
RETURNS TABLE (
  id uuid,
  consultancy_name text,
  responsible_name text,
  city text,
  state text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, consultancy_name, responsible_name, city, state
  FROM public.consultants
  WHERE invite_code = UPPER(_code) AND is_active = true
  LIMIT 1;
$$;

-- ============================================================================
-- 5) Atualizar user_has_company_access para usar link table (em vez de blanket)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.companies WHERE id = _company_id AND owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company_id AND user_id = _user_id)
    OR EXISTS (
      SELECT 1
      FROM public.consultant_company_links l
      JOIN public.consultants c ON c.id = l.consultant_id
      WHERE l.company_id = _company_id
        AND c.user_id = _user_id
        AND l.status = 'approved'
    )
$$;

-- ============================================================================
-- 6) Backfill: criar consultants para usuários consultores existentes
-- ============================================================================
INSERT INTO public.consultants (user_id, consultancy_name, responsible_name, email, invite_code)
SELECT
  ur.user_id,
  COALESCE(NULLIF(TRIM(p.full_name), ''), 'Minha Consultoria') || ' Consultoria',
  COALESCE(p.full_name, p.email),
  p.email,
  public.gen_invite_code(COALESCE(p.full_name, 'FP'))
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'consultant'
  AND NOT EXISTS (SELECT 1 FROM public.consultants c WHERE c.user_id = ur.user_id);

-- Backfill: empresas existentes que foram criadas pelos consultores (owner_id é o consultor),
-- vincular automaticamente como 'approved' para não quebrar fluxo atual
INSERT INTO public.consultant_company_links (consultant_id, company_id, status, linked_at, responded_at)
SELECT c.id, comp.id, 'approved', now(), now()
FROM public.companies comp
JOIN public.consultants c ON c.user_id = comp.owner_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.consultant_company_links l
  WHERE l.consultant_id = c.id AND l.company_id = comp.id
);

-- ============================================================================
-- 7) Trigger handle_new_user atualizado: cria consultoria, vincula cliente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role app_role;
  new_company_id UUID;
  link_consultant_id UUID;
  inv_code TEXT;
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

  -- Cria perfil de consultoria para novo consultor
  IF assigned_role = 'consultant' THEN
    inv_code := public.gen_invite_code(
      COALESCE(
        NULLIF(TRIM(m->>'consultancy_name'), ''),
        NULLIF(TRIM(m->>'full_name'), ''),
        'FP'
      )
    );
    INSERT INTO public.consultants (
      user_id, consultancy_name, consultancy_cnpj, responsible_name,
      email, phone, city, state, invite_code
    )
    VALUES (
      NEW.id,
      COALESCE(NULLIF(TRIM(m->>'consultancy_name'), ''), NULLIF(TRIM(m->>'full_name'), ''), 'Minha Consultoria'),
      NULLIF(TRIM(m->>'consultancy_cnpj'), ''),
      COALESCE(NULLIF(TRIM(m->>'full_name'), ''), NEW.email),
      NEW.email,
      NULLIF(TRIM(m->>'user_phone'), ''),
      NULLIF(TRIM(m->>'consultancy_city'), ''),
      NULLIF(TRIM(m->>'consultancy_state'), ''),
      inv_code
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- Cria empresa cliente e tenta vincular ao consultor escolhido
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

    -- Vínculo automático via código de convite
    IF COALESCE(TRIM(m->>'consultant_invite_code'), '') <> '' THEN
      SELECT id INTO link_consultant_id FROM public.consultants
       WHERE invite_code = UPPER(TRIM(m->>'consultant_invite_code')) AND is_active = true
       LIMIT 1;
      IF link_consultant_id IS NOT NULL THEN
        INSERT INTO public.consultant_company_links
          (consultant_id, company_id, status, requested_by, linked_at, responded_at)
        VALUES (link_consultant_id, new_company_id, 'approved', NEW.id, now(), now())
        ON CONFLICT DO NOTHING;
      END IF;
    -- Caso contrário, solicita vínculo se houver consultant_id selecionado
    ELSIF COALESCE(TRIM(m->>'consultant_id'), '') <> '' THEN
      BEGIN
        link_consultant_id := (TRIM(m->>'consultant_id'))::uuid;
        IF EXISTS (SELECT 1 FROM public.consultants WHERE id = link_consultant_id AND is_active = true) THEN
          INSERT INTO public.consultant_company_links
            (consultant_id, company_id, status, requested_by)
          VALUES (link_consultant_id, new_company_id, 'pending', NEW.id)
          ON CONFLICT DO NOTHING;
        END IF;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END IF;

  RETURN NEW;
END
$$;
