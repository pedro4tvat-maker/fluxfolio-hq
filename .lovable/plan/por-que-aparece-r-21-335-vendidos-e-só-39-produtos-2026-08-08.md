# Por que aparece R$ 21.335 vendidos e só 39 produtos

## O que os dados mostram (verificado no banco)

Em julho/2026, o Kaique tem 46 vendas atribuídas, somando R$ 21.355,00 — e essas 46 vendas correspondem a **97 unidades** de produto, não 39.

O número 39 aparece porque a tabela de produtos da prestação de contas conta as unidades pela **data da baixa no estoque**, enquanto o valor vendido é contado pela **data da venda**. Nas vendas a prazo do Kaique a baixa de estoque foi registrada bem depois da venda. Exemplos reais:

- K0020 a K0024 — vendas de 11/07, baixa no estoque em 03/08 (19 unidades)
- K0033, K0035, K0036, K0037 — vendas de 22/07, baixa em 15/08 e 17/08 (18 unidades)
- K0045, K0048, K0051, K0052, K0054 — vendas do fim de julho, baixa entre 23/08 e 29/08 (19 unidades)

Ou seja: em julho o painel mostra o dinheiro de 46 vendas, mas só as unidades cujo movimento de estoque caiu dentro de julho. Nada foi perdido — é só o critério de data diferente entre as duas metades da tela.

## O que proponho corrigir

1. **Unidades vendidas passam a seguir as mesmas vendas do período.** A coluna "Vendidos" e o total de unidades serão calculados a partir das baixas de estoque **ligadas às vendas do período** (pelo vínculo venda → movimento), e não pela data do movimento. Assim, julho passará a mostrar 97 unidades para os R$ 21.355,00.

2. **Valor vendido por produto coerente.** O valor por produto passa a usar o valor real das vendas ligadas, rateado pelos itens, em vez do preço de tabela do cadastro.

3. **As colunas de logística continuam por data de movimento** — "Enviados", "Devolvidos", "Transferidos" e o saldo em posse do revendedor seguem a movimentação física do período, que é o critério correto para elas. A tabela ganha uma legenda explicando essa diferença.

4. **Aviso de defasagem.** Quando existirem vendas do período cuja baixa de estoque ficou fora dele (ou vice-versa), o painel mostra um aviso com a quantidade envolvida, para o número nunca mais parecer inconsistente.

5. O PDF exportado passa a refletir os mesmos critérios e a legenda.

Nenhum dado será apagado ou alterado no banco — a mudança é apenas de cálculo e exibição.

## Detalhes técnicos

- `src/routes/app.revendedores.tsx` (`SettlementTab`):
  - nova query buscando `stock_movements` por `related_sale_id in (ids das vendas do período)` com `tipo='saida'` e `motivo='Venda'`, usada para `vendidos` e `valorVendido` por produto;
  - `movs` (por data) continua alimentando `enviados`, `devolvidos`, `transferidos` e saldo em posse;
  - `totalVendidos` passa a vir do conjunto ligado às vendas; comparação com o conjunto por data gera o aviso de defasagem;
  - `exportSettlementPDF` recebe os mesmos totais e a legenda.
