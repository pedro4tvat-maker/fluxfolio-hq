import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Filter, Trash2, CheckCircle2, MessageSquare,
  LayoutList, Columns, Wand2, AlertTriangle, Clock, CalendarPlus,
} from "lucide-react";
import { maybeAdvanceStage } from "@/lib/journey-stages";

export const Route = createFileRoute("/app/plano-acao")({ component: PlanoAcaoPage });

const sb = supabase as any;

const RELATED_AREAS = [
  "Fluxo de Caixa", "Contas a Pagar", "Contas a Receber", "Precificação", "Estoque",
  "Orçamento", "DRE", "KPIs", "Endividamento", "Capital de Giro", "Vendas",
  "Documentos", "Gestão", "Outro",
] as const;

const ORIGINS = [
  { v: "diagnostico", l: "Diagnóstico Inicial" },
  { v: "relatorio", l: "Relatório Financeiro" },
  { v: "kpi", l: "KPI" },
  { v: "reuniao", l: "Reunião" },
  { v: "cliente", l: "Solicitação do cliente" },
  { v: "analise_consultor", l: "Análise do consultor" },
  { v: "pendencia", l: "Pendência operacional" },
  { v: "outro", l: "Outro" },
] as const;

const RESPONSIBLE_TYPES = [
  { v: "consultor", l: "Consultor" },
  { v: "cliente", l: "Cliente" },
  { v: "equipe", l: "Equipe interna" },
  { v: "terceiro", l: "Terceiro" },
] as const;

const PRIORITIES = [
  { v: "baixa", l: "Baixa", color: "bg-muted text-muted-foreground" },
  { v: "media", l: "Média", color: "bg-blue-500 text-white" },
  { v: "alta", l: "Alta", color: "bg-orange-500 text-white" },
  { v: "urgente", l: "Urgente", color: "bg-destructive text-destructive-foreground" },
] as const;

const STATUSES = [
  { v: "pendente", l: "Pendente", color: "bg-muted text-foreground" },
  { v: "em_andamento", l: "Em andamento", color: "bg-blue-500 text-white" },
  { v: "aguardando_cliente", l: "Aguardando cliente", color: "bg-yellow-500 text-black" },
  { v: "aguardando_consultor", l: "Aguardando consultor", color: "bg-purple-500 text-white" },
  { v: "concluida", l: "Concluída", color: "bg-emerald-600 text-white" },
  { v: "atrasada", l: "Atrasada", color: "bg-destructive text-destructive-foreground" },
  { v: "cancelada", l: "Cancelada", color: "bg-muted text-muted-foreground" },
] as const;

const KANBAN_COLS = ["pendente", "em_andamento", "aguardando_cliente", "aguardando_consultor", "concluida"] as const;

type Action = {
  id: string;
  consultant_id: string;
  company_id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  related_area: string;
  origin: string;
  responsible_type: string;
  responsible_user_id: string | null;
  responsible_name: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  completion_notes: string | null;
  notes: string | null;
  related_module: string | null;
  related_record_id: string | null;
  diagnostic_id: string | null;
  activity_id: string | null;
  allow_client_view: boolean;
  allow_client_complete: boolean;
  created_at: string;
  updated_at: string;
};

const DIAGNOSTIC_SUGGESTIONS: Record<string, { title: string; area: string; priority: string }[]> = {
  organizacao: [
    { title: "Implantar rotina de fluxo de caixa diário", area: "Fluxo de Caixa", priority: "alta" },
    { title: "Separar contas PJ da pessoa física", area: "Gestão", priority: "alta" },
  ],
  contas: [
    { title: "Cadastrar contas a pagar dos próximos 30 dias", area: "Contas a Pagar", priority: "alta" },
    { title: "Cobrar clientes inadimplentes", area: "Contas a Receber", priority: "urgente" },
  ],
  lucratividade: [
    { title: "Montar DRE gerencial do mês", area: "DRE", priority: "alta" },
    { title: "Calcular margem de contribuição e ponto de equilíbrio", area: "KPIs", priority: "media" },
  ],
  precificacao: [
    { title: "Realizar análise de precificação dos principais produtos/serviços", area: "Precificação", priority: "alta" },
    { title: "Revisar preços com margem abaixo do mínimo", area: "Precificação", priority: "urgente" },
  ],
  estoque: [
    { title: "Cadastrar produtos e levantar valor total em estoque", area: "Estoque", priority: "media" },
  ],
  orcamento: [
    { title: "Montar orçamento mensal por categoria", area: "Orçamento", priority: "media" },
    { title: "Definir metas de faturamento e lucro", area: "Orçamento", priority: "media" },
  ],
  endividamento: [
    { title: "Levantar dívidas ativas e custo financeiro", area: "Endividamento", priority: "alta" },
    { title: "Projetar capital de giro necessário", area: "Capital de Giro", priority: "alta" },
  ],
  gestao: [
    { title: "Definir responsável financeiro e rotina semanal", area: "Gestão", priority: "media" },
  ],
};

function statusBadge(v: string) {
  const s = STATUSES.find((x) => x.v === v);
  return <Badge className={s?.color}>{s?.l ?? v}</Badge>;
}
function priorityBadge(v: string) {
  const p = PRIORITIES.find((x) => x.v === v);
  return <Badge className={p?.color}>{p?.l ?? v}</Badge>;
}

function isOverdue(a: Action) {
  if (!a.due_date) return false;
  if (a.status === "concluida" || a.status === "cancelada") return false;
  return a.due_date < new Date().toISOString().slice(0, 10);
}

function PlanoAcaoPage() {
  const qc = useQueryClient();
  const { user, isConsultant } = useAuth();
  const { selected: companyId, companies } = useSelectedCompany();
  const [view, setView] = useState<"lista" | "kanban">("lista");
  const [filters, setFilters] = useState({ status: "all", priority: "all", area: "all", origin: "all", overdue: false });
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Action | null>(null);
  const [commentsOf, setCommentsOf] = useState<Action | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);

  const { data: consultant } = useQuery({
    queryKey: ["consultant-self", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id").eq("user_id", user!.id).maybeSingle();
      return data as { id: string } | null;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["company-light", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await sb.from("companies").select("id, nome").eq("id", companyId!).maybeSingle();
      return data as { id: string; nome: string } | null;
    },
  });

  const { data: actions = [], isLoading } = useQuery({
    queryKey: ["action-plans", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<Action[]> => {
      const { data, error } = await sb
        .from("action_plans")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Action[];
    },
  });

  const { data: lastDiagnostic } = useQuery({
    queryKey: ["last-diagnostic", companyId],
    enabled: !!companyId && isConsultant,
    queryFn: async () => {
      const { data } = await sb
        .from("financial_diagnostics")
        .select("id, status, diagnostic_date")
        .eq("company_id", companyId!)
        .in("status", ["finalizado", "revisado"])
        .order("diagnostic_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as { id: string; status: string; diagnostic_date: string } | null;
    },
  });

  const filtered = useMemo(() => {
    return actions.filter((a) => {
      if (filters.status !== "all" && a.status !== filters.status) return false;
      if (filters.priority !== "all" && a.priority !== filters.priority) return false;
      if (filters.area !== "all" && a.related_area !== filters.area) return false;
      if (filters.origin !== "all" && a.origin !== filters.origin) return false;
      if (filters.overdue && !isOverdue(a)) return false;
      return true;
    });
  }, [actions, filters]);

  const summary = useMemo(() => {
    const open = actions.filter((a) => a.status === "pendente").length;
    const progress = actions.filter((a) => a.status === "em_andamento").length;
    const overdue = actions.filter((a) => isOverdue(a)).length;
    const done = actions.filter((a) => a.status === "concluida").length;
    const urgent = actions.filter((a) => a.priority === "urgente" && a.status !== "concluida").length;
    const pct = actions.length ? Math.round((done / actions.length) * 100) : 0;
    return { open, progress, overdue, done, urgent, pct, total: actions.length };
  }, [actions]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Action> & { addToAgenda?: boolean }) => {
      if (!consultant?.id || !companyId) throw new Error("Consultor/empresa não definidos.");
      const { addToAgenda, ...rest } = payload as any;
      let actionRow: any;
      if (rest.id) {
        const { id, ...upd } = rest;
        const { data, error } = await sb.from("action_plans").update(upd).eq("id", id).select().single();
        if (error) throw error;
        actionRow = data;
      } else {
        const insertPayload = {
          ...rest,
          consultant_id: consultant.id,
          company_id: companyId,
          created_by: user?.id,
        };
        const { data, error } = await sb.from("action_plans").insert(insertPayload).select().single();
        if (error) throw error;
        actionRow = data;
      }
      if (addToAgenda && consultant?.id) {
        await sb.from("consultancy_activities").insert({
          consultant_id: consultant.id,
          company_id: companyId,
          title: actionRow.title,
          description: actionRow.description,
          activity_type: "tarefa_interna",
          activity_date: actionRow.due_date || new Date().toISOString().slice(0, 10),
          due_date: actionRow.due_date,
          priority: actionRow.priority,
          status: "pendente",
          related_module: "plano_acao",
          related_record_id: actionRow.id,
          responsible_name: actionRow.responsible_name,
        });
      }
      return actionRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action-plans", companyId] });
      toast.success("Ação salva");
      setOpenNew(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("action_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["action-plans", companyId] });
      toast.success("Ação removida");
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const upd: any = { status };
      if (status === "concluida") upd.completed_at = new Date().toISOString();
      const { error } = await sb.from("action_plans").update(upd).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["action-plans", companyId] }),
  });

  if (!companyId) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center max-w-xl mx-auto">
        <p className="text-muted-foreground">Selecione uma empresa para acessar o Plano de Ação.</p>
        <Button asChild className="mt-4"><Link to="/app">Voltar</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/app/empresa/$id" params={{ id: companyId }}>
              <ArrowLeft className="size-4 mr-1" /> Voltar à empresa
            </Link>
          </Button>
          <h1 className="text-3xl font-display font-semibold">Plano de Ação</h1>
          <p className="text-sm text-muted-foreground">{company?.nome ?? "Empresa cliente"}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isConsultant && lastDiagnostic && (
            <Button variant="outline" onClick={() => setSuggestOpen(true)}>
              <Wand2 className="size-4 mr-2" /> Gerar a partir do diagnóstico
            </Button>
          )}
          {isConsultant && (
            <Button onClick={() => { setEditing(null); setOpenNew(true); }}>
              <Plus className="size-4 mr-2" /> Nova Ação
            </Button>
          )}
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard label="Abertas" value={summary.open} icon={<Clock className="size-4" />} />
        <SummaryCard label="Em andamento" value={summary.progress} />
        <SummaryCard label="Atrasadas" value={summary.overdue} tone="danger" icon={<AlertTriangle className="size-4" />} />
        <SummaryCard label="Concluídas" value={summary.done} tone="success" icon={<CheckCircle2 className="size-4" />} />
        <SummaryCard label="Urgentes" value={summary.urgent} tone="warning" />
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-xs text-muted-foreground">Progresso geral</div>
            <div className="text-2xl font-display font-semibold">{summary.pct}%</div>
            <Progress value={summary.pct} />
          </CardContent>
        </Card>
      </div>

      {/* Filtros + view toggle */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Filter className="size-4" /> Filtros</div>
          <FilterSelect label="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
            options={[{ v: "all", l: "Todos" }, ...STATUSES.map((s) => ({ v: s.v, l: s.l }))]} />
          <FilterSelect label="Prioridade" value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v })}
            options={[{ v: "all", l: "Todas" }, ...PRIORITIES.map((p) => ({ v: p.v, l: p.l }))]} />
          <FilterSelect label="Área" value={filters.area} onChange={(v) => setFilters({ ...filters, area: v })}
            options={[{ v: "all", l: "Todas" }, ...RELATED_AREAS.map((a) => ({ v: a, l: a }))]} />
          <FilterSelect label="Origem" value={filters.origin} onChange={(v) => setFilters({ ...filters, origin: v })}
            options={[{ v: "all", l: "Todas" }, ...ORIGINS.map((o) => ({ v: o.v, l: o.l }))]} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filters.overdue} onCheckedChange={(v) => setFilters({ ...filters, overdue: !!v })} />
            Atrasadas
          </label>
          <div className="ml-auto flex gap-1 border rounded-md p-1">
            <Button size="sm" variant={view === "lista" ? "default" : "ghost"} onClick={() => setView("lista")}>
              <LayoutList className="size-4 mr-1" /> Lista
            </Button>
            <Button size="sm" variant={view === "kanban" ? "default" : "ghost"} onClick={() => setView("kanban")}>
              <Columns className="size-4 mr-1" /> Kanban
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Nenhuma ação cadastrada.</CardContent></Card>
      ) : view === "lista" ? (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Ação</th>
                  <th className="text-left p-3">Área</th>
                  <th className="text-left p-3">Origem</th>
                  <th className="text-left p-3">Responsável</th>
                  <th className="text-left p-3">Prazo</th>
                  <th className="text-left p-3">Prioridade</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className={`border-t ${isOverdue(a) ? "bg-destructive/5" : ""}`}>
                    <td className="p-3 font-medium">{a.title}</td>
                    <td className="p-3">{a.related_area}</td>
                    <td className="p-3 text-muted-foreground">{ORIGINS.find((o) => o.v === a.origin)?.l ?? a.origin}</td>
                    <td className="p-3">{a.responsible_name ?? "—"}</td>
                    <td className="p-3">{a.due_date ?? "—"}</td>
                    <td className="p-3">{priorityBadge(a.priority)}</td>
                    <td className="p-3">{statusBadge(a.status)}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setCommentsOf(a)}>
                        <MessageSquare className="size-4" />
                      </Button>
                      {isConsultant && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpenNew(true); }}>Editar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => { if (confirm("Remover esta ação?")) deleteMutation.mutate(a.id); }}>
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {KANBAN_COLS.map((col) => {
            const items = filtered.filter((a) => a.status === col);
            const s = STATUSES.find((x) => x.v === col)!;
            return (
              <div key={col} className="bg-muted/30 rounded-xl p-3 space-y-2 min-h-[200px]">
                <div className="flex items-center justify-between">
                  <Badge className={s.color}>{s.l}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                {items.map((a) => (
                  <Card key={a.id} className={isOverdue(a) ? "border-destructive" : ""}>
                    <CardContent className="p-3 space-y-2">
                      <div className="font-medium text-sm">{a.title}</div>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {priorityBadge(a.priority)}
                        <span className="text-muted-foreground">{a.related_area}</span>
                      </div>
                      {a.due_date && <div className="text-xs text-muted-foreground">Prazo: {a.due_date}</div>}
                      {isConsultant && (
                        <Select value={a.status} onValueChange={(v) => statusMutation.mutate({ id: a.id, status: v })}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Nova/Editar */}
      {openNew && (
        <ActionDialog
          open={openNew}
          onClose={() => { setOpenNew(false); setEditing(null); }}
          editing={editing}
          onSave={(payload) => saveMutation.mutate(payload)}
          saving={saveMutation.isPending}
          companies={companies}
        />
      )}

      {commentsOf && (
        <CommentsDialog
          action={commentsOf}
          onClose={() => setCommentsOf(null)}
          user={user}
          canComment={true}
        />
      )}

      {suggestOpen && lastDiagnostic && (
        <SuggestionsDialog
          diagnosticId={lastDiagnostic.id}
          companyId={companyId}
          consultantId={consultant?.id ?? ""}
          createdBy={user?.id ?? ""}
          onClose={() => setSuggestOpen(false)}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["action-plans", companyId] }); setSuggestOpen(false); }}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, tone, icon }: { label: string; value: number; tone?: "danger" | "success" | "warning"; icon?: React.ReactNode }) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-orange-500" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{label}</span>{icon}
        </div>
        <div className={`text-2xl font-display font-semibold ${toneCls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ActionDialog({ open, onClose, editing, onSave, saving }: {
  open: boolean;
  onClose: () => void;
  editing: Action | null;
  onSave: (payload: any) => void;
  saving: boolean;
  companies: { id: string; nome: string }[];
}) {
  const [form, setForm] = useState(() => editing ?? {
    title: "", description: "", related_area: "Gestão", origin: "analise_consultor",
    responsible_type: "consultor", responsible_name: "", priority: "media", status: "pendente",
    due_date: "", notes: "", allow_client_view: false, allow_client_complete: false,
  } as any);
  const [addToAgenda, setAddToAgenda] = useState(false);

  const update = (patch: any) => setForm((f: any) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editar ação" : "Nova ação"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={form.title ?? ""} onChange={(e) => update({ title: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => update({ description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Área relacionada</Label>
              <Select value={form.related_area} onValueChange={(v) => update({ related_area: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RELATED_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={form.origin} onValueChange={(v) => update({ origin: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ORIGINS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de responsável</Label>
              <Select value={form.responsible_type} onValueChange={(v) => update({ responsible_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RESPONSIBLE_TYPES.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do responsável</Label>
              <Input value={form.responsible_name ?? ""} onChange={(e) => update({ responsible_name: e.target.value })} />
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={(v) => update({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.due_date ?? ""} onChange={(e) => update({ due_date: e.target.value })} />
            </div>
            <div>
              <Label>Data de conclusão</Label>
              <Input type="date" value={(form.completed_at ?? "").slice(0, 10)} onChange={(e) => update({ completed_at: e.target.value || null })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} />
          </div>
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!form.allow_client_view} onCheckedChange={(v) => update({ allow_client_view: !!v })} />
              Permitir que o cliente visualize esta ação
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!form.allow_client_complete} onCheckedChange={(v) => update({ allow_client_complete: !!v })} />
              Permitir que o cliente marque como concluída (se atribuída a ele)
            </label>
            {!editing && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={addToAgenda} onCheckedChange={(v) => setAddToAgenda(!!v)} />
                <CalendarPlus className="size-4" /> Adicionar esta ação à Agenda
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={saving || !form.title}
            onClick={() => onSave({
              ...(editing ? { id: editing.id } : {}),
              title: form.title,
              description: form.description || null,
              related_area: form.related_area,
              origin: form.origin,
              responsible_type: form.responsible_type,
              responsible_name: form.responsible_name || null,
              priority: form.priority,
              status: form.status,
              due_date: form.due_date || null,
              completed_at: form.completed_at || null,
              notes: form.notes || null,
              allow_client_view: !!form.allow_client_view,
              allow_client_complete: !!form.allow_client_complete,
              addToAgenda,
            })}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommentsDialog({ action, onClose, user, canComment }: { action: Action; onClose: () => void; user: any; canComment: boolean }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [type, setType] = useState("observacao");

  const { data: comments = [] } = useQuery({
    queryKey: ["action-comments", action.id],
    queryFn: async () => {
      const { data } = await sb.from("action_plan_comments").select("*").eq("action_plan_id", action.id).order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      const { error } = await sb.from("action_plan_comments").insert({
        action_plan_id: action.id,
        author_user_id: user?.id,
        author_name: user?.user_metadata?.full_name ?? user?.email,
        comment_type: type,
        comment: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["action-comments", action.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Comentários — {action.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {canComment && (
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex gap-2">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="observacao">Observação</SelectItem>
                    <SelectItem value="atualizacao_consultor">Atualização do consultor</SelectItem>
                    <SelectItem value="resposta_cliente">Resposta do cliente</SelectItem>
                    <SelectItem value="justificativa">Justificativa de atraso</SelectItem>
                    <SelectItem value="evidencia">Evidência de conclusão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea placeholder="Escreva um comentário..." value={text} onChange={(e) => setText(e.target.value)} />
              <Button onClick={() => addComment.mutate()} disabled={!text.trim() || addComment.isPending}>Adicionar</Button>
            </div>
          )}
          <div className="space-y-2">
            {comments.length === 0 && <p className="text-sm text-muted-foreground">Sem comentários ainda.</p>}
            {comments.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{c.author_name ?? "Usuário"} • {c.comment_type}</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionsDialog({ diagnosticId, companyId, consultantId, createdBy, onClose, onCreated }: {
  diagnosticId: string; companyId: string; consultantId: string; createdBy: string;
  onClose: () => void; onCreated: () => void;
}) {
  const { data: answers = [] } = useQuery({
    queryKey: ["diag-answers-for-suggestions", diagnosticId],
    queryFn: async () => {
      const { data } = await sb.from("financial_diagnostic_answers").select("section, score, answer").eq("diagnostic_id", diagnosticId);
      return (data ?? []) as { section: string; score: number; answer: string | null }[];
    },
  });

  // Identifica blocos fracos (média de score < 1) e gera sugestões
  const suggestions = useMemo(() => {
    const bySection: Record<string, { total: number; count: number }> = {};
    answers.forEach((a) => {
      if (a.answer === "na") return;
      bySection[a.section] = bySection[a.section] ?? { total: 0, count: 0 };
      bySection[a.section].total += Number(a.score) || 0;
      bySection[a.section].count += 1;
    });
    const weak = Object.entries(bySection).filter(([, v]) => v.count > 0 && v.total / v.count < 1).map(([k]) => k);
    const list: { title: string; area: string; priority: string; section: string; selected: boolean }[] = [];
    weak.forEach((sec) => {
      (DIAGNOSTIC_SUGGESTIONS[sec] ?? []).forEach((s) => list.push({ ...s, section: sec, selected: true }));
    });
    return list;
  }, [answers]);

  const [items, setItems] = useState(suggestions);
  // Sync when suggestions arrive
  useMemo(() => setItems(suggestions), [suggestions]);

  const create = useMutation({
    mutationFn: async () => {
      const toInsert = items.filter((i) => i.selected).map((i) => ({
        consultant_id: consultantId,
        company_id: companyId,
        title: i.title,
        related_area: i.area,
        origin: "diagnostico",
        responsible_type: "consultor",
        priority: i.priority,
        status: "pendente",
        diagnostic_id: diagnosticId,
        created_by: createdBy,
      }));
      if (toInsert.length === 0) return;
      const { error } = await sb.from("action_plans").insert(toInsert);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Ações criadas a partir do diagnóstico"); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Sugestões a partir do diagnóstico</DialogTitle></DialogHeader>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bloco fraco identificado. Bom trabalho!</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Revise e desmarque o que não quiser criar:</p>
            {items.map((s, idx) => (
              <label key={idx} className="flex items-start gap-2 border rounded-lg p-3 cursor-pointer">
                <Checkbox checked={s.selected} onCheckedChange={(v) => {
                  const cp = [...items]; cp[idx] = { ...cp[idx], selected: !!v }; setItems(cp);
                }} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{s.title}</div>
                  <div className="text-xs text-muted-foreground">{s.area} • Prioridade {s.priority}</div>
                </div>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={create.isPending || items.every((i) => !i.selected)} onClick={() => create.mutate()}>
            Criar ações selecionadas
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
