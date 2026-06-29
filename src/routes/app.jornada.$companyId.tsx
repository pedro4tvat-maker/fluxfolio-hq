import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2, Calendar, CheckCircle2, Clock, Plus, Trash2, ChevronLeft,
  ListChecks, FileBox, Layers, AlertTriangle, Pause, Circle,
} from "lucide-react";
import {
  PROFESSIONAL_JOURNEY_PHASES, applyJourneyToCompany,
} from "@/lib/journey-stages";

export const Route = createFileRoute("/app/jornada/$companyId")({
  component: JornadaCompanyPage,
});

const sb = supabase as any;

const PHASE_STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  nao_iniciada: { label: "Não iniciada", cls: "bg-muted text-muted-foreground", icon: Circle },
  em_andamento: { label: "Em andamento", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400", icon: Clock },
  atencao:      { label: "Atenção",      cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400", icon: AlertTriangle },
  atrasada:     { label: "Atrasada",     cls: "bg-red-500/15 text-red-700 dark:text-red-400", icon: AlertTriangle },
  pausada:      { label: "Pausada",      cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400", icon: Pause },
  concluida:    { label: "Concluída",    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", icon: CheckCircle2 },
};

function JornadaCompanyPage() {
  const { companyId } = Route.useParams();
  const { user, isConsultant } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: consultant } = useQuery({
    queryKey: ["consultant-me", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data } = await sb.from("companies")
        .select("id, nome, cnpj, responsavel, consultancy_stage, consultancy_progress, data_inicio")
        .eq("id", companyId).maybeSingle();
      return data;
    },
  });

  const { data: journey, refetch: refetchJourney } = useQuery({
    queryKey: ["company-journey", companyId],
    queryFn: async () => {
      const { data } = await sb.from("company_journeys")
        .select("*").eq("company_id", companyId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: phases = [], refetch: refetchPhases } = useQuery({
    queryKey: ["journey-phases", journey?.id],
    enabled: !!journey?.id,
    queryFn: async () => {
      const { data } = await sb.from("company_journey_phases")
        .select("*").eq("journey_id", journey.id)
        .order("phase_order", { ascending: true });
      return data ?? [];
    },
  });

  const phaseIds = useMemo(() => phases.map((p: any) => p.id), [phases]);

  const { data: checklist = [], refetch: refetchChecklist } = useQuery({
    queryKey: ["journey-checklist", phaseIds],
    enabled: phaseIds.length > 0,
    queryFn: async () => {
      const { data } = await sb.from("company_journey_checklist")
        .select("*").in("journey_phase_id", phaseIds)
        .order("position", { ascending: true });
      return data ?? [];
    },
  });

  const { data: deliverables = [], refetch: refetchDeliverables } = useQuery({
    queryKey: ["journey-deliverables", phaseIds],
    enabled: phaseIds.length > 0,
    queryFn: async () => {
      const { data } = await sb.from("company_journey_deliverables")
        .select("*").in("journey_phase_id", phaseIds)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: pendings = [] } = useQuery({
    queryKey: ["company-pendings", companyId],
    queryFn: async () => {
      const { data } = await sb.from("client_pending_items")
        .select("id, title, status, due_date").eq("company_id", companyId);
      return data ?? [];
    },
  });

  const { data: nextActs = [] } = useQuery({
    queryKey: ["company-acts", companyId, consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb.from("consultancy_activities")
        .select("id, title, activity_date, status")
        .eq("consultant_id", consultant!.id).eq("company_id", companyId)
        .neq("status", "concluida").is("deleted_at", null).order("activity_date", { ascending: true }).limit(5);
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const total = phases.length || 1;
    const done = phases.filter((p: any) => p.status === "concluida").length;
    const progress = Math.round((done / total) * 100);
    const openDeliv = deliverables.filter((d: any) => !["entregue", "revisado", "cancelado"].includes(d.status)).length;
    const openPend = pendings.filter((p: any) => !["resolvido", "cancelado"].includes(p.status)).length;
    return { progress, done, total: phases.length, openDeliv, openPend };
  }, [phases, deliverables, pendings]);

  const applyDefault = useMutation({
    mutationFn: async () => {
      if (!consultant?.id) throw new Error("Sem consultor");
      return applyJourneyToCompany({
        consultantId: consultant.id, companyId,
        phases: PROFESSIONAL_JOURNEY_PHASES,
      });
    },
    onSuccess: () => {
      toast.success("Jornada criada");
      refetchJourney(); refetchPhases();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (!isConsultant) {
    return <div className="text-center py-12 text-muted-foreground">Acesso restrito ao consultor.</div>;
  }

  if (!journey) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/jornada" })}>
          <ChevronLeft className="size-4" /> Voltar à Jornada
        </Button>
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Layers className="size-10 text-muted-foreground mx-auto" />
            <div>
              <h2 className="text-lg font-semibold">{company?.nome ?? "Empresa"}</h2>
              <p className="text-sm text-muted-foreground">
                Esta empresa ainda não tem uma jornada estruturada. Aplique o método padrão para começar.
              </p>
            </div>
            <Button onClick={() => applyDefault.mutate()} disabled={applyDefault.isPending}>
              <ListChecks className="size-4" /> Aplicar método padrão (15 fases)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/jornada" })}>
        <ChevronLeft className="size-4" /> Voltar à Jornada
      </Button>

      {/* Cabeçalho */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Building2 className="size-3" /> Jornada da Consultoria
              </div>
              <h1 className="text-2xl font-display font-bold mt-1">{company?.nome}</h1>
              <div className="text-sm text-muted-foreground">
                {[company?.cnpj, company?.responsavel].filter(Boolean).join(" • ")}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button asChild size="sm" variant="outline">
                <Link to="/app/empresa/$id" params={{ id: companyId }}><Building2 className="size-4" /> Ver empresa</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/app/agenda"><Calendar className="size-4" /> Agenda</Link>
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <Stat label="Progresso geral" value={`${stats.progress}%`}>
              <Progress value={stats.progress} className="h-1.5 mt-2" />
              <div className="text-xs text-muted-foreground mt-1">{stats.done}/{stats.total} fases concluídas</div>
            </Stat>
            <Stat label="Data de início" value={journey.start_date ? new Date(journey.start_date).toLocaleDateString("pt-BR") : "—"} />
            <Stat label="Entregáveis em aberto" value={String(stats.openDeliv)} />
            <Stat label="Pendências do cliente" value={String(stats.openPend)} />
          </div>

          {nextActs.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Próxima ação</div>
              <div className="flex flex-wrap gap-2">
                {nextActs.slice(0, 3).map((a: any) => (
                  <Badge key={a.id} variant="secondary">
                    {a.title}{a.activity_date && ` • ${new Date(a.activity_date).toLocaleDateString("pt-BR")}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linha do tempo */}
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4">Linha do tempo</h2>
          <div className="flex gap-1 overflow-x-auto pb-3">
            {phases.map((p: any) => {
              const m = PHASE_STATUS[p.status] ?? PHASE_STATUS.nao_iniciada;
              return (
                <div key={p.id} className="flex-1 min-w-[120px]">
                  <div className={`h-2 rounded-full ${m.cls}`} />
                  <div className="text-[11px] font-medium mt-1 truncate" title={p.phase_name}>{p.phase_name}</div>
                  <div className="text-[10px] text-muted-foreground">{m.label}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Fases detalhadas */}
      <div className="space-y-4">
        {phases.map((p: any) => (
          <PhaseCard
            key={p.id} phase={p}
            checklist={checklist.filter((c: any) => c.journey_phase_id === p.id)}
            deliverables={deliverables.filter((d: any) => d.journey_phase_id === p.id)}
            companyId={companyId}
            onChanged={() => { refetchChecklist(); refetchDeliverables(); refetchPhases(); qc.invalidateQueries({ queryKey: ["jornada-companies"] }); }}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {children}
    </div>
  );
}

function PhaseCard({ phase, checklist, deliverables, companyId, onChanged }: {
  phase: any; checklist: any[]; deliverables: any[]; companyId: string; onChanged: () => void;
}) {
  const [addingCheck, setAddingCheck] = useState(false);
  const [addingDeliv, setAddingDeliv] = useState(false);
  const m = PHASE_STATUS[phase.status] ?? PHASE_STATUS.nao_iniciada;
  const Icon = m.icon;

  const updatePhaseStatus = async (status: string) => {
    const patch: any = { status };
    if (status === "concluida") patch.completed_at = new Date().toISOString();
    if (status === "em_andamento" && !phase.start_date) patch.start_date = new Date().toISOString().slice(0, 10);
    const { error } = await sb.from("company_journey_phases").update(patch).eq("id", phase.id);
    if (error) toast.error(error.message);
    else { toast.success("Fase atualizada"); onChanged(); }
  };

  const toggleCheck = async (item: any) => {
    const newStatus = item.status === "concluido" ? "pendente" : "concluido";
    const patch: any = { status: newStatus };
    if (newStatus === "concluido") patch.completed_at = new Date().toISOString();
    const { error } = await sb.from("company_journey_checklist").update(patch).eq("id", item.id);
    if (error) toast.error(error.message); else onChanged();
  };

  const delCheck = async (id: string) => {
    await sb.from("company_journey_checklist").delete().eq("id", id); onChanged();
  };
  const delDeliv = async (id: string) => {
    await sb.from("company_journey_deliverables").delete().eq("id", id); onChanged();
  };

  const checkDone = checklist.filter((c) => c.status === "concluido").length;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">#{phase.phase_order + 1}</span>
              <h3 className="font-semibold">{phase.phase_name}</h3>
              <Badge className={m.cls} variant="outline">
                <Icon className="size-3 mr-1 inline" />{m.label}
              </Badge>
            </div>
            {phase.objective && <p className="text-sm text-muted-foreground mt-1">{phase.objective}</p>}
            <div className="text-xs text-muted-foreground mt-1">
              {phase.start_date && <>Início: {new Date(phase.start_date).toLocaleDateString("pt-BR")} • </>}
              {phase.due_date && <>Prazo: {new Date(phase.due_date).toLocaleDateString("pt-BR")}</>}
            </div>
          </div>
          <Select value={phase.status} onValueChange={updatePhaseStatus}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PHASE_STATUS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <ListChecks className="size-4" /> Checklist
                <span className="text-xs text-muted-foreground">({checkDone}/{checklist.length})</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAddingCheck(true)}><Plus className="size-3" /></Button>
            </div>
            <div className="space-y-1">
              {checklist.length === 0 && <div className="text-xs text-muted-foreground">Nenhum item.</div>}
              {checklist.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-sm group">
                  <input type="checkbox" className="mt-1" checked={c.status === "concluido"} onChange={() => toggleCheck(c)} />
                  <div className="flex-1 min-w-0">
                    <div className={c.status === "concluido" ? "line-through text-muted-foreground" : ""}>{c.title}</div>
                    {c.due_date && <div className="text-[10px] text-muted-foreground">Prazo: {new Date(c.due_date).toLocaleDateString("pt-BR")}</div>}
                  </div>
                  <Button size="icon" variant="ghost" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => delCheck(c.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Entregáveis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium flex items-center gap-2">
                <FileBox className="size-4" /> Entregáveis
                <span className="text-xs text-muted-foreground">({deliverables.length})</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setAddingDeliv(true)}><Plus className="size-3" /></Button>
            </div>
            <div className="space-y-1">
              {deliverables.length === 0 && <div className="text-xs text-muted-foreground">Nenhum entregável.</div>}
              {deliverables.map((d) => (
                <div key={d.id} className="flex items-start gap-2 text-sm group border rounded p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{d.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px]">{d.status}</Badge>
                      {d.due_date && <span className="text-[10px] text-muted-foreground">Prazo: {new Date(d.due_date).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => delDeliv(d.id)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {addingCheck && (
          <AddChecklistDialog phaseId={phase.id} onClose={() => setAddingCheck(false)} onSaved={onChanged} />
        )}
        {addingDeliv && (
          <AddDeliverableDialog phaseId={phase.id} companyId={companyId} onClose={() => setAddingDeliv(false)} onSaved={onChanged} />
        )}
      </CardContent>
    </Card>
  );
}

function AddChecklistDialog({ phaseId, onClose, onSaved }: { phaseId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState("consultor");

  const save = async () => {
    if (!title.trim()) return toast.error("Informe o título");
    const { error } = await sb.from("company_journey_checklist").insert({
      journey_phase_id: phaseId, title: title.trim(),
      due_date: dueDate || null, responsible_type: responsible, status: "pendente",
    });
    if (error) toast.error(error.message);
    else { toast.success("Item adicionado"); onSaved(); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo item de checklist</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultor">Consultor</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDeliverableDialog({ phaseId, companyId, onClose, onSaved }: {
  phaseId: string; companyId: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsible, setResponsible] = useState("consultor");
  const [status, setStatus] = useState("pendente");

  const save = async () => {
    if (!title.trim()) return toast.error("Informe o título");
    const { error } = await sb.from("company_journey_deliverables").insert({
      journey_phase_id: phaseId, company_id: companyId,
      title: title.trim(), description: description || null,
      due_date: dueDate || null, responsible_type: responsible, status,
    });
    if (error) toast.error(error.message);
    else { toast.success("Entregável adicionado"); onSaved(); onClose(); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo entregável</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <Select value={responsible} onValueChange={setResponsible}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consultor">Consultor</SelectItem>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="ambos">Ambos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_producao">Em produção</SelectItem>
                <SelectItem value="entregue">Entregue</SelectItem>
                <SelectItem value="revisado">Revisado</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
