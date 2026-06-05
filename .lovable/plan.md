## Diagnóstico

Encontrei a causa real do "Carregando seu dashboard..." que nunca termina.

A chamada do front a `company_members` está retornando **HTTP 500** do Postgres com a mensagem:

```
54001 - stack depth limit exceeded
```

### Por que isso acontece

A função `public.user_has_company_access(_user_id, _company_id)` é declarada como **SECURITY INVOKER** (não DEFINER). Ela é usada nas policies de RLS de `companies` e `company_members`:

- Policy de `company_members` chama `user_has_company_access(...)`
- `user_has_company_access` faz `SELECT FROM public.company_members` e `SELECT FROM public.companies`
- Esses SELECTs são reavaliados pela RLS, que **chama a função de novo**
- Resultado: recursão infinita → estouro de pilha → 500

Como a query falha, `useSelectedCompany` devolve `companies = []`, `selected` continua `null` e o gate atual fica preso em "Carregando seu dashboard..." (porque a query do dashboard nunca habilita e `data` nunca chega).

Isso explica também por que ora aparece "Nenhuma empresa encontrada" (quando o erro é tratado como lista vazia), ora fica em loading eterno (quando o React Query mantém estado pendente após erro intermitente).

A área do consultor funciona porque ela usa `select * from companies` direto (sem ir pela função recursiva no caminho rápido) e o consultor tem acesso via outras checagens.

## Correção

Uma única migration, mínima e cirúrgica.

### 1. Tornar `user_has_company_access` SECURITY DEFINER

Isso é exatamente o mesmo padrão que já é usado em `has_role` e `is_consultant` no template — funções chamadas dentro de policies devem rodar com privilégios elevados para **não** disparar RLS recursiva.

```sql
CREATE OR REPLACE FUNCTION public.user_has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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
    );
$$;
```

Como a função só recebe `_user_id` e `_company_id` como parâmetros, não há risco de privilege escalation — ela responde sempre exatamente "este usuário tem acesso a esta empresa?".

### 2. Verificação

- Login da Kellen (`kellenhillarygm@gmail.com`) → a chamada a `company_members` retorna 1 linha → `selected` é preenchido → dashboard da empresa abre normalmente.
- Painel do consultor continua intacto (não toca em policies, só na função).
- Demais telas do cliente (Fluxo de Caixa, Vendas, Estoque, etc.), que também passam por `user_has_company_access` via RLS, voltam a responder em vez de retornar 500.

## Escopo

Apenas uma migration. **Nenhuma alteração de policy, código React ou hook.** O gate de loading no `ClientDashboard` já está correto — ele estava só refletindo o erro do banco.