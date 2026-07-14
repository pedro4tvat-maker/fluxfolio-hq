## Módulo "Dados Históricos Gerenciais"

Novo módulo para lançar snapshots mensais consolidados de meses anteriores ao início do uso do sistema, alimentando o Relatório Executivo Gerencial sem tocar em estoque, OS, sale_items, transactions, receivables, payables ou fluxo de caixa atual.

### 1. Banco de dados (migração)

**Tabela `public.historical_financial_snapshots`**
Todos os campos pedidos: `company_id`, `branch_id`, `reference_month` (1–12), `reference_year`, `period_start`, `period_end`, `source_type` (enum), `source_description`, receita bruta/líquida, `sales_count`, `average_ticket`, custos variáveis/fixos, despesas (fixas, variáveis, financeiras, folha, marketing, administrativas, operacionais, outras), impostos, descontos, devoluções, valores de margem (bruta, contribuição, operacional), resultado operacional/líquido, contas a receber/pagar (abertas/vencidas), `inventory_value`, `notes`, `status` (rascunho/conferido/aprovado/substituído), `created_by`, `created_at`, `updated_at`, `deleted_at`.
Constraint UNIQUE parcial em (`company_id`, `branch_id`, `reference_year`, `reference_month`) WHERE `deleted_at IS NULL`.

**Tabela `public.historical_financial_snapshot_versions`**
`snapshot_id`, `old_data jsonb`, `new_data jsonb`, `changed_by`, `changed_at`, `change_reason`. Trigger BEFORE UPDATE grava versão.

**Enum `historical_source_type`**: manual, planilha, relatorio_antigo, extrato, sistema_anterior, contabilidade, estimativa_cliente, outro.

**RLS + GRANTS** (SELECT/INSERT/UPDATE/DELETE para authenticated, ALL para service_role):
- Consultor/owner/membro da empresa lê e escreve seus snapshots (via `owner_id`, `company_members`, `consultant_company_links`).
- Cliente lê sempre; edita apenas se `allow_client_edit` (flag na empresa já existente ou default false — inicialmente somente consultor edita, conforme pedido).

### 2. Server functions (`src/lib/historical.functions.ts`)
- `listHistoricalSnapshots({ companyId, branchId? })`
- `getHistoricalSnapshot({ id })`
- `upsertHistoricalSnapshot({ ...payload, changeReason? })` — recalcula campos derivados (ticket médio, margens, resultado operacional), valida (mês/ano/empresa obrigatórios, receita líquida ≤ bruta salvo justificativa em notes, sem valores negativos), grava versão.
- `deleteHistoricalSnapshot({ id })` — soft delete.
- `importHistoricalSnapshotsPreview({ rows })` e `importHistoricalSnapshotsCommit({ rows })` — CSV/planilha, resolve empresa por nome, mostra prévia, faz upsert com confirmação.

### 3. UI

**Menu** (`src/routes/app.tsx`):
- Consultor: novo item "Dados Históricos" → `/app/historicos`.
- Cliente (grupo Gerenciamento): "Dados Históricos" → `/app/historicos` (visualização; edição só se consultor).

**Rota `src/routes/app.historicos.tsx`**
- Header: seleção de empresa + filial + botão "Novo snapshot" + botão "Importar planilha".
- Tabela listagem: mês/ano, receita bruta, líquida, custos, despesas, resultado operacional, margem %, origem, status, ações (visualizar, editar, excluir).
- Filtros por ano/status.
- Badges de alertas (receita líquida > bruta, margem negativa, custo > 70%, despesa fixa > 40%, incompleto).

**Componentes** (`src/components/historicos/`):
- `SnapshotForm.tsx` — formulário completo com cálculo automático em tempo real. Aviso de duplicidade oferece "editar existente" ou "criar nova versão" (nova versão marca antigo como `substituido`).
- `SnapshotImportModal.tsx` — upload CSV, parse, prévia, commit.
- `SnapshotAlerts.tsx` — regras determinísticas.
- `SnapshotStatusBadge.tsx`.

### 4. Integração com Relatório Executivo Gerencial

Em `src/lib/reports.ts`:
- Nova função `fetchHistoricalSnapshots(companyId, branchId, start, end)`.
- `buildSerieMensal` estendido: para cada mês do período, verifica se há snapshot histórico e/ou dados operacionais reais.
  - Sem operacional + com snapshot → usa snapshot, marca `source: 'historico'`.
  - Com operacional completo → usa real, marca `source: 'operacional'`.
  - Ambos → marca `source: 'conflito'` e devolve os dois; UI mostra seletor.
- KPIs agregados respeitam a fonte escolhida por mês.

Em `src/routes/app.executivo.tsx`:
- Toggle "Fonte por período": Automático (padrão) / Só operacional / Só histórico / Comparar.
- Etiqueta visual "Dados históricos lançados manualmente" nas células/pontos de gráfico de meses que vieram de snapshot.
- Aviso quando há conflito no mesmo mês.

### 5. Isolamento
Nenhuma escrita em `transactions`, `receivables`, `payables`, `stock_movements`, `sale_items`, `products`, `os_renumbering_log`. Todo cálculo derivado fica em `historical_financial_snapshots`. Snapshots nunca aparecem em Fluxo de Caixa, Vendas, Estoque, DRE de caixa da tela atual — só no Relatório Executivo Gerencial e na tela de Dados Históricos.

### 6. Auditoria
- Trigger de versão em `historical_financial_snapshot_versions`.
- `audit_log` já existente é acionado via trigger genérico se aplicável (opcional; a tabela de versões cobre o histórico completo).

### 7. Exportação
- Botão "Exportar PDF" via `window.print()` com CSS específico.
- Botão "Exportar CSV".
- Botão "Resumo WhatsApp" (modal com texto formatado e copiar).

### 8. Como testar
1. Login como consultor, selecionar empresa cliente.
2. Menu → Dados Históricos → Novo snapshot para abril/2026, maio/2026, junho/2026 com receitas, custos, despesas.
3. Verificar cálculos (ticket médio, margens, resultado operacional).
4. Ir em Análise Gerencial, período abril–julho, ver série mensal misturando snapshot (abr–jun) + operacional (jul).
5. Confirmar que Fluxo de Caixa, Estoque, Vendas, Contas continuam intactos.
6. Testar importação CSV com 3 meses.
7. Editar snapshot e conferir versão criada em `historical_financial_snapshot_versions`.

### Arquivos previstos
- Migração SQL (tabelas + enum + policies + grants + trigger de versão).
- `src/lib/historical.functions.ts`
- `src/routes/app.historicos.tsx`
- `src/components/historicos/SnapshotForm.tsx`, `SnapshotImportModal.tsx`, `SnapshotAlerts.tsx`, `SnapshotStatusBadge.tsx`
- Edições em `src/routes/app.tsx` (menu), `src/lib/reports.ts` (fonte por período), `src/routes/app.executivo.tsx` (seletor + etiquetas).

### Fora de escopo
- Importação detalhada que gera vendas/estoque reais (fluxo futuro dedicado).
- Aprovação com assinatura eletrônica do cliente (v2).

Confirma que posso seguir?
