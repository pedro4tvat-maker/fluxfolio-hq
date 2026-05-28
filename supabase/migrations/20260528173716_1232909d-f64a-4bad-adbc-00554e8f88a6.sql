
-- Updated signup trigger: cria empresa automaticamente para clientes
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
  company_name TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    assigned_role := 'consultant';
  ELSE
    assigned_role := COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'client_manager');
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role)
  ON CONFLICT DO NOTHING;

  -- Se for cliente (client_manager), criar a empresa dele automaticamente
  IF assigned_role = 'client_manager' THEN
    company_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''), 'Minha Empresa');
    INSERT INTO public.companies (nome, owner_id, responsavel, email)
    VALUES (company_name, NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
    RETURNING id INTO new_company_id;

    INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'client_manager')
    ON CONFLICT DO NOTHING;

    -- Categorias e conta padrão
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

-- Permitir que o dono da empresa (cliente) edite os dados dela
DROP POLICY IF EXISTS "Owner can update own company" ON public.companies;
CREATE POLICY "Owner can update own company"
ON public.companies
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
