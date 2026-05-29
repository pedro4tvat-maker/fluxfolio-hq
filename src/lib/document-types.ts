// Document type registry for the Consultant Library generator.
// Each type declares its category, label, form fields, and a template
// renderer that converts form_data into the initial generated content.

export type FieldType =
  | "text" | "textarea" | "number" | "date" | "select"
  | "currency" | "checkbox" | "list" | "table";

export interface DocField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
  help?: string;
  columns?: { key: string; label: string; type?: FieldType }[]; // for table
}

export interface DocSection {
  title: string;
  fields: DocField[];
}

export interface DocTypeDef {
  key: string;
  label: string;
  category: string;
  description: string;
  sections: DocSection[];
  render: (data: Record<string, any>, ctx: RenderCtx) => string;
}

export interface RenderCtx {
  empresa?: { nome?: string; cnpj?: string; responsavel?: string; cidade?: string; estado?: string };
  consultor?: { nome?: string; consultoria?: string };
  hoje: string;
}

const fmtDate = (s?: string) => {
  if (!s) return "___/___/______";
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
};

const fmtCurrency = (v: any) => {
  const n = Number(v);
  if (!isFinite(n)) return "R$ ___";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const v = (x: any, fallback = "_____") => {
  if (x === undefined || x === null || x === "") return fallback;
  return String(x);
};

const list = (arr: any, bullet = "- ") => {
  if (!arr) return `${bullet}_____`;
  if (Array.isArray(arr)) return arr.filter(Boolean).map((x) => `${bullet}${x}`).join("\n") || `${bullet}_____`;
  return String(arr).split("\n").filter(Boolean).map((x) => `${bullet}${x}`).join("\n");
};

// ============================================================
// CONTRATO DE CONSULTORIA
// ============================================================
const CONTRATO: DocTypeDef = {
  key: "contrato_consultoria",
  label: "Contrato de Consultoria",
  category: "contratos",
  description: "Contrato completo de prestação de serviços de consultoria.",
  sections: [
    {
      title: "Contratante",
      fields: [
        { key: "contratante_nome", label: "Razão social", type: "text", required: true },
        { key: "contratante_fantasia", label: "Nome fantasia", type: "text" },
        { key: "contratante_cnpj", label: "CNPJ", type: "text" },
        { key: "contratante_endereco", label: "Endereço", type: "text" },
        { key: "contratante_cidade", label: "Cidade", type: "text" },
        { key: "contratante_estado", label: "Estado", type: "text" },
        { key: "contratante_representante", label: "Representante legal", type: "text" },
        { key: "contratante_cpf_rep", label: "CPF do representante", type: "text" },
        { key: "contratante_email", label: "E-mail", type: "text" },
        { key: "contratante_telefone", label: "Telefone", type: "text" },
      ],
    },
    {
      title: "Contratada (Consultoria)",
      fields: [
        { key: "contratada_nome", label: "Nome da consultoria", type: "text", required: true },
        { key: "contratada_cnpj", label: "CNPJ/CPF da consultoria", type: "text" },
        { key: "contratada_endereco", label: "Endereço", type: "text" },
        { key: "contratada_cidade", label: "Cidade", type: "text" },
        { key: "contratada_estado", label: "Estado", type: "text" },
        { key: "contratada_responsavel", label: "Consultor responsável", type: "text" },
        { key: "contratada_email", label: "E-mail", type: "text" },
        { key: "contratada_telefone", label: "Telefone", type: "text" },
      ],
    },
    {
      title: "Serviço",
      fields: [
        { key: "servico_tipo", label: "Tipo de serviço", type: "text" },
        { key: "servico_escopo", label: "Escopo da consultoria", type: "textarea" },
        { key: "servico_descricao", label: "Descrição dos serviços", type: "textarea" },
        { key: "servico_entregaveis", label: "Entregáveis incluídos (um por linha)", type: "textarea" },
        { key: "servico_modulos", label: "Módulos incluídos", type: "textarea" },
        { key: "servico_reunioes", label: "Reuniões incluídas", type: "text" },
        { key: "servico_frequencia", label: "Frequência de reuniões", type: "text" },
        { key: "servico_canais", label: "Canais de atendimento", type: "text" },
        { key: "servico_exclusoes", label: "O que NÃO está incluso", type: "textarea" },
      ],
    },
    {
      title: "Financeiro",
      fields: [
        { key: "fin_valor_mensal", label: "Valor mensal (R$)", type: "currency" },
        { key: "fin_valor_total", label: "Valor total do contrato (R$)", type: "currency" },
        { key: "fin_forma_pagamento", label: "Forma de pagamento", type: "text" },
        { key: "fin_dia_vencimento", label: "Dia de vencimento", type: "number" },
        { key: "fin_multa", label: "Multa por atraso (%)", type: "text" },
        { key: "fin_juros", label: "Juros por atraso", type: "text" },
        { key: "fin_reajuste", label: "Reajuste anual", type: "text" },
        { key: "fin_cancelamento", label: "Condições de cancelamento", type: "textarea" },
        { key: "fin_aviso_previo", label: "Prazo de aviso prévio", type: "text" },
      ],
    },
    {
      title: "Vigência",
      fields: [
        { key: "vig_inicio", label: "Data de início", type: "date" },
        { key: "vig_termino", label: "Data de término", type: "date" },
        { key: "vig_prazo", label: "Prazo do contrato", type: "text" },
        { key: "vig_renovacao", label: "Renovação automática", type: "select", options: ["Sim", "Não"] },
        { key: "vig_cond_renovacao", label: "Condições de renovação", type: "textarea" },
      ],
    },
    {
      title: "Assinatura",
      fields: [
        { key: "ass_cidade", label: "Cidade da assinatura", type: "text" },
        { key: "ass_data", label: "Data da assinatura", type: "date" },
        { key: "ass_test1_nome", label: "Testemunha 1 — Nome", type: "text" },
        { key: "ass_test1_cpf", label: "Testemunha 1 — CPF", type: "text" },
        { key: "ass_test2_nome", label: "Testemunha 2 — Nome", type: "text" },
        { key: "ass_test2_cpf", label: "Testemunha 2 — CPF", type: "text" },
      ],
    },
  ],
  render: (d) => `# CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE CONSULTORIA

**CONTRATANTE:** ${v(d.contratante_nome)}, ${d.contratante_fantasia ? `nome fantasia "${d.contratante_fantasia}", ` : ""}inscrita no CNPJ sob nº ${v(d.contratante_cnpj)}, com sede em ${v(d.contratante_endereco)}, ${v(d.contratante_cidade)}/${v(d.contratante_estado)}, neste ato representada por ${v(d.contratante_representante)}, CPF ${v(d.contratante_cpf_rep)}.

**CONTRATADA:** ${v(d.contratada_nome)}, inscrita no CNPJ/CPF sob nº ${v(d.contratada_cnpj)}, com sede em ${v(d.contratada_endereco)}, ${v(d.contratada_cidade)}/${v(d.contratada_estado)}, representada por ${v(d.contratada_responsavel)}.

As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços de Consultoria, que se regerá pelas cláusulas seguintes:

## CLÁUSULA 1ª — DO OBJETO
A CONTRATADA prestará à CONTRATANTE serviços de ${v(d.servico_tipo, "consultoria empresarial")}, conforme escopo descrito abaixo:

${v(d.servico_escopo)}

### 1.1 Descrição dos serviços
${v(d.servico_descricao)}

### 1.2 Entregáveis
${list(d.servico_entregaveis)}

### 1.3 Reuniões e atendimento
- Reuniões incluídas: ${v(d.servico_reunioes)}
- Frequência: ${v(d.servico_frequencia)}
- Canais de atendimento: ${v(d.servico_canais)}

### 1.4 Exclusões
${v(d.servico_exclusoes, "Não há exclusões específicas.")}

## CLÁUSULA 2ª — DAS OBRIGAÇÕES DA CONTRATADA
2.1. Executar os serviços com diligência e qualidade técnica.
2.2. Manter sigilo sobre informações da CONTRATANTE.
2.3. Entregar os produtos previstos no escopo nos prazos acordados.

## CLÁUSULA 3ª — DAS OBRIGAÇÕES DA CONTRATANTE
3.1. Fornecer informações e documentos necessários à execução dos serviços.
3.2. Efetuar os pagamentos nas datas avençadas.
3.3. Designar interlocutor para tratativas com a CONTRATADA.

## CLÁUSULA 4ª — DO VALOR E FORMA DE PAGAMENTO
4.1. Valor mensal: ${fmtCurrency(d.fin_valor_mensal)}.
4.2. Valor total do contrato: ${fmtCurrency(d.fin_valor_total)}.
4.3. Forma de pagamento: ${v(d.fin_forma_pagamento)}.
4.4. Vencimento: todo dia ${v(d.fin_dia_vencimento)} de cada mês.
4.5. Em caso de atraso, multa de ${v(d.fin_multa, "2")}% e juros de ${v(d.fin_juros, "1% a.m.")}.
4.6. Reajuste: ${v(d.fin_reajuste, "anual pelo IPCA")}.

## CLÁUSULA 5ª — DA VIGÊNCIA
5.1. Início em ${fmtDate(d.vig_inicio)} e término em ${fmtDate(d.vig_termino)}.
5.2. Prazo: ${v(d.vig_prazo)}.
5.3. Renovação automática: ${v(d.vig_renovacao, "Não")}. ${v(d.vig_cond_renovacao, "")}

## CLÁUSULA 6ª — DA RESCISÃO
6.1. O contrato poderá ser rescindido mediante aviso prévio de ${v(d.fin_aviso_previo, "30 dias")}.
6.2. ${v(d.fin_cancelamento, "Em caso de rescisão antecipada, serão devidos os valores até a data efetiva do encerramento.")}

## CLÁUSULA 7ª — DA CONFIDENCIALIDADE
7.1. As partes obrigam-se a manter sigilo de todas as informações trocadas, inclusive após o término do contrato.

## CLÁUSULA 8ª — PROTEÇÃO DE DADOS (LGPD)
8.1. As partes comprometem-se a tratar dados pessoais em conformidade com a Lei nº 13.709/2018.

## CLÁUSULA 9ª — PROPRIEDADE
9.1. Os materiais produzidos serão de propriedade da CONTRATANTE após o pagamento integral.

## CLÁUSULA 10ª — LIMITAÇÃO DE RESPONSABILIDADE
10.1. A CONTRATADA não responde por decisões de gestão tomadas pela CONTRATANTE.

## CLÁUSULA 11ª — DO FORO
11.1. Fica eleito o foro da comarca de ${v(d.ass_cidade, d.contratante_cidade)} para dirimir quaisquer controvérsias.

E por estarem assim justos e contratados, firmam o presente instrumento.

${v(d.ass_cidade)}, ${fmtDate(d.ass_data)}.


_____________________________________
${v(d.contratante_nome)}
CONTRATANTE


_____________________________________
${v(d.contratada_nome)}
CONTRATADA


**Testemunhas:**

1) ${v(d.ass_test1_nome)} — CPF ${v(d.ass_test1_cpf)}

2) ${v(d.ass_test2_nome)} — CPF ${v(d.ass_test2_cpf)}
`,
};

// ============================================================
// PROPOSTA COMERCIAL
// ============================================================
const PROPOSTA: DocTypeDef = {
  key: "proposta_comercial",
  label: "Proposta Comercial",
  category: "propostas",
  description: "Proposta comercial estruturada para prospects.",
  sections: [
    {
      title: "Prospect",
      fields: [
        { key: "prospect_empresa", label: "Empresa", type: "text", required: true },
        { key: "prospect_cnpj", label: "CNPJ", type: "text" },
        { key: "prospect_responsavel", label: "Responsável", type: "text" },
        { key: "prospect_cargo", label: "Cargo", type: "text" },
        { key: "prospect_email", label: "E-mail", type: "text" },
        { key: "prospect_telefone", label: "Telefone", type: "text" },
      ],
    },
    {
      title: "Proposta",
      fields: [
        { key: "titulo", label: "Título da proposta", type: "text", required: true },
        { key: "servico", label: "Serviço proposto", type: "text" },
        { key: "diagnostico", label: "Diagnóstico resumido do problema", type: "textarea" },
        { key: "objetivo", label: "Objetivo da consultoria", type: "textarea" },
        { key: "escopo", label: "Escopo do serviço", type: "textarea" },
        { key: "metodologia", label: "Metodologia de trabalho", type: "textarea" },
        { key: "entregaveis", label: "Entregáveis (um por linha)", type: "textarea" },
        { key: "cronograma", label: "Cronograma", type: "textarea" },
        { key: "investimento", label: "Investimento (R$)", type: "currency" },
        { key: "pagamento", label: "Formas de pagamento", type: "text" },
        { key: "validade", label: "Validade da proposta", type: "text" },
        { key: "beneficios", label: "Benefícios esperados", type: "textarea" },
        { key: "proximos_passos", label: "Próximos passos", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# ${v(d.titulo, "Proposta Comercial")}

**De:** ${v(ctx.consultor?.consultoria, ctx.consultor?.nome)}
**Para:** ${v(d.prospect_empresa)} — ${v(d.prospect_responsavel)} (${v(d.prospect_cargo)})
**Data:** ${ctx.hoje}
**Validade:** ${v(d.validade, "15 dias")}

---

## 1. Apresentação
Apresentamos a seguir nossa proposta de ${v(d.servico, "consultoria")} para ${v(d.prospect_empresa)}.

## 2. Diagnóstico da necessidade
${v(d.diagnostico)}

## 3. Objetivo
${v(d.objetivo)}

## 4. Escopo
${v(d.escopo)}

## 5. Metodologia
${v(d.metodologia)}

## 6. Entregáveis
${list(d.entregaveis)}

## 7. Cronograma
${v(d.cronograma)}

## 8. Investimento
${fmtCurrency(d.investimento)}

**Formas de pagamento:** ${v(d.pagamento)}

## 9. Benefícios esperados
${v(d.beneficios)}

## 10. Próximos passos
${v(d.proximos_passos)}

---

**Aceite**

Declaro que li e aceito os termos desta proposta.

${v(d.prospect_empresa)}, ____ / ____ / ______

_____________________________________
${v(d.prospect_responsavel)}
`,
};

// ============================================================
// ATA DE REUNIÃO
// ============================================================
const ATA: DocTypeDef = {
  key: "ata_reuniao",
  label: "Ata de Reunião",
  category: "atas",
  description: "Ata estruturada de reunião de consultoria.",
  sections: [
    {
      title: "Reunião",
      fields: [
        { key: "data", label: "Data", type: "date", required: true },
        { key: "hora_inicio", label: "Horário inicial", type: "text" },
        { key: "hora_fim", label: "Horário final", type: "text" },
        { key: "local", label: "Local ou link", type: "text" },
        { key: "tipo", label: "Tipo de reunião", type: "select", options: ["Diagnóstico", "Acompanhamento", "Apresentação", "Fechamento", "Outro"] },
        { key: "participantes", label: "Participantes (um por linha)", type: "textarea" },
      ],
    },
    {
      title: "Conteúdo",
      fields: [
        { key: "pauta", label: "Pauta (um item por linha)", type: "textarea" },
        { key: "relato", label: "Relato livre da reunião", type: "textarea", help: "Você pode editar livremente; este texto será reorganizado na ata." },
        { key: "pontos", label: "Principais pontos discutidos", type: "textarea" },
        { key: "decisoes", label: "Decisões tomadas", type: "textarea" },
        { key: "pendencias", label: "Pendências (uma por linha)", type: "textarea" },
        { key: "responsaveis", label: "Responsáveis e prazos", type: "textarea" },
        { key: "proximos_passos", label: "Próximos passos", type: "textarea" },
        { key: "observacoes", label: "Observações finais", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# Ata de Reunião — ${v(ctx.empresa?.nome)}

**Data:** ${fmtDate(d.data)} | **Horário:** ${v(d.hora_inicio)} às ${v(d.hora_fim)}
**Local:** ${v(d.local)}
**Tipo:** ${v(d.tipo)}
**Consultor:** ${v(ctx.consultor?.nome)}

## Participantes
${list(d.participantes)}

## Pauta
${list(d.pauta, "1. ")}

## Resumo
${v(d.relato)}

## Pontos discutidos
${list(d.pontos)}

## Decisões
${list(d.decisoes)}

## Pendências
${list(d.pendencias)}

## Responsáveis e prazos
${v(d.responsaveis)}

## Próximos passos
${v(d.proximos_passos)}

## Observações
${v(d.observacoes)}
`,
};

// ============================================================
// DIAGNÓSTICO FINANCEIRO
// ============================================================
const DIAGNOSTICO: DocTypeDef = {
  key: "diagnostico_financeiro",
  label: "Diagnóstico Financeiro",
  category: "diagnosticos",
  description: "Diagnóstico estruturado da saúde financeira do cliente.",
  sections: [
    {
      title: "Identificação",
      fields: [
        { key: "data_diag", label: "Data do diagnóstico", type: "date" },
        { key: "segmento", label: "Segmento", type: "text" },
        { key: "responsavel", label: "Responsável na empresa", type: "text" },
      ],
    },
    {
      title: "Blocos avaliados",
      fields: [
        { key: "b_org", label: "Organização financeira — situação e recomendações", type: "textarea" },
        { key: "b_fluxo", label: "Fluxo de caixa", type: "textarea" },
        { key: "b_pagar", label: "Contas a pagar", type: "textarea" },
        { key: "b_receber", label: "Contas a receber", type: "textarea" },
        { key: "b_precif", label: "Precificação", type: "textarea" },
        { key: "b_estoque", label: "Estoque", type: "textarea" },
        { key: "b_orcamento", label: "Orçamento", type: "textarea" },
        { key: "b_endiv", label: "Endividamento", type: "textarea" },
        { key: "b_lucr", label: "Lucratividade", type: "textarea" },
        { key: "b_ind", label: "Indicadores", type: "textarea" },
        { key: "b_rotina", label: "Gestão e rotina", type: "textarea" },
      ],
    },
    {
      title: "Conclusão",
      fields: [
        { key: "pontuacao", label: "Pontuação geral (0-100)", type: "number" },
        { key: "classificacao", label: "Classificação", type: "select", options: ["Crítico", "Frágil", "Em desenvolvimento", "Saudável", "Excelente"] },
        { key: "fragilidades", label: "Principais fragilidades", type: "textarea" },
        { key: "fortes", label: "Pontos fortes", type: "textarea" },
        { key: "recomendacoes", label: "Recomendações prioritárias", type: "textarea" },
        { key: "plano", label: "Plano inicial sugerido", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# Diagnóstico Financeiro — ${v(ctx.empresa?.nome)}

**CNPJ:** ${v(ctx.empresa?.cnpj)} | **Segmento:** ${v(d.segmento)}
**Responsável:** ${v(d.responsavel, ctx.empresa?.responsavel)}
**Data:** ${fmtDate(d.data_diag)}
**Consultor:** ${v(ctx.consultor?.nome)}

## 1. Organização financeira
${v(d.b_org)}

## 2. Fluxo de caixa
${v(d.b_fluxo)}

## 3. Contas a pagar
${v(d.b_pagar)}

## 4. Contas a receber
${v(d.b_receber)}

## 5. Precificação
${v(d.b_precif)}

## 6. Estoque
${v(d.b_estoque)}

## 7. Orçamento
${v(d.b_orcamento)}

## 8. Endividamento
${v(d.b_endiv)}

## 9. Lucratividade
${v(d.b_lucr)}

## 10. Indicadores
${v(d.b_ind)}

## 11. Gestão e rotina
${v(d.b_rotina)}

---

## Conclusão
- **Pontuação geral:** ${v(d.pontuacao)} / 100
- **Classificação:** ${v(d.classificacao)}

### Principais fragilidades
${v(d.fragilidades)}

### Pontos fortes
${v(d.fortes)}

### Recomendações prioritárias
${v(d.recomendacoes)}

### Plano inicial sugerido
${v(d.plano)}
`,
};

// ============================================================
// RELATÓRIO EXECUTIVO MENSAL
// ============================================================
const RELATORIO_EXEC: DocTypeDef = {
  key: "relatorio_executivo",
  label: "Relatório Executivo Mensal",
  category: "relatorios",
  description: "Relatório mensal consolidado para a diretoria do cliente.",
  sections: [
    {
      title: "Período",
      fields: [
        { key: "periodo", label: "Período analisado", type: "text", placeholder: "Ex.: Maio/2026" },
        { key: "resumo", label: "Resumo executivo", type: "textarea" },
      ],
    },
    {
      title: "Indicadores financeiros",
      fields: [
        { key: "receita", label: "Receita do mês (R$)", type: "currency" },
        { key: "despesas", label: "Despesas do mês (R$)", type: "currency" },
        { key: "resultado", label: "Resultado do mês (R$)", type: "currency" },
        { key: "fluxo", label: "Fluxo de caixa", type: "textarea" },
        { key: "dre", label: "DRE gerencial", type: "textarea" },
        { key: "pagar", label: "Contas a pagar", type: "textarea" },
        { key: "receber", label: "Contas a receber", type: "textarea" },
        { key: "orc_real", label: "Orçado x realizado", type: "textarea" },
        { key: "kpis", label: "Indicadores / KPIs", type: "textarea" },
      ],
    },
    {
      title: "Operacional",
      fields: [
        { key: "vendas", label: "Vendas", type: "textarea" },
        { key: "estoque", label: "Estoque", type: "textarea" },
        { key: "precif", label: "Precificação / margem", type: "textarea" },
        { key: "endiv", label: "Endividamento", type: "textarea" },
        { key: "giro", label: "Capital de giro", type: "textarea" },
        { key: "compar", label: "Comparativo com mês anterior", type: "textarea" },
      ],
    },
    {
      title: "Diagnóstico e ações",
      fields: [
        { key: "diag", label: "Diagnóstico do consultor", type: "textarea" },
        { key: "riscos", label: "Riscos identificados", type: "textarea" },
        { key: "recom", label: "Recomendações", type: "textarea" },
        { key: "plano", label: "Plano de ação", type: "textarea" },
        { key: "proximos", label: "Próximos passos", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# Relatório Executivo Mensal — ${v(ctx.empresa?.nome)}

**Período:** ${v(d.periodo)} | **CNPJ:** ${v(ctx.empresa?.cnpj)}
**Consultor:** ${v(ctx.consultor?.nome)}

## Resumo executivo
${v(d.resumo)}

## Resultado do mês
| Indicador | Valor |
|-----------|-------|
| Receita | ${fmtCurrency(d.receita)} |
| Despesas | ${fmtCurrency(d.despesas)} |
| Resultado | ${fmtCurrency(d.resultado)} |

## Fluxo de caixa
${v(d.fluxo)}

## DRE gerencial
${v(d.dre)}

## Contas a pagar
${v(d.pagar)}

## Contas a receber
${v(d.receber)}

## Orçado x realizado
${v(d.orc_real)}

## KPIs
${v(d.kpis)}

## Vendas
${v(d.vendas)}

## Estoque
${v(d.estoque)}

## Precificação e margem
${v(d.precif)}

## Endividamento
${v(d.endiv)}

## Capital de giro
${v(d.giro)}

## Comparativo com mês anterior
${v(d.compar)}

## Diagnóstico do consultor
${v(d.diag)}

## Riscos identificados
${v(d.riscos)}

## Recomendações
${v(d.recom)}

## Plano de ação
${v(d.plano)}

## Próximos passos
${v(d.proximos)}
`,
};

// ============================================================
// PLANO DE AÇÃO
// ============================================================
const PLANO_ACAO: DocTypeDef = {
  key: "plano_acao",
  label: "Plano de Ação",
  category: "planos_acao",
  description: "Plano de ação consultivo com tabela de ações.",
  sections: [
    {
      title: "Contexto",
      fields: [
        { key: "periodo", label: "Período", type: "text" },
        { key: "objetivo", label: "Objetivo do plano", type: "textarea" },
        { key: "problema", label: "Problema identificado", type: "textarea" },
        { key: "origem", label: "Origem", type: "select", options: ["Diagnóstico", "Reunião", "Relatório", "KPI", "Solicitação"] },
      ],
    },
    {
      title: "Ações",
      fields: [
        {
          key: "acoes", label: "Ações", type: "table",
          columns: [
            { key: "acao", label: "Ação" },
            { key: "responsavel", label: "Responsável" },
            { key: "prazo", label: "Prazo" },
            { key: "prioridade", label: "Prioridade" },
            { key: "status", label: "Status" },
            { key: "resultado", label: "Resultado esperado" },
          ],
        },
        { key: "recursos", label: "Recursos necessários", type: "textarea" },
        { key: "indicador", label: "Indicador de sucesso", type: "textarea" },
        { key: "observacoes", label: "Observações", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => {
    const rows = Array.isArray(d.acoes) ? d.acoes : [];
    const table = rows.length
      ? `| Ação | Responsável | Prazo | Prioridade | Status | Resultado |
|------|-------------|-------|------------|--------|-----------|
${rows.map((r: any) => `| ${v(r.acao)} | ${v(r.responsavel)} | ${v(r.prazo)} | ${v(r.prioridade)} | ${v(r.status)} | ${v(r.resultado)} |`).join("\n")}`
      : "_Nenhuma ação cadastrada._";
    return `# Plano de Ação — ${v(ctx.empresa?.nome)}

**Período:** ${v(d.periodo)} | **Origem:** ${v(d.origem)}
**Consultor:** ${v(ctx.consultor?.nome)}

## Objetivo
${v(d.objetivo)}

## Problema identificado
${v(d.problema)}

## Ações
${table}

## Recursos necessários
${v(d.recursos)}

## Indicador de sucesso
${v(d.indicador)}

## Observações
${v(d.observacoes)}
`;
  },
};

// ============================================================
// CHECKLIST DE ONBOARDING
// ============================================================
const ONBOARDING_ITEMS = [
  "Confirmar dados da empresa", "Confirmar CNPJ", "Confirmar responsável financeiro",
  "Criar acesso do cliente", "Vincular consultor", "Cadastrar contas financeiras",
  "Cadastrar categorias", "Solicitar extratos bancários", "Solicitar contas a pagar",
  "Solicitar contas a receber", "Solicitar lista de produtos", "Solicitar documentos da empresa",
  "Agendar reunião inicial", "Explicar uso do sistema", "Definir prazos de envio",
];

const CHECKLIST_ONB: DocTypeDef = {
  key: "checklist_onboarding",
  label: "Checklist de Onboarding",
  category: "checklists",
  description: "Checklist padrão de onboarding de cliente.",
  sections: [
    {
      title: "Dados gerais",
      fields: [
        { key: "data_inicio", label: "Data de início", type: "date" },
        { key: "responsavel_empresa", label: "Responsável da empresa", type: "text" },
      ],
    },
    {
      title: "Itens",
      fields: [
        {
          key: "itens", label: "Itens do onboarding", type: "table",
          columns: [
            { key: "item", label: "Item" },
            { key: "responsavel", label: "Responsável" },
            { key: "prazo", label: "Prazo" },
            { key: "status", label: "Status" },
            { key: "observacao", label: "Observação" },
          ],
        },
      ],
    },
  ],
  render: (d, ctx) => {
    const rows: any[] = Array.isArray(d.itens) && d.itens.length
      ? d.itens
      : ONBOARDING_ITEMS.map((i) => ({ item: i, status: "Pendente" }));
    return `# Checklist de Onboarding — ${v(ctx.empresa?.nome)}

**Início:** ${fmtDate(d.data_inicio)} | **Consultor:** ${v(ctx.consultor?.nome)}
**Responsável na empresa:** ${v(d.responsavel_empresa)}

| Item | Responsável | Prazo | Status | Observação |
|------|-------------|-------|--------|------------|
${rows.map((r) => `| ${v(r.item)} | ${v(r.responsavel)} | ${v(r.prazo)} | ${v(r.status, "Pendente")} | ${v(r.observacao)} |`).join("\n")}
`;
  },
};

// ============================================================
// CHECKLIST DE DOCUMENTOS
// ============================================================
const DOC_ITEMS = [
  "Cartão CNPJ", "Contrato social", "Extratos bancários", "Relatório de vendas",
  "Lista de produtos", "Lista de preços", "Contas a pagar", "Contas a receber",
  "Folha de pagamento", "Dívidas / parcelamentos", "Notas fiscais",
  "Contratos com fornecedores", "Comprovantes importantes",
];

const CHECKLIST_DOC: DocTypeDef = {
  key: "checklist_documentos",
  label: "Checklist de Documentos",
  category: "checklists",
  description: "Lista de documentos solicitados ao cliente.",
  sections: [
    {
      title: "Solicitação",
      fields: [
        { key: "data_solicitacao", label: "Data de solicitação", type: "date" },
        { key: "prazo_envio", label: "Prazo de envio", type: "date" },
        { key: "responsavel", label: "Responsável", type: "text" },
      ],
    },
    {
      title: "Documentos",
      fields: [
        {
          key: "documentos", label: "Documentos", type: "table",
          columns: [
            { key: "doc", label: "Documento" },
            { key: "status", label: "Status" },
            { key: "data_envio", label: "Data envio" },
            { key: "observacao", label: "Observação" },
          ],
        },
      ],
    },
  ],
  render: (d, ctx) => {
    const rows: any[] = Array.isArray(d.documentos) && d.documentos.length
      ? d.documentos
      : DOC_ITEMS.map((i) => ({ doc: i, status: "Solicitado" }));
    return `# Checklist de Documentos — ${v(ctx.empresa?.nome)}

**Solicitação:** ${fmtDate(d.data_solicitacao)} | **Prazo:** ${fmtDate(d.prazo_envio)}
**Responsável:** ${v(d.responsavel)}

| Documento | Status | Data envio | Observação |
|-----------|--------|------------|------------|
${rows.map((r) => `| ${v(r.doc)} | ${v(r.status)} | ${v(r.data_envio)} | ${v(r.observacao)} |`).join("\n")}
`;
  },
};

// ============================================================
// PRECIFICAÇÃO
// ============================================================
const PRECIFICACAO: DocTypeDef = {
  key: "relatorio_precificacao",
  label: "Relatório de Precificação",
  category: "precificacao",
  description: "Análise de precificação de produto/serviço.",
  sections: [
    {
      title: "Produto",
      fields: [
        { key: "produto", label: "Produto ou serviço", type: "text", required: true },
        { key: "custo_base", label: "Custo base (R$)", type: "currency" },
        { key: "custos_diretos", label: "Custos diretos (R$)", type: "currency" },
        { key: "desp_var", label: "Despesas variáveis (R$)", type: "currency" },
        { key: "impostos", label: "Impostos (%)", type: "number" },
        { key: "taxas", label: "Taxas (%)", type: "number" },
        { key: "comissao", label: "Comissão (%)", type: "number" },
        { key: "preco_atual", label: "Preço atual (R$)", type: "currency" },
        { key: "preco_sugerido", label: "Preço sugerido (R$)", type: "currency" },
        { key: "margem_atual", label: "Margem atual (%)", type: "number" },
        { key: "margem_desejada", label: "Margem desejada (%)", type: "number" },
        { key: "lucro_estimado", label: "Lucro estimado (R$)", type: "currency" },
      ],
    },
    {
      title: "Análise",
      fields: [
        { key: "diagnostico", label: "Diagnóstico da precificação", type: "textarea" },
        { key: "recomendacoes", label: "Recomendações", type: "textarea" },
        { key: "riscos", label: "Riscos", type: "textarea" },
        { key: "proximos", label: "Próximos passos", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# Relatório de Precificação — ${v(ctx.empresa?.nome)}

**Produto/Serviço:** ${v(d.produto)}
**Consultor:** ${v(ctx.consultor?.nome)}

## Composição de preço
| Item | Valor |
|------|-------|
| Custo base | ${fmtCurrency(d.custo_base)} |
| Custos diretos | ${fmtCurrency(d.custos_diretos)} |
| Despesas variáveis | ${fmtCurrency(d.desp_var)} |
| Impostos | ${v(d.impostos)}% |
| Taxas | ${v(d.taxas)}% |
| Comissão | ${v(d.comissao)}% |

## Comparativo de preço
| Indicador | Atual | Sugerido |
|-----------|-------|----------|
| Preço | ${fmtCurrency(d.preco_atual)} | ${fmtCurrency(d.preco_sugerido)} |
| Margem | ${v(d.margem_atual)}% | ${v(d.margem_desejada)}% |
| Lucro estimado | — | ${fmtCurrency(d.lucro_estimado)} |

## Diagnóstico
${v(d.diagnostico)}

## Recomendações
${v(d.recomendacoes)}

## Riscos
${v(d.riscos)}

## Próximos passos
${v(d.proximos)}
`,
};

// ============================================================
// DRE GERENCIAL
// ============================================================
const DRE: DocTypeDef = {
  key: "dre_gerencial",
  label: "Relatório DRE Gerencial",
  category: "dre",
  description: "DRE gerencial estruturada.",
  sections: [
    {
      title: "Período",
      fields: [{ key: "periodo", label: "Período", type: "text" }],
    },
    {
      title: "Linhas da DRE",
      fields: [
        { key: "receita_bruta", label: "Receita bruta", type: "currency" },
        { key: "deducoes", label: "Deduções", type: "currency" },
        { key: "receita_liquida", label: "Receita líquida", type: "currency" },
        { key: "custos_var", label: "Custos variáveis", type: "currency" },
        { key: "margem_contrib", label: "Margem de contribuição", type: "currency" },
        { key: "custos_fixos", label: "Custos fixos", type: "currency" },
        { key: "desp_op", label: "Despesas operacionais", type: "currency" },
        { key: "resultado_op", label: "Resultado operacional", type: "currency" },
        { key: "desp_fin", label: "Despesas financeiras", type: "currency" },
        { key: "lucro_liquido", label: "Lucro líquido", type: "currency" },
        { key: "margem_liquida", label: "Margem líquida (%)", type: "number" },
      ],
    },
    {
      title: "Análise",
      fields: [
        { key: "analise", label: "Análise do consultor", type: "textarea" },
        { key: "recomendacoes", label: "Recomendações", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# DRE Gerencial — ${v(ctx.empresa?.nome)}

**Período:** ${v(d.periodo)} | **CNPJ:** ${v(ctx.empresa?.cnpj)}

| Linha | Valor |
|-------|-------|
| Receita bruta | ${fmtCurrency(d.receita_bruta)} |
| (-) Deduções | ${fmtCurrency(d.deducoes)} |
| **Receita líquida** | ${fmtCurrency(d.receita_liquida)} |
| (-) Custos variáveis | ${fmtCurrency(d.custos_var)} |
| **Margem de contribuição** | ${fmtCurrency(d.margem_contrib)} |
| (-) Custos fixos | ${fmtCurrency(d.custos_fixos)} |
| (-) Despesas operacionais | ${fmtCurrency(d.desp_op)} |
| **Resultado operacional** | ${fmtCurrency(d.resultado_op)} |
| (-) Despesas financeiras | ${fmtCurrency(d.desp_fin)} |
| **Lucro líquido** | ${fmtCurrency(d.lucro_liquido)} |
| Margem líquida | ${v(d.margem_liquida)}% |

## Análise
${v(d.analise)}

## Recomendações
${v(d.recomendacoes)}
`,
};

// ============================================================
// TERMO DE ENCERRAMENTO
// ============================================================
const TERMO_ENC: DocTypeDef = {
  key: "termo_encerramento",
  label: "Termo de Encerramento",
  category: "encerramento",
  description: "Termo de encerramento de contrato de consultoria.",
  sections: [
    {
      title: "Dados",
      fields: [
        { key: "data_inicio", label: "Data de início do contrato", type: "date" },
        { key: "data_encerramento", label: "Data de encerramento", type: "date" },
        { key: "motivo", label: "Motivo do encerramento", type: "textarea" },
        { key: "entregas", label: "Entregas realizadas", type: "textarea" },
        { key: "pendencias", label: "Pendências finais", type: "textarea" },
        { key: "declaracao", label: "Declaração de encerramento", type: "textarea" },
        { key: "cidade", label: "Cidade", type: "text" },
      ],
    },
  ],
  render: (d, ctx) => `# Termo de Encerramento

A **${v(ctx.empresa?.nome)}**, CNPJ ${v(ctx.empresa?.cnpj)}, e a consultoria **${v(ctx.consultor?.consultoria)}**, declaram o encerramento do contrato de consultoria iniciado em ${fmtDate(d.data_inicio)} e encerrado em ${fmtDate(d.data_encerramento)}.

## Motivo
${v(d.motivo)}

## Entregas realizadas
${v(d.entregas)}

## Pendências finais
${v(d.pendencias)}

## Declaração
${v(d.declaracao, "As partes declaram que não há débitos ou obrigações pendentes além das listadas acima.")}

${v(d.cidade)}, ${fmtDate(d.data_encerramento)}.


_____________________________________
${v(ctx.empresa?.nome)} — CONTRATANTE


_____________________________________
${v(ctx.consultor?.consultoria)} — CONTRATADA
`,
};

// ============================================================
// TERMO DE RENOVAÇÃO
// ============================================================
const TERMO_REN: DocTypeDef = {
  key: "termo_renovacao",
  label: "Termo de Renovação",
  category: "encerramento",
  description: "Termo de renovação de contrato de consultoria.",
  sections: [
    {
      title: "Renovação",
      fields: [
        { key: "contrato_original", label: "Contrato original (referência)", type: "text" },
        { key: "nova_inicio", label: "Início da renovação", type: "date" },
        { key: "nova_termino", label: "Término da renovação", type: "date" },
        { key: "novo_valor", label: "Novo valor mensal (R$)", type: "currency" },
        { key: "condicoes", label: "Condições atualizadas", type: "textarea" },
        { key: "servicos", label: "Serviços incluídos", type: "textarea" },
        { key: "cidade", label: "Cidade", type: "text" },
      ],
    },
  ],
  render: (d, ctx) => `# Termo de Renovação Contratual

As partes **${v(ctx.empresa?.nome)}** (CNPJ ${v(ctx.empresa?.cnpj)}) e **${v(ctx.consultor?.consultoria)}**, em referência ao contrato ${v(d.contrato_original)}, acordam sua renovação nos termos abaixo.

## Nova vigência
De ${fmtDate(d.nova_inicio)} a ${fmtDate(d.nova_termino)}.

## Novo valor
${fmtCurrency(d.novo_valor)} mensais.

## Condições atualizadas
${v(d.condicoes)}

## Serviços incluídos
${v(d.servicos)}

${v(d.cidade)}, ${fmtDate(d.nova_inicio)}.


_____________________________________
${v(ctx.empresa?.nome)} — CONTRATANTE


_____________________________________
${v(ctx.consultor?.consultoria)} — CONTRATADA
`,
};

// ============================================================
// MENSAGEM PARA CLIENTE
// ============================================================
const MENSAGEM: DocTypeDef = {
  key: "mensagem_cliente",
  label: "Mensagem para Cliente",
  category: "mensagens",
  description: "Mensagem editável para WhatsApp ou e-mail.",
  sections: [
    {
      title: "Mensagem",
      fields: [
        { key: "tipo", label: "Tipo de mensagem", type: "select", options: ["Cobrar pendência", "Enviar relatório", "Confirmar reunião", "Solicitar documento", "Agradecer reunião", "Enviar plano de ação", "Avisar atraso", "Outro"] },
        { key: "tom", label: "Tom", type: "select", options: ["Formal", "Cordial", "Direto", "Informal"] },
        { key: "responsavel", label: "Responsável (destinatário)", type: "text" },
        { key: "objetivo", label: "Objetivo da mensagem", type: "textarea" },
        { key: "informacoes", label: "Informações principais", type: "textarea" },
        { key: "prazo", label: "Prazo (se houver)", type: "text" },
        { key: "cta", label: "Call to action", type: "text" },
      ],
    },
  ],
  render: (d, ctx) => `Olá, ${v(d.responsavel, ctx.empresa?.responsavel)}!

${v(d.objetivo, "Estamos entrando em contato sobre nossa consultoria.")}

${v(d.informacoes)}

${d.prazo ? `Prazo: ${d.prazo}\n` : ""}
${v(d.cta, "Fico à disposição.")}

Atenciosamente,
${v(ctx.consultor?.nome)}
${v(ctx.consultor?.consultoria)}
`,
};

// ============================================================
// OUTRO / Personalizado
// ============================================================
const OUTRO: DocTypeDef = {
  key: "outro",
  label: "Documento personalizado",
  category: "outros",
  description: "Documento em formato livre.",
  sections: [
    {
      title: "Conteúdo",
      fields: [
        { key: "conteudo", label: "Conteúdo do documento", type: "textarea" },
      ],
    },
  ],
  render: (d, ctx) => `# ${v(d.titulo, "Documento")}

${v(d.conteudo)}

---
${v(ctx.consultor?.nome)} — ${ctx.hoje}
`,
};

export const DOCUMENT_TYPES: DocTypeDef[] = [
  CONTRATO, PROPOSTA, ATA, DIAGNOSTICO, RELATORIO_EXEC, PLANO_ACAO,
  CHECKLIST_ONB, CHECKLIST_DOC, PRECIFICACAO, DRE, TERMO_ENC, TERMO_REN,
  MENSAGEM, OUTRO,
];

export const DOCUMENT_TYPES_MAP: Record<string, DocTypeDef> =
  Object.fromEntries(DOCUMENT_TYPES.map((d) => [d.key, d]));

export const DOCUMENT_CATEGORIES = [
  { v: "contratos", l: "Contratos" },
  { v: "propostas", l: "Propostas comerciais" },
  { v: "atas", l: "Atas" },
  { v: "diagnosticos", l: "Diagnósticos" },
  { v: "relatorios", l: "Relatórios" },
  { v: "planos_acao", l: "Planos de ação" },
  { v: "checklists", l: "Checklists" },
  { v: "precificacao", l: "Precificação" },
  { v: "dre", l: "DRE gerencial" },
  { v: "encerramento", l: "Encerramento / renovação" },
  { v: "mensagens", l: "Mensagens" },
  { v: "outros", l: "Outros" },
] as const;

export const STATUS_OPTIONS = [
  { v: "rascunho", l: "Rascunho" },
  { v: "gerado", l: "Gerado" },
  { v: "em_revisao", l: "Em revisão" },
  { v: "finalizado", l: "Finalizado" },
  { v: "compartilhado", l: "Compartilhado com cliente" },
  { v: "enviado_assinatura", l: "Enviado para assinatura" },
  { v: "assinado", l: "Assinado" },
  { v: "arquivado", l: "Arquivado" },
] as const;

export const SIGNATURE_STATUS_OPTIONS = [
  { v: "nao_enviado", l: "Não enviado" },
  { v: "enviado", l: "Enviado" },
  { v: "aguardando", l: "Aguardando assinatura" },
  { v: "assinado", l: "Assinado" },
  { v: "recusado", l: "Recusado" },
  { v: "cancelado", l: "Cancelado" },
] as const;

// Apply dynamic placeholders against rendered text
export function applyDynamicFields(text: string, ctx: RenderCtx & { extras?: Record<string, string> }): string {
  const map: Record<string, string> = {
    "{{nome_empresa}}": ctx.empresa?.nome ?? "",
    "{{cnpj_empresa}}": ctx.empresa?.cnpj ?? "",
    "{{nome_responsavel}}": ctx.empresa?.responsavel ?? "",
    "{{nome_consultor}}": ctx.consultor?.nome ?? "",
    "{{nome_consultoria}}": ctx.consultor?.consultoria ?? "",
    "{{data}}": ctx.hoje,
    ...(ctx.extras ?? {}),
  };
  return text.replace(/\{\{[a-z_]+\}\}/g, (m) => map[m] ?? m);
}
