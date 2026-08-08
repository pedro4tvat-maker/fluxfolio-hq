# Controle híbrido das ferramentas de recuperação

Objetivo: manter a detecção automática atual (as abas "Reconstrução de Vendas" e "Correção de Centro de Estoque das OSs" aparecem quando há pendências reais), e adicionar um controle manual para você forçar exibir ou ocultar quando quiser.

## Como vai funcionar

Em Configurações → Estruturas auxiliares, um novo bloco "Ferramentas de recuperação" com três opções:

- Automático (padrão): aparece só quando o sistema detecta pendências.
- Sempre visível: as duas abas ficam no menu mesmo sem pendências.
- Sempre oculto: as abas somem do menu mesmo havendo pendências.

A escolha é salva por empresa no próprio navegador e vale imediatamente no menu lateral. Quando a opção for "Sempre oculto" e existirem pendências, o bloco mostra um aviso discreto informando quantas pendências continuam abertas, para não esquecer delas.

Nenhum dado é apagado e as telas continuam acessíveis pela URL mesmo quando ocultas.

## Detalhes técnicos

- `src/hooks/use-recovery-flags.ts`: adicionar leitura da preferência (`localStorage`, chave `sfp:recovery_tools:<companyId>`, valores `auto | show | hide`) e aplicar sobre o resultado atual. Expor também `hasPending` e um `setMode` para o componente de configuração.
- `src/routes/app.tsx`: nenhuma mudança de lógica necessária — já filtra pelos flags do hook.
- `src/routes/app.configuracoes.tsx`: novo card na aba "Estruturas auxiliares" com um grupo de rádio/select para as três opções e o aviso de pendências.
- Sem alterações no banco de dados.
