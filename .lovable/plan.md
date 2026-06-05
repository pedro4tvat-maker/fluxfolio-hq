
## Diagnóstico

Encontrei duas causas distintas — uma no banco, outra no front. Os dados estão íntegros: as 4 empresas-cliente existem, todas com vínculo em `company_members`, e há 1 consultor cadastrado com código `FP-PEDROGUILH-EA450`.

### 1) Cadastro não encontra o código do consultor

As funções RPC `find_consultant_by_code` e `search_consultants` só têm permissão `EXECUTE` para os papéis `authenticated` e `service_role` — não para `anon`. Como o usuário está deslogado durante o cadastro, a chamada não retorna dados e o front mostra "Código de convite não encontrado", mesmo para códigos válidos.

### 2) "Empresa não encontrada" depois do login (área cliente)

No `ClientDashboard` (`src/routes/app.index.tsx`), o ramo de erro `!company || !data` é exibido durante uma janela legítima de carregamento:

- `selected` começa `null` (SSR/hidratação do `localStorage`); um `useEffect` é quem define a empresa default depois que `companies` chega.
- Enquanto `selected` é `null`, a query `client-dashboard-v2` fica com `enabled: false`, então `isLoading` é `false` e `data` é `undefined`.
- Resultado: o guard `companyLoading || isLoading` passa direto e cai em "Empresa não encontrada", mesmo a empresa existindo.

O usuário fica preso nessa tela porque, em alguns casos, a rota não re-renderiza após o `useEffect` definir `selected` (a tela "fixa" a primeira renderização).

## Correções

### A. Migration — liberar RPCs para anônimos no fluxo de cadastro
```sql
GRANT EXECUTE ON FUNCTION public.find_consultant_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_consultants(text) TO anon;
```
Essas funções já são `SECURITY INVOKER` e retornam apenas campos públicos do consultor (nome da consultoria, cidade, estado), seguro para expor no signup.

### B. Front — gate de carregamento correto no ClientDashboard

Em `src/routes/app.index.tsx` (`ClientDashboard`):

- Substituir o guard atual por um que aguarde também a definição de `selected` quando há empresas disponíveis:
  - Mostrar "Carregando seu dashboard..." enquanto `companyLoading`, `isLoading` **ou** (`companies.length > 0 && !selected`).
- Só após esse gate, avaliar:
  - sem empresas → "Nenhuma empresa encontrada";
  - com empresa selecionada mas sem `data` → continuar em loading (não mostrar mais "Empresa não encontrada"; esse estado era um falso negativo).
- Manter o `useEffect` no `useSelectedCompany` que já define o fallback (`companies[0].id`), garantindo que `selected` é sempre preenchido quando houver vínculos.

### C. Verificação

- Recriar cadastro de cliente informando o código `FP-PEDROGUILH-EA450` → deve achar "Finanças em Propósito".
- Login com um dos clientes existentes (ex.: Kellen) → dashboard da empresa deve abrir direto, sem cair em "Empresa não encontrada".
- Conferir que o painel do consultor continua funcionando (sem mudanças nessa rota).

## Escopo

Apenas dois arquivos tocados: nova migration (grants) e ajuste de guards no `src/routes/app.index.tsx`. Nenhuma alteração no painel do consultor, nas políticas RLS ou no `useSelectedCompany`.
