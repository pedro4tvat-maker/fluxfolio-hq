import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload, FileSpreadsheet, History as HistoryIcon, ArrowLeft, ArrowRight,
  CheckCircle2, AlertTriangle, Trash2, Building2, Wallet, ShoppingCart,
  Package, ArrowUpCircle, ArrowDownCircle, Tag, FileText, Banknote, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch, ALL_BRANCHES } from "@/hooks/use-selected-branch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatMoney as formatBRL } from "@/lib/format";
import {
  parseFile, autoMapColumns, parseDate, parseAmount, DEFAULT_RULES,
  type BankFields, type ParsedFile, type Rule,
} from "@/lib/import-engine";

export const Route = createFileRoute("/app/importacoes")({
  component: ImportacoesPage,
});

type ImportType = {
  key: string;
  title: string;
  description: string;
  formats: string;
  icon: React.ComponentType<{ className?: string }>;
  implemented: boolean;
};

const IMPORT_TYPES: ImportType[] = [
  { key: "extrato", title: "Extrato Bancário", description: "Importe transações do banco com classificação e conciliação automática.", formats: "CSV, XLSX, OFX", icon: Banknote, implemented: true },
  { key: "fluxo", title: "Fluxo de Caixa", description: "Lançamentos manuais consolidados.", formats: "CSV, XLSX", icon: Wallet, implemented: false },
  { key: "vendas", title: "Vendas", description: "Histórico de vendas com clientes e produtos.", formats: "CSV, XLSX", icon: ShoppingCart, implemented: false },
  { key: "produtos", title: "Produtos", description: "Cadastro e atualização de estoque.", formats: "CSV, XLSX", icon: Package, implemented: false },
  { key: "pagar", title: "Contas a Pagar", description: "Compromissos e fornecedores.", formats: "CSV, XLSX", icon: ArrowUpCircle, implemented: false },
  { key: "receber", title: "Contas a Receber", description: "Recebimentos previstos e clientes.", formats: "CSV, XLSX", icon: ArrowDownCircle, implemented: false },
  { key: "estoque", title: "Estoque", description: "Movimentações: entradas, saídas e ajustes.", formats: "CSV, XLSX", icon: Package, implemented: false },
  { key: "precificacao", title: "Precificação", description: "Custos, margens e preços sugeridos.", formats: "CSV, XLSX", icon: Tag, implemented: false },
  { key: "dividas", title: "Dívidas e Parcelamentos", description: "Empréstimos e financiamentos.", formats: "CSV, XLSX", icon: FileText, implemented: false },
];

function ImportacoesPage() {
  const [view, setView] = useState<"home" | "wizard" | "history" | "rules">("home");
  const [type, setType] = useState<ImportType | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight">Central de Importação e Conciliação</h1>
          <p className="text-muted-foreground mt-1">Importe extratos, planilhas e arquivos com revisão, classificação automática e conciliação financeira.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView("rules")}><Sparkles className="size-4" /> Regras de classificação</Button>
          <Button variant="outline" onClick={() => setView("history")}><HistoryIcon className="size-4" /> Histórico</Button>
        </div>
      </div>

      {view === "home" && (
        <TypesGrid onSelect={(t) => { setType(t); setView("wizard"); }} />
      )}
      {view === "wizard" && type && (
        <ImportWizard type={type} onBack={() => setView("home")} onDone={() => { setView("history"); }} />
      )}
      {view === "history" && (
        <HistoryView onBack={() => setView("home")} />
      )}
      {view === "rules" && (
        <RulesView onBack={() => setView("home")} />
      )}
    </div>
  );
}

function TypesGrid({ onSelect }: { onSelect: (t: ImportType) => void }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {IMPORT_TYPES.map((t) => (
        <Card key={t.key} className="flex flex-col">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="size-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <t.icon className="size-5" />
              </div>
              {!t.implemented && <Badge variant="secondary" className="text-[10px]">Em breve</Badge>}
            </div>
            <CardTitle className="text-base mt-3">{t.title}</CardTitle>
            <CardDescription>{t.description}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto pt-0 space-y-3">
            <div className="text-xs text-muted-foreground">Formatos: <span className="font-medium text-foreground">{t.formats}</span></div>
            <Button
              className="w-full"
              disabled={!t.implemented}
              onClick={() => onSelect(t)}
            >
              <Upload className="size-4" /> Importar
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type PreviewRow = {
  idx: number;
  raw: Record<string, string>;
  data: string | null;
  descricao: string;
  valor: number | null;
  tipo: "entrada" | "saida" | null;
  documento: string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  status: "ok" | "revisar" | "duplicado" | "conciliar" | "erro" | "ignorado";
  alerts: string[];
  reconcileWith?: { type: "payable" | "receivable"; id: string; descricao: string };
  include: boolean;
};

function ImportWizard({ type, onBack, onDone }: { type: ImportType; onBack: () => void; onDone: () => void }) {
  const { user } = useAuth();
  const { selected: companyId } = useSelectedCompany();
  const { branches, branchId } = useSelectedBranch();
  const [step, setStep] = useState(1);
  const [contaId, setContaId] = useState<string | null>(null);
  const [branchSel, setBranchSel] = useState<string>(branchId ?? ALL_BRANCHES);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<BankFields, string | null>>({
    data: null, descricao: null, valor: null, tipo: null, documento: null,
  });
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: contas = [] } = useQuery({
    queryKey: ["financial-accounts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, nome, tipo")
        .eq("company_id", companyId!)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, nome, tipo")
        .eq("company_id", companyId!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["import-rules", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_rules")
        .select("id, keyword, category_id, tipo, is_active")
        .eq("company_id", companyId!)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const handleFile = async (f: File) => {
    setFile(f);
    try {
      const p = await parseFile(f);
      if (p.rows.length === 0) {
        toast.error("Não foi possível ler o arquivo (vazio).");
        return;
      }
      setParsed(p);
      setMapping(autoMapColumns(p.columns));
      toast.success("Arquivo enviado com sucesso.");
      setStep(3);
    } catch (e: any) {
      toast.error("Não foi possível ler o arquivo.");
      console.error(e);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const buildPreview = async () => {
    if (!parsed || !mapping.data || !mapping.valor) {
      toast.error("Mapeie ao menos Data e Valor.");
      return;
    }
    const [{ data: payables = [] }, { data: receivables = [] }] = await Promise.all([
      supabase.from("payables").select("id, descricao, valor, vencimento, status").eq("company_id", companyId!).in("status", ["em_aberto", "vencido"]),
      supabase.from("receivables").select("id, descricao, valor, vencimento, status").eq("company_id", companyId!).in("status", ["em_aberto", "vencido"]),
    ]);

    const since = new Date(); since.setDate(since.getDate() - 180);
    const { data: existing = [] } = await supabase
      .from("transactions")
      .select("data, valor, descricao, conta_id")
      .eq("company_id", companyId!)
      .gte("data", since.toISOString().slice(0, 10));

    const rows: PreviewRow[] = parsed.rows.map((raw, idx) => {
      const dataStr = mapping.data ? String(raw[mapping.data] ?? "") : "";
      const valStr = mapping.valor ? String(raw[mapping.valor] ?? "") : "";
      const desc = mapping.descricao ? String(raw[mapping.descricao] ?? "") : "";
      const doc = mapping.documento ? String(raw[mapping.documento] ?? "") : "";

      const data = parseDate(dataStr);
      const valor = parseAmount(valStr);
      const alerts: string[] = [];
      if (!data) alerts.push("Data inválida");
      if (valor === null) alerts.push("Valor inválido");
      if (!desc) alerts.push("Descrição ausente");

      const tipo: "entrada" | "saida" | null = valor === null ? null : valor < 0 ? "saida" : "entrada";
      const absValor = valor === null ? null : Math.abs(valor);

      let categoria_id: string | null = null;
      const lowerDesc = desc.toLowerCase();
      const matched = rules.find((r) => r.is_active !== false && lowerDesc.includes(r.keyword.toLowerCase()));
      if (matched) categoria_id = matched.category_id;
      if (!categoria_id) {
        const def = DEFAULT_RULES.find((d) => lowerDesc.includes(d.keyword));
        if (def) {
          const cat = categorias.find((c) => c.nome.toLowerCase() === def.suggestedName.toLowerCase());
          if (cat) categoria_id = cat.id;
        }
      }

      const isDup = existing.some((t: any) =>
        t.data === data && Math.abs(Number(t.valor) - (absValor ?? 0)) < 0.01 &&
        (t.conta_id === contaId || !contaId) &&
        (t.descricao ?? "").toLowerCase().includes(desc.toLowerCase().slice(0, 12))
      );

      let reconcileWith: PreviewRow["reconcileWith"];
      if (data && absValor && tipo === "saida") {
        const hit = payables.find((p: any) => Math.abs(Number(p.valor) - absValor) < 0.01 && dateClose(p.vencimento, data));
        if (hit) reconcileWith = { type: "payable", id: hit.id, descricao: hit.descricao };
      } else if (data && absValor && tipo === "entrada") {
        const hit = receivables.find((r: any) => Math.abs(Number(r.valor) - absValor) < 0.01 && dateClose(r.vencimento, data));
        if (hit) reconcileWith = { type: "receivable", id: hit.id, descricao: hit.descricao };
      }

      let status: PreviewRow["status"] = "ok";
      if (alerts.length > 0) status = alerts.some((a) => a.includes("inválid") || a.includes("ausente")) ? "erro" : "revisar";
      if (isDup) status = "duplicado";
      if (reconcileWith) status = "conciliar";

      return {
        idx,
        raw: raw as Record<string, string>,
        data,
        descricao: desc,
        valor: absValor,
        tipo,
        documento: doc,
        categoria_id,
        centro_custo_id: null,
        status,
        alerts,
        reconcileWith,
        include: status !== "erro" && status !== "duplicado",
      };
    });

    setPreview(rows);
    setStep(5);
  };

  const confirm = async () => {
    if (!companyId || !contaId || !user) {
      toast.error("Selecione conta e empresa.");
      return;
    }
    setImporting(true);
    try {
      const branchFinal = branchSel === ALL_BRANCHES ? null : branchSel;
      const { data: batch, error: bErr } = await supabase
        .from("import_batches")
        .insert({
          company_id: companyId,
          branch_id: branchFinal,
          user_id: user.id,
          import_type: "extrato_bancario",
          file_name: file?.name,
          file_format: file?.name.split(".").pop()?.toLowerCase(),
          total_rows: preview.length,
          status: "processando",
        })
        .select("id")
        .single();
      if (bErr || !batch) throw bErr;

      const toImport = preview.filter((r) => r.include && r.status !== "erro");
      let imported = 0, ignored = 0, errors = 0, dups = 0, reconciled = 0;

      for (const r of preview) {
        if (!r.include) { ignored++; continue; }
        if (r.status === "erro") { errors++; continue; }
        if (r.status === "duplicado" && !r.include) { dups++; continue; }
        if (r.status === "duplicado") dups++;

        if (r.reconcileWith) {
          if (r.reconcileWith.type === "payable") {
            const { error } = await supabase
              .from("payables")
              .update({ status: "pago", data_pagamento: r.data, conta_id: contaId })
              .eq("id", r.reconcileWith.id);
            if (error) { errors++; continue; }
          } else {
            const { error } = await supabase
              .from("receivables")
              .update({ status: "recebido", data_recebimento: r.data, conta_id: contaId })
              .eq("id", r.reconcileWith.id);
            if (error) { errors++; continue; }
          }
          const linkCol = r.reconcileWith.type === "payable" ? "payable_id" : "receivable_id";
          await supabase
            .from("transactions")
            .update({
              import_batch_id: batch.id,
              reconciled_with_type: r.reconcileWith.type,
              reconciled_with_id: r.reconcileWith.id,
              reconciliation_status: "auto",
              branch_id: branchFinal,
            })
            .eq(linkCol, r.reconcileWith.id);
          reconciled++; imported++;
          continue;
        }

        const { error } = await supabase.from("transactions").insert({
          company_id: companyId,
          branch_id: branchFinal,
          data: r.data,
          tipo: r.tipo,
          descricao: r.descricao || "(sem descrição)",
          valor: r.valor,
          categoria_id: r.categoria_id,
          conta_id: contaId,
          status: "realizado",
          observacoes: r.documento ? `Doc: ${r.documento}` : null,
          import_batch_id: batch.id,
        });
        if (error) { errors++; continue; }
        imported++;
      }

      await supabase.from("import_batches").update({
        imported_rows: imported,
        ignored_rows: ignored,
        error_rows: errors,
        duplicate_rows: dups,
        reconciled_rows: reconciled,
        status: "concluido",
      }).eq("id", batch.id);

      toast.success(`Importação concluída: ${imported} de ${preview.length} registros.`);
      onDone();
    } catch (e: any) {
      toast.error("Erro na importação: " + (e.message ?? e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Voltar</Button>
        <div>
          <h2 className="text-xl font-display font-semibold">{type.title}</h2>
          <p className="text-sm text-muted-foreground">Wizard de importação — etapa {step} de 5</p>
        </div>
      </div>

      <StepBar step={step} />

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Empresa, filial e conta</CardTitle>
            <CardDescription>Os dados importados respeitam a empresa e a filial selecionadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Filial">
              <Select value={branchSel} onValueChange={setBranchSel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_BRANCHES}>Sem filial (consolidado)</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Conta financeira *">
              <Select value={contaId ?? ""} onValueChange={setContaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a conta do extrato" /></SelectTrigger>
                <SelectContent>
                  {contas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex justify-end">
              <Button disabled={!contaId} onClick={() => setStep(2)}>Continuar <ArrowRight className="size-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Envie o arquivo</CardTitle>
            <CardDescription>Formatos aceitos: CSV, XLSX, OFX. PDF é experimental — revise tudo antes de confirmar.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:bg-muted/40 transition"
            >
              <FileSpreadsheet className="size-10 mx-auto text-muted-foreground" />
              <p className="mt-3 font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">CSV · XLSX · OFX (até 5MB)</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.ofx"
                className="hidden"
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
            {(["data", "valor", "descricao", "tipo", "documento"] as BankFields[]).map((f) => (
              <Field key={f} label={`${f === "data" || f === "valor" ? "*" : ""} ${labelFor(f)}`}>
                <Select value={mapping[f] ?? ""} onValueChange={(v) => setMapping({ ...mapping, [f]: v || null })}>
                  <SelectTrigger><SelectValue placeholder="— Ignorar —" /></SelectTrigger>
                  <SelectContent>
                    {parsed.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
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
            <CardDescription>Edite, ignore ou confirme cada linha. Linhas com erro não serão importadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PreviewSummary preview={preview} />
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r, i) => (
                    <TableRow key={i} className={!r.include ? "opacity-50" : ""}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => {
                            const cp = [...preview]; cp[i] = { ...cp[i], include: e.target.checked }; setPreview(cp);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.data ?? "—"}</TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {r.descricao}
                        {r.reconcileWith && <div className="text-[10px] text-emerald-600">↳ Concilia com {r.reconcileWith.type === "payable" ? "conta a pagar" : "conta a receber"}: {r.reconcileWith.descricao}</div>}
                      </TableCell>
                      <TableCell className="text-right font-mono">{r.valor !== null ? formatBRL(r.valor) : "—"}</TableCell>
                      <TableCell>{r.tipo ?? "—"}</TableCell>
                      <TableCell>
                        <Select value={r.categoria_id ?? ""} onValueChange={(v) => { const cp = [...preview]; cp[i] = { ...cp[i], categoria_id: v || null }; setPreview(cp); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {categorias.filter((c: any) => !r.tipo || c.tipo === r.tipo).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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

function dateClose(d1: string, d2: string) {
  const a = new Date(d1).getTime(), b = new Date(d2).getTime();
  return Math.abs(a - b) <= 1000 * 60 * 60 * 24 * 3; // 3-day window
}

function labelFor(f: BankFields) {
  return { data: "Data", valor: "Valor", descricao: "Descrição", tipo: "Tipo", documento: "Documento" }[f];
}

function StepBar({ step }: { step: number }) {
  const steps = ["Empresa/Conta", "Arquivo", "Mapeamento", "—", "Revisão"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const n = i + 1;
        if (s === "—") return null;
        const active = step === n, done = step > n;
        return (
          <div key={i} className="flex items-center gap-2">
            <div className={`size-6 rounded-full grid place-items-center text-[10px] font-semibold ${done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{n}</div>
            <span className={active ? "font-medium" : "text-muted-foreground"}>{s}</span>
            {i < steps.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: PreviewRow["status"] }) {
  const map: Record<PreviewRow["status"], { label: string; cls: string }> = {
    ok: { label: "Pronto", cls: "bg-emerald-500/10 text-emerald-600" },
    revisar: { label: "Revisar", cls: "bg-amber-500/10 text-amber-600" },
    duplicado: { label: "Duplicado", cls: "bg-orange-500/10 text-orange-600" },
    conciliar: { label: "Conciliar", cls: "bg-blue-500/10 text-blue-600" },
    erro: { label: "Erro", cls: "bg-red-500/10 text-red-600" },
    ignorado: { label: "Ignorado", cls: "bg-muted text-muted-foreground" },
  };
  const c = map[status];
  return <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-medium ${c.cls}`}>{c.label}</span>;
}

function PreviewSummary({ preview }: { preview: PreviewRow[] }) {
  const total = preview.length;
  const ok = preview.filter((p) => p.status === "ok").length;
  const rev = preview.filter((p) => p.status === "revisar").length;
  const dup = preview.filter((p) => p.status === "duplicado").length;
  const con = preview.filter((p) => p.status === "conciliar").length;
  const err = preview.filter((p) => p.status === "erro").length;
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
      <Stat label="Total" value={total} />
      <Stat label="Prontos" value={ok} tone="emerald" />
      <Stat label="Revisar" value={rev} tone="amber" />
      <Stat label="Conciliar" value={con} tone="blue" />
      <Stat label="Duplicados/Erros" value={dup + err} tone="red" />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  const c = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "blue" ? "text-blue-600" : tone === "red" ? "text-red-600" : "";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold ${c}`}>{value}</div>
    </div>
  );
}

function HistoryView({ onBack }: { onBack: () => void }) {
  const { selected: companyId } = useSelectedCompany();
  const qc = useQueryClient();
  const [toUndo, setToUndo] = useState<string | null>(null);
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["import-batches", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_batches")
        .select("*")
        .eq("company_id", companyId!)
        .order("imported_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const undoMut = useMutation({
    mutationFn: async (batchId: string) => {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, reconciled_with_type, reconciled_with_id")
        .eq("import_batch_id", batchId);
      for (const t of txs ?? []) {
        if (t.reconciled_with_type === "payable" && t.reconciled_with_id) {
          await supabase.from("payables").update({ status: "em_aberto", data_pagamento: null }).eq("id", t.reconciled_with_id);
        }
        if (t.reconciled_with_type === "receivable" && t.reconciled_with_id) {
          await supabase.from("receivables").update({ status: "em_aberto", data_recebimento: null }).eq("id", t.reconciled_with_id);
        }
      }
      await supabase.from("transactions").delete().eq("import_batch_id", batchId);
      await supabase.from("payables").delete().eq("import_batch_id", batchId);
      await supabase.from("receivables").delete().eq("import_batch_id", batchId);
      await supabase.from("import_batches").update({ status: "desfeito", undone_at: new Date().toISOString() }).eq("id", batchId);
    },
    onSuccess: () => {
      toast.success("Importação desfeita.");
      qc.invalidateQueries({ queryKey: ["import-batches"] });
      setToUndo(null);
    },
    onError: (e: any) => toast.error("Erro ao desfazer: " + e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Voltar</Button>
        <h2 className="text-xl font-display font-semibold">Histórico de importações</h2>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Importados</TableHead>
                <TableHead className="text-right">Conciliados</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>}
              {!isLoading && batches.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma importação ainda.</TableCell></TableRow>}
              {batches.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell className="text-xs">{new Date(b.imported_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell>{b.import_type}</TableCell>
                  <TableCell className="font-mono text-xs">{b.file_name}</TableCell>
                  <TableCell className="text-right">{b.total_rows}</TableCell>
                  <TableCell className="text-right text-emerald-600">{b.imported_rows}</TableCell>
                  <TableCell className="text-right text-blue-600">{b.reconciled_rows}</TableCell>
                  <TableCell>
                    <Badge variant={b.status === "desfeito" ? "secondary" : "default"}>{b.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {b.status !== "desfeito" && (
                      <Button size="sm" variant="ghost" onClick={() => setToUndo(b.id)}><Trash2 className="size-3.5" /> Desfazer</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!toUndo} onOpenChange={(o) => !o && setToUndo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desfazer importação?</DialogTitle>
            <DialogDescription>
              Todos os registros criados neste lote serão removidos e as conciliações revertidas. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToUndo(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={undoMut.isPending} onClick={() => toUndo && undoMut.mutate(toUndo)}>
              Desfazer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RulesView({ onBack }: { onBack: () => void }) {
  const { selected: companyId } = useSelectedCompany();
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");

  const { data: rules = [] } = useQuery({
    queryKey: ["import-rules", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("import_rules").select("*, categories(nome)").eq("company_id", companyId!).order("keyword");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: categorias = [] } = useQuery({
    queryKey: ["categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, nome, tipo").eq("company_id", companyId!).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!keyword.trim() || !categoryId || !companyId) throw new Error("Preencha palavra-chave e categoria.");
      const { error } = await supabase.from("import_rules").insert({
        company_id: companyId, keyword: keyword.trim(), category_id: categoryId, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Regra criada."); setKeyword(""); setCategoryId(""); qc.invalidateQueries({ queryKey: ["import-rules"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { await supabase.from("import_rules").delete().eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["import-rules"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Voltar</Button>
        <h2 className="text-xl font-display font-semibold">Regras de classificação automática</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova regra</CardTitle>
          <CardDescription>Quando a descrição contiver a palavra-chave, sugerir a categoria.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Palavra-chave (ex: COELBA)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome} <span className="text-muted-foreground text-xs">({c.tipo})</span></SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>Adicionar regra</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Palavra-chave</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma regra ainda.</TableCell></TableRow>}
              {rules.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.keyword}</TableCell>
                  <TableCell>{r.categories?.nome ?? "—"}</TableCell>
                  <TableCell>{r.is_active ? "Sim" : "Não"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => del.mutate(r.id)}><Trash2 className="size-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
