import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Plus, Pencil, Trash2, Check, X, Clock, AlertTriangle,
  ChevronLeft, ChevronRight,
  Video, MapPin, ExternalLink, Building2, ChevronDown, ChevronUp,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { CompanyAgenda } from "@/components/agenda/CompanyAgenda";


export const AGENDA_SECTIONS = [
  { id: "calendario", label: "Calendário" },
  { id: "reunioes", label: "Reuniões" },
  { id: "por-cliente", label: "Por cliente" },
] as const;
type AgendaSection = typeof AGENDA_SECTIONS[number]["id"];
const AGENDA_SECTION_IDS = AGENDA_SECTIONS.map((s) => s.id) as readonly string[];

export const Route = createFileRoute("/app/agenda")({
  validateSearch: (s: Record<string, unknown>): { section?: AgendaSection; company?: string } => {
    const v = String(s.section ?? "");
    return {
      section: (AGENDA_SECTION_IDS.includes(v) ? v : "calendario") as AgendaSection,
      company: typeof s.company === "string" ? s.company : undefined,
    };
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
const PRAZO_TYPES = [...ENTREGA_TYPES, "renovacao_contrato", "cobranca_mensalidade", "cobranca_docs"];

const PRIORITIES = [
  { id: "baixa", label: "Baixa", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "media", label: "Média", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "alta", label: "Alta", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "urgente", label: "Urgente", color: "bg-red-100 text-red-700 border-red-200" },
];
const STATUSES = [
  { id: "pendente", label: "Pendente", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "em_andamento", label: "Em andamento", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { id: "concluida", label: "Concluída", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "atrasada", label: "Atrasada", color: "bg-red-100 text-red-700 border-red-200" },
  { id: "cancelada", label: "Cancelada", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
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
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDate = (s?: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");
const daysBetween = (a: string, b: string) => Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / 86400000);

function priorityBadge(p: string) {
  const x = PRIORITIES.find((i) => i.id === p) ?? PRIORITIES[1];
  return <Badge variant="outline" className={x.color}>{x.label}</Badge>;
}
function statusBadge(s: string) {
  const x = STATUSES.find((i) => i.id === s) ?? STATUSES[0];
  return <Badge variant="outline" className={x.color}>{x.label}</Badge>;
}
function isOverdue(a: Activity) {
  const ref = a.due_date ?? a.activity_date;
  return a.status !== "concluida" && a.status !== "cancelada" && ref < today();
}

function AgendaPage() {
  const { isConsultant, loading } = useAuth();
  const { section } = Route.useSearch();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!isConsultant) return <CompanyAgenda section={section ?? "calendario"} />;
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
      const { data, error } = await supabase.from("companies").select("id, nome, cnpj").order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string; cnpj: string | null }>;
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
        .is("deleted_at", null).order("activity_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
  });
}

function Inner() {
  const { section, company } = Route.useSearch();
  const { data: consultant } = useConsultant();
  const { data: companies = [] } = useCompanies();
  const { data: activities = [] } = useActivities(consultant?.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [prefill, setPrefill] = useState<Partial<Activity> | null>(null);

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    companies.forEach((c) => m.set(c.id, c.nome));
    return m;
  }, [companies]);

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<Activity> & { id?: string }) => {
      if (!consultant?.id) throw new Error("Consultoria não encontrada");
      const body: any = { ...payload, consultant_id: consultant.id };
      Object.keys(body).forEach((k) => body[k] === "" && (body[k] = null));
      if (body.id) {
        const { id, ...rest } = body;
        const { error } = await sb.from("consultancy_activities").update(rest).eq("id", id).is("deleted_at", null);
        if (error) throw error;
      } else {
        const { error } = await sb.from("consultancy_activities").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agenda-activities"] });
      toast.success("Atividade salva");
      setOpen(false); setEditing(null); setPrefill(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("consultancy_activities").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agenda-activities"] }); toast.success("Atividade removida"); },
  });

  const setStatusMut = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "concluida") patch.completed_at = new Date().toISOString();
      if (status === "cancelada") patch.canceled_at = new Date().toISOString();
      const { error } = await sb.from("consultancy_activities").update(patch).eq("id", id).is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agenda-activities"] }),
  });

  const openNew = (pf?: Partial<Activity>) => { setEditing(null); setPrefill(pf ?? null); setOpen(true); };
  const openEdit = (a: Activity) => { setEditing(a); setPrefill(null); setOpen(true); };
  const onStatus = (id: string, s: string) => setStatusMut.mutate({ id, status: s });
  const onDelete = (id: string) => { if (confirm("Excluir esta atividade?")) delMut.mutate(id); };
  const onReagendar = (a: Activity) => {
    const novo = prompt("Nova data (AAAA-MM-DD):", a.activity_date);
    if (novo) sb.from("consultancy_activities").update({ activity_date: novo, status: "pendente" }).eq("id", a.id).is("deleted_at", null).then(() => {
      qc.invalidateQueries({ queryKey: ["agenda-activities"] });
      toast.success("Atividade reagendada");
    });
  };

  const sectionLabel = AGENDA_SECTIONS.find((s) => s.id === section)?.label ?? "Calendário";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Agenda do Consultor</h1>
          <p className="text-muted-foreground text-sm">Organize reuniões, entregas, tarefas e prazos da sua consultoria.</p>
          <div className="text-xs text-muted-foreground mt-1">Visão: <span className="font-medium text-foreground">{sectionLabel}</span></div>
        </div>
        <Button onClick={() => openNew()}><Plus className="size-4" /> Nova Atividade</Button>
      </div>

      {section === "calendario" && (
        <CalendarTab activities={activities} companyMap={companyMap}
          onSelect={openEdit} onNewOnDate={(d) => openNew({ activity_date: d })} />
      )}
      {section === "reunioes" && (
        <ReunioesTab activities={activities} companyMap={companyMap} companies={companies}
          onEdit={openEdit} onDelete={onDelete} onStatus={onStatus} onReagendar={onReagendar}
          onNew={() => openNew({ activity_type: "reuniao" })} />
      )}
      {section === "por-cliente" && (
        <PorClienteTab activities={activities} companies={companies}
          selected={company} onNewForCompany={(cid) => openNew({ company_id: cid })} onEdit={openEdit} />
      )}

      <ActivityDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setPrefill(null); } }}
        initial={editing}
        prefill={prefill}
        companies={companies}
        onSave={(p) => saveMut.mutate(p)}
        saving={saveMut.isPending}
      />
    </div>
  );
}

function KpiCard({ icon, title, value, tone, onClick, active }: {
  icon: React.ReactNode; title: string; value: number; tone: string;
  onClick?: () => void; active?: boolean;
}) {
  const tones: Record<string, string> = {
    blue: "text-blue-700 bg-blue-50",
    red: "text-red-700 bg-red-50",
    violet: "text-violet-700 bg-violet-50",
    amber: "text-amber-700 bg-amber-50",
    emerald: "text-emerald-700 bg-emerald-50",
    slate: "text-slate-700 bg-slate-50",
  };
  const Comp: any = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick}
      className={`bg-card border rounded-xl p-4 text-left transition ${onClick ? "hover:border-primary/50 cursor-pointer" : ""} ${active ? "border-primary ring-2 ring-primary/20" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`size-8 rounded-md grid place-items-center ${tones[tone]}`}>{icon}</div>
        <div className="text-2xl font-display font-semibold">{value}</div>
      </div>
      <div className="text-xs text-muted-foreground mt-2">{title}</div>
    </Comp>
  );
}

// ---------- LISTA TAB ----------

function FilterSelect({ label, value, onChange, options, className }: {
  label: string; value: string; onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>; className?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
        <SelectTrigger className={className ?? "w-40"}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {options.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function QuickChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"}`}>
      {children}
    </button>
  );
}

// ---------- ACTIVITY TABLE (shared) ----------
function ActivityTable({ items, companyMap, onEdit, onDelete, onStatus, onReagendar, emptyMsg, onNew, extraCols }: {
  items: Activity[]; companyMap: Map<string, string>;
  onEdit: (a: Activity) => void; onDelete: (id: string) => void;
  onStatus: (id: string, s: string) => void; onReagendar: (a: Activity) => void;
  emptyMsg: string; onNew?: () => void;
  extraCols?: { header: string; render: (a: Activity) => React.ReactNode };
}) {
  const t = today();
  return (
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
            {extraCols && <TableHead>{extraCols.header}</TableHead>}
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow><TableCell colSpan={extraCols ? 10 : 9} className="text-center text-muted-foreground py-10">
              <div>{emptyMsg}</div>
              {onNew && <Button size="sm" variant="outline" className="mt-3" onClick={onNew}><Plus className="size-3" /> Nova atividade</Button>}
            </TableCell></TableRow>
          )}
          {items.map((a) => {
            const overdue = isOverdue(a);
            const urgent = a.priority === "urgente";
            const done = a.status === "concluida";
            const canceled = a.status === "cancelada";
            const rowCls = canceled ? "opacity-60" : done ? "opacity-70" : overdue ? "bg-red-50/50" : urgent ? "bg-amber-50/40" : "";
            return (
              <TableRow key={a.id} className={rowCls}>
                <TableCell className={`font-medium ${done ? "line-through" : ""}`}>{a.title}</TableCell>
                <TableCell className="text-sm">{a.company_id ? (companyMap.get(a.company_id) ?? "—") : <span className="text-muted-foreground">Interna</span>}</TableCell>
                <TableCell className="text-sm">{ACTIVITY_TYPES[a.activity_type] ?? a.activity_type}</TableCell>
                <TableCell className="text-sm">
                  {fmtDate(a.activity_date)}
                  {overdue && <Badge variant="outline" className="ml-1 bg-red-100 text-red-700 border-red-200 text-[10px]">atrasada</Badge>}
                  {a.activity_date === t && !done && <Badge variant="outline" className="ml-1 bg-blue-100 text-blue-700 text-[10px]">hoje</Badge>}
                </TableCell>
                <TableCell className="text-sm">{a.start_time ? a.start_time.slice(0, 5) : "—"}</TableCell>
                <TableCell className="text-sm">{fmtDate(a.due_date)}</TableCell>
                {extraCols && <TableCell className="text-sm">{extraCols.render(a)}</TableCell>}
                <TableCell>{priorityBadge(a.priority)}</TableCell>
                <TableCell>{statusBadge(a.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {a.meeting_link && (
                      <Button size="icon" variant="ghost" title="Entrar na reunião" asChild>
                        <a href={a.meeting_link} target="_blank" rel="noreferrer"><Video className="size-4" /></a>
                      </Button>
                    )}
                    {!done && (
                      <Button size="icon" variant="ghost" title="Concluir" onClick={() => onStatus(a.id, "concluida")}><Check className="size-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="Reagendar" onClick={() => onReagendar(a)}><CalendarDays className="size-4" /></Button>
                    <Button size="icon" variant="ghost" title="Editar" onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
                    {!canceled && (
                      <Button size="icon" variant="ghost" title="Cancelar" onClick={() => onStatus(a.id, "cancelada")}><X className="size-4" /></Button>
                    )}
                    <Button size="icon" variant="ghost" title="Excluir" onClick={() => onDelete(a.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------- REUNIÕES TAB ----------
function ReunioesTab({ activities, companyMap, companies, onEdit, onDelete, onStatus, onReagendar, onNew }: {
  activities: Activity[]; companyMap: Map<string, string>; companies: Array<{ id: string; nome: string }>;
  onEdit: (a: Activity) => void; onDelete: (id: string) => void;
  onStatus: (id: string, s: string) => void; onReagendar: (a: Activity) => void; onNew: () => void;
}) {
  const t = today();
  const semanaFim = iso(addDays(new Date(), 7));
  const [fCompany, setFCompany] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [quick, setQuick] = useState<"" | "hoje" | "semana" | "futuras" | "concluidas" | "canceladas">("");

  const base = activities.filter((a) => a.activity_type === "reuniao");
  const kpis = {
    hoje: base.filter((a) => a.activity_date === t && a.status !== "cancelada").length,
    semana: base.filter((a) => a.activity_date >= t && a.activity_date <= semanaFim && a.status !== "cancelada").length,
    proximas: base.filter((a) => a.activity_date > t && a.status !== "cancelada" && a.status !== "concluida").length,
    mes: base.filter((a) => a.status === "concluida" && a.activity_date.slice(0, 7) === t.slice(0, 7)).length,
  };

  const filtered = base.filter((a) => {
    if (fCompany && a.company_id !== fCompany) return false;
    if (fStatus && a.status !== fStatus) return false;
    if (quick === "hoje" && a.activity_date !== t) return false;
    if (quick === "semana" && (a.activity_date < t || a.activity_date > semanaFim)) return false;
    if (quick === "futuras" && a.activity_date <= t) return false;
    if (quick === "concluidas" && a.status !== "concluida") return false;
    if (quick === "canceladas" && a.status !== "cancelada") return false;
    return true;
  }).sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<CalendarDays className="size-4" />} title="Reuniões de hoje" value={kpis.hoje} tone="blue"
          onClick={() => setQuick(quick === "hoje" ? "" : "hoje")} active={quick === "hoje"} />
        <KpiCard icon={<CalendarDays className="size-4" />} title="Reuniões da semana" value={kpis.semana} tone="violet"
          onClick={() => setQuick(quick === "semana" ? "" : "semana")} active={quick === "semana"} />
        <KpiCard icon={<Clock className="size-4" />} title="Próximas reuniões" value={kpis.proximas} tone="amber"
          onClick={() => setQuick(quick === "futuras" ? "" : "futuras")} active={quick === "futuras"} />
        <KpiCard icon={<Check className="size-4" />} title="Concluídas no mês" value={kpis.mes} tone="emerald" />
      </div>

      <div className="bg-card border rounded-xl p-3 flex flex-wrap gap-2 items-end justify-between">
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Empresa</Label>
            <Select value={fCompany || "all"} onValueChange={(v) => setFCompany(v === "all" ? "" : v)}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FilterSelect label="Status" value={fStatus} onChange={setFStatus} options={STATUSES} />
          <div className="flex gap-2">
            <QuickChip active={quick === "concluidas"} onClick={() => setQuick(quick === "concluidas" ? "" : "concluidas")}>Concluídas</QuickChip>
            <QuickChip active={quick === "canceladas"} onClick={() => setQuick(quick === "canceladas" ? "" : "canceladas")}>Canceladas</QuickChip>
          </div>
        </div>
        <Button onClick={onNew}><Plus className="size-4" /> Nova reunião</Button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">
          Sem reuniões para mostrar.
          <div className="mt-3"><Button size="sm" variant="outline" onClick={onNew}><Plus className="size-3" /> Nova reunião</Button></div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const overdue = isOverdue(a);
            const done = a.status === "concluida";
            return (
              <div key={a.id} className={`bg-card border rounded-xl p-4 flex flex-wrap gap-3 items-center justify-between ${overdue ? "border-red-200" : ""} ${done ? "opacity-70" : ""}`}>
                <div className="flex-1 min-w-[240px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={`font-medium ${done ? "line-through" : ""}`}>{a.title}</div>
                    {priorityBadge(a.priority)}
                    {statusBadge(a.status)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                    <span>{a.company_id ? companyMap.get(a.company_id) : "Interna"}</span>
                    <span>{fmtDate(a.activity_date)}</span>
                    {a.start_time && <span>{a.start_time.slice(0, 5)}{a.end_time ? ` – ${a.end_time.slice(0, 5)}` : ""}</span>}
                    {a.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {a.location}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {a.meeting_link && (
                    <Button size="sm" asChild><a href={a.meeting_link} target="_blank" rel="noreferrer"><Video className="size-3" /> Entrar</a></Button>
                  )}
                  {!done && <Button size="icon" variant="ghost" title="Concluir" onClick={() => onStatus(a.id, "concluida")}><Check className="size-4" /></Button>}
                  <Button size="icon" variant="ghost" title="Reagendar" onClick={() => onReagendar(a)}><CalendarDays className="size-4" /></Button>
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
                  {a.status !== "cancelada" && <Button size="icon" variant="ghost" title="Cancelar" onClick={() => onStatus(a.id, "cancelada")}><X className="size-4" /></Button>}
                  <Button size="icon" variant="ghost" title="Excluir" onClick={() => onDelete(a.id)}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------- CALENDÁRIO ----------
function CalendarTab({ activities, companyMap, onSelect, onNewOnDate }: {
  activities: Activity[]; companyMap: Map<string, string>;
  onSelect: (a: Activity) => void; onNewOnDate: (date: string) => void;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [view, setView] = useState<"mes" | "semana" | "dia">("mes");
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = today();
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const byDate = useMemo(() => {
    const m = new Map<string, Activity[]>();
    activities.forEach((a) => {
      const arr = m.get(a.activity_date) ?? [];
      arr.push(a); m.set(a.activity_date, arr);
    });
    return m;
  }, [activities]);

  const colorOf = (a: Activity) => {
    if (a.status === "concluida") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (isOverdue(a)) return "bg-red-200 text-red-900 border-red-300";
    if (a.priority === "urgente") return "bg-red-100 text-red-700 border-red-200";
    if (a.activity_type === "reuniao") return "bg-blue-100 text-blue-700 border-blue-200";
    if (ENTREGA_TYPES.includes(a.activity_type)) return "bg-violet-100 text-violet-700 border-violet-200";
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const renderMes = () => {
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {weekdays.map((w) => <div key={w} className="bg-muted text-xs font-medium text-muted-foreground p-2 text-center">{w}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="bg-card min-h-[100px]" />;
          const key = iso(d);
          const items = byDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <div key={i} className={`bg-card min-h-[100px] p-1.5 group relative ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setDayModalDate(key)}
                  className="text-[11px] text-muted-foreground hover:text-primary hover:underline"
                  title="Ver todas as atividades do dia"
                >
                  {d.getDate()}
                </button>
                <button onClick={() => onNewOnDate(key)} className="opacity-0 group-hover:opacity-100 text-[10px] text-primary hover:underline">+ nova</button>
              </div>
              <div className="space-y-0.5 mt-1">
                {items.slice(0, 3).map((a) => (
                  <button key={a.id} onClick={(e) => { e.stopPropagation(); onSelect(a); }}
                    className={`w-full text-left text-[11px] truncate rounded px-1 py-0.5 border ${colorOf(a)}`}
                    title={`${a.title}${a.company_id ? " — " + (companyMap.get(a.company_id) ?? "") : ""}`}>
                    {a.start_time ? a.start_time.slice(0, 5) + " " : ""}{a.title}
                  </button>
                ))}
                {items.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setDayModalDate(key)}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    +{items.length - 3} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSemana = () => {
    const ref = new Date(selectedDate + "T00:00:00");
    const start = addDays(ref, -ref.getDay());
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <div className="grid grid-cols-7 gap-2">
        {days.map((d) => {
          const key = iso(d);
          const items = (byDate.get(key) ?? []).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
          return (
            <div key={key} className="bg-card border rounded-lg p-2 min-h-[260px]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs">
                  <div className="text-muted-foreground">{weekdays[d.getDay()]}</div>
                  <div className={`font-semibold ${key === todayKey ? "text-primary" : ""}`}>{d.getDate()}/{d.getMonth() + 1}</div>
                </div>
                <button onClick={() => onNewOnDate(key)} className="text-[10px] text-primary hover:underline">+ nova</button>
              </div>
              <div className="space-y-1">
                {items.map((a) => (
                  <button key={a.id} onClick={() => onSelect(a)} className={`w-full text-left text-[11px] rounded p-1 border ${colorOf(a)}`}>
                    {a.start_time && <div className="font-medium">{a.start_time.slice(0, 5)}</div>}
                    <div className="truncate">{a.title}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDia = () => {
    const items = (byDate.get(selectedDate) ?? []).sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
    return (
      <div className="bg-card border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">{new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</div>
          <Button size="sm" onClick={() => onNewOnDate(selectedDate)}><Plus className="size-3" /> Nova atividade</Button>
        </div>
        {items.length === 0 ? (
          <div className="text-muted-foreground text-sm py-6 text-center">Sem atividades neste dia.</div>
        ) : (
          <div className="space-y-2">
            {items.map((a) => (
              <button key={a.id} onClick={() => onSelect(a)} className={`w-full text-left rounded-lg border p-3 ${colorOf(a)}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{a.start_time ? a.start_time.slice(0, 5) + " · " : ""}{a.title}</div>
                  {priorityBadge(a.priority)}
                </div>
                <div className="text-xs mt-1 opacity-80">{a.company_id ? companyMap.get(a.company_id) : "Interna"} · {ACTIVITY_TYPES[a.activity_type]}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="bg-card border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="font-display font-semibold capitalize">{view === "mes" ? monthLabel : new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</div>
          <div className="flex gap-1 ml-2">
            <Button size="icon" variant="outline" onClick={() => { if (view === "mes") setCursor(new Date(year, month - 1, 1)); else setSelectedDate(iso(addDays(new Date(selectedDate + "T00:00:00"), view === "semana" ? -7 : -1))); }}><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSelectedDate(today()); }}>Hoje</Button>
            <Button size="icon" variant="outline" onClick={() => { if (view === "mes") setCursor(new Date(year, month + 1, 1)); else setSelectedDate(iso(addDays(new Date(selectedDate + "T00:00:00"), view === "semana" ? 7 : 1))); }}><ChevronRight className="size-4" /></Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-md overflow-hidden">
            {(["dia", "semana", "mes"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1 text-xs capitalize ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{v}</button>
            ))}
          </div>
          <Button size="sm" onClick={() => onNewOnDate(view === "mes" ? today() : selectedDate)}><Plus className="size-3" /> Nova Atividade</Button>
        </div>
      </div>
      {view === "mes" && renderMes()}
      {view === "semana" && renderSemana()}
      {view === "dia" && renderDia()}
      <div className="flex gap-3 text-[11px] text-muted-foreground flex-wrap">
        <LegendDot c="bg-blue-100 border-blue-200" l="Reunião" />
        <LegendDot c="bg-violet-100 border-violet-200" l="Entrega" />
        <LegendDot c="bg-slate-100 border-slate-200" l="Tarefa interna" />
        <LegendDot c="bg-red-100 border-red-200" l="Urgente" />
        <LegendDot c="bg-emerald-100 border-emerald-200" l="Concluída" />
        <LegendDot c="bg-red-200 border-red-300" l="Atrasada" />
      </div>
      <Dialog open={dayModalDate !== null} onOpenChange={(o) => !o && setDayModalDate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dayModalDate ? new Date(dayModalDate + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : ""}
            </DialogTitle>
          </DialogHeader>
          {dayModalDate && (() => {
            const items = (byDate.get(dayModalDate) ?? []).slice().sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">{items.length} atividade(s)</div>
                  <Button size="sm" onClick={() => { const d = dayModalDate; setDayModalDate(null); onNewOnDate(d); }}>
                    <Plus className="size-3" /> Nova atividade
                  </Button>
                </div>
                {items.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-6 text-center">Sem atividades neste dia.</div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {items.map((a) => (
                      <button key={a.id} onClick={() => { setDayModalDate(null); onSelect(a); }} className={`w-full text-left rounded-lg border p-3 ${colorOf(a)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{a.start_time ? a.start_time.slice(0, 5) + " · " : ""}{a.title}</div>
                          {priorityBadge(a.priority)}
                        </div>
                        <div className="text-xs mt-1 opacity-80">{a.company_id ? companyMap.get(a.company_id) : "Interna"} · {ACTIVITY_TYPES[a.activity_type]}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LegendDot({ c, l }: { c: string; l: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`inline-block size-3 rounded border ${c}`} />{l}</span>;
}

// ---------- POR CLIENTE ----------
function PorClienteTab({ activities, companies, selected, onNewForCompany, onEdit }: {
  activities: Activity[]; companies: Array<{ id: string; nome: string; cnpj: string | null }>;
  selected?: string; onNewForCompany: (cid: string) => void; onEdit: (a: Activity) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(selected ?? null);
  const t = today();

  useEffect(() => { if (selected) setExpanded(selected); }, [selected]);

  const summaries = useMemo(() => {
    const m = new Map<string, Activity[]>();
    activities.forEach((a) => {
      const k = a.company_id ?? "_interna";
      const arr = m.get(k) ?? []; arr.push(a); m.set(k, arr);
    });
    return Array.from(m.entries()).map(([k, items]) => {
      const open = items.filter((a) => a.status !== "concluida" && a.status !== "cancelada");
      const sorted = [...items].sort((a, b) => a.activity_date.localeCompare(b.activity_date));
      const co = companies.find((c) => c.id === k);
      return {
        key: k,
        nome: k === "_interna" ? "Atividades internas da consultoria" : (co?.nome ?? "Empresa"),
        cnpj: co?.cnpj ?? null,
        items: sorted,
        abertas: open.length,
        entregas: open.filter((a) => ENTREGA_TYPES.includes(a.activity_type)).length,
        reunioesFut: open.filter((a) => a.activity_type === "reuniao" && a.activity_date >= t).length,
        atrasadas: open.filter(isOverdue).length,
        ultima: sorted[sorted.length - 1],
        proxima: sorted.find((a) => a.activity_date >= t && a.status !== "concluida" && a.status !== "cancelada"),
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [activities, companies, t]);

  if (summaries.length === 0) {
    return <div className="bg-card border rounded-xl p-10 text-center text-muted-foreground">Nenhuma atividade cadastrada.</div>;
  }

  return (
    <div className="space-y-3">
      {summaries.map((s) => {
        const isOpen = expanded === s.key;
        return (
          <div key={s.key} className="bg-card border rounded-xl overflow-hidden">
            <button className="w-full p-4 text-left hover:bg-muted/40 transition" onClick={() => setExpanded(isOpen ? null : s.key)}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-md bg-primary/10 text-primary grid place-items-center"><Building2 className="size-4" /></div>
                  <div className="min-w-0">
                    <div className="font-display font-semibold truncate">{s.nome}</div>
                    {s.cnpj && <div className="text-xs text-muted-foreground">{s.cnpj}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-slate-50">{s.abertas} abertas</Badge>
                  {s.entregas > 0 && <Badge variant="outline" className="bg-violet-50 text-violet-700">{s.entregas} entregas</Badge>}
                  {s.reunioesFut > 0 && <Badge variant="outline" className="bg-blue-50 text-blue-700">{s.reunioesFut} reuniões</Badge>}
                  {s.atrasadas > 0 && <Badge variant="outline" className="bg-red-50 text-red-700">{s.atrasadas} atrasadas</Badge>}
                  {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-4">
                <span>Última: {s.ultima ? `${s.ultima.title} (${fmtDate(s.ultima.activity_date)})` : "—"}</span>
                <span>Próxima: {s.proxima ? `${s.proxima.title} (${fmtDate(s.proxima.activity_date)})` : "—"}</span>
              </div>
            </button>
            {isOpen && (
              <div className="border-t p-4 space-y-3 bg-muted/20">
                <div className="flex flex-wrap gap-2">
                  {s.key !== "_interna" && (
                    <>
                      <Button size="sm" onClick={() => onNewForCompany(s.key)}><Plus className="size-3" /> Nova atividade</Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/app/empresa/$id" params={{ id: s.key }}><ExternalLink className="size-3" /> Ver empresa</Link>
                      </Button>
                    </>
                  )}
                </div>
                {s.items.length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade cadastrada para esta empresa.</div>
                ) : (
                  <ul className="divide-y bg-card rounded-lg border">
                    {s.items.map((a) => {
                      const overdue = isOverdue(a);
                      const done = a.status === "concluida";
                      return (
                        <li key={a.id} className={`p-3 flex items-center justify-between gap-3 ${overdue ? "bg-red-50/40" : ""} ${done ? "opacity-70" : ""}`}>
                          <button onClick={() => onEdit(a)} className="flex-1 text-left min-w-0">
                            <div className={`font-medium text-sm truncate ${done ? "line-through" : ""}`}>{a.title}</div>
                            <div className="text-xs text-muted-foreground">{ACTIVITY_TYPES[a.activity_type]} · {fmtDate(a.activity_date)}{a.start_time ? ` · ${a.start_time.slice(0, 5)}` : ""}</div>
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {priorityBadge(a.priority)}
                            {statusBadge(a.status)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- DIALOG ----------
function ActivityDialog({ open, onOpenChange, initial, prefill, companies, onSave, saving }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  initial: Activity | null; prefill: Partial<Activity> | null;
  companies: Array<{ id: string; nome: string }>;
  onSave: (payload: any) => void; saving: boolean;
}) {
  const empty = {
    title: "", activity_type: "tarefa_interna", company_id: "", branch_id: "",
    responsible_name: "", activity_date: today(), start_time: "", end_time: "",
    due_date: "", priority: "media", status: "pendente", description: "", notes: "",
    meeting_link: "", location: "", reminder_type: "none", recurrence_type: "none", recurrence_until: "",
  };
  const [form, setForm] = useState<any>(empty);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        ...empty, ...initial,
        company_id: initial.company_id ?? "",
        start_time: initial.start_time?.slice(0, 5) ?? "",
        end_time: initial.end_time?.slice(0, 5) ?? "",
        due_date: initial.due_date ?? "",
        recurrence_until: initial.recurrence_until ?? "",
        reminder_type: initial.reminder_type ?? "none",
      } : { ...empty, ...(prefill ?? {}) });
    }
  }, [open, initial, prefill]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const isMeeting = form.activity_type === "reuniao";
  const isDelivery = ENTREGA_TYPES.includes(form.activity_type);

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
            <Label>Tipo *</Label>
            <Select value={form.activity_type} onValueChange={(v) => set("activity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ACTIVITY_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresa cliente {isDelivery && <span className="text-xs text-muted-foreground">(recomendado)</span>}</Label>
            <Select value={form.company_id || "none"} onValueChange={(v) => set("company_id", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem empresa (interna)</SelectItem>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsible_name ?? ""} onChange={(e) => set("responsible_name", e.target.value)} />
          </div>
          <div>
            <Label>Data *</Label>
            <Input type="date" value={form.activity_date} onChange={(e) => set("activity_date", e.target.value)} />
          </div>
          {isMeeting && (
            <>
              <div>
                <Label>Horário inicial</Label>
                <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
              </div>
              <div>
                <Label>Horário final</Label>
                <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
              </div>
            </>
          )}
          {!isMeeting && (
            <div>
              <Label>Horário</Label>
              <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
            </div>
          )}
          <div>
            <Label>Prazo final</Label>
            <Input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div>
            <Label>Prioridade *</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status *</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isMeeting && (
            <>
              <div className="md:col-span-2">
                <Label>Link da reunião</Label>
                <Input placeholder="https://meet..." value={form.meeting_link ?? ""} onChange={(e) => set("meeting_link", e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <Label>Local</Label>
                <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
              </div>
            </>
          )}
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
            <div className="md:col-span-2">
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
          <div className="md:col-span-2 border-t pt-4">
            <Label>Arquivos da atividade</Label>
            {initial ? (
              <div className="mt-2">
                <AttachmentsPanel
                  companyId={(form.company_id || initial.company_id) as string | null}
                  module="activity"
                  recordId={initial.id}
                />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Salve a atividade para anexar arquivos.
              </p>
            )}
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
