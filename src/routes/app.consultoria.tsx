import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy, Link2, Check, X, BadgeCheck, Building2, Plus, Pencil, Trash2, Undo2,
  TrendingUp, TrendingDown, Wallet, Users, FileText, Calendar, Download,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { maskCNPJ, maskPhone, BR_STATES } from "@/lib/cnpj";
import { formatMoney, formatDate, monthRange, downloadCSV } from "@/lib/format";

export const CONSULTORIA_SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "receitas", label: "Receitas" },
  { id: "despesas", label: "Despesas e Custos" },
  { id: "contratos", label: "Contratos" },
  { id: "clientes", label: "Clientes Contratantes" },
  { id: "receber", label: "Contas a Receber" },
  { id: "pagar", label: "Contas a Pagar" },
  { id: "relatorios", label: "Relatórios" },
  { id: "solicitacoes", label: "Solicitações" },
] as const;
type Section = typeof CONSULTORIA_SECTIONS[number]["id"];
const SECTION_IDS = CONSULTORIA_SECTIONS.map((s) => s.id) as readonly string[];

export const Route = createFileRoute("/app/consultoria")({
  validateSearch: (s: Record<string, unknown>): { section: Section } => {
    const v = String(s.section ?? "");
    return { section: (SECTION_IDS.includes(v) ? v : "dashboard") as Section };
  },
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: ConsultoriaPage,
});

const REVENUE_TYPES = ["Consultoria mensal", "Mentoria", "Projeto fechado", "Diagnóstico financeiro", "Treinamento", "Produto digital", "Comissão", "Outros"];
const EXPENSE_CATEGORIES = ["Software e ferramentas", "Tráfego pago", "Marketing", "Internet", "Telefone", "Transporte", "Alimentação", "Contabilidade", "Impostos", "Cursos e capacitação", "Equipamentos", "Assinaturas", "Comissões", "Terceirizados", "Despesas bancárias", "Outras despesas"];
const PAYMENT_METHODS = ["Pix", "Transferência bancária", "Boleto", "Cartão de crédito", "Cartão de débito", "Dinheiro", "Outros"];

function ConsultoriaPage() {
  const { isConsultant, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!isConsultant) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center max-w-xl mx-auto">
        <h2 className="font-display font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">Esta área é exclusiva para consultores.</p>
      </div>
    );
  }
  return <Inner />;
}

function useConsultancy() {
  return useQuery({
    queryKey: ["my-consultancy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function Inner() {
  const { data: consultancy, isLoading } = useConsultancy();
  const { section } = Route.useSearch();
  const navigate = Route.useNavigate();
  if (isLoading) return <div className="text-muted-foreground text-sm">Carregando...</div>;
  if (!consultancy) return <div className="text-muted-foreground text-sm">Perfil de consultoria não encontrado.</div>;

  const currentLabel = CONSULTORIA_SECTIONS.find((s) => s.id === section)?.label ?? "Dashboard";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Minha Consultoria</h1>
        <p className="text-muted-foreground text-sm">{currentLabel}</p>
      </div>
      <Tabs value={section} onValueChange={(v) => navigate({ search: { section: v as Section }, replace: true })}>
        <TabsContent value="dashboard" className="mt-0"><DashboardTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="receitas" className="mt-0"><ReceitasTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="despesas" className="mt-0"><DespesasTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="contratos" className="mt-0"><ContratosTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="clientes" className="mt-0"><ClientesContratantesTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="receber" className="mt-0"><ReceberTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="pagar" className="mt-0"><PagarTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="relatorios" className="mt-0"><RelatoriosTab consultantId={consultancy.id} /></TabsContent>
        <TabsContent value="solicitacoes" className="mt-0"><SolicitacoesTab /></TabsContent>
        
      </Tabs>
    </div>
  );
}

/* ====================== DASHBOARD ====================== */
function DashboardTab({ consultantId }: { consultantId: string }) {
  const { start, end } = monthRange();
  const today = new Date().toISOString().slice(0, 10);

  const { data: recv = [] } = useQuery({
    queryKey: ["c-recv", consultantId],
    queryFn: async () => (await supabase.from("consultancy_receivables").select("*").eq("consultant_id", consultantId)).data ?? [],
  });
  const { data: pay = [] } = useQuery({
    queryKey: ["c-pay", consultantId],
    queryFn: async () => (await supabase.from("consultancy_payables").select("*").eq("consultant_id", consultantId)).data ?? [],
  });
  const { data: contracts = [] } = useQuery({
    queryKey: ["c-contracts", consultantId],
    queryFn: async () => (await supabase.from("consultancy_contracts").select("*").eq("consultant_id", consultantId)).data ?? [],
  });

  const inMonth = (d: string | null) => d && d >= start && d <= end;
  const receitaMes = recv.filter((r: any) => r.status === "recebido" && inMonth(r.received_date)).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const despesaMes = pay.filter((p: any) => p.status === "pago" && inMonth(p.payment_date)).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const resultado = receitaMes - despesaMes;
  const ativos = contracts.filter((c: any) => c.status === "ativo");
  const clientesAtivos = new Set(ativos.map((c: any) => c.company_id || c.client_name)).size;
  const aReceber = recv.filter((r: any) => r.status !== "recebido").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const vencidas = recv.filter((r: any) => r.status !== "recebido" && r.due_date < today).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const mrr = ativos.reduce((s: number, c: any) => s + Number(c.monthly_amount), 0);
  const ticketMedio = ativos.length ? mrr / ativos.length : 0;
  const proxRecebimentos = recv.filter((r: any) => r.status !== "recebido" && r.due_date >= today).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date)).slice(0, 5);
  const proxDespesas = pay.filter((p: any) => p.status !== "pago" && p.due_date >= today).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date)).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Receita do mês" value={formatMoney(receitaMes)} tone="success" />
        <KpiCard icon={TrendingDown} label="Despesas do mês" value={formatMoney(despesaMes)} tone="danger" />
        <KpiCard icon={Wallet} label="Resultado líquido" value={formatMoney(resultado)} tone={resultado >= 0 ? "success" : "danger"} />
        <KpiCard icon={Users} label="Clientes ativos" value={String(clientesAtivos)} />
        <KpiCard icon={FileText} label="Contratos ativos" value={String(ativos.length)} />
        <KpiCard icon={Wallet} label="Receita recorrente (MRR)" value={formatMoney(mrr)} tone="success" />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={formatMoney(ticketMedio)} />
        <KpiCard icon={TrendingDown} label="Mensalidades em atraso" value={formatMoney(vencidas)} tone="danger" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Próximos recebimentos">
          {proxRecebimentos.length === 0 ? <Empty text="Nenhum recebimento previsto." /> :
            <ul className="text-sm divide-y">
              {proxRecebimentos.map((r: any) => (
                <li key={r.id} className="py-2 flex justify-between"><span>{r.description}<div className="text-xs text-muted-foreground">{r.client_name || "—"} · {formatDate(r.due_date)}</div></span><span className="font-semibold text-emerald-600">{formatMoney(r.amount)}</span></li>
              ))}
            </ul>}
        </Panel>
        <Panel title="Próximas despesas">
          {proxDespesas.length === 0 ? <Empty text="Nenhuma despesa prevista." /> :
            <ul className="text-sm divide-y">
              {proxDespesas.map((p: any) => (
                <li key={p.id} className="py-2 flex justify-between"><span>{p.description}<div className="text-xs text-muted-foreground">{p.category || "—"} · {formatDate(p.due_date)}</div></span><span className="font-semibold text-rose-600">{formatMoney(p.amount)}</span></li>
              ))}
            </ul>}
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "text-emerald-600" : tone === "danger" ? "text-rose-600" : "text-foreground";
  return (
    <div className="bg-card border rounded-2xl p-4 shadow-card">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4" /> {label}</div>
      <div className={`mt-2 font-display font-bold text-xl ${color}`}>{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="bg-card border rounded-2xl p-5 shadow-card"><h3 className="font-display font-semibold mb-3">{title}</h3>{children}</div>;
}
function Empty({ text }: { text: string }) { return <div className="text-sm text-muted-foreground py-6 text-center">{text}</div>; }

/* ====================== RECEITAS ====================== */
function ReceitasTab({ consultantId }: { consultantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["c-receitas", consultantId],
    queryFn: async () => (await supabase.from("consultancy_receivables").select("*").eq("consultant_id", consultantId).order("due_date", { ascending: false })).data ?? [],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("consultancy_receivables").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Receita excluída"); qc.invalidateQueries({ queryKey: ["c-receitas"] }); qc.invalidateQueries({ queryKey: ["c-recv"] }); },
  });
  const revertRecv = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("consultancy_receivables").update({ status: "em_aberto", received_date: null }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Receita estornada"); qc.invalidateQueries({ queryKey: ["c-receitas"] }); qc.invalidateQueries({ queryKey: ["c-recv"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{items.length} receita(s)</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV("receitas-consultoria.csv", items)}><Download className="size-4" /> Exportar</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Nova receita</Button>
        </div>
      </div>
      <div className="bg-card border rounded-2xl shadow-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Cliente</TableHead>
            <TableHead>Tipo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma receita registrada.</TableCell></TableRow> :
              items.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{formatDate(r.due_date)}</TableCell>
                  <TableCell className="font-medium">{r.description}</TableCell>
                  <TableCell className="text-sm">{r.client_name || "—"}</TableCell>
                  <TableCell className="text-sm">{r.revenue_type || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">{formatMoney(r.amount)}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    {r.status === "recebido" && <Button size="icon" variant="ghost" title="Estornar" onClick={() => confirm("Estornar esta receita?") && revertRecv.mutate(r.id)}><Undo2 className="size-4" /></Button>}
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => confirm("Excluir esta receita?") && remove.mutate(r.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {open && <ReceitaForm consultantId={consultantId} record={editing} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ReceitaForm({ consultantId, record, onClose }: { consultantId: string; record: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>(record ?? { description: "", revenue_type: REVENUE_TYPES[0], amount: 0, due_date: new Date().toISOString().slice(0, 10), status: "em_aberto", payment_method: "Pix", client_name: "", received_date: null, notes: "" });

  const { data: contracts = [] } = useQuery({
    queryKey: ["c-contracts", consultantId],
    queryFn: async () => (await supabase.from("consultancy_contracts").select("id, client_name, company_id, plan_name").eq("consultant_id", consultantId)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...f, consultant_id: consultantId, amount: Number(f.amount) || 0 };
      if (record) {
        const { error } = await supabase.from("consultancy_receivables").update(payload).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultancy_receivables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Receita salva"); qc.invalidateQueries({ queryKey: ["c-receitas"] }); qc.invalidateQueries({ queryKey: ["c-recv"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{record ? "Editar receita" : "Nova receita"}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Descrição" required><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Tipo">
            <Select value={f.revenue_type} onValueChange={(v) => setF({ ...f, revenue_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REVENUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Cliente"><Input value={f.client_name ?? ""} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></Field>
          <Field label="Contrato vinculado (opcional)">
            <Select value={f.contract_id ?? "none"} onValueChange={(v) => {
              if (v === "none") setF({ ...f, contract_id: null });
              else { const c = contracts.find((x: any) => x.id === v); setF({ ...f, contract_id: v, company_id: c?.company_id ?? null, client_name: c?.client_name ?? f.client_name }); }
            }}>
              <SelectTrigger><SelectValue placeholder="Sem contrato" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Sem contrato</SelectItem>{contracts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.client_name || c.plan_name || c.id.slice(0,8)}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Valor" required><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Forma de recebimento">
            <Select value={f.payment_method ?? "Pix"} onValueChange={(v) => setF({ ...f, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vencimento" required><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v, received_date: v === "recebido" && !f.received_date ? new Date().toISOString().slice(0,10) : f.received_date })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="em_aberto">Em aberto</SelectItem><SelectItem value="recebido">Recebido</SelectItem><SelectItem value="vencido">Vencido</SelectItem></SelectContent>
            </Select>
          </Field>
          {f.status === "recebido" && <Field label="Data de recebimento"><Input type="date" value={f.received_date ?? ""} onChange={(e) => setF({ ...f, received_date: e.target.value })} /></Field>}
          <Field label="Observações" full><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !f.description || !f.due_date}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ====================== DESPESAS ====================== */
function DespesasTab({ consultantId }: { consultantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["c-despesas", consultantId],
    queryFn: async () => (await supabase.from("consultancy_payables").select("*").eq("consultant_id", consultantId).order("due_date", { ascending: false })).data ?? [],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("consultancy_payables").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Despesa excluída"); qc.invalidateQueries({ queryKey: ["c-despesas"] }); qc.invalidateQueries({ queryKey: ["c-pay"] }); },
  });
  const revertPay = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("consultancy_payables").update({ status: "em_aberto", payment_date: null }).eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Despesa estornada"); qc.invalidateQueries({ queryKey: ["c-despesas"] }); qc.invalidateQueries({ queryKey: ["c-pay"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{items.length} despesa(s)</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV("despesas-consultoria.csv", items)}><Download className="size-4" /> Exportar</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Nova despesa</Button>
        </div>
      </div>
      <div className="bg-card border rounded-2xl shadow-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Vencimento</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead>
            <TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma despesa registrada.</TableCell></TableRow> :
              items.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{formatDate(p.due_date)}</TableCell>
                  <TableCell className="font-medium">{p.description}</TableCell>
                  <TableCell className="text-sm">{p.category || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-rose-600">{formatMoney(p.amount)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => confirm("Excluir esta despesa?") && remove.mutate(p.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {open && <DespesaForm consultantId={consultantId} record={editing} onClose={() => setOpen(false)} />}
    </div>
  );
}

function DespesaForm({ consultantId, record, onClose }: { consultantId: string; record: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>(record ?? { description: "", category: EXPENSE_CATEGORIES[0], amount: 0, due_date: new Date().toISOString().slice(0, 10), status: "em_aberto", payment_method: "Pix", payment_date: null, notes: "" });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...f, consultant_id: consultantId, amount: Number(f.amount) || 0 };
      if (record) {
        const { error } = await supabase.from("consultancy_payables").update(payload).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultancy_payables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Despesa salva"); qc.invalidateQueries({ queryKey: ["c-despesas"] }); qc.invalidateQueries({ queryKey: ["c-pay"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{record ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Descrição" required><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Field label="Categoria">
            <Select value={f.category ?? EXPENSE_CATEGORIES[0]} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Valor" required><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={f.payment_method ?? "Pix"} onValueChange={(v) => setF({ ...f, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Vencimento" required><Input type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v, payment_date: v === "pago" && !f.payment_date ? new Date().toISOString().slice(0,10) : f.payment_date })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="em_aberto">Em aberto</SelectItem><SelectItem value="pago">Pago</SelectItem><SelectItem value="vencido">Vencido</SelectItem></SelectContent>
            </Select>
          </Field>
          {f.status === "pago" && <Field label="Data de pagamento"><Input type="date" value={f.payment_date ?? ""} onChange={(e) => setF({ ...f, payment_date: e.target.value })} /></Field>}
          <Field label="Observações" full><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !f.description || !f.due_date}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ====================== CONTRATOS ====================== */
function ContratosTab({ consultantId }: { consultantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: items = [] } = useQuery({
    queryKey: ["c-contratos", consultantId],
    queryFn: async () => (await supabase.from("consultancy_contracts").select("*").eq("consultant_id", consultantId).order("start_date", { ascending: false })).data ?? [],
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("consultancy_contracts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Contrato removido"); qc.invalidateQueries({ queryKey: ["c-contratos"] }); qc.invalidateQueries({ queryKey: ["c-contracts"] }); },
  });

  const gerarMensalidade = useMutation({
    mutationFn: async (c: any) => {
      const today = new Date();
      const due = new Date(today.getFullYear(), today.getMonth(), c.due_day);
      const { error } = await supabase.from("consultancy_receivables").insert({
        consultant_id: consultantId, contract_id: c.id, company_id: c.company_id, client_name: c.client_name,
        description: `Mensalidade ${c.plan_name || c.service_type || ""} - ${due.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
        revenue_type: "Consultoria mensal", amount: c.monthly_amount, due_date: due.toISOString().slice(0, 10), status: "em_aberto", payment_method: c.payment_method,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Mensalidade gerada"); qc.invalidateQueries({ queryKey: ["c-receitas"] }); qc.invalidateQueries({ queryKey: ["c-recv"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">{items.length} contrato(s)</div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Novo contrato</Button>
      </div>
      <div className="bg-card border rounded-2xl shadow-card overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cliente</TableHead><TableHead>Plano</TableHead><TableHead className="text-right">Valor mensal</TableHead>
            <TableHead>Vigência</TableHead><TableHead>Venc.</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum contrato registrado.</TableCell></TableRow> :
              items.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.client_name || "—"}</TableCell>
                  <TableCell className="text-sm">{c.plan_name || c.service_type || "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(c.monthly_amount)}</TableCell>
                  <TableCell className="text-xs">{formatDate(c.start_date)}{c.end_date ? ` → ${formatDate(c.end_date)}` : ""}</TableCell>
                  <TableCell className="text-xs">Dia {c.due_day}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-right space-x-1">
                    {c.status === "ativo" && <Button size="sm" variant="outline" onClick={() => gerarMensalidade.mutate(c)}>Gerar mensalidade</Button>}
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => confirm("Excluir contrato?") && remove.mutate(c.id)}><Trash2 className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {open && <ContratoForm consultantId={consultantId} record={editing} onClose={() => setOpen(false)} />}
    </div>
  );
}

function ContratoForm({ consultantId, record, onClose }: { consultantId: string; record: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<any>(record ?? { client_name: "", service_type: "Consultoria mensal", plan_name: "", monthly_amount: 0, start_date: new Date().toISOString().slice(0, 10), end_date: null, due_day: 5, payment_method: "Pix", status: "ativo", notes: "" });

  const { data: linkedCompanies = [] } = useQuery({
    queryKey: ["consultant-linked-companies", consultantId],
    queryFn: async () => (await supabase.from("consultant_company_links").select("companies(id, nome, nome_fantasia)").eq("status", "approved")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...f, consultant_id: consultantId, monthly_amount: Number(f.monthly_amount) || 0, due_day: Number(f.due_day) || 5 };
      if (record) {
        const { error } = await supabase.from("consultancy_contracts").update(payload).eq("id", record.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("consultancy_contracts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Contrato salvo"); qc.invalidateQueries({ queryKey: ["c-contratos"] }); qc.invalidateQueries({ queryKey: ["c-contracts"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{record ? "Editar contrato" : "Novo contrato"}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Empresa cliente (vinculada)">
            <Select value={f.company_id ?? "none"} onValueChange={(v) => {
              if (v === "none") setF({ ...f, company_id: null });
              else { const c: any = linkedCompanies.find((x: any) => x.companies?.id === v); setF({ ...f, company_id: v, client_name: c?.companies?.nome_fantasia || c?.companies?.nome || f.client_name }); }
            }}>
              <SelectTrigger><SelectValue placeholder="Cliente externo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cliente externo (não vinculada)</SelectItem>
                {linkedCompanies.map((l: any) => l.companies && <SelectItem key={l.companies.id} value={l.companies.id}>{l.companies.nome_fantasia || l.companies.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome do cliente" required><Input value={f.client_name ?? ""} onChange={(e) => setF({ ...f, client_name: e.target.value })} /></Field>
          <Field label="Tipo de serviço"><Input value={f.service_type ?? ""} onChange={(e) => setF({ ...f, service_type: e.target.value })} /></Field>
          <Field label="Plano contratado"><Input value={f.plan_name ?? ""} onChange={(e) => setF({ ...f, plan_name: e.target.value })} /></Field>
          <Field label="Valor mensal" required><Input type="number" step="0.01" value={f.monthly_amount} onChange={(e) => setF({ ...f, monthly_amount: e.target.value })} /></Field>
          <Field label="Dia de vencimento (1-28)"><Input type="number" min={1} max={28} value={f.due_day} onChange={(e) => setF({ ...f, due_day: e.target.value })} /></Field>
          <Field label="Início" required><Input type="date" value={f.start_date} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></Field>
          <Field label="Encerramento"><Input type="date" value={f.end_date ?? ""} onChange={(e) => setF({ ...f, end_date: e.target.value || null })} /></Field>
          <Field label="Forma de pagamento">
            <Select value={f.payment_method ?? "Pix"} onValueChange={(v) => setF({ ...f, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="pausado">Pausado</SelectItem><SelectItem value="encerrado">Encerrado</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Observações" full><Textarea value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !f.client_name}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ====================== CLIENTES CONTRATANTES ====================== */
function ClientesContratantesTab({ consultantId }: { consultantId: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: contracts = [] } = useQuery({
    queryKey: ["c-contratos", consultantId],
    queryFn: async () => (await supabase.from("consultancy_contracts").select("*, companies(id, nome, nome_fantasia, cnpj, responsavel)").eq("consultant_id", consultantId)).data ?? [],
  });
  const { data: recv = [] } = useQuery({
    queryKey: ["c-recv", consultantId],
    queryFn: async () => (await supabase.from("consultancy_receivables").select("*").eq("consultant_id", consultantId)).data ?? [],
  });

  const situacao = (clientKey: string) => {
    const rs = recv.filter((r: any) => (r.company_id || r.client_name) === clientKey && r.status !== "recebido");
    if (rs.some((r: any) => r.due_date < today)) return { txt: "Inadimplente", tone: "bg-rose-500/15 text-rose-600" };
    if (rs.length) return { txt: "Pendente", tone: "bg-amber-500/15 text-amber-600" };
    return { txt: "Em dia", tone: "bg-emerald-500/15 text-emerald-600" };
  };

  return (
    <div className="bg-card border rounded-2xl shadow-card overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Cliente</TableHead><TableHead>CNPJ</TableHead><TableHead>Responsável</TableHead>
          <TableHead>Plano</TableHead><TableHead className="text-right">Mensalidade</TableHead>
          <TableHead>Início</TableHead><TableHead>Status</TableHead><TableHead>Situação</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {contracts.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum contrato cadastrado.</TableCell></TableRow> :
            contracts.map((c: any) => {
              const sit = situacao(c.company_id || c.client_name);
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.companies?.nome_fantasia || c.companies?.nome || c.client_name || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{c.companies?.cnpj ? maskCNPJ(c.companies.cnpj) : "—"}</TableCell>
                  <TableCell className="text-sm">{c.companies?.responsavel || "—"}</TableCell>
                  <TableCell className="text-sm">{c.plan_name || c.service_type || "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(c.monthly_amount)}</TableCell>
                  <TableCell className="text-xs">{formatDate(c.start_date)}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sit.tone}`}>{sit.txt}</span></TableCell>
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ====================== CONTAS A RECEBER ====================== */
function ReceberTab({ consultantId }: { consultantId: string }) {
  const { start, end } = monthRange();
  const today = new Date().toISOString().slice(0, 10);
  const { data: recv = [] } = useQuery({
    queryKey: ["c-recv", consultantId],
    queryFn: async () => (await supabase.from("consultancy_receivables").select("*").eq("consultant_id", consultantId)).data ?? [],
  });

  const total = recv.filter((r: any) => r.status !== "recebido").reduce((s: number, r: any) => s + Number(r.amount), 0);
  const vencido = recv.filter((r: any) => r.status !== "recebido" && r.due_date < today).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const recebidoMes = recv.filter((r: any) => r.status === "recebido" && r.received_date && r.received_date >= start && r.received_date <= end).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const proximos = recv.filter((r: any) => r.status !== "recebido" && r.due_date >= today).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
  const inad = Object.entries(recv.filter((r: any) => r.status !== "recebido" && r.due_date < today).reduce((acc: any, r: any) => { const k = r.client_name || "—"; acc[k] = (acc[k] || 0) + Number(r.amount); return acc; }, {})).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard icon={Wallet} label="Total a receber" value={formatMoney(total)} />
        <KpiCard icon={TrendingDown} label="Total vencido" value={formatMoney(vencido)} tone="danger" />
        <KpiCard icon={TrendingUp} label="Recebido no mês" value={formatMoney(recebidoMes)} tone="success" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Próximos recebimentos">
          {proximos.length === 0 ? <Empty text="Sem previsões." /> :
            <ul className="text-sm divide-y">{proximos.slice(0, 10).map((r: any) => (
              <li key={r.id} className="py-2 flex justify-between"><span>{r.description}<div className="text-xs text-muted-foreground">{r.client_name || "—"} · {formatDate(r.due_date)}</div></span><span className="font-semibold">{formatMoney(r.amount)}</span></li>
            ))}</ul>}
        </Panel>
        <Panel title="Clientes inadimplentes">
          {inad.length === 0 ? <Empty text="Nenhum inadimplente." /> :
            <ul className="text-sm divide-y">{inad.map(([k, v]: any) => (
              <li key={k} className="py-2 flex justify-between"><span>{k}</span><span className="font-semibold text-rose-600">{formatMoney(v)}</span></li>
            ))}</ul>}
        </Panel>
      </div>
    </div>
  );
}

/* ====================== CONTAS A PAGAR ====================== */
function PagarTab({ consultantId }: { consultantId: string }) {
  const { start, end } = monthRange();
  const today = new Date().toISOString().slice(0, 10);
  const { data: pay = [] } = useQuery({
    queryKey: ["c-pay", consultantId],
    queryFn: async () => (await supabase.from("consultancy_payables").select("*").eq("consultant_id", consultantId)).data ?? [],
  });

  const total = pay.filter((p: any) => p.status !== "pago").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const vencido = pay.filter((p: any) => p.status !== "pago" && p.due_date < today).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const pagoMes = pay.filter((p: any) => p.status === "pago" && p.payment_date && p.payment_date >= start && p.payment_date <= end).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const proximos = pay.filter((p: any) => p.status !== "pago" && p.due_date >= today).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
  const porCategoria = Object.entries(pay.reduce((acc: any, p: any) => { const k = p.category || "—"; acc[k] = (acc[k] || 0) + Number(p.amount); return acc; }, {})).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        <KpiCard icon={Wallet} label="Total a pagar" value={formatMoney(total)} />
        <KpiCard icon={TrendingDown} label="Total vencido" value={formatMoney(vencido)} tone="danger" />
        <KpiCard icon={TrendingUp} label="Pago no mês" value={formatMoney(pagoMes)} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Próximas despesas">
          {proximos.length === 0 ? <Empty text="Sem despesas previstas." /> :
            <ul className="text-sm divide-y">{proximos.slice(0, 10).map((p: any) => (
              <li key={p.id} className="py-2 flex justify-between"><span>{p.description}<div className="text-xs text-muted-foreground">{p.category || "—"} · {formatDate(p.due_date)}</div></span><span className="font-semibold">{formatMoney(p.amount)}</span></li>
            ))}</ul>}
        </Panel>
        <Panel title="Despesas por categoria">
          {porCategoria.length === 0 ? <Empty text="Sem despesas." /> :
            <ul className="text-sm divide-y">{porCategoria.map(([k, v]: any) => (
              <li key={k} className="py-2 flex justify-between"><span>{k}</span><span className="font-semibold">{formatMoney(v)}</span></li>
            ))}</ul>}
        </Panel>
      </div>
    </div>
  );
}

/* ====================== RELATÓRIOS ====================== */
function RelatoriosTab({ consultantId }: { consultantId: string }) {
  const { start, end } = monthRange();
  const { data: recv = [] } = useQuery({ queryKey: ["c-recv", consultantId], queryFn: async () => (await supabase.from("consultancy_receivables").select("*").eq("consultant_id", consultantId)).data ?? [] });
  const { data: pay = [] } = useQuery({ queryKey: ["c-pay", consultantId], queryFn: async () => (await supabase.from("consultancy_payables").select("*").eq("consultant_id", consultantId)).data ?? [] });
  const { data: contracts = [] } = useQuery({ queryKey: ["c-contracts", consultantId], queryFn: async () => (await supabase.from("consultancy_contracts").select("*").eq("consultant_id", consultantId)).data ?? [] });

  const receitaMes = recv.filter((r: any) => r.status === "recebido" && r.received_date && r.received_date >= start && r.received_date <= end).reduce((s: number, r: any) => s + Number(r.amount), 0);
  const despesaMes = pay.filter((p: any) => p.status === "pago" && p.payment_date && p.payment_date >= start && p.payment_date <= end).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const lucro = receitaMes - despesaMes;
  const margem = receitaMes > 0 ? (lucro / receitaMes) * 100 : 0;
  const ativos = contracts.filter((c: any) => c.status === "ativo");
  const mrr = ativos.reduce((s: number, c: any) => s + Number(c.monthly_amount), 0);

  const receitaPorCliente = Object.entries(recv.filter((r: any) => r.status === "recebido").reduce((a: any, r: any) => { const k = r.client_name || "—"; a[k] = (a[k] || 0) + Number(r.amount); return a; }, {})).sort((a: any, b: any) => b[1] - a[1]);
  const despesaPorCat = Object.entries(pay.reduce((a: any, p: any) => { const k = p.category || "—"; a[k] = (a[k] || 0) + Number(p.amount); return a; }, {})).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={TrendingUp} label="Receita no mês" value={formatMoney(receitaMes)} tone="success" />
        <KpiCard icon={TrendingDown} label="Despesas no mês" value={formatMoney(despesaMes)} tone="danger" />
        <KpiCard icon={Wallet} label="Lucro líquido" value={formatMoney(lucro)} tone={lucro >= 0 ? "success" : "danger"} />
        <KpiCard icon={TrendingUp} label="Margem líquida" value={`${margem.toFixed(1)}%`} />
        <KpiCard icon={Wallet} label="MRR" value={formatMoney(mrr)} />
        <KpiCard icon={FileText} label="Contratos ativos" value={String(ativos.length)} />
        <KpiCard icon={Users} label="Ticket médio" value={formatMoney(ativos.length ? mrr / ativos.length : 0)} />
        <KpiCard icon={Calendar} label="Período" value={`${formatDate(start)} - ${formatDate(end)}`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Panel title="Receita por cliente">
          <Button size="sm" variant="outline" className="mb-3" onClick={() => downloadCSV("receita-por-cliente.csv", receitaPorCliente.map(([k, v]: any) => ({ cliente: k, valor: v })))}><Download className="size-4" /> Exportar</Button>
          {receitaPorCliente.length === 0 ? <Empty text="Sem dados." /> :
            <ul className="text-sm divide-y">{receitaPorCliente.map(([k, v]: any) => (
              <li key={k} className="py-2 flex justify-between"><span>{k}</span><span className="font-semibold text-emerald-600">{formatMoney(v)}</span></li>
            ))}</ul>}
        </Panel>
        <Panel title="Despesas por categoria">
          <Button size="sm" variant="outline" className="mb-3" onClick={() => downloadCSV("despesas-categoria.csv", despesaPorCat.map(([k, v]: any) => ({ categoria: k, valor: v })))}><Download className="size-4" /> Exportar</Button>
          {despesaPorCat.length === 0 ? <Empty text="Sem dados." /> :
            <ul className="text-sm divide-y">{despesaPorCat.map(([k, v]: any) => (
              <li key={k} className="py-2 flex justify-between"><span>{k}</span><span className="font-semibold text-rose-600">{formatMoney(v)}</span></li>
            ))}</ul>}
        </Panel>
      </div>
    </div>
  );
}

/* ====================== SOLICITAÇÕES (vínculo) ====================== */
function SolicitacoesTab() {
  const qc = useQueryClient();
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["link-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_company_links")
        .select("id, status, created_at, companies(id, nome, nome_fantasia, cnpj, responsavel, cidade, estado, segmento)")
        .eq("status", "pending").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const patch: any = { status, responded_at: new Date().toISOString() };
      if (status === "approved") patch.linked_at = new Date().toISOString();
      const { error } = await supabase.from("consultant_company_links").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => { toast.success(vars.status === "approved" ? "Vínculo aprovado!" : "Solicitação recusada."); qc.invalidateQueries({ queryKey: ["link-requests"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground text-sm">Carregando...</div>;
  if (pending.length === 0) return <div className="bg-card border rounded-2xl p-10 text-center"><BadgeCheck className="size-10 mx-auto text-muted-foreground/40" /><p className="mt-3 text-muted-foreground text-sm">Nenhuma solicitação pendente.</p></div>;

  return (
    <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
      <Table>
        <TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>CNPJ</TableHead><TableHead>Responsável</TableHead><TableHead>Solicitada em</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
        <TableBody>
          {pending.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.companies?.nome_fantasia || r.companies?.nome}</TableCell>
              <TableCell className="font-mono text-xs">{r.companies?.cnpj ? maskCNPJ(r.companies.cnpj) : "—"}</TableCell>
              <TableCell className="text-sm">{r.companies?.responsavel || "—"}</TableCell>
              <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell className="text-right space-x-1">
                <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: r.id, status: "rejected" })}><X className="size-4" /> Recusar</Button>
                <Button size="sm" onClick={() => respond.mutate({ id: r.id, status: "approved" })}><Check className="size-4" /> Aprovar</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ====================== CONFIGURAÇÕES (perfil) ====================== */
function PerfilTab() {
  const qc = useQueryClient();
  const { data } = useConsultancy();
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data && !form) setForm({ ...data, consultancy_cnpj: data.consultancy_cnpj ? maskCNPJ(data.consultancy_cnpj) : "", phone: data.phone ? maskPhone(data.phone) : "" }); }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultants").update({
        consultancy_name: form.consultancy_name,
        consultancy_cnpj: form.consultancy_cnpj ? form.consultancy_cnpj.replace(/\D/g, "") : null,
        responsible_name: form.responsible_name, email: form.email, phone: form.phone, city: form.city, state: form.state,
      }).eq("id", data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados atualizados"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!form) return <div className="text-muted-foreground text-sm">Carregando...</div>;
  const inviteUrl = `${window.location.origin}/signup?invite=${data!.invite_code}`;
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copiado!`); };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-2xl p-6 shadow-card">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> Código de convite</h3>
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label className="text-xs">Código</Label><div className="flex gap-2 mt-1"><Input readOnly value={data!.invite_code} className="font-mono font-semibold" /><Button variant="outline" onClick={() => copy(data!.invite_code, "Código")}><Copy className="size-4" /></Button></div></div>
          <div><Label className="text-xs">Link</Label><div className="flex gap-2 mt-1"><Input readOnly value={inviteUrl} className="text-xs" /><Button variant="outline" onClick={() => copy(inviteUrl, "Link")}><Link2 className="size-4" /></Button></div></div>
        </div>
      </div>
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <h3 className="font-display font-semibold">Dados da consultoria</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Nome da consultoria" required><Input value={form.consultancy_name ?? ""} onChange={(e) => setForm({ ...form, consultancy_name: e.target.value })} /></Field>
          <Field label="CNPJ"><Input value={form.consultancy_cnpj ?? ""} onChange={(e) => setForm({ ...form, consultancy_cnpj: maskCNPJ(e.target.value) })} /></Field>
          <Field label="Responsável"><Input value={form.responsible_name ?? ""} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} /></Field>
          <Field label="E-mail"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Telefone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} /></Field>
          <Field label="Cidade"><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="UF">
            <Select value={form.state ?? ""} onValueChange={(v) => setForm({ ...form, state: v })}>
              <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar alterações</Button></div>
      </div>
    </div>
  );
}

/* ====================== HELPERS ====================== */
function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}><Label className="text-sm">{label}{required && <span className="text-destructive ml-1">*</span>}</Label>{children}</div>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { txt: string; cls: string }> = {
    em_aberto: { txt: "Em aberto", cls: "bg-amber-500/15 text-amber-600" },
    recebido: { txt: "Recebido", cls: "bg-emerald-500/15 text-emerald-600" },
    pago: { txt: "Pago", cls: "bg-emerald-500/15 text-emerald-600" },
    vencido: { txt: "Vencido", cls: "bg-rose-500/15 text-rose-600" },
    ativo: { txt: "Ativo", cls: "bg-emerald-500/15 text-emerald-600" },
    pausado: { txt: "Pausado", cls: "bg-amber-500/15 text-amber-600" },
    encerrado: { txt: "Encerrado", cls: "bg-muted text-muted-foreground" },
    cancelado: { txt: "Cancelado", cls: "bg-rose-500/15 text-rose-600" },
  };
  const m = map[status] ?? { txt: status, cls: "bg-muted text-muted-foreground" };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.cls}`}>{m.txt}</span>;
}
