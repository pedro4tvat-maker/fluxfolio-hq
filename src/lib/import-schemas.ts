// Generic schema definitions for the import wizard (non-extrato types).
// Each schema declares the fields the user maps from spreadsheet columns
// and how rows are translated into rows of a target Supabase table.

export type FieldKind = "date" | "number" | "integer" | "text" | "enum";

export type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  aliases?: string[];
  enumValues?: string[];
};

export type ImportSchema = {
  key: string;
  label: string;
  importType: string; // stored in import_batches.import_type
  table: "transactions" | "payables" | "receivables" | "products" | "stock_movements";
  mode?: "insert" | "upsertByName" | "updateByName";
  fields: FieldDef[];
  // Per-row defaults applied before insert.
  defaults?: Record<string, any>;
  // Optional helper text shown above mapping.
  help?: string;
};

export const SCHEMAS: Record<string, ImportSchema> = {
  fluxo: {
    key: "fluxo",
    label: "Fluxo de Caixa",
    importType: "fluxo_caixa",
    table: "transactions",
    fields: [
      { key: "data", label: "Data", kind: "date", required: true, aliases: ["data", "date", "dt"] },
      { key: "descricao", label: "Descrição", kind: "text", required: true, aliases: ["descricao", "descrição", "historico", "histórico"] },
      { key: "valor", label: "Valor", kind: "number", required: true, aliases: ["valor", "amount", "vlr"] },
      { key: "tipo", label: "Tipo (entrada/saida)", kind: "enum", required: true, enumValues: ["entrada", "saida"], aliases: ["tipo", "natureza", "c/d"] },
      { key: "categoria", label: "Categoria (nome)", kind: "text", aliases: ["categoria", "category"] },
      { key: "conta", label: "Conta (nome)", kind: "text", aliases: ["conta", "account", "banco"] },
      { key: "forma_pagamento", label: "Forma de pagamento", kind: "text", aliases: ["forma", "forma pagamento", "meio"] },
    ],
    defaults: { status: "realizado" },
    help: "Lançamentos consolidados de entradas e saídas.",
  },

  vendas: {
    key: "vendas",
    label: "Vendas",
    importType: "vendas",
    table: "transactions",
    fields: [
      { key: "data", label: "Data da venda", kind: "date", required: true, aliases: ["data", "data venda"] },
      { key: "descricao", label: "Descrição/Produto", kind: "text", required: true, aliases: ["descricao", "produto", "item"] },
      { key: "cliente", label: "Cliente", kind: "text", aliases: ["cliente", "customer"] },
      { key: "valor", label: "Valor total", kind: "number", required: true, aliases: ["valor", "total", "preco", "preço"] },
      { key: "forma_pagamento", label: "Forma de pagamento", kind: "text", aliases: ["forma", "pagamento"] },
      { key: "categoria", label: "Categoria (nome)", kind: "text", aliases: ["categoria"] },
    ],
    defaults: { tipo: "entrada", status: "realizado" },
    help: "Importa vendas como entradas no financeiro.",
  },

  produtos: {
    key: "produtos",
    label: "Produtos",
    importType: "produtos",
    table: "products",
    mode: "upsertByName",
    fields: [
      { key: "nome", label: "Nome do produto", kind: "text", required: true, aliases: ["nome", "produto", "name"] },
      { key: "categoria", label: "Categoria", kind: "text", aliases: ["categoria", "category"] },
      { key: "fornecedor", label: "Fornecedor", kind: "text", aliases: ["fornecedor", "supplier"] },
      { key: "quantidade", label: "Quantidade em estoque", kind: "number", aliases: ["quantidade", "qtd", "estoque", "stock"] },
      { key: "custo_unitario", label: "Custo unitário", kind: "number", aliases: ["custo", "cost"] },
      { key: "preco_venda", label: "Preço de venda", kind: "number", aliases: ["preco", "preço", "preco venda", "price"] },
      { key: "estoque_minimo", label: "Estoque mínimo", kind: "number", aliases: ["minimo", "mínimo", "estoque minimo"] },
    ],
    help: "Cria novos produtos ou atualiza os existentes pelo nome.",
  },

  pagar: {
    key: "pagar",
    label: "Contas a Pagar",
    importType: "contas_pagar",
    table: "payables",
    fields: [
      { key: "descricao", label: "Descrição", kind: "text", required: true, aliases: ["descricao", "descrição", "historico"] },
      { key: "fornecedor", label: "Fornecedor", kind: "text", aliases: ["fornecedor", "supplier"] },
      { key: "valor", label: "Valor", kind: "number", required: true, aliases: ["valor", "amount"] },
      { key: "vencimento", label: "Vencimento", kind: "date", required: true, aliases: ["vencimento", "due", "data vencimento"] },
      { key: "categoria", label: "Categoria (nome)", kind: "text", aliases: ["categoria"] },
      { key: "status", label: "Status (em_aberto/pago/vencido)", kind: "enum", enumValues: ["em_aberto", "pago", "vencido"], aliases: ["status", "situacao"] },
    ],
    defaults: { status: "em_aberto" },
  },

  receber: {
    key: "receber",
    label: "Contas a Receber",
    importType: "contas_receber",
    table: "receivables",
    fields: [
      { key: "descricao", label: "Descrição", kind: "text", required: true, aliases: ["descricao", "descrição"] },
      { key: "cliente", label: "Cliente", kind: "text", aliases: ["cliente", "customer"] },
      { key: "valor", label: "Valor", kind: "number", required: true, aliases: ["valor", "amount"] },
      { key: "vencimento", label: "Vencimento", kind: "date", required: true, aliases: ["vencimento", "due"] },
      { key: "categoria", label: "Categoria (nome)", kind: "text", aliases: ["categoria"] },
      { key: "status", label: "Status (em_aberto/recebido/vencido)", kind: "enum", enumValues: ["em_aberto", "recebido", "vencido"], aliases: ["status"] },
    ],
    defaults: { status: "em_aberto" },
  },

  estoque: {
    key: "estoque",
    label: "Movimentações de Estoque",
    importType: "estoque",
    table: "stock_movements",
    fields: [
      { key: "data", label: "Data", kind: "date", required: true, aliases: ["data", "date"] },
      { key: "produto", label: "Produto (nome)", kind: "text", required: true, aliases: ["produto", "item", "nome"] },
      { key: "tipo", label: "Tipo (entrada/saida)", kind: "enum", required: true, enumValues: ["entrada", "saida"], aliases: ["tipo", "movimento"] },
      { key: "quantidade", label: "Quantidade", kind: "number", required: true, aliases: ["quantidade", "qtd"] },
      { key: "custo_unitario", label: "Custo unitário", kind: "number", aliases: ["custo", "cost"] },
      { key: "motivo", label: "Motivo", kind: "text", aliases: ["motivo", "obs", "observacao"] },
    ],
    help: "Entradas e saídas que atualizam o estoque dos produtos cadastrados.",
  },

  precificacao: {
    key: "precificacao",
    label: "Precificação",
    importType: "precificacao",
    table: "products",
    mode: "updateByName",
    fields: [
      { key: "nome", label: "Nome do produto", kind: "text", required: true, aliases: ["nome", "produto"] },
      { key: "custo_unitario", label: "Novo custo unitário", kind: "number", aliases: ["custo"] },
      { key: "preco_venda", label: "Novo preço de venda", kind: "number", aliases: ["preco", "preço", "venda"] },
    ],
    help: "Atualiza custos e preços de venda dos produtos pelo nome.",
  },

  dividas: {
    key: "dividas",
    label: "Dívidas e Parcelamentos",
    importType: "dividas",
    table: "payables",
    fields: [
      { key: "descricao", label: "Descrição da dívida", kind: "text", required: true, aliases: ["descricao", "descrição"] },
      { key: "fornecedor", label: "Credor", kind: "text", aliases: ["credor", "fornecedor", "banco"] },
      { key: "valor", label: "Valor da parcela", kind: "number", required: true, aliases: ["valor", "parcela"] },
      { key: "vencimento", label: "Vencimento da próxima parcela", kind: "date", required: true, aliases: ["vencimento"] },
      { key: "parcelas", label: "Nº de parcelas restantes", kind: "integer", aliases: ["parcelas", "qtd parcelas"] },
      { key: "categoria", label: "Categoria (nome)", kind: "text", aliases: ["categoria"] },
    ],
    defaults: { status: "em_aberto", recorrencia: "mensal" },
    help: "Importa empréstimos e financiamentos como contas a pagar recorrentes.",
  },
};

export function autoMapSchema(schema: ImportSchema, columns: string[]): Record<string, string | null> {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
  const out: Record<string, string | null> = {};
  for (const f of schema.fields) {
    out[f.key] = null;
    const aliases = [f.key, f.label.toLowerCase(), ...(f.aliases ?? [])];
    for (const c of columns) {
      if (aliases.some((a) => norm(c).includes(norm(a)))) { out[f.key] = c; break; }
    }
  }
  return out;
}
