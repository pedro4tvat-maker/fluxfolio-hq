# Auditoria — vendas do revendedor Kaique Mafra

Revendedor: Kaique Mafra, centro de estoque "Kaique", comissão cadastrada 4,5455%.

## O que os dados mostram (verificado no banco)

Vendas marcadas com o revendedor (base da prestação de contas hoje):

- À vista: 29 vendas, R$ 8.580,00 — comissão lançada R$ 389,99
- A prazo: 32 vendas, R$ 21.610,00 — comissão lançada R$ 982,27
- Total: 61 vendas, R$ 30.190,00 — comissão R$ 1.372,26

Conferência da comissão: bate com 4,5455% em 100% dos registros (diferença total de R$ 0,02 por arredondamento). Nenhum registro sem comissão.

## Divergências encontradas

1. Duas vendas saíram do estoque do Kaique mas NÃO estão atribuídas a ele, portanto ficam fora da prestação de contas:
   - 25/06/2026 — OS K0002 — "Venda (1x Café Rio de contas)" — R$ 225,00
   - 25/06/2026 — OS K0003 — "1O GOURMET 1 FARD RIO DE CONTAS" — R$ 480,00
   - Total oculto: R$ 705,00 (comissão não calculada de aproximadamente R$ 32,05)

2. Sete lançamentos atribuídos ao Kaique não têm baixa de estoque no centro dele (2 à vista, R$ 1.540,00; 5 a prazo, R$ 4.180,00). Podem ser serviços, acertos ou vendas lançadas sem movimentação — precisam de conferência caso a caso, não são necessariamente erro.

3. Riscos de leitura no relatório atual:
   - O período padrão é apenas os últimos 30 dias, então ao abrir a tela o total aparece bem menor que o real.
   - As vendas a prazo são filtradas pela data de vencimento, não pela data da venda — parcelas futuras entram em meses errados.

Conclusão: os valores das 61 vendas atribuídas estão corretos e confiáveis; o problema é de cobertura (2 vendas de fato do Kaique fora da conta) e de leitura do período.

## O que proponho corrigir

1. Tela de prestação de contas
   - Período padrão passa a ser o mês corrente, com atalhos rápidos (mês atual, últimos 90 dias, ano, tudo).
   - Vendas a prazo passam a ser filtradas pela data da venda (data de emissão) e não pelo vencimento, mantendo a coluna de vencimento visível.
   - Novo painel "Conferência de integridade" no topo, listando:
     - vendas com saída do estoque do revendedor sem atribuição a ele (as duas acima), com botão "Atribuir ao revendedor" que grava o vínculo e recalcula a comissão;
     - vendas atribuídas sem baixa de estoque no centro dele, apenas como aviso;
     - total conferido x total atribuído, para o relatório nunca esconder diferença.
   - O PDF exportado passa a incluir esse bloco de conferência e o período usado.

2. Nenhum dado será apagado. A atribuição das duas vendas só acontece se você clicar em "Atribuir ao revendedor" — nada é alterado automaticamente.

## Detalhes técnicos

- `src/routes/app.revendedores.tsx` (`SettlementTab`): ajustar `dateFrom` padrão, trocar o filtro de `receivables` de `vencimento` para a data da venda, adicionar consultas de reconciliação cruzando `stock_movements` (por `stock_location_id` do revendedor, `tipo='saida'`, `related_sale_id/related_sale_type`) contra `transactions.reseller_id` e `receivables.reseller_id`.
- Ação de atribuir: `update` em `transactions`/`receivables` setando `reseller_id` e `commission_value = valor * commission_pct / 100`, com invalidação das queries do módulo.
- Sem alterações de banco de dados.
