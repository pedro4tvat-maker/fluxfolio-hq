import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Plus, Pencil, Trash2, Check, X, Clock, AlertTriangle,
  ListChecks, Package as PackageIcon, Users as UsersIcon, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const AGENDA_SECTIONS = [
  { id: "lista", label: "Lista" },
  { id: "calendario", label: "Calendário" },
  { id: "entregas", label: "Entregas pendentes" },
  { id: "reunioes", label: "Reuniões" },
  { id: "prazos", label: "Prazos importantes" },
  { id: "por-cliente", label: "Por cliente" },
] as const;
type AgendaSection = typeof AGENDA_SECTIONS[number]["id"];
const AGENDA_SECTION_IDS = AGENDA_SECTIONS.map((s) => s.id) as readonly string[];

export const Route = createFileRoute("/app/agenda")({
  validateSearch: (s: Record<string, unknown>): { section: AgendaSection } => {
    const v = String(s.section ?? "");
    return { section: (AGENDA_SECTION_IDS.includes(v) ? v : "lista") as AgendaSection };
  },
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AgendaPage,
});

const ACTIVITY_TYPES: Record<string, string> = {
  reuniao: "Reunião",
  entrega_relatorio: "Entrega de relatório",
  entrega_precificacao: "Entrega de precificação",
  diagnostico: "Diagnóstico financeiro",
  fluxo_caixa: "Análise de fluxo de caixa",
  dre: "Análise de DRE",
  cobranca_docs: "Cobrança de documentos",
  apresentacao: "Apresentação de resultados",
  plano_acao: "Plano de ação",
  tarefa_interna: "Tarefa interna",
  contato_cliente: "Ligação/contato com cliente",
  follow_up: "Follow-up",
  renovacao_contrato: "Renovação de contrato",
  cobranca_mensalidade: "Cobrança de mensalidade",
  outro: "Outro",
};
const ENTREGA_TYPES = ["entrega_relatorio", "entrega_precificacao", "diagnostico", "fluxo_caixa", "dre", "plano_acao", "apresentacao"];

const PRIORITIES = [
  { id: "baixa", label: "Baixa", color: "bg-slate-100 text-slate-700" },
  { id: "media", label: "Média", color: "bg-blue-100 text-blue-700" },
  { id: "alta", label: "Alta", color: "bg-amber-100 text-amber-800" },
  { id: "urgente", label: "Urgente", color: "bg-red-100 text-red-700" },
];
const STATUSES = [
  { id: "pendente", label: "Pendente", color: "bg-slate-100 text-slate-700" },
  { id: "em_andamento", label: "Em andamento", color: "bg-blue-100 text-blue-700" },
  { id: "concluida", label: "Concluída", color: "bg-emerald-100 text-emerald-700" },
  { id: "atrasada", label: "Atrasada", color: "bg-red-100 text-red-700" },
  { id: "cancelada", label: "Cancelada", color: "bg-zinc-100 text-zinc-600" },
];
const REMINDERS = [
  { id: "none", label: "Sem lembrete" },
  { id: "at_time", label: "No horário" },
  { id: "15m", label: "15 minutos antes" },
  { id: "1h", label: "1 hora antes" },
  { id: "1d", label: "1 dia antes" },
  { id: "3d", label: "3 dias antes" },
];
const RECURRENCES = [
  { id: "none", label: "Não repetir" },
  { id: "daily", label: "Diariamente" },
  { id: "weekly", label: "Semanalmente" },
  { id: "monthly", label: "Mensalmente" },
  { id: "yearly", label: "Anualmente" },
];

type Activity = {
  id: string;
  consultant_id: string;
  company_id: string | null;
  branch_id: string | null;
  title: string;
  activity_type: string;
  responsible_name: string | null;
  activity_date: string;
  start_time: string | null;
  end_time: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  description: string | null;
  notes: string | null;
  meeting_link: string | null;
  location: string | null;
  reminder_type: string | null;
  recurrence_type: string;
  recurrence_until: string | null;
  related_module: string | null;
  related_record_id: string | null;
  completed_at: string | null;
  canceled_at: string | null;
};

const sb = supabase as any;
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function priorityBadge(p: string) {
  const x = PRIORITIES.find((i) => i.id === p) ?? PRIORITIES[1];
  return <Badge variant="outline" className={x.color}>{x.label}</Badge>;
}
function statusBadge(s: string) {
  const x = STATUSES.find((i) => i.id === s) ?? STATUSES[0];
  return <Badge variant="outline" className={x.color}>{x.label}</Badge>;
}

function AgendaPage() {
  const { isConsultant, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!isConsultant) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center max-w-xl mx-auto">
        <h2 className="font-display font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">A Agenda é exclusiva para consultores.</p>
      </div>
    );
  }
  return <Inner />;
}

function useConsultant() {
  return useQuery({
    queryKey: ["my-consultancy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("id").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useCompanies() {
  return useQuery({
    queryKey: ["agenda-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, nome").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useActivities(consultantId: string | undefined) {
  return useQuery({
    queryKey: ["agenda-activities", consultantId],
    enabled: !!consultantId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("consultancy_activities")
        .select("*")
        .eq("consultant_id", consultantId)
        .order("activity_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });
}

function Inner() {
  const { section } = Route.useSearch();
  const { data: consultant } = useConsultant();
  const { data: companies = [] } = useCompanies();
  const { data: activities = [] } = useActivities(consultant?.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    companies.forEach((c: any) => m.set(c.id, c.nome));
    return m;
  }, [companies]);

  const todayStr = today();
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const open = activities.filter((a) => a.status !== "concluida" && a.status !== "cancelada");
    return {
      hoje: open.filter((a) => a.activity_date === todayStr).length,
      atrasadas: open.filter((a) => (a.due_date ?? a.activity_date) < todayStr).length,
      reunioes: open.filter((a) => a.activity_type === "reuniao" && a.activity_date >= todayStr && a.activity_date <= weekEndStr).length,
      entregas: open.filter((a) => ENTREGA_TYPES.includes(a.activity_type)).length,
      relatorios: open.filter((a) => a.activity_type === "entrega_relatorio").length,
      precificacoes: open.filter((a) => a.activity_type === "entrega_precificacao").length,
      clientesAtivos: new Set(open.filter((a) => a.company_id).map((a) => a.company_id)).size,
      concluidasMes: activities.filter((a) => a.status === "concluida" && a.activity_date.slice(0, 7) === todayStr.slice(0, 7)).length,
    };
  }, [activities, todayStr, weekEndStr]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Activity> & { id?: string }) => {
      if (!consultant?.id) throw new Error("Consultoria não encontrada");
      const body: any = { ...payload, consultant_id: consultant.id };
      Object.keys(body).forEach((k) => body[k] === "" && (body[k] = null));
      if (body.id) {
        const { id, ...rest } = body;
        const { error } = await sb.from("consultancy_activities").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("consultancy_activities").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda-activities"] });
      toast.success("Atividade salva");
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("consultancy_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda-activities"] }); toast.success("Atividade removida"); },
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "concluida") patch.completed_at = new Date().toISOString();
      if (status === "cancelada") patch.canceled_at = new Date().toISOString();
      const { error } = await sb.from("consultancy_activities").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-activities"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Agenda do Consultor</h1>
          <p className="text-muted-foreground text-sm">Organize reuniões, entregas, tarefas e prazos da sua consultoria.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="size-4" /> Nova Atividade</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Clock className="size-4" />} title="Tarefas de hoje" value={kpis.hoje} tone="blue" />
        <KpiCard icon={<AlertTriangle className="size-4" />} title="Tarefas atrasadas" value={kpis.atrasadas} tone="red" />
        <KpiCard icon={<CalendarDays className="size-4" />} title="Reuniões na semana" value={kpis.reunioes} tone="violet" />
        <KpiCard icon={<PackageIcon className="size-4" />} title="Entregas pendentes" value={kpis.entregas} tone="amber" />
        <KpiCard icon={<FileText className="size-4" />} title="Relatórios a entregar" value={kpis.relatorios} tone="slate" />
        <KpiCard icon={<FileText className="size-4" />} title="Precificações pendentes" value={kpis.precificacoes} tone="slate" />
        <KpiCard icon={<UsersIcon className="size-4" />} title="Clientes com atividades" value={kpis.clientesAtivos} tone="emerald" />
        <KpiCard icon={<ListChecks className="size-4" />} title="Concluídas no mês" value={kpis.concluidasMes} tone="emerald" />
      </div>

      {section === "lista" && (
        <ListaTab
          activities={activities}
          companyMap={companyMap}
          onEdit={(a) => { setEditing(a); setOpen(true); }}
          onDelete={(id) => delMut.mutate(id)}
          onStatus={(id, s) => setStatusMut.mutate({ id, status: s })}
        />
      )}
      {section === "calendario" && (
        <CalendarTab activities={activities} companyMap={companyMap} onSelect={(a) => { setEditing(a); setOpen(true); }} />
      )}
      {section === "entregas" && (
        <ListaTab
          activities={activities.filter((a) => ENTREGA_TYPES.includes(a.activity_type) && a.status !== "concluida" && a.status !== "cancelada")}
          companyMap={companyMap}
          onEdit={(a) => { setEditing(a); setOpen(true); }}
          onDelete={(id) => delMut.mutate(id)}
          onStatus={(id, s) => setStatusMut.mutate({ id, status: s })}
          emptyMsg="Sem entregas pendentes."
        />
      )}
      {section === "reunioes" && (
        <ListaTab
          activities={activities.filter((a) => a.activity_type === "reuniao")}
          companyMap={companyMap}
          onEdit={(a) => { setEditing(a); setOpen(true); }}
          onDelete={(id) => delMut.mutate(id)}
          onStatus={(id, s) => setStatusMut.mutate({ id, status: s })}
          emptyMsg="Sem reuniões agendadas."
        />
      )}
      {section === "prazos" && (
        <ListaTab
          activities={activities.filter((a) => a.due_date && a.status !== "concluida" && a.status !== "cancelada").sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))}
          companyMap={companyMap}
          onEdit={(a) => { setEditing(a); setOpen(true); }}
          onDelete={(id) => delMut.mutate(id)}
          onStatus={(id, s) => setStatusMut.mutate({ id, status: s })}
          emptyMsg="Sem prazos cadastrados."
        />
      )}
      {section === "por-cliente" && (
        <PorClienteTab activities={activities} companies={companies} />
      )}

      <ActivityDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        initial={editing}
        companies={companies}
        onSave={(p) => saveMut.mutate(p)}
        saving={saveMut.isPending}
      />
    </div>
  );
}

function KpiCard({ icon, title, value, tone }: { icon: React.ReactNode; title: string; value: number; tone: string }) {
  const tones: Record<string, string> = {
    blue: "text-blue-700 bg-blue-50",
    red: "text-red-700 bg-red-50",
    violet: "text-violet-700 bg-violet-50",
    amber: "text-amber-700 bg-amber-50",
    emerald: "text-emerald-700 bg-emerald-50",
    slate: "text-slate-700 bg-slate-50",
  };
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className={`size-8 rounded-md grid place-items-center ${tones[tone]}`}>{icon}</div>
        <div className="text-2xl font-display font-semibold">{value}</div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">{title}</div>
    </div>
  );
}

function ListaTab({ activities, companyMap, onEdit, onDelete, onStatus, emptyMsg }: {
  activities: Activity[]; companyMap: Map<string, string>;
  onEdit: (a: Activity) => void; onDelete: (id: string) => void; onStatus: (id: string, s: string) => void;
  emptyMsg?: string;
}) {
  const [fStatus, setFStatus] = useState<string>("");
  const [fPriority, setFPriority] = useState<string>("");
  const [fType, setFType] = useState<string>("");
  const [fSearch, setFSearch] = useState("");

  const filtered = activities.filter((a) => {
    if (fStatus && a.status !== fStatus) return false;
    if (fPriority && a.priority !== fPriority) return false;
    if (fType && a.activity_type !== fType) return false;
    if (fSearch && !a.title.toLowerCase().includes(fSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar título..." value={fSearch} onChange={(e) => setFSearch(e.target.value)} className="w-56" />
        <Select value={fStatus || "all"} onValueChange={(v) => setFStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fPriority || "all"} onValueChange={(v) => setFPriority(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            {PRIORITIES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fType || "all"} onValueChange={(v) => setFType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {Object.entries(ACTIVITY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Atividade</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">{emptyMsg ?? "Nenhuma atividade."}</TableCell></TableRow>
            )}
            {filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.title}</TableCell>
                <TableCell className="text-sm">{a.company_id ? (companyMap.get(a.company_id) ?? "—") : <span className="text-muted-foreground">Interna</span>}</TableCell>
                <TableCell className="text-sm">{ACTIVITY_TYPES[a.activity_type] ?? a.activity_type}</TableCell>
                <TableCell className="text-sm">{fmtDate(a.activity_date)}</TableCell>
                <TableCell className="text-sm">{a.start_time ? a.start_time.slice(0, 5) : "—"}</TableCell>
                <TableCell className="text-sm">{fmtDate(a.due_date)}</TableCell>
                <TableCell>{priorityBadge(a.priority)}</TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {a.status !== "concluida" && (
                      <Button size="icon" variant="ghost" title="Concluir" onClick={() => onStatus(a.id, "concluida")}><Check className="size-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
                    {a.status !== "cancelada" && (
                      <Button size="icon" variant="ghost" title="Cancelar" onClick={() => onStatus(a.id, "cancelada")}><X className="size-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => onDelete(a.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CalendarTab({ activities, companyMap, onSelect }: { activities: Activity[]; companyMap: Map<string, string>; onSelect: (a: Activity) => void }) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const byDate = new Map<string, Activity[]>();
  activities.forEach((a) => {
    const arr = byDate.get(a.activity_date) ?? [];
    arr.push(a); byDate.set(a.activity_date, arr);
  });

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const todayKey = today();

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-semibold capitalize">{monthLabel}</div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {weekdays.map((w) => <div key={w} className="bg-muted text-xs font-medium text-muted-foreground p-2 text-center">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="bg-card min-h-[90px]" />;
          const key = d.toISOString().slice(0, 10);
          const items = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={i} className={`bg-card min-h-[90px] p-1.5 ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
              <div className="text-[11px] text-muted-foreground">{d.getDate()}</div>
              <div className="space-y-0.5 mt-1">
                {items.slice(0, 3).map((a) => {
                  const pColor = PRIORITIES.find((p) => p.id === a.priority)?.color ?? "";
                  return (
                    <button key={a.id} onClick={() => onSelect(a)} className={`w-full text-left text-[11px] truncate rounded px-1 py-0.5 ${pColor}`} title={`${a.title}${a.company_id ? " — " + (companyMap.get(a.company_id) ?? "") : ""}`}>
                      {a.start_time ? a.start_time.slice(0, 5) + " " : ""}{a.title}
                    </button>
                  );
                })}
                {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PorClienteTab({ activities, companies }: { activities: Activity[]; companies: any[] }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Activity[]>();
    activities.forEach((a) => {
      const k = a.company_id ?? "_interna";
      const arr = m.get(k) ?? []; arr.push(a); m.set(k, arr);
    });
    return m;
  }, [activities]);
  const nameOf = (id: string) => id === "_interna" ? "Atividades internas da consultoria" : (companies.find((c: any) => c.id === id)?.nome ?? "Empresa");
  const keys = Array.from(grouped.keys()).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));

  if (keys.length === 0) return <div className="text-muted-foreground text-sm">Nenhuma atividade cadastrada.</div>;

  return (
    <div className="space-y-3">
      {keys.map((k) => {
        const items = grouped.get(k) ?? [];
        const pend = items.filter((a) => a.status !== "concluida" && a.status !== "cancelada").length;
        return (
          <div key={k} className="bg-card border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-display font-semibold">{nameOf(k)}</div>
              <Badge variant="outline">{pend} pendentes / {items.length} total</Badge>
            </div>
            <ul className="text-sm divide-y">
              {items.slice(0, 8).map((a) => (
                <li key={a.id} className="py-1.5 flex items-center justify-between gap-2">
                  <span className="truncate">{a.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{fmtDate(a.activity_date)}</span>
                    {statusBadge(a.status)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function ActivityDialog({ open, onOpenChange, initial, companies, onSave, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial: Activity | null; companies: any[];
  onSave: (payload: any) => void; saving: boolean;
}) {
  const empty = {
    title: "", activity_type: "tarefa_interna", company_id: "", branch_id: "",
    responsible_name: "", activity_date: today(), start_time: "", end_time: "",
    due_date: "", priority: "media", status: "pendente", description: "", notes: "",
    meeting_link: "", location: "", reminder_type: "none", recurrence_type: "none", recurrence_until: "",
  };
  const [form, setForm] = useState<any>(empty);

  useMemo(() => {
    if (open) {
      setForm(initial ? {
        ...empty, ...initial,
        company_id: initial.company_id ?? "",
        start_time: initial.start_time?.slice(0, 5) ?? "",
        end_time: initial.end_time?.slice(0, 5) ?? "",
        due_date: initial.due_date ?? "",
        recurrence_until: initial.recurrence_until ?? "",
        reminder_type: initial.reminder_type ?? "none",
      } : empty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? "Editar atividade" : "Nova atividade"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.activity_type} onValueChange={(v) => set("activity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ACTIVITY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresa cliente</Label>
            <Select value={form.company_id || "none"} onValueChange={(v) => set("company_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem empresa (interna)</SelectItem>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsible_name ?? ""} onChange={(e) => set("responsible_name", e.target.value)} />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={form.activity_date} onChange={(e) => set("activity_date", e.target.value)} />
          </div>
          <div>
            <Label>Horário inicial</Label>
            <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
          </div>
          <div>
            <Label>Horário final</Label>
            <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
          </div>
          <div>
            <Label>Prazo final</Label>
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Link da reunião</Label>
            <Input placeholder="https://meet..." value={form.meeting_link ?? ""} onChange={(e) => set("meeting_link", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Local</Label>
            <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </div>
          <div>
            <Label>Lembrete</Label>
            <Select value={form.reminder_type} onValueChange={(v) => set("reminder_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REMINDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recorrência</Label>
            <Select value={form.recurrence_type} onValueChange={(v) => set("recurrence_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{RECURRENCES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {form.recurrence_type !== "none" && (
            <div>
              <Label>Recorrer até</Label>
              <Input type="date" value={form.recurrence_until} onChange={(e) => set("recurrence_until", e.target.value)} />
            </div>
          )}
          <div className="md:col-span-2">
            <Label>Descrição</Label>
            <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={saving || !form.title.trim()}
            onClick={() => onSave({
              ...(initial ? { id: initial.id } : {}),
              title: form.title.trim(),
              activity_type: form.activity_type,
              company_id: form.company_id || null,
              responsible_name: form.responsible_name || null,
              activity_date: form.activity_date,
              start_time: form.start_time || null,
              end_time: form.end_time || null,
              due_date: form.due_date || null,
              priority: form.priority,
              status: form.status,
              description: form.description || null,
              notes: form.notes || null,
              meeting_link: form.meeting_link || null,
              location: form.location || null,
              reminder_type: form.reminder_type || null,
              recurrence_type: form.recurrence_type,
              recurrence_until: form.recurrence_until || null,
            })}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
