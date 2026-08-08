import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Pencil, Trash2, Check, ChevronLeft, ChevronRight, MapPin, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";

export const COMPANY_AGENDA_SECTIONS = [
  { id: "calendario", label: "Calendário" },
  { id: "reunioes", label: "Reuniões" },
] as const;

const TYPES: Record<string, string> = {
  reuniao: "Reunião",
  pagamento: "Pagamento / vencimento",
  recebimento: "Recebimento",
  entrega: "Entrega / prazo",
  compra: "Compra / pedido",
  visita: "Visita / cliente",
  tarefa: "Tarefa interna",
  outro: "Outro",
};

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
  { id: "cancelada", label: "Cancelada", color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
];

const REMINDERS = [
  { id: "nenhum", label: "Sem lembrete" },
  { id: "1h", label: "1 hora antes" },
  { id: "1d", label: "1 dia antes" },
  { id: "3d", label: "3 dias antes" },
  { id: "7d", label: "7 dias antes" },
];

export type CompanyActivity = {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  activity_date: string;
  activity_type: string;
  priority: string;
  status: string;
  responsible: string | null;
  location: string | null;
  meeting_link: string | null;
  reminder: string | null;
  completed_at: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayOf = (ts: string) => isoDay(new Date(ts));
const timeOf = (ts: string) => {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const todayKey = () => isoDay(new Date());

function priorityBadge(p: string) {
  const x = PRIORITIES.find((i) => i.id === p) ?? PRIORITIES[1];
  return <Badge variant="outline" className={x.color}>{x.label}</Badge>;
}
function statusBadge(s: string) {
  const x = STATUSES.find((i) => i.id === s) ?? STATUSES[0];
  return <Badge variant="outline" className={x.color}>{x.label}</Badge>;
}
function colorOf(a: CompanyActivity) {
  if (a.status === "concluida") return "bg-emerald-100 border-emerald-200 text-emerald-900";
  if (a.status === "cancelada") return "bg-zinc-100 border-zinc-200 text-zinc-600";
  if (a.priority === "urgente") return "bg-red-100 border-red-200 text-red-900";
  if (a.activity_type === "reuniao") return "bg-blue-100 border-blue-200 text-blue-900";
  if (a.activity_type === "tarefa") return "bg-slate-100 border-slate-200 text-slate-800";
  return "bg-violet-100 border-violet-200 text-violet-900";
}

export function CompanyAgenda({ section }: { section: string }) {
  const { user } = useAuth();
  const { selected: companyId, companies } = useSelectedCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyActivity | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  const { data: activities = [] } = useQuery({
    queryKey: ["company-agenda", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_activities")
        .select("*")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("activity_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CompanyActivity[];
    },
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<CompanyActivity> & { id?: string }) => {
      if (!companyId) throw new Error("Nenhuma empresa selecionada");
      const body: Record<string, unknown> = { ...payload, company_id: companyId };
      Object.keys(body).forEach((k) => body[k] === "" && (body[k] = null));
      if (payload.id) {
        const { id, ...rest } = body as Record<string, unknown> & { id: string };
        const { error } = await supabase.from("company_activities").update(rest as never).eq("id", id).is("deleted_at", null);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_activities").insert({ ...body, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-agenda"] });
      toast.success("Atividade salva");
      setOpen(false); setEditing(null); setPrefillDate(null);
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao salvar"),
  });

  const archiveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_activities").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-agenda"] }); toast.success("Atividade removida da agenda"); },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao remover"),
  });

  const concludeMut = useMutation({
    mutationFn: async (a: CompanyActivity) => {
      const { error } = await supabase
        .from("company_activities")
        .update({ status: "concluida", completed_at: new Date().toISOString() })
        .eq("id", a.id).is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["company-agenda"] }); toast.success("Atividade concluída"); },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Erro ao concluir"),
  });

  const openNew = (date?: string) => { setEditing(null); setPrefillDate(date ?? todayKey()); setOpen(true); };
  const openEdit = (a: CompanyActivity) => { setEditing(a); setPrefillDate(null); setOpen(true); };

  const companyName = companies?.find((c) => c.id === companyId)?.nome;

  if (!companyId) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center max-w-xl mx-auto">
        <h2 className="font-display font-semibold">Nenhuma empresa selecionada</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecione uma empresa para usar a agenda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="font-display text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" /> Agenda
          </h1>
          <p className="text-sm text-muted-foreground">{companyName ?? "Sua empresa"}</p>
        </div>
        <Button onClick={() => openNew()}><Plus className="size-4" /> Nova atividade</Button>
      </div>

      {section === "reunioes" ? (
        <MeetingsList
          activities={activities.filter((a) => a.activity_type === "reuniao")}
          onEdit={openEdit}
          onConclude={(a) => concludeMut.mutate(a)}
          onArchive={(id) => archiveMut.mutate(id)}
        />
      ) : (
        <CalendarView
          activities={activities}
          onNewOnDate={openNew}
          onSelect={openEdit}
        />
      )}

      <UpcomingList
        activities={activities}
        onEdit={openEdit}
        onConclude={(a) => concludeMut.mutate(a)}
        onArchive={(id) => archiveMut.mutate(id)}
      />

      <ActivityDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setPrefillDate(null); } }}
        editing={editing}
        prefillDate={prefillDate}
        companyId={companyId}
        saving={saveMut.isPending}
        onSave={(payload) => saveMut.mutate(payload)}
      />
    </div>
  );
}

function CalendarView({ activities, onNewOnDate, onSelect }: {
  activities: CompanyActivity[];
  onNewOnDate: (d: string) => void;
  onSelect: (a: CompanyActivity) => void;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [dayModal, setDayModal] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, CompanyActivity[]>();
    activities.forEach((a) => {
      const k = dayOf(a.activity_date);
      m.set(k, [...(m.get(k) ?? []), a]);
    });
    return m;
  }, [activities]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const tk = todayKey();

  return (
    <div className="bg-card border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="font-display font-semibold capitalize">
          {cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month - 1, 1))}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Hoje</Button>
          <Button size="icon" variant="outline" onClick={() => setCursor(new Date(year, month + 1, 1))}><ChevronRight className="size-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border">
        {weekdays.map((w) => (
          <div key={w} className="bg-muted text-[11px] font-medium text-muted-foreground text-center py-1">{w}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="bg-card min-h-[92px]" />;
          const key = isoDay(d);
          const items = (byDate.get(key) ?? []).slice().sort((a, b) => a.activity_date.localeCompare(b.activity_date));
          return (
            <div key={key} className="bg-card min-h-[92px] p-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setDayModal(key)}
                  className={`text-[11px] font-medium rounded px-1 ${key === tk ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {d.getDate()}
                </button>
                <button onClick={() => onNewOnDate(key)} className="text-[10px] text-primary hover:underline">+</button>
              </div>
              {items.slice(0, 3).map((a) => (
                <button key={a.id} onClick={() => onSelect(a)} className={`w-full text-left text-[10px] rounded px-1 py-0.5 border truncate ${colorOf(a)}`}>
                  {timeOf(a.activity_date)} {a.title}
                </button>
              ))}
              {items.length > 3 && (
                <button onClick={() => setDayModal(key)} className="text-[10px] text-primary hover:underline font-medium">
                  +{items.length - 3} mais
                </button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={dayModal !== null} onOpenChange={(o) => !o && setDayModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {dayModal ? new Date(dayModal + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : ""}
            </DialogTitle>
          </DialogHeader>
          {dayModal && (() => {
            const items = (byDate.get(dayModal) ?? []).slice().sort((a, b) => a.activity_date.localeCompare(b.activity_date));
            return (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="text-xs text-muted-foreground">{items.length} atividade(s)</div>
                  <Button size="sm" onClick={() => { const d = dayModal; setDayModal(null); onNewOnDate(d); }}>
                    <Plus className="size-3" /> Nova atividade
                  </Button>
                </div>
                {items.length === 0 ? (
                  <div className="text-muted-foreground text-sm py-6 text-center">Sem atividades neste dia.</div>
                ) : (
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {items.map((a) => (
                      <button key={a.id} onClick={() => { setDayModal(null); onSelect(a); }} className={`w-full text-left rounded-lg border p-3 ${colorOf(a)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">{timeOf(a.activity_date)} · {a.title}</div>
                          {priorityBadge(a.priority)}
                        </div>
                        <div className="text-xs mt-1 opacity-80">{TYPES[a.activity_type] ?? a.activity_type}</div>
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

function ActivityRow({ a, onEdit, onConclude, onArchive }: {
  a: CompanyActivity;
  onEdit: (a: CompanyActivity) => void;
  onConclude: (a: CompanyActivity) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border rounded-lg p-3">
      <div className="min-w-0">
        <div className="font-medium truncate">{a.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {new Date(a.activity_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          {" · "}{TYPES[a.activity_type] ?? a.activity_type}
          {a.responsible ? ` · ${a.responsible}` : ""}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">{priorityBadge(a.priority)}{statusBadge(a.status)}</div>
      </div>
      <div className="flex gap-1 shrink-0">
        {a.status !== "concluida" && (
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Concluir" onClick={() => onConclude(a)}><Check className="size-4" /></Button>
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => onEdit(a)}><Pencil className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Remover da agenda" onClick={() => onArchive(a.id)}><Trash2 className="size-4" /></Button>
      </div>
    </div>
  );
}

function UpcomingList({ activities, onEdit, onConclude, onArchive }: {
  activities: CompanyActivity[];
  onEdit: (a: CompanyActivity) => void;
  onConclude: (a: CompanyActivity) => void;
  onArchive: (id: string) => void;
}) {
  const now = Date.now();
  const items = activities
    .filter((a) => new Date(a.activity_date).getTime() >= now - 86400000 && a.status !== "cancelada")
    .slice(0, 20);
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="font-display font-semibold mb-3">Próximas atividades</div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade futura cadastrada.</div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => <ActivityRow key={a.id} a={a} onEdit={onEdit} onConclude={onConclude} onArchive={onArchive} />)}
        </div>
      )}
    </div>
  );
}

function MeetingsList({ activities, onEdit, onConclude, onArchive }: {
  activities: CompanyActivity[];
  onEdit: (a: CompanyActivity) => void;
  onConclude: (a: CompanyActivity) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="font-display font-semibold mb-3">Reuniões</div>
      {activities.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma reunião cadastrada.</div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <div key={a.id} className="space-y-1">
              <ActivityRow a={a} onEdit={onEdit} onConclude={onConclude} onArchive={onArchive} />
              {(a.location || a.meeting_link) && (
                <div className="text-xs text-muted-foreground flex gap-3 pl-3">
                  {a.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{a.location}</span>}
                  {a.meeting_link && (
                    <a href={a.meeting_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="size-3" /> Link da reunião
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityDialog({ open, onOpenChange, editing, prefillDate, companyId, saving, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: CompanyActivity | null;
  prefillDate: string | null;
  companyId: string;
  saving: boolean;
  onSave: (payload: Partial<CompanyActivity> & { id?: string }) => void;
}) {
  const baseDate = editing ? dayOf(editing.activity_date) : (prefillDate ?? todayKey());
  const baseTime = editing ? timeOf(editing.activity_date) : "09:00";
  const key = editing?.id ?? `new-${baseDate}`;

  const [form, setForm] = useState(() => ({
    title: editing?.title ?? "",
    description: editing?.description ?? "",
    date: baseDate,
    time: baseTime,
    activity_type: editing?.activity_type ?? "reuniao",
    priority: editing?.priority ?? "media",
    status: editing?.status ?? "pendente",
    responsible: editing?.responsible ?? "",
    location: editing?.location ?? "",
    meeting_link: editing?.meeting_link ?? "",
    reminder: editing?.reminder ?? "nenhum",
  }));
  const [formKey, setFormKey] = useState(key);
  if (formKey !== key) {
    setFormKey(key);
    setForm({
      title: editing?.title ?? "",
      description: editing?.description ?? "",
      date: baseDate,
      time: baseTime,
      activity_type: editing?.activity_type ?? "reuniao",
      priority: editing?.priority ?? "media",
      status: editing?.status ?? "pendente",
      responsible: editing?.responsible ?? "",
      location: editing?.location ?? "",
      meeting_link: editing?.meeting_link ?? "",
      reminder: editing?.reminder ?? "nenhum",
    });
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.title.trim()) { toast.error("Informe o título da atividade"); return; }
    if (!form.date) { toast.error("Informe a data"); return; }
    const dt = new Date(`${form.date}T${form.time || "00:00"}:00`);
    onSave({
      id: editing?.id,
      title: form.title.trim(),
      description: form.description,
      activity_date: dt.toISOString(),
      activity_type: form.activity_type,
      priority: form.priority,
      status: form.status,
      responsible: form.responsible,
      location: form.location,
      meeting_link: form.meeting_link,
      reminder: form.reminder,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar atividade" : "Nova atividade"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Reunião com fornecedor" />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <Label>Hora</Label>
            <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.activity_type} onValueChange={(v) => set("activity_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPES).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsável</Label>
            <Input value={form.responsible} onChange={(e) => set("responsible", e.target.value)} placeholder="Nome do responsável" />
          </div>
          <div>
            <Label>Local</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Local presencial" />
          </div>
          <div>
            <Label>Link da reunião</Label>
            <Input value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>Lembrete</Label>
            <Select value={form.reminder} onValueChange={(v) => set("reminder", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REMINDERS.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Descrição</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
        </div>

        {editing && (
          <div className="border-t pt-3">
            <AttachmentsPanel companyId={companyId} module="agenda_empresa" recordId={editing.id} compact />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
