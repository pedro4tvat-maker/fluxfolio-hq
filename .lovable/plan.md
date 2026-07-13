
## Relatório Executivo Gerencial (Análise Gerencial)

Vou **evoluir** a tela `/app/executivo` que já existe (hoje é um diagnóstico mensal simples salvo em `executive_reports`) para o dashboard gerencial descrito, reutilizando 100% das funções de cálculo já em `src/lib/reports.ts` (`fetchReportData`, `buildDRE`, `buildVendasMargem`, `buildLucroOperacional`, `buildMargemContribuicao`, `buildPontoEquilibrio`, `buildComparativo`, etc.) e as fontes já corretas (`sale_items`, `transactions`, `receivables`, `payables`, `stock_movements`, `products`, `categories`, `cost_centers`). Nada de recalcular margem por descrição/OS.

### Menu
- Renomear a entrada existente `Relatórios consolidados` **não** — em vez disso, adicionar novo item no menu do **consultor** e do **cliente**: `Análise Gerencial` → `/app/executivo` (mantém a rota, mas a UI é reconstruída). O antigo diagnóstico salvo continua acessível dentro da nova tela como aba "Diagnóstico do consultor".

### UI / Fluxo

Cabeçalho de filtros:
- Empresa (consultor) / Filial / Período inicial / Período final / Modo de comparação (`Mensal | Trimestral | Anual`) / Toggle "Incluir gráficos" / Toggle "Incluir análise IA" / Botão "Gerar".

Estrutura da tela (uma página, seções âncora):
1. **Cabeçalho executivo** — nome da empresa, período analisado, data de geração, logo.
2. **Cards de indicadores** (topo, grid responsivo) — todos os KPIs listados (receita bruta, líquida, custos variáveis, despesas fixas/variáveis/financeiras, resultado e margem operacional, margem de contribuição, lucro líquido, crescimento da receita, variação do lucro, ticket médio, qtd vendas, contas vencidas, a receber, a pagar, ponto de equilíbrio). Cada card mostra valor + variação vs período anterior com seta e cor semântica (nunca vermelho por "faturou menos" isoladamente — segue a regra já memorizada).
3. **Gráficos** (Recharts, já usado no projeto):
   - Receita bruta × líquida por mês (barras agrupadas)
   - Resultado operacional por mês (barras)
   - Composição custos/despesas sobre receita (stacked 100%)
   - Margem operacional por mês (linha)
   - Evolução do faturamento (área)
   - Vendas por centro de estoque (barras horizontais)
   - Top produtos por faturamento / maior margem / menor margem (3 tabelas-mini)
   - Despesas por categoria (donut)
   - Contas a receber vencidas por faixa de atraso (barras)
4. **Tabela comparativa mensal** — meses lado a lado com variação % e observação automática.
5. **Destaques do período** — gerados por regra (não IA): crescimentos, quedas, alertas.
6. **Alertas automáticos** — regras determinísticas listadas.
7. **Inconsistências encontradas** — validador (ver abaixo). Se lista vazia, seção fica oculta.
8. **Análise consultiva com IA** (opcional) — só executa ao clicar "Gerar análise". Envia **apenas os indicadores já calculados** (JSON) para o Lovable AI Gateway; prompt do sistema proíbe inventar números. Retorna Resumo executivo / Pontos positivos / Pontos de atenção / Recomendações / Próximas ações.
9. **Diagnóstico do consultor** (aba/collapse) — mantém o textarea salvo em `executive_reports` que já existe hoje.
10. **Rodapé** — "Relatório gerado pelo SistemaFP PJ — Finanças em Propósito".

### Exportações
Botões na barra superior:
- **Exportar PDF** — via `window.print()` com `@media print` estilizado (padrão do projeto, sem nova dependência).
- **Versão WhatsApp** — abre modal com texto resumido (receita, lucro/margem, ponto de atenção, próxima ação) + botão copiar.
- **Versão resumida** — imprime só cards + destaques.
- **Salvar relatório** — persiste snapshot JSON em `executive_reports` (campo novo `snapshot jsonb`, ver migração).
- **Compartilhar com cliente** — copia link `/app/executivo?company=...&start=...&end=...`.

### Cálculos e fontes
Reutiliza integralmente:
- `sale_items` como fonte oficial de itens vendidos (`buildVendasMargem`, `buildMargemContribuicao`).
- `transactions` + `receivables` para receita bruta; canceladas (`status='cancelado'`) excluídas.
- Custos variáveis = `Σ sale_items.unit_cost × quantity` **para a linha de margem**, e categorias marcadas `variable_cost` **para a DRE de caixa** — deixando explícito na UI qual visão está sendo mostrada (memória do usuário: DRE usa caixa, margem usa custo do produto).
- Ticket médio = receita bruta / nº de vendas (`transactions.tipo='entrada' + receivables`).
- Crescimento, variação: já em `buildComparativo`, expandido para N períodos.

### Validador de inconsistências
Nova função `buildInconsistencias(data, period)` em `src/lib/reports.ts`:
- vendas sem `sale_items`
- itens com `unit_price`, `unit_cost` ou `quantity` = 0
- vendas com `status='cancelado'` somando em totais (checagem defensiva)
- `receivables` sem `sale_id` vinculado
- OS duplicadas (`os_code` repetido em transactions+receivables)
- produtos sem `custo_unitario`
- venda com `valor` divergente de `Σ sale_items.total_revenue`

Retorna `{ os_code, cliente, problema, impacto, acao_sugerida }[]`.

### IA
- Server function `generateExecutiveAnalysis` em `src/lib/executive-ai.functions.ts` com `requireSupabaseAuth`.
- Model: `google/gemini-2.5-flash` via Lovable AI Gateway (`LOVABLE_API_KEY`).
- Input: objeto com KPIs, série mensal, top produtos, destaques, inconsistências.
- Prompt: "Você é consultor financeiro. Use APENAS os números fornecidos. Não invente. Responda no formato: Resumo executivo / Pontos positivos / Pontos de atenção / Recomendações / Próximas ações."
- Trata 429 e 402 com toast claro.

### Persistência (migração)
Adicionar colunas em `executive_reports`:
- `snapshot jsonb` — KPIs e séries do relatório salvo
- `ia_analysis text` — última análise IA
- `periodo_inicio date`, `periodo_fim date` — para relatórios multi-mês
Índice em `(company_id, branch_id, periodo_inicio, periodo_fim)`.
Policies existentes (por `company_id`) já cobrem RLS; sem mudança.

### Design
Paleta brandbook Finanças em Propósito aplicada via tokens em `src/styles.css` (adicionar se faltar): `--fep-green`, `--fep-green-2`, `--fep-support`, `--fep-light`, `--fep-graphite`, `--fep-offwhite`, `--fep-sand`, `--fep-neutral`. Componentes usam esses tokens; sem dourado/azul/preto dominante/verde neon. Print CSS remove sidebar e botões.

### Permissões
- Consultor: vê empresas via `companies` (RLS já filtra por `owner_id` + `consultant_company_links`).
- Cliente: seleção limitada a `company_members` (hook `useSelectedCompany` já existe).
- `branch_id` respeitado em todos os filtros (já implementado em `fetchReportData`).

### Arquivos previstos
- `src/routes/app.executivo.tsx` — reescrito (mantém rota, mantém diagnóstico salvo dentro de aba).
- `src/components/executivo/KpiCard.tsx`, `ChartsSection.tsx`, `ComparativoTable.tsx`, `DestaquesSection.tsx`, `AlertasSection.tsx`, `InconsistenciasSection.tsx`, `IAAnalysisSection.tsx`, `WhatsAppModal.tsx`, `ExecPrintStyles.tsx`.
- `src/lib/reports.ts` — adiciona `buildInconsistencias`, `buildSerieMensal(company, branch, periodoInicio, periodoFim)`, `buildDestaques`, `buildAlertas`.
- `src/lib/executive-ai.functions.ts` — server fn IA.
- `src/routes/app.tsx` — adiciona item de menu "Análise Gerencial" para cliente e consultor.
- Migração SQL para colunas novas em `executive_reports`.

### Testes manuais
Executar com empresa que tenha ≥ 3 meses de vendas: validar receita bruta/mês, receita líquida, custo total, margem total, resultado operacional, gráficos, tabela comparativa, inconsistências, PDF (print), WhatsApp, IA.

### Fora de escopo (proponho não fazer nesta iteração)
- Geração real de arquivo `.pptx` (o botão "Gerar apresentação" abre a versão print otimizada em landscape em vez de gerar pptx nativo).
- Múltiplas filiais lado a lado no mesmo relatório (já existe `buildComparativoFiliais`, mas UI dedicada ficaria para v2).

Confirma que posso seguir com essa abordagem?
