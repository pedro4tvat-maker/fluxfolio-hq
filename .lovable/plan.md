# SISTEMAFP PJ — Plano de Implementação (MVP)

Sistema de gestão financeira para consultorias, com dois perfis (Consultor e Cliente), backend completo em Lovable Cloud, layout profissional azul escuro + verde/vermelho/âmbar, e dados de demonstração.

## 1. Arquitetura

- **Frontend**: TanStack Start + React + Tailwind v4 + shadcn/ui
- **Backend**: Lovable Cloud (Postgres + Auth + RLS)
- **Estado**: TanStack Query + server functions (`createServerFn`)
- **Layout**: Sidebar fixa colapsável, header com troca de empresa (consultor)
- **Responsivo**: desktop / tablet / mobile (sidebar vira drawer no mobile)

## 2. Design System

Tokens em `src/styles.css` (oklch):
- `--primary` azul escuro corporativo (~#0F2A4A)
- `--success` verde, `--destructive` vermelho, `--warning` âmbar
- `--muted` cinza claro para fundos
- Cards com `rounded-2xl`, sombras suaves
- Tipografia: Inter (body) + Sora (headings)
- Badges de status (Saudável / Atenção / Crítico)

## 3. Banco de dados (Cloud)

Tabelas com RLS por `company_id` + tabela `user_roles` (enum: `consultant`, `client_manager`, `operator`):

- `profiles` (id, full_name, email)
- `user_roles` (user_id, role)
- `companies` (id, nome, responsável, cnpj, telefone, email, segmento, cidade, uf, observações, data_inicio, ativo, owner_id)
- `company_members` (company_id, user_id, role) — vincula clientes/operadores a empresas; consultor enxerga tudo
- `categories` (company_id, nome, tipo: entrada/saida)
- `cost_centers` (company_id, nome)
- `financial_accounts` (company_id, nome, tipo, ativo)
- `transactions` (company_id, data, tipo, descrição, categoria_id, centro_custo_id, forma_pagto, conta_id, valor, status, observações, payable_id?, receivable_id?)
- `payables` (company_id, descrição, fornecedor, categoria_id, valor, vencimento, data_pagto, status, forma_pagto, conta_id, recorrência, parcelas, observações)
- `receivables` (company_id, cliente, descrição, categoria_id, valor, vencimento, data_receb, status, forma_receb, conta_id, recorrência, parcelas, observações)
- `budgets` (company_id, mes, ano, categoria_id, valor_orcado, observações)
- `products` (company_id, nome, categoria, fornecedor, quantidade, custo, preço_venda, estoque_min)
- `stock_movements` (company_id, product_id, tipo, quantidade, custo_unit, data, motivo, observações)

Função SECURITY DEFINER `has_role()` + `is_consultant()` + `user_has_company_access(company_id)` para policies. GRANTs explícitos em todas as tabelas.

**Regra-chave anti-duplicação**: quando uma `payable` vira `pago` ou `receivable` vira `recebido`, um trigger Postgres cria automaticamente o `transaction` correspondente vinculado por `payable_id`/`receivable_id`. Reverter o status apaga a transaction.

## 4. Telas

### Autenticação
- `/login` — email + senha, mostrar/ocultar, indicador de força, link recuperar
- `/signup` — cadastro (primeiro user vira consultor)
- `/reset-password`
- Roteamento pós-login conforme papel

### Consultor (`/_authenticated/consultor`)
- `/consultor/clientes` — grid de cards por empresa: saldo, entradas/saídas mês, resultado, vencidos, último lançamento, badge de status
- `/consultor/clientes/novo` e `/editar/:id`
- Ao clicar no card → entra no contexto da empresa

### Cliente / Empresa (`/_authenticated/empresa/$companyId/...`)
- `/dashboard` — cards principais + alertas inteligentes + resumo do mês
- `/fluxo-caixa` — tabela + filtros (data, tipo, categoria, status) + modal novo lançamento
- `/contas-pagar` — KPIs + tabela com destaques de cor + modal + ação "marcar como pago"
- `/contas-receber` — análogo
- `/orcamento` — barras de progresso orçado×realizado por categoria/mês
- `/estoque` — produtos, entrada/saída, alertas de mínimo
- `/relatorios` — 6 tipos de relatório com filtros de período + botões PDF/CSV (CSV funcional, PDF preparado)
- `/configuracoes` — abas: empresa, categorias, centros de custo, contas financeiras, usuários

## 5. Cálculos centrais

- Saldo da conta = soma das transactions `realizado` (entrada +, saída −)
- Saldo da empresa = soma de todas as contas
- Resultado do mês = entradas realizadas − saídas realizadas no mês
- Orçado×realizado = sum(transactions realizadas) no mês/categoria
- Status orçamento: ≤70 ok, 70–90 atenção, 90–100 perto, >100 estourado
- Status empresa: derivado de resultado, vencidos e orçamento

Todos os agregados via server functions usando o cliente autenticado (RLS aplica).

## 6. Alertas inteligentes (dashboard)

Calculados no server: contas vencidas, recebimentos vencidos, orçamento >90%, estoque abaixo do mínimo, sem lançamento há >3 dias, projeção de caixa negativa.

## 7. Dados de demonstração

Seed automático no primeiro signup: 3 empresas, 10 lançamentos, 5 a pagar, 5 a receber, 5 orçamentos, 5 produtos, categorias/centros/contas padrão.

## 8. Fora do escopo (conforme pedido)

NF-e, integração bancária, maquininha, folha, PDV, fiscal avançado, CRM, app nativo.

## 9. Ordem de execução

1. Ativar Lovable Cloud
2. Migration completa (tabelas + RLS + triggers + seed function)
3. Design system + layout (sidebar, header)
4. Auth (login, signup, reset, guards por papel)
5. Painel do consultor + CRUD empresas
6. Contexto de empresa + dashboard
7. Fluxo de caixa
8. Contas a pagar + trigger
9. Contas a receber + trigger
10. Orçamento
11. Estoque
12. Relatórios + export CSV
13. Configurações
14. Seed de demonstração + QA de navegação/responsividade

## Detalhes técnicos

- Server functions sob `src/lib/*.functions.ts` com `requireSupabaseAuth`
- `attachSupabaseAuth` em `src/start.ts`
- Roteamento: `_authenticated.tsx` (gate), `_authenticated.consultor.*`, `_authenticated.empresa.$companyId.*`
- Validação com Zod em todos os formulários e inputValidators
- Componentes shadcn customizados via variants (sem className ad-hoc de cor)

Aprova esse plano para eu começar a construir?