import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { BranchSwitcher } from "@/components/branch-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { Plus, Pencil, Trash2, AlertTriangle, FileDown } from "lucide-react";

export const Route = createFileRoute("/app/historicos")({ component: Historicos });

const SOURCE_TYPES = [
  { value: "manual", label: "Manual" },
  { value: "planilha", label: "Planilha" },
  { value: "relatorio_antigo", label: "Relatório antigo" },
  { value: "extrato", label: "Extrato" },
  { value: "sistema_anterior", label: "Sistema anterior" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "estimativa_cliente", label: "Estimativa do cliente" },
  { value: "outro", label: "Outro" },
];

const STATUS = [
  { value: "rascunho", label: "Rascunho" },
  { value: "conferido", label: "Conferido" },
  { value: "aprovado", label: "Aprovado" },
  { value: "substituido", label: "Substituído" },
];

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type Snap = any;

const NUMERIC_FIELDS = [
  "revenue_gross","revenue_net","sales_count","variable_costs","fixed_costs",
  "variable_expenses","fixed_expenses","financial_expenses","taxes","discounts","refunds",
  "payroll_costs","marketing_expenses","administrative_expenses","operational_expenses","other_expenses",
  "accounts_receivable_open","accounts_receivable_overdue","accounts_payable_open","accounts_payable_overdue",
  "inventory_value",
] as const;

function emptyForm(companyId?: string, branchId?: string | null): Snap {
  const now = new Date();
  return {
    company_id: companyId ?? null,
    branch_id: branchId ?? null,
    reference_month: now.getMonth() + 1,
    reference_year: now.getFullYear(),
    source_type: "manual",
    source_description: "",
    notes: "",
    status: "rascunho",
    ...Object.fromEntries(NUMERIC_FIELDS.map((f) => [f, 0])),
  };
}

function computeDerived(f: Snap) {
  const rl = Number(f.revenue_net) || 0;
  const rg = Number(f.revenue_gross) || 0;
  const sc = Number(f.sales_count) || 0;
  const cv = Number(f.variable_costs) || 0;
  const desp = ["variable_expenses","payroll_costs","marketing_expenses","administrative_expenses","operational_expenses","other_expenses"]
    .reduce((s, k) => s + (Number(f[k]) || 0), 0);
  const cf = (Number(f.fixed_costs) || 0) + (Number(f.fixed_expenses) || 0);
  const fin = Number(f.financial_expenses) || 0;
  const taxes = Number(f.taxes) || 0;
  const ticket = sc > 0 ? rg / sc : 0;
  const grossVal = rl - cv;
  const grossPct = rl > 0 ? (grossVal / rl) * 100 : 0;
  const cmVal = rl - cv - (Number(f.variable_expenses) || 0);
  const cmPct = rl > 0 ? (cmVal / rl) * 100 : 0;
  const opRes = rl - cv - cf - desp - fin - taxes;
  const opPct = rl > 0 ? (opRes / rl) * 100 : 0;
  return {
    average_ticket: round2(ticket),
    gross_margin_value: round2(grossVal),
    gross_margin_percentage: round2(grossPct),
    contribution_margin_value: round2(cmVal),
    contribution_margin_percentage: round2(cmPct),
    operational_result: round2(opRes),
    operational_margin_percentage: round2(opPct),
    net_result: round2(opRes),
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

function validate(f: Snap): string[] {
  const errs: string[] = [];
  if (!f.company_id) errs.push("Empresa obrigatória.");
  if (!f.reference_month || !f.reference_year) errs.push("Mês e ano obrigatórios.");
  if (Number(f.revenue_gross) < 0) errs.push("Receita bruta não pode ser negativa.");
  if (Number(f.revenue_net) > Number(f.revenue_gross) && !f.notes) {
    errs.push("Receita líquida maior que bruta — descreva a justificativa em observações.");
  }
  for (const k of NUMERIC_FIELDS) {
    if (k === "inventory_value") continue;
    if (Number(f[k]) < 0) errs.push(`${k} não pode ser negativo.`);
  }
  return errs;
}

function alertsFor(f: Snap): string[] {
  const out: string[] = [];
  const rl = Number(f.revenue_net) || 0;
  const rg = Number(f.revenue_gross) || 0;
  const cv = Number(f.variable_costs) || 0;
  const fx = Number(f.fixed_expenses) || 0;
  if (rl > rg) out.push("Receita líquida maior que bruta.");
  if ((Number(f.operational_result) || 0) < 0) out.push("Margem operacional negativa.");
  if (rl > 0 && cv / rl > 0.7) out.push("Custo variável acima de 70% da receita.");
  if (rl > 0 && fx / rl > 0.4) out.push("Despesa fixa acima de 40% da receita.");
  if (rl === 0) out.push("Dados incompletos para cálculo de margem.");
  return out;
}

function Historicos() {
  const { isConsultant } = useAuth();
  const { companies, selected } = useSelectedCompany();
  const { branchId } = useSelectedBranch();
  const qc = useQueryClient();

  const { data: ownedCompanies } = useQuery({
    queryKey: ["hist-all-companies"],
    enabled: isConsultant,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome").order("nome");
      return data ?? [];
    },
  });
  const allCompanies = isConsultant ? (ownedCompanies ?? []) : companies;
  const companyId = selected ?? allCompanies[0]?.id;

  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: snaps, refetch } = useQuery({
    queryKey: ["historical-snapshots", companyId, branchId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("historical_financial_snapshots")
        .select("*")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Snap[];
    },
  });

  const filtered = useMemo(() => {
    return (snaps ?? []).filter((s) => {
      if (yearFilter !== "all" && s.reference_year !== yearFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [snaps, yearFilter, statusFilter]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Snap | null>(null);
  const [form, setForm] = useState<Snap>(emptyForm(companyId, branchId));
  const [changeReason, setChangeReason] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) setForm({ ...editing });
    else setForm(emptyForm(companyId, branchId));
    setChangeReason("");
  }, [open, editing, companyId, branchId]);

  const derived = useMemo(() => computeDerived(form), [form]);
  const currentAlerts = useMemo(() => alertsFor({ ...form, ...derived }), [form, derived]);

  const setField = (k: string, v: any) => setForm((f: Snap) => ({ ...f, [k]: v }));

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (s: Snap) => { setEditing(s); setOpen(true); };

  const remove = async (s: Snap) => {
    if (!confirm(`Excluir snapshot ${MONTHS[s.reference_month - 1]}/${s.reference_year}?`)) return;
    const { error } = await supabase.from("historical_financial_snapshots")
      .update({ deleted_at: new Date().toISOString() }).eq("id", s.id);
    if (error) toast.error(error.message);
    else { toast.success("Snapshot excluído."); refetch(); }
  };

  const save = async () => {
    const errs = validate(form);
    if (errs.length) { toast.error(errs.join(" ")); return; }

    // check duplicate on new
    if (!editing) {
      let q = supabase.from("historical_financial_snapshots")
        .select("id").eq("company_id", form.company_id)
        .eq("reference_month", form.reference_month)
        .eq("reference_year", form.reference_year)
        .is("deleted_at", null);
      q = form.branch_id ? q.eq("branch_id", form.branch_id) : q.is("branch_id", null);
      const { data: dup } = await q.maybeSingle();
      if (dup) {
        if (!confirm("Já existem dados para este período. Deseja editar o registro existente?")) return;
        setEditing(dup as any); return;
      }
    }

    const period_start = new Date(form.reference_year, form.reference_month - 1, 1).toISOString().slice(0,10);
    const period_end = new Date(form.reference_year, form.reference_month, 0).toISOString().slice(0,10);
    const payload = { ...form, ...derived, period_start, period_end };
    delete payload.id; delete payload.created_at; delete payload.updated_at;

    if (editing) {
      const _ = changeReason; // change_reason is captured by trigger via app setting when available

      const { error } = await supabase.from("historical_financial_snapshots")
        .update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Snapshot atualizado.");
    } else {
      const { error } = await supabase.from("historical_financial_snapshots").insert(payload as any);
      if (error) return toast.error(error.message);
      toast.success("Snapshot criado.");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["historical-snapshots"] });
    qc.invalidateQueries({ queryKey: ["exec-serie"] });
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const cols = ["reference_year","reference_month","revenue_gross","revenue_net","variable_costs","fixed_expenses","operational_result","operational_margin_percentage","status","source_type"];
    const header = cols.join(",");
    const rows = filtered.map((s) => cols.map((c) => JSON.stringify(s[c] ?? "")).join(","));
    const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "dados-historicos.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const years = useMemo(() => {
    const s = new Set<number>();
    (snaps ?? []).forEach((x) => s.add(x.reference_year));
    return Array.from(s).sort((a, b) => b - a);
  }, [snaps]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Dados Históricos Gerenciais</h1>
          <p className="text-sm text-muted-foreground">
            Lance dados consolidados de meses anteriores para compor relatórios comparativos.
            Estes dados <b>não</b> geram vendas, OS, estoque ou movimentos financeiros.
          </p>
        </div>
        <div className="flex gap-2">
          <BranchSwitcher />
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <FileDown className="size-4" /> CSV
          </Button>
          <Button onClick={openNew} disabled={!companyId}>
            <Plus className="size-4" /> Novo snapshot
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <Label className="text-xs">Ano</Label>
          <Select value={String(yearFilter)} onValueChange={(v) => setYearFilter(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-xl overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Período</th>
              <th className="px-3 py-2 text-right">Receita bruta</th>
              <th className="px-3 py-2 text-right">Receita líquida</th>
              <th className="px-3 py-2 text-right">Custos</th>
              <th className="px-3 py-2 text-right">Resultado op.</th>
              <th className="px-3 py-2 text-right">Margem op. %</th>
              <th className="px-3 py-2">Origem</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Alertas</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">Sem snapshots.</td></tr>
            )}
            {filtered.map((s) => {
              const al = alertsFor(s);
              return (
                <tr key={s.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2">{MONTHS[s.reference_month - 1]}/{s.reference_year}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(Number(s.revenue_gross) || 0)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(Number(s.revenue_net) || 0)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(Number(s.variable_costs) || 0)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(Number(s.operational_result) || 0)}</td>
                  <td className="px-3 py-2 text-right">{(Number(s.operational_margin_percentage) || 0).toFixed(1)}%</td>
                  <td className="px-3 py-2">{SOURCE_TYPES.find((t) => t.value === s.source_type)?.label ?? s.source_type}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-muted">
                      {STATUS.find((t) => t.value === s.status)?.label ?? s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {al.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs" title={al.join(" • ")}>
                        <AlertTriangle className="size-3.5" /> {al.length}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => remove(s)}><Trash2 className="size-4" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar snapshot" : "Novo snapshot histórico"}</DialogTitle>
            <DialogDescription>
              Dados consolidados do mês. Cálculos derivados são atualizados automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Label>Empresa</Label>
              <Select value={form.company_id ?? ""} onValueChange={(v) => setField("company_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {allCompanies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mês</Label>
              <Select value={String(form.reference_month)} onValueChange={(v) => setField("reference_month", Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ano</Label>
              <Input type="number" value={form.reference_year} onChange={(e) => setField("reference_year", Number(e.target.value))} />
            </div>

            <div>
              <Label>Origem dos dados</Label>
              <Select value={form.source_type} onValueChange={(v) => setField("source_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Descrição da origem</Label>
              <Input value={form.source_description ?? ""} onChange={(e) => setField("source_description", e.target.value)}
                placeholder="Ex.: Planilha de controle de abril/2026 enviada pelo cliente." />
            </div>
          </div>

          <FieldsGroup title="Receita" fields={[
            ["revenue_gross", "Receita bruta"], ["revenue_net", "Receita líquida"],
            ["sales_count", "Quantidade de vendas"], ["discounts", "Descontos"], ["refunds", "Devoluções"], ["taxes", "Impostos"],
          ]} form={form} setField={setField} />

          <FieldsGroup title="Custos" fields={[
            ["variable_costs", "Custos variáveis"], ["fixed_costs", "Custos fixos"], ["payroll_costs", "Folha / pessoal"],
          ]} form={form} setField={setField} />

          <FieldsGroup title="Despesas" fields={[
            ["fixed_expenses", "Despesas fixas"], ["variable_expenses", "Despesas variáveis"],
            ["financial_expenses", "Despesas financeiras"], ["marketing_expenses", "Marketing"],
            ["administrative_expenses", "Administrativo"], ["operational_expenses", "Operacional"], ["other_expenses", "Outras"],
          ]} form={form} setField={setField} />

          <FieldsGroup title="Contas e estoque" fields={[
            ["accounts_receivable_open", "Receber em aberto"], ["accounts_receivable_overdue", "Receber vencidas"],
            ["accounts_payable_open", "Pagar em aberto"], ["accounts_payable_overdue", "Pagar vencidas"],
            ["inventory_value", "Valor de estoque"],
          ]} form={form} setField={setField} />

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setField("notes", e.target.value)} rows={2} />
          </div>

          {editing && (
            <div>
              <Label>Motivo da alteração (opcional)</Label>
              <Input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
            </div>
          )}

          <div className="grid md:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/50 text-sm">
            <Derived label="Ticket médio" value={formatMoney(derived.average_ticket)} />
            <Derived label="Margem bruta" value={`${formatMoney(derived.gross_margin_value)} (${derived.gross_margin_percentage.toFixed(1)}%)`} />
            <Derived label="Margem contribuição" value={`${formatMoney(derived.contribution_margin_value)} (${derived.contribution_margin_percentage.toFixed(1)}%)`} />
            <Derived label="Resultado operacional" value={`${formatMoney(derived.operational_result)} (${derived.operational_margin_percentage.toFixed(1)}%)`} />
          </div>

          {currentAlerts.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-center gap-2 font-medium mb-1"><AlertTriangle className="size-4" /> Alertas</div>
              <ul className="list-disc pl-5 space-y-0.5">{currentAlerts.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldsGroup({ title, fields, form, setField }: { title: string; fields: [string, string][]; form: Snap; setField: (k: string, v: any) => void }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 mt-2">{title}</div>
      <div className="grid md:grid-cols-4 gap-3">
        {fields.map(([k, label]) => (
          <div key={k}>
            <Label className="text-xs">{label}</Label>
            <Input type="number" step="0.01" value={form[k] ?? ""} onChange={(e) => setField(k, e.target.value === "" ? null : Number(e.target.value))} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Derived({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
