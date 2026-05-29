import * as XLSX from "xlsx";

export type RawRow = Record<string, string>;

export type ParsedFile = {
  columns: string[];
  rows: RawRow[];
};

export async function parseFile(file: File): Promise<ParsedFile> {
  const name = file.name.toLowerCase();
  const buf = await file.arrayBuffer();

  if (name.endsWith(".ofx")) return parseOFX(new TextDecoder("utf-8").decode(buf));

  // CSV / XLSX via SheetJS (handles both)
  const wb = XLSX.read(buf, { type: "array", cellDates: true, raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: false });
  const columns = json.length > 0 ? Object.keys(json[0]) : [];
  return { columns, rows: json };
}

function parseOFX(text: string): ParsedFile {
  // Minimal OFX parser: extracts STMTTRN blocks
  const rows: RawRow[] = [];
  const re = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const block = m[1];
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
      return r ? r[1].trim() : "";
    };
    const dt = get("DTPOSTED").slice(0, 8); // YYYYMMDD
    const data = dt.length === 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : "";
    rows.push({
      Data: data,
      Valor: get("TRNAMT"),
      Descricao: get("MEMO") || get("NAME"),
      Tipo: get("TRNTYPE"),
      Documento: get("FITID"),
    });
  }
  return { columns: ["Data", "Valor", "Descricao", "Tipo", "Documento"], rows };
}

// ===== Column auto-mapping =====
export type BankFields = "data" | "descricao" | "valor" | "tipo" | "documento";

const ALIASES: Record<BankFields, string[]> = {
  data: ["data", "dt", "dt mov", "data lancamento", "data lançamento", "date"],
  descricao: ["historico", "histórico", "descricao", "descrição", "memo", "documento histórico", "complemento"],
  valor: ["valor", "valor r$", "valor (r$)", "montante", "amount", "vlr"],
  tipo: ["tipo", "credito/debito", "c/d", "natureza"],
  documento: ["documento", "doc", "nº doc", "fitid", "id"],
};

export function autoMapColumns(columns: string[]): Record<BankFields, string | null> {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9 ]/g, "");
  const out: Record<BankFields, string | null> = {
    data: null, descricao: null, valor: null, tipo: null, documento: null,
  };
  for (const f of Object.keys(ALIASES) as BankFields[]) {
    for (const c of columns) {
      if (ALIASES[f].some((a) => norm(c).includes(norm(a)))) { out[f] = c; break; }
    }
  }
  return out;
}

// ===== Value/date parsing =====
export function parseDate(s: string): string | null {
  if (!s) return null;
  s = String(s).trim();
  // ISO
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // BR dd/mm/yyyy
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  // BR dd/mm/yy
  m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(s);
  if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
  // Excel serial
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function parseAmount(s: string): number | null {
  if (s === null || s === undefined || s === "") return null;
  let str = String(s).trim().replace(/\s/g, "");
  const neg = /^\(.*\)$/.test(str) || str.startsWith("-");
  str = str.replace(/[()\-+R$\s]/g, "");
  // br format: 1.234,56 → 1234.56
  if (/,\d{1,2}$/.test(str)) str = str.replace(/\./g, "").replace(",", ".");
  const n = Number(str);
  if (isNaN(n)) return null;
  return neg ? -Math.abs(n) : n;
}

// ===== Classification rules =====
export type Rule = { id: string; keyword: string; category_id: string | null; tipo: string | null };

export function classify(description: string, rules: Rule[]): Rule | null {
  const d = (description || "").toLowerCase();
  return rules.find((r) => r.is_active !== false && d.includes(r.keyword.toLowerCase())) ?? null;
}

export const DEFAULT_RULES: { keyword: string; suggestedName: string }[] = [
  { keyword: "coelba", suggestedName: "Energia" },
  { keyword: "energia", suggestedName: "Energia" },
  { keyword: "embasa", suggestedName: "Água" },
  { keyword: "aluguel", suggestedName: "Aluguel" },
  { keyword: "tarifa", suggestedName: "Despesas Bancárias" },
  { keyword: "manutencao conta", suggestedName: "Despesas Bancárias" },
  { keyword: "pix recebido", suggestedName: "Recebimento de Cliente" },
  { keyword: "ted recebida", suggestedName: "Recebimento de Cliente" },
  { keyword: "stone", suggestedName: "Recebimento por Cartão" },
  { keyword: "cielo", suggestedName: "Recebimento por Cartão" },
  { keyword: "rede", suggestedName: "Recebimento por Cartão" },
  { keyword: "getnet", suggestedName: "Recebimento por Cartão" },
  { keyword: "pagseguro", suggestedName: "Recebimento por Cartão" },
  { keyword: "das", suggestedName: "Impostos" },
  { keyword: "darf", suggestedName: "Impostos" },
  { keyword: "imposto", suggestedName: "Impostos" },
  { keyword: "salario", suggestedName: "Salários" },
  { keyword: "folha", suggestedName: "Salários" },
  { keyword: "posto", suggestedName: "Transporte" },
  { keyword: "combustivel", suggestedName: "Transporte" },
  { keyword: "marketing", suggestedName: "Marketing" },
  { keyword: "meta ads", suggestedName: "Marketing" },
  { keyword: "google ads", suggestedName: "Marketing" },
];
