// Pure compute helpers for financial / managerial reports.
// All numbers are in BRL. All dates are ISO yyyy-mm-dd strings.

import { supabase } from "@/integrations/supabase/client";

export type Period = { start: string; end: string };

export type Tx = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  status: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  conta_id: string | null;
  forma_pagamento: string | null;
};

export type Category = {
  id: string;
  nome: string;
  tipo: "entrada" | "saida";
  kpi_classification: string | null;
  is_deduction: boolean;
  is_fixed_cost: boolean;
  is_variable_cost: boolean;
  is_financial_expense: boolean;
};


export type Payable = {
  id: string;
  descricao: string;
  fornecedor: string | null;
  valor: number;
  vencimento: string;
  data_pagamento: string | null;
  status: string;
  forma_pagamento: string | null;
  categoria_id: string | null;
  centro_custo_id: string | null;
};

export type Receivable = {
  id: string;
  descricao: string;
  cliente: string | null;
  valor: number;
  vencimento: string;
  data_recebimento: string | null;
  status: string;
  forma_recebimento: string | null;
  categoria_id: string | null;
};

export type Product = {
  id: string;
  nome: string;
  categoria: string | null;
  quantidade: number;
  custo_unitario: number;
  preco_venda: number;
  estoque_minimo: number;
};

export type SaleItemReport = {
  id: string;
  company_id: string;
  branch_id: string | null;
  sale_id: string;
  sale_type: "vista" | "prazo";
  product_id: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_revenue: number;
  total_cost: number;
  margin_value: number;
  margin_percentage: number;
  needs_review: boolean;
  recovery_log_id: string | null;
  recovered_from_stock_movement: boolean;
};

export type Account = {
  id: string;
  nome: string;
  saldo_inicial: number;
};

export type Budget = {
  mes: number;
  ano: number;
  valor_orcado: number;
  categoria_id: string;
};

export type CostCenter = { id: string; nome: string; kpi_classification: string | null };

export type ReportData = {
  transactions: Tx[];
  categories: Category[];
  payables: Payable[];
  receivables: Receivable[];
  products: Product[];
  saleItems: SaleItemReport[];
  accounts: Account[];
  budgets: Budget[];
  costCenters: CostCenter[];
};

function applyBranch(q: any, branchId: string | null) {
  return branchId ? q.eq("branch_id", branchId) : q;
}

export async function fetchReportData(
  companyId: string,
  branchId: string | null,
  period: Period,
  costCenterId?: string | null,
): Promise<ReportData> {
  const applyCC = (q: any) => (costCenterId ? q.eq("centro_custo_id", costCenterId) : q);
  const [tx, cats, pay, rec, prods, saleItems, accs, budgets, ccs] = await Promise.all([
    applyCC(applyBranch(
      supabase
        .from("transactions")
        .select("id, data, tipo, valor, descricao, status, categoria_id, centro_custo_id, conta_id, forma_pagamento")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        // Busca o histórico até o fim do período para calcular corretamente
        // o saldo inicial com os movimentos realizados antes da data inicial.
        .lte("data", period.end),
      branchId,
    )),
    supabase.from("categories").select("id, nome, tipo, kpi_classification, is_deduction, is_fixed_cost, is_variable_cost, is_financial_expense").eq("company_id", companyId).is("deleted_at", null),
    applyCC(applyBranch(
      supabase
        .from("payables")
        .select("id, descricao, fornecedor, valor, vencimento, data_pagamento, status, forma_pagamento, categoria_id, centro_custo_id")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      branchId,
    )),
    applyBranch(
      supabase
        .from("receivables")
        .select("id, descricao, cliente, valor, vencimento, data_recebimento, status, forma_recebimento, categoria_id")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      branchId,
    ),
    applyBranch(
      supabase
        .from("products")
        .select("id, nome, categoria, quantidade, custo_unitario, preco_venda, estoque_minimo")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      branchId,
    ),
    applyBranch(
      (supabase as any)
        .from("sale_items")
        .select("id, company_id, branch_id, sale_id, sale_type, product_id, product_name_snapshot, quantity, unit_price, unit_cost, total_revenue, total_cost, margin_value, margin_percentage, needs_review, recovery_log_id, recovered_from_stock_movement")
        .eq("company_id", companyId)
        .is("deleted_at", null),
      branchId,
    ),
    supabase.from("financial_accounts").select("id, nome, saldo_inicial").eq("company_id", companyId),
    applyBranch(
      supabase.from("budgets").select("mes, ano, valor_orcado, categoria_id").eq("company_id", companyId).is("deleted_at", null),
      branchId,
    ),
    supabase.from("cost_centers").select("id, nome, kpi_classification").eq("company_id", companyId).is("deleted_at", null),
  ]);
  return {
    transactions: ((tx as any).data ?? []).map((r: any) => ({ ...r, valor: Number(r.valor) })),
    categories: ((cats as any).data ?? []) as Category[],
    payables: ((pay as any).data ?? []).map((r: any) => ({ ...r, valor: Number(r.valor) })),
    receivables: ((rec as any).data ?? []).map((r: any) => ({ ...r, valor: Number(r.valor) })),
    products: ((prods as any).data ?? []).map((r: any) => ({
      ...r,
      quantidade: Number(r.quantidade),
      custo_unitario: Number(r.custo_unitario),
      preco_venda: Number(r.preco_venda),
      estoque_minimo: Number(r.estoque_minimo),
    })),
    saleItems: (((saleItems as any).data ?? []) as any[]).map((r: any) => ({
      ...r,
      quantity: Number(r.quantity),
      unit_price: Number(r.unit_price),
      unit_cost: Number(r.unit_cost),
      total_revenue: Number(r.total_revenue),
      total_cost: Number(r.total_cost),
      margin_value: Number(r.margin_value),
      margin_percentage: Number(r.margin_percentage),
      needs_review: Boolean(r.needs_review),
      recovery_log_id: r.recovery_log_id ?? null,
      recovered_from_stock_movement: Boolean(r.recovered_from_stock_movement),
    })),
    accounts: ((accs as any).data ?? []).map((r: any) => ({ ...r, saldo_inicial: Number(r.saldo_inicial) })),
    budgets: ((budgets as any).data ?? []).map((r: any) => ({ ...r, valor_orcado: Number(r.valor_orcado) })),
    costCenters: ((ccs as any).data ?? []) as CostCenter[],
  };
}

const inPeriod = (d: string, p: Period) => d >= p.start && d <= p.end;

// ============ DRE GERENCIAL ============

// Normaliza texto livre/códigos em buckets canônicos da DRE.
// Aceita variações singular/plural, com/sem acento, maiúsculas, e rótulos
// digitados pelo usuário (ex: "Custos Variáveis", "CUSTO VARIÁVEL", "Juros").
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type DreBucket =
  | "receita_bruta"
  | "outras_receitas"
  | "impostos"
  | "custos_variaveis"
  | "custos_fixos"
  | "despesas_operacionais"
  | "marketing"
  | "despesas_financeiras";

const BUCKET_ALIASES: Record<DreBucket, string[]> = {
  receita_bruta: [
    "receita_bruta",
    "receita_operacional",
    "receitas_operacionais",
    "vendas",
    "venda",
    "faturamento",
    "receita_de_vendas",
    "receita_servicos",
    "receita_de_servicos",
    "servicos",
  ],
  outras_receitas: ["outras_receitas", "outra_receita", "receita_nao_operacional", "receitas_nao_operacionais"],
  impostos: ["impostos", "imposto", "deducoes", "deducoes_e_impostos", "deducoes_impostos", "tributos"],
  custos_variaveis: ["custos_variaveis", "custo_variavel", "custos_variavel", "custo_variaveis", "cmv", "custo_mercadoria_vendida"],
  custos_fixos: ["custos_fixos", "custo_fixo"],
  despesas_operacionais: [
    "despesas_operacionais",
    "despesa_operacional",
    "despesa_administrativa",
    "despesas_administrativas",
    "despesa_comercial",
    "despesas_comerciais",
  ],
  marketing: ["marketing", "marketing_vendas", "marketing_e_vendas"],
  despesas_financeiras: ["despesas_financeiras", "despesa_financeira", "juros", "encargos_financeiros"],
};

const ALIAS_TO_BUCKET: Map<string, DreBucket> = (() => {
  const m = new Map<string, DreBucket>();
  (Object.keys(BUCKET_ALIASES) as DreBucket[]).forEach((b) => {
    BUCKET_ALIASES[b].forEach((a) => m.set(a, b));
  });
  return m;
})();

function toBucket(raw: string | null | undefined): DreBucket | null {
  if (!raw) return null;
  return ALIAS_TO_BUCKET.get(slug(raw)) ?? null;
}

export function buildDRE(data: ReportData, period: Period) {
  const realized = data.transactions.filter((t) => t.status === "realizado" && inPeriod(t.data, period));
  const catMap = new Map(data.categories.map((c) => [c.id, c]));

  const bucketOf = (t: Tx): string | null => {
    const cat = catMap.get(t.categoria_id ?? "");
    if (!cat) return null;
    if (cat.is_deduction) return "impostos";
    if (cat.is_variable_cost) return "custos_variaveis";
    if (cat.is_fixed_cost) return "custos_fixos";
    if (cat.is_financial_expense) return "despesas_financeiras";
    return null;
  };

  const receitaBruta = realized
    .filter((t) => t.tipo === "entrada")
    .reduce((s, t) => s + t.valor, 0);

  const deducoes = realized
    .filter((t) => bucketOf(t) === "impostos")
    .reduce((s, t) => s + t.valor, 0);

  const receitaLiquida = receitaBruta - deducoes;

  const custosVariaveis = realized
    .filter((t) => bucketOf(t) === "custos_variaveis")
    .reduce((s, t) => s + t.valor, 0);

  const margemContribuicao = receitaLiquida - custosVariaveis;

  const custosFixos = realized
    .filter((t) => bucketOf(t) === "custos_fixos")
    .reduce((s, t) => s + t.valor, 0);

  const despesasOperacionais = realized
    .filter((t) => t.tipo === "saida" && !bucketOf(t))
    .reduce((s, t) => s + t.valor, 0);

  const ebitda = margemContribuicao - custosFixos - despesasOperacionais;

  const despesasFinanceiras = realized
    .filter((t) => bucketOf(t) === "despesas_financeiras")
    .reduce((s, t) => s + t.valor, 0);

  const lucroLiquido = ebitda - despesasFinanceiras;
  const margemLiquida = receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0;
  const semClassificacao = data.categories.filter((c) => c.tipo === "saida" && !c.is_variable_cost && !c.is_fixed_cost && !c.is_deduction && !c.is_financial_expense).length;

  return {
    rows: [
      { Linha: "1. Receita Bruta (Vendas)", Valor: receitaBruta },
      { Linha: "2. Deduções (Impostos/Devol)", Valor: -deducoes },
      { Linha: "3. = RECEITA LÍQUIDA", Valor: receitaLiquida },
      { Linha: "4. (–) Custos Variáveis (CMV/Serv)", Valor: -custosVariaveis },
      { Linha: "5. = MARGEM DE CONTRIBUIÇÃO", Valor: margemContribuicao },
      { Linha: "6. (–) Custos Fixos (Estrutura)", Valor: -custosFixos },
      { Linha: "7. (–) Despesas Operacionais", Valor: -despesasOperacionais },
      { Linha: "8. = EBITDA / Lucro Operacional", Valor: ebitda },
      { Linha: "9. (–) Despesas Financeiras / Juros", Valor: -despesasFinanceiras },
      { Linha: "10. = LUCRO LÍQUIDO", Valor: lucroLiquido },
      { Linha: "Margem Líquida (%)", Valor: margemLiquida },
    ],
    summary: {
      receitaBruta,
      receitaLiquida,
      margemContribuicao,
      resultadoOperacional: ebitda,
      lucroLiquido,
      margemLiquida,
    },
    semClassificacao,
  };
}


// ============ FLUXO DE CAIXA REALIZADO ============
export function buildFluxoRealizado(data: ReportData, period: Period) {
  const realized = data.transactions.filter((t) => t.status === "realizado" && inPeriod(t.data, period));
  // Saldo Inicial do período = saldo base das contas + resultado realizado ANTES do período.
  // Não entra como faturamento/receita do mês; apenas compõe o resultado de caixa.
  const baseAccounts = data.accounts.reduce((s, a) => s + a.saldo_inicial, 0);
  const priorRealized = data.transactions
    .filter((t) => t.status === "realizado" && t.data < period.start)
    .reduce((s, t) => s + (t.tipo === "entrada" ? t.valor : -t.valor), 0);
  const saldoInicial = baseAccounts + priorRealized;
  const entradas = realized.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
  const saidas = realized.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
  const saldoFinal = saldoInicial + entradas - saidas;
  const catMap = new Map(data.categories.map((c) => [c.id, c.nome]));

  const byCat = (tipo: "entrada" | "saida") => {
    const m = new Map<string, number>();
    realized.filter((t) => t.tipo === tipo).forEach((t) => {
      const k = catMap.get(t.categoria_id ?? "") ?? "Sem categoria";
      m.set(k, (m.get(k) ?? 0) + t.valor);
    });
    return Array.from(m.entries()).map(([Categoria, Valor]) => ({ Categoria, Valor }));
  };

  const formasPag = new Map<string, number>();
  realized.forEach((t) => {
    const k = t.forma_pagamento || "Não informado";
    formasPag.set(k, (formasPag.get(k) ?? 0) + (t.tipo === "entrada" ? t.valor : -t.valor));
  });

  return {
    summary: { saldoInicial, entradas, saidas, saldoFinal, resultado: entradas - saidas },
    entradasPorCategoria: byCat("entrada"),
    saidasPorCategoria: byCat("saida"),
    formasPagamento: Array.from(formasPag.entries()).map(([Forma, Valor]) => ({ Forma, Valor })),
    lancamentos: realized.map((t) => ({
      Data: t.data,
      Tipo: t.tipo,
      Descrição: t.descricao,
      Categoria: catMap.get(t.categoria_id ?? "") ?? "",
      Forma: t.forma_pagamento ?? "",
      Valor: t.tipo === "entrada" ? t.valor : -t.valor,
    })),
  };
}

// ============ FLUXO DE CAIXA PROJETADO ============
export function buildFluxoProjetado(data: ReportData) {
  const saldoAtual =
    data.accounts.reduce((s, a) => s + a.saldo_inicial, 0) +
    data.transactions
      .filter((t) => t.status === "realizado")
      .reduce((s, t) => s + (t.tipo === "entrada" ? t.valor : -t.valor), 0);
  const today = new Date().toISOString().slice(0, 10);
  const pagFuturas = data.payables.filter((p) => p.status !== "pago" && p.vencimento >= today);
  const recFuturas = data.receivables.filter((r) => r.status !== "recebido" && r.vencimento >= today);
  const totalPagar = pagFuturas.reduce((s, p) => s + p.valor, 0);
  const totalReceber = recFuturas.reduce((s, r) => s + r.valor, 0);

  // Projeção dia a dia (próximos 60 dias)
  const dias: { Data: string; Saldo: number; Entradas: number; Saídas: number }[] = [];
  let saldo = saldoAtual;
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const ent = recFuturas.filter((r) => r.vencimento === iso).reduce((s, r) => s + r.valor, 0);
    const sai = pagFuturas.filter((p) => p.vencimento === iso).reduce((s, p) => s + p.valor, 0);
    saldo = saldo + ent - sai;
    if (ent > 0 || sai > 0 || i === 0) dias.push({ Data: iso, Saldo: saldo, Entradas: ent, Saídas: sai });
  }

  const riscoNegativo = dias.some((d) => d.Saldo < 0);
  return {
    summary: { saldoAtual, totalPagar, totalReceber, saldoProjetado: saldoAtual + totalReceber - totalPagar, riscoNegativo },
    projecao: dias,
  };
}

// ============ LUCRO OPERACIONAL ============
export function buildLucroOperacional(data: ReportData, period: Period) {
  const dre = buildDRE(data, period);
  const s = dre.summary;
  const margemOperacional = s.receitaLiquida > 0 ? (s.resultadoOperacional / s.receitaLiquida) * 100 : 0;
  return {
    rows: [
      { Linha: "Receita Operacional", Valor: s.receitaLiquida },
      { Linha: "Custos + Despesas Operacionais", Valor: -(s.receitaLiquida - s.resultadoOperacional) },
      { Linha: "Lucro Operacional", Valor: s.resultadoOperacional },
      { Linha: "Margem Operacional (%)", Valor: margemOperacional },
    ],
  };
}

// ============ MARGEM DE CONTRIBUIÇÃO ============
export function buildMargemContribuicao(data: ReportData, period: Period) {
  const dre = buildDRE(data, period);
  const s = dre.summary;
  const mcPct = s.receitaLiquida > 0 ? (s.margemContribuicao / s.receitaLiquida) * 100 : 0;
  const produtos = data.products
    .filter((p) => p.preco_venda > 0)
    .map((p) => ({
      Produto: p.nome,
      "Preço Venda": p.preco_venda,
      "Custo Unit.": p.custo_unitario,
      "MC R$": p.preco_venda - p.custo_unitario,
      "MC %": ((p.preco_venda - p.custo_unitario) / p.preco_venda) * 100,
    }));
  return {
    summary: { receita: s.receitaLiquida, custosVariaveis: s.receitaLiquida - s.margemContribuicao, mc: s.margemContribuicao, mcPct },
    produtos,
  };
}

// ============ PONTO DE EQUILÍBRIO ============
export function buildPontoEquilibrio(data: ReportData, period: Period) {
  const dre = buildDRE(data, period);
  const s = dre.summary;
  const mcPct = s.receitaLiquida > 0 ? s.margemContribuicao / s.receitaLiquida : 0;
  const custosFixos = s.receitaLiquida - s.margemContribuicao > 0
    ? Math.max(0, s.margemContribuicao - s.resultadoOperacional)
    : 0;
  const pe = mcPct > 0 ? custosFixos / mcPct : 0;
  const diff = s.receitaLiquida - pe;
  const status = pe === 0 ? "indefinido" : diff > pe * 0.1 ? "acima" : diff > -pe * 0.1 ? "proximo" : "abaixo";
  return {
    rows: [
      { Linha: "Custos Fixos", Valor: custosFixos },
      { Linha: "Margem de Contribuição (%)", Valor: mcPct * 100 },
      { Linha: "Ponto de Equilíbrio (R$)", Valor: pe },
      { Linha: "Receita Atual", Valor: s.receitaLiquida },
      { Linha: "Diferença", Valor: diff },
    ],
    status,
  };
}

// ============ CONTAS A PAGAR ============
export function buildContasPagar(data: ReportData, period: Period) {
  const filtered = data.payables.filter((p) => inPeriod(p.vencimento, period) || (p.data_pagamento && inPeriod(p.data_pagamento, period)));
  const today = new Date().toISOString().slice(0, 10);
  const totalPagar = filtered.filter((p) => p.status !== "pago").reduce((s, p) => s + p.valor, 0);
  const vencido = filtered.filter((p) => p.status !== "pago" && p.vencimento < today).reduce((s, p) => s + p.valor, 0);
  const aVencer = filtered.filter((p) => p.status !== "pago" && p.vencimento >= today).reduce((s, p) => s + p.valor, 0);
  const pago = filtered.filter((p) => p.status === "pago").reduce((s, p) => s + p.valor, 0);
  const catMap = new Map(data.categories.map((c) => [c.id, c.nome]));

  const byKey = (key: (p: Payable) => string) => {
    const m = new Map<string, number>();
    filtered.forEach((p) => {
      const k = key(p) || "—";
      m.set(k, (m.get(k) ?? 0) + p.valor);
    });
    return Array.from(m.entries()).map(([k, v]) => ({ Item: k, Valor: v }));
  };

  return {
    summary: { totalPagar, vencido, aVencer, pago },
    porFornecedor: byKey((p) => p.fornecedor ?? ""),
    porCategoria: byKey((p) => catMap.get(p.categoria_id ?? "") ?? ""),
    lista: filtered.map((p) => ({
      Descrição: p.descricao,
      Fornecedor: p.fornecedor ?? "",
      Categoria: catMap.get(p.categoria_id ?? "") ?? "",
      Vencimento: p.vencimento,
      Status: p.status,
      Valor: p.valor,
    })),
  };
}

// ============ CONTAS A RECEBER ============
export function buildContasReceber(data: ReportData, period: Period) {
  const filtered = data.receivables.filter((r) => inPeriod(r.vencimento, period) || (r.data_recebimento && inPeriod(r.data_recebimento, period)));
  const today = new Date().toISOString().slice(0, 10);
  const totalReceber = filtered.filter((r) => r.status !== "recebido").reduce((s, r) => s + r.valor, 0);
  const vencido = filtered.filter((r) => r.status !== "recebido" && r.vencimento < today).reduce((s, r) => s + r.valor, 0);
  const aVencer = filtered.filter((r) => r.status !== "recebido" && r.vencimento >= today).reduce((s, r) => s + r.valor, 0);
  const recebido = filtered.filter((r) => r.status === "recebido").reduce((s, r) => s + r.valor, 0);
  const inadimplencia = totalReceber > 0 ? (vencido / totalReceber) * 100 : 0;

  const byKey = (key: (r: Receivable) => string) => {
    const m = new Map<string, number>();
    filtered.forEach((r) => {
      const k = key(r) || "—";
      m.set(k, (m.get(k) ?? 0) + r.valor);
    });
    return Array.from(m.entries()).map(([k, v]) => ({ Item: k, Valor: v }));
  };

  return {
    summary: { totalReceber, vencido, aVencer, recebido, inadimplencia },
    porCliente: byKey((r) => r.cliente ?? ""),
    porForma: byKey((r) => r.forma_recebimento ?? ""),
    proximos: filtered
      .filter((r) => r.status !== "recebido")
      .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
      .slice(0, 20)
      .map((r) => ({ Cliente: r.cliente ?? "", Descrição: r.descricao, Vencimento: r.vencimento, Valor: r.valor })),
  };
}

// ============ ORÇADO X REALIZADO ============
export function buildOrcadoRealizado(data: ReportData, period: Period) {
  const start = new Date(period.start);
  const end = new Date(period.end);
  const realized = data.transactions.filter((t) => t.status === "realizado" && inPeriod(t.data, period));
  const catMap = new Map(data.categories.map((c) => [c.id, c]));
  const realByCat = new Map<string, number>();
  realized.forEach((t) => {
    if (!t.categoria_id) return;
    realByCat.set(t.categoria_id, (realByCat.get(t.categoria_id) ?? 0) + t.valor);
  });
  const budgetByCat = new Map<string, number>();
  data.budgets
    .filter((b) => {
      const d = new Date(b.ano, b.mes - 1, 1);
      return d >= new Date(start.getFullYear(), start.getMonth(), 1) && d <= end;
    })
    .forEach((b) => budgetByCat.set(b.categoria_id, (budgetByCat.get(b.categoria_id) ?? 0) + b.valor_orcado));

  const rows = Array.from(new Set([...realByCat.keys(), ...budgetByCat.keys()])).map((id) => {
    const orcado = budgetByCat.get(id) ?? 0;
    const realizado = realByCat.get(id) ?? 0;
    const diff = realizado - orcado;
    const pct = orcado > 0 ? (realizado / orcado) * 100 : 0;
    let status = "Dentro";
    if (orcado > 0) {
      if (pct > 110) status = "Estourado";
      else if (pct > 90) status = "Atenção";
    }
    return {
      Categoria: catMap.get(id)?.nome ?? "Sem categoria",
      Orçado: orcado,
      Realizado: realizado,
      "Diferença R$": diff,
      "Diferença %": orcado > 0 ? ((diff / orcado) * 100) : 0,
      Status: status,
    };
  });
  return { rows };
}

// ============ CAPITAL DE GIRO ============
export function buildCapitalGiro(data: ReportData) {
  const saldoDisponivel =
    data.accounts.reduce((s, a) => s + a.saldo_inicial, 0) +
    data.transactions.filter((t) => t.status === "realizado").reduce((s, t) => s + (t.tipo === "entrada" ? t.valor : -t.valor), 0);
  const contasReceber = data.receivables.filter((r) => r.status !== "recebido").reduce((s, r) => s + r.valor, 0);
  const estoque = data.products.reduce((s, p) => s + p.quantidade * p.custo_unitario, 0);
  const contasPagar = data.payables.filter((p) => p.status !== "pago").reduce((s, p) => s + p.valor, 0);
  const ncg = contasReceber + estoque - contasPagar;
  // PMR / PMP simples
  const today = new Date();
  const days = (d: string) => Math.max(0, Math.round((today.getTime() - new Date(d).getTime()) / 86400000));
  const recOpen = data.receivables.filter((r) => r.status !== "recebido");
  const payOpen = data.payables.filter((p) => p.status !== "pago");
  const pmr = recOpen.length ? recOpen.reduce((s, r) => s + days(r.vencimento), 0) / recOpen.length : 0;
  const pmp = payOpen.length ? payOpen.reduce((s, p) => s + days(p.vencimento), 0) / payOpen.length : 0;

  return {
    rows: [
      { Indicador: "Saldo Disponível", Valor: saldoDisponivel },
      { Indicador: "Contas a Receber", Valor: contasReceber },
      { Indicador: "Estoque", Valor: estoque },
      { Indicador: "Contas a Pagar", Valor: -contasPagar },
      { Indicador: "Necessidade de Capital de Giro", Valor: ncg },
      { Indicador: "Prazo Médio Recebimento (dias)", Valor: Math.round(pmr) },
      { Indicador: "Prazo Médio Pagamento (dias)", Valor: Math.round(pmp) },
    ],
    situacao: ncg < 0 ? "Folga de caixa" : saldoDisponivel >= ncg ? "Saudável" : "Atenção",
  };
}

// ============ ESTOQUE FINANCEIRO ============
export function buildEstoqueFinanceiro(data: ReportData) {
  const total = data.products.reduce((s, p) => s + p.quantidade * p.custo_unitario, 0);
  const abaixoMin = data.products.filter((p) => p.quantidade > 0 && p.quantidade <= p.estoque_minimo);
  const zerados = data.products.filter((p) => p.quantidade <= 0);
  const maiorValor = [...data.products]
    .sort((a, b) => b.quantidade * b.custo_unitario - a.quantidade * a.custo_unitario)
    .slice(0, 10)
    .map((p) => ({ Produto: p.nome, Quantidade: p.quantidade, Custo: p.custo_unitario, "Valor Total": p.quantidade * p.custo_unitario }));
  const porCat = new Map<string, number>();
  data.products.forEach((p) => {
    const k = p.categoria || "Sem categoria";
    porCat.set(k, (porCat.get(k) ?? 0) + p.quantidade * p.custo_unitario);
  });
  return {
    summary: { total, abaixoMin: abaixoMin.length, zerados: zerados.length, totalProdutos: data.products.length },
    maiorValor,
    porCategoria: Array.from(porCat.entries()).map(([Categoria, Valor]) => ({ Categoria, Valor })),
  };
}

// ============ VENDAS E MARGEM ============
export function buildVendasMargem(data: ReportData, period: Period) {
  const vendasVista = data.transactions.filter(
    (t) =>
      t.status === "realizado" &&
      t.tipo === "entrada" &&
      inPeriod(t.data, period),
  );
  const vendasPrazo = data.receivables.filter((r) => inPeriod(r.vencimento, period) && r.status !== "cancelado");
  const vendaIdsVista = new Set(vendasVista.map((v) => v.id));
  const vendaIdsPrazo = new Set(vendasPrazo.map((v) => v.id));
  const itens = data.saleItems.filter(
    (it) =>
      ((it.sale_type === "vista" && vendaIdsVista.has(it.sale_id)) || (it.sale_type === "prazo" && vendaIdsPrazo.has(it.sale_id))) &&
      (it.recovery_log_id || it.recovered_from_stock_movement || it.unit_price > 0 || it.total_revenue > 0),
  );
  const vendasComItens = new Set(itens.map((it) => `${it.sale_type}:${it.sale_id}`));
  const faturamentoItens = itens.reduce((s, it) => s + it.total_revenue, 0);
  const qtd = vendasComItens.size;
  const ticket = qtd > 0 ? faturamentoItens / qtd : 0;
  const produtos = itens.map((it) => ({
    Produto: it.product_name_snapshot,
    Quantidade: it.quantity,
    "Preço unitário": it.unit_price,
    "Receita total": it.total_revenue,
    "Custo unitário": it.unit_cost,
    "Custo total": it.total_cost,
    "Margem R$": it.margin_value,
    "Margem %": it.total_revenue > 0 ? (it.margin_value / it.total_revenue) * 100 : 0,
    Status: it.needs_review || it.unit_price <= 0 ? "Revisar" : it.unit_cost <= 0 ? "Sem custo" : "OK",
  }));
  const custoTotal = itens.reduce((s, it) => s + it.total_cost, 0);
  const margemBruta = faturamentoItens - custoTotal;
  return {
    summary: {
      totalVendido: faturamentoItens,
      qtd,
      ticket,
      custoTotal,
      margemBruta,
      margemPct: faturamentoItens > 0 ? (margemBruta / faturamentoItens) * 100 : 0,
      custoZerado: itens.filter((it) => it.unit_cost <= 0).length,
      itensIncompletos: itens.filter((it) => it.needs_review || it.quantity <= 0 || it.unit_price <= 0).length,
    },
    produtos,
  };
}

// ============ INDICADORES ============
export function buildIndicadores(data: ReportData, period: Period) {
  const dre = buildDRE(data, period);
  const pe = buildPontoEquilibrio(data, period);
  const cg = buildCapitalGiro(data);
  const cr = buildContasReceber(data, period);
  const s = dre.summary;
  const mcPct = s.receitaLiquida > 0 ? (s.margemContribuicao / s.receitaLiquida) * 100 : 0;
  const margemOp = s.receitaLiquida > 0 ? (s.resultadoOperacional / s.receitaLiquida) * 100 : 0;
  const ebitda = s.resultadoOperacional; // sem D&A separados
  const liquidez = cg.rows.find((r) => r.Indicador === "Contas a Pagar")?.Valor
    ? Math.abs(((cg.rows[0].Valor as number) + (cg.rows[1].Valor as number)) / (cg.rows[3].Valor as number))
    : 0;
  return {
    rows: [
      { Indicador: "Margem Líquida (%)", Valor: s.margemLiquida },
      { Indicador: "Margem Operacional (%)", Valor: margemOp },
      { Indicador: "Margem de Contribuição (%)", Valor: mcPct },
      { Indicador: "EBITDA", Valor: ebitda },
      { Indicador: "Liquidez Corrente", Valor: liquidez },
      { Indicador: "Ponto de Equilíbrio (R$)", Valor: pe.rows[2].Valor },
      { Indicador: "PMR (dias)", Valor: cg.rows[5].Valor },
      { Indicador: "PMP (dias)", Valor: cg.rows[6].Valor },
      { Indicador: "Inadimplência (%)", Valor: cr.summary.inadimplencia },
    ],
  };
}

// ============ COMPARATIVO PERÍODOS ============
export function buildComparativo(atual: ReportData, anterior: ReportData, pAtual: Period, pAnterior: Period) {
  const sumRealized = (d: ReportData, p: Period, tipo: "entrada" | "saida") =>
    d.transactions
      .filter((t) => t.status === "realizado" && t.tipo === tipo && inPeriod(t.data, p))
      .reduce((s, t) => s + t.valor, 0);
  const a = { entradas: sumRealized(atual, pAtual, "entrada"), saidas: sumRealized(atual, pAtual, "saida") };
  const b = { entradas: sumRealized(anterior, pAnterior, "entrada"), saidas: sumRealized(anterior, pAnterior, "saida") };
  const variacao = (cur: number, prev: number) => (prev === 0 ? 0 : ((cur - prev) / prev) * 100);
  const dreA = buildDRE(atual, pAtual).summary;
  const dreB = buildDRE(anterior, pAnterior).summary;
  return {
    rows: [
      { Indicador: "Entradas", Atual: a.entradas, Anterior: b.entradas, "Var %": variacao(a.entradas, b.entradas) },
      { Indicador: "Saídas", Atual: a.saidas, Anterior: b.saidas, "Var %": variacao(a.saidas, b.saidas) },
      { Indicador: "Resultado", Atual: a.entradas - a.saidas, Anterior: b.entradas - b.saidas, "Var %": variacao(a.entradas - a.saidas, b.entradas - b.saidas) },
      { Indicador: "Receita Líquida", Atual: dreA.receitaLiquida, Anterior: dreB.receitaLiquida, "Var %": variacao(dreA.receitaLiquida, dreB.receitaLiquida) },
      { Indicador: "Lucro Líquido", Atual: dreA.lucroLiquido, Anterior: dreB.lucroLiquido, "Var %": variacao(dreA.lucroLiquido, dreB.lucroLiquido) },
    ],
  };
}

// ============ CENTRO DE CUSTOS ============
export function buildCentroCustos(data: ReportData, period: Period) {
  const realized = data.transactions.filter((t) => t.status === "realizado" && inPeriod(t.data, period));
  return {
    rows: data.costCenters.map((cc) => {
      const txs = realized.filter((t) => t.centro_custo_id === cc.id);
      const entradas = txs.filter((t) => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0);
      const saidas = txs.filter((t) => t.tipo === "saida").reduce((s, t) => s + t.valor, 0);
      return {
        "Centro de Custo": cc.nome,
        Entradas: entradas,
        Saídas: saidas,
        Resultado: entradas - saidas,
        Movimentos: txs.length,
      };
    }),
  };
}

// ============ COMPARATIVO DE FILIAIS ============
export async function buildComparativoFiliais(companyId: string, period: Period) {
  const { data: branches } = await supabase
    .from("branches")
    .select("id, nome, is_main_branch")
    .eq("company_id", companyId)
    .order("is_main_branch", { ascending: false });
  if (!branches || branches.length === 0) return { rows: [] };
  const rows = await Promise.all(
    branches.map(async (b: any) => {
      const d = await fetchReportData(companyId, b.id, period);
      const dre = buildDRE(d, period).summary;
      const pay = buildContasPagar(d, period).summary;
      const rec = buildContasReceber(d, period).summary;
      return {
        Filial: b.is_main_branch ? `Matriz — ${b.nome}` : b.nome,
        Receita: dre.receitaLiquida,
        Lucro: dre.lucroLiquido,
        "Margem %": dre.margemLiquida,
        "A Pagar": pay.totalPagar,
        "A Receber": rec.totalReceber,
      };
    }),
  );
  return { rows };
}
