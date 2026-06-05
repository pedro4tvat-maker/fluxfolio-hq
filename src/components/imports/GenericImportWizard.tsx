import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch, ALL_BRANCHES } from "@/hooks/use-selected-branch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { parseFile, parseDate, parseAmount, type ParsedFile } from "@/lib/import-engine";
import { autoMapSchema, type ImportSchema, type FieldDef } from "@/lib/import-schemas";

type Row = {
  idx: number;
  values: Record<string, any>;
  errors: string[];
  include: boolean;
};

export function GenericImportWizard({
  schema,
  onBack,
  onDone,
}: {
  schema: ImportSchema;
  onBack: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const { selected: companyId } = useSelectedCompany();
  const { branches, branchId } = useSelectedBranch();
  const [step, setStep] = useState(1);
  const [branchSel, setBranchSel] = useState<string>(branchId ?? ALL_BRANCHES);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reference data for name → id resolution
  const { data: categorias = [] } = useQuery({
    queryKey: ["categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, nome, tipo").eq("company_id", companyId!);
      return data ?? [];
    },
  });
  const { data: contas = [] } = useQuery({
    queryKey: ["financial-accounts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("financial_accounts").select("id, nome").eq("company_id", companyId!).eq("ativo", true);
      return data ?? [];
    },
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["products", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, nome, custo_unitario").eq("company_id", companyId!);
      return data ?? [];
    },
  });

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const p = await parseFile(f);
      if (p.rows.length === 0) { toast.error("Arquivo vazio."); return; }
      setParsed(p);
      setMapping(autoMapSchema(schema, p.columns));
      toast.success("Arquivo enviado.");
      setStep(3);
    } catch (e) {
      toast.error("Não foi possível ler o arquivo.");
      console.error(e);
    }
  };

  const buildPreview = () => {
    if (!parsed) return;
    const missingRequired = schema.fields.filter((f) => f.required && !mapping[f.key]);
    if (missingRequired.length > 0) {
      toast.error("Mapeie os campos obrigatórios: " + missingRequired.map((f) => f.label).join(", "));
      return;
    }
    const built: Row[] = parsed.rows.map((raw, idx) => {
      const values: Record<string, any> = {};
      const errors: string[] = [];
      for (const f of schema.fields) {
        const col = mapping[f.key];
        const raw_v = col ? String((raw as any)[col] ?? "").trim() : "";
        const v = coerce(f, raw_v);
        if (f.required && (v === null || v === "")) errors.push(`${f.label} ausente/ inválido`);
        values[f.key] = v;
      }
      return { idx, values, errors, include: errors.length === 0 };
    });
    setRows(built);
    setStep(5);
  };

  const findCategoryId = (name?: string, tipo?: string) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    return categorias.find((c: any) => c.nome.toLowerCase() === lower && (!tipo || c.tipo === tipo))?.id
      ?? categorias.find((c: any) => c.nome.toLowerCase() === lower)?.id
      ?? null;
  };
  const findAccountId = (name?: string) => {
    if (!name) return null;
    return contas.find((c: any) => c.nome.toLowerCase() === name.toLowerCase().trim())?.id ?? null;
  };
  const findProductId = (name?: string) => {
    if (!name) return null;
    return produtos.find((p: any) => p.nome.toLowerCase() === name.toLowerCase().trim())?.id ?? null;
  };

  const confirm = async () => {
    if (!companyId || !user) { toast.error("Selecione a empresa."); return; }
    setImporting(true);
    try {
      const branchFinal = branchSel === ALL_BRANCHES ? null : branchSel;
      const { data: batch, error: bErr } = await supabase
        .from("import_batches")
        .insert({
          company_id: companyId,
          branch_id: branchFinal,
          user_id: user.id,
          import_type: schema.importType,
          file_name: file?.name,
          file_format: file?.name.split(".").pop()?.toLowerCase(),
          total_rows: rows.length,
          status: "processando",
        })
        .select("id").single();
      if (bErr || !batch) throw bErr ?? new Error("Falha ao criar lote.");

      let imported = 0, ignored = 0, errors = 0;
      for (const r of rows) {
        if (!r.include || r.errors.length > 0) { ignored++; continue; }
        try {
          await persistRow(schema, r.values, companyId, branchFinal, batch.id, {
            findCategoryId, findAccountId, findProductId,
          });
          imported++;
        } catch (e) {
          console.error(e);
          errors++;
        }
      }

      await supabase.from("import_batches").update({
        imported_rows: imported, ignored_rows: ignored, error_rows: errors, status: "concluido",
      }).eq("id", batch.id);

      toast.success(`Importação concluída: ${imported} de ${rows.length}.`);
      onDone();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Voltar</Button>
        <div>
          <h2 className="text-xl font-display font-semibold">{schema.label}</h2>
          <p className="text-sm text-muted-foreground">Wizard de importação — etapa {step} de 4</p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Filial</CardTitle>
            <CardDescription>{schema.help ?? "Os dados serão vinculados à filial selecionada."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Filial</label>
              <Select value={branchSel} onValueChange={setBranchSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BRANCHES}>Sem filial (consolidado)</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Continuar <ArrowRight className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Envie o arquivo</CardTitle>
            <CardDescription>Formatos aceitos: PDF, CSV ou XLSX.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-muted/40 transition"
            >
              <FileSpreadsheet className="size-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">CSV · XLSX (até 5MB)</p>
              <input
                ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
            <div className="flex justify-between mt-4">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Voltar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && parsed && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeamento de colunas</CardTitle>
            <CardDescription>{parsed.rows.length} linhas detectadas. Confira a correspondência de campos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {schema.fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {f.required ? "* " : ""}{f.label}
                </label>
                <Select value={mapping[f.key] ?? ""} onValueChange={(v) => setMapping({ ...mapping, [f.key]: v || null })}>
                  <SelectTrigger><SelectValue placeholder="— Ignorar —" /></SelectTrigger>
                  <SelectContent>
                    {parsed.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="size-4" /> Voltar</Button>
              <Button onClick={buildPreview}>Pré-visualizar <ArrowRight className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Revisão e confirmação</CardTitle>
            <CardDescription>
              {rows.filter((r) => r.include && r.errors.length === 0).length} de {rows.length} serão importadas.
              Linhas com erro são marcadas e ignoradas automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border overflow-x-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    {schema.fields.map((f) => <TableHead key={f.key}>{f.label}</TableHead>)}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 200).map((r, i) => (
                    <TableRow key={i} className={!r.include ? "opacity-50" : ""}>
                      <TableCell>
                        <input
                          type="checkbox" checked={r.include}
                          onChange={(e) => { const cp = [...rows]; cp[i] = { ...cp[i], include: e.target.checked }; setRows(cp); }}
                        />
                      </TableCell>
                      {schema.fields.map((f) => (
                        <TableCell key={f.key} className="text-xs">
                          {r.values[f.key] === null || r.values[f.key] === "" ? "—" : String(r.values[f.key])}
                        </TableCell>
                      ))}
                      <TableCell>
                        {r.errors.length > 0
                          ? <Badge variant="destructive" className="text-[10px]" title={r.errors.join("; ")}>Erro</Badge>
                          : <Badge variant="default" className="text-[10px]">OK</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 200 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  Exibindo primeiras 200 linhas. Todas as {rows.length} serão processadas.
                </div>
              )}
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="size-4" /> Voltar</Button>
              <Button onClick={confirm} disabled={importing}>
                <CheckCircle2 className="size-4" /> {importing ? "Importando..." : "Confirmar importação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function coerce(field: FieldDef, raw: string): any {
  if (raw === "" || raw === null || raw === undefined) return null;
  switch (field.kind) {
    case "date": return parseDate(raw);
    case "number": {
      const n = parseAmount(raw);
      return n === null ? null : Math.abs(n);
    }
    case "integer": {
      const n = parseAmount(raw);
      return n === null ? null : Math.round(n);
    }
    case "enum": {
      const v = raw.toLowerCase().trim();
      // Common aliases
      const aliasMap: Record<string, string> = {
        c: "entrada", credito: "entrada", crédito: "entrada", receita: "entrada", in: "entrada",
        d: "saida", debito: "saida", débito: "saida", despesa: "saida", out: "saida",
        aberto: "em_aberto", pendente: "em_aberto",
      };
      const normalized = aliasMap[v] ?? v;
      if (field.enumValues?.includes(normalized)) return normalized;
      return null;
    }
    default: return raw;
  }
}

async function persistRow(
  schema: ImportSchema,
  v: Record<string, any>,
  companyId: string,
  branchId: string | null,
  batchId: string,
  res: {
    findCategoryId: (name?: string, tipo?: string) => string | null;
    findAccountId: (name?: string) => string | null;
    findProductId: (name?: string) => string | null;
  },
) {
  const base: any = { company_id: companyId, branch_id: branchId, import_batch_id: batchId, ...schema.defaults };

  if (schema.table === "transactions") {
    const tipo = v.tipo ?? schema.defaults?.tipo ?? "entrada";
    const payload = {
      ...base,
      data: v.data,
      descricao: v.descricao ?? "(sem descrição)",
      tipo,
      valor: v.valor,
      forma_pagamento: v.forma_pagamento ?? null,
      categoria_id: res.findCategoryId(v.categoria, tipo),
      conta_id: res.findAccountId(v.conta),
      observacoes: v.cliente ? `Cliente: ${v.cliente}` : null,
    };
    const { error } = await supabase.from("transactions").insert(payload);
    if (error) throw error;
    return;
  }

  if (schema.table === "payables") {
    const payload = {
      ...base,
      descricao: v.descricao,
      fornecedor: v.fornecedor ?? null,
      valor: v.valor,
      vencimento: v.vencimento,
      categoria_id: res.findCategoryId(v.categoria, "saida"),
      status: v.status ?? schema.defaults?.status ?? "em_aberto",
      parcelas: v.parcelas ?? 1,
    };
    const { error } = await supabase.from("payables").insert(payload);
    if (error) throw error;
    return;
  }

  if (schema.table === "receivables") {
    const payload = {
      ...base,
      descricao: v.descricao,
      cliente: v.cliente ?? null,
      valor: v.valor,
      vencimento: v.vencimento,
      categoria_id: res.findCategoryId(v.categoria, "entrada"),
      status: v.status ?? schema.defaults?.status ?? "em_aberto",
    };
    const { error } = await supabase.from("receivables").insert(payload);
    if (error) throw error;
    return;
  }

  if (schema.table === "products") {
    if (schema.mode === "updateByName") {
      const id = res.findProductId(v.nome);
      if (!id) throw new Error(`Produto não encontrado: ${v.nome}`);
      const update: any = {};
      if (v.custo_unitario !== null && v.custo_unitario !== undefined) update.custo_unitario = v.custo_unitario;
      if (v.preco_venda !== null && v.preco_venda !== undefined) update.preco_venda = v.preco_venda;
      const { error } = await supabase.from("products").update(update).eq("id", id);
      if (error) throw error;
      return;
    }
    // upsert by name
    const existingId = res.findProductId(v.nome);
    const payload: any = {
      nome: v.nome,
      categoria: v.categoria ?? null,
      fornecedor: v.fornecedor ?? null,
      quantidade: v.quantidade ?? 0,
      custo_unitario: v.custo_unitario ?? 0,
      preco_venda: v.preco_venda ?? 0,
      estoque_minimo: v.estoque_minimo ?? 0,
    };
    if (existingId) {
      const { error } = await supabase.from("products").update({ ...payload, import_batch_id: batchId }).eq("id", existingId);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("products").insert({ ...payload, company_id: companyId, branch_id: branchId, import_batch_id: batchId });
      if (error) throw error;
    }
    return;
  }

  if (schema.table === "stock_movements") {
    const productId = res.findProductId(v.produto);
    if (!productId) throw new Error(`Produto não encontrado: ${v.produto}`);
    const payload = {
      company_id: companyId,
      branch_id: branchId,
      import_batch_id: batchId,
      product_id: productId,
      data: v.data,
      tipo: v.tipo,
      quantidade: v.quantidade,
      custo_unitario: v.custo_unitario ?? null,
      motivo: v.motivo ?? null,
    };
    const { error } = await supabase.from("stock_movements").insert(payload);
    if (error) throw error;
    return;
  }
}
