import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Building2, Calendar, AlertTriangle, CheckCircle2, Clock, Pause,
  TrendingUp, Users, FileWarning, FileText, Settings2, Layers,
  Search, Plus, ArrowRight, Download, Eye, ListChecks,
} from "lucide-react";
import {
  DEFAULT_JOURNEY_STAGES, PROFESSIONAL_JOURNEY_PHASES,
  applyJourneyToCompany, type JourneyStage,
} from "@/lib/journey-stages";

export const Route = createFileRoute("/app/jornada")({ component: JornadaPage });

const sb = supabase as any;
export const JOURNEY_STAGES = DEFAULT_JOURNEY_STAGES;

type CompanyRow = {
  id: string;
  nome: string;
  cnpj: string | null;
  responsavel: string | null;
  segmento: string | null;
  consultancy_stage: string | null;
  consultancy_progress: number | null;
  consultancy_status: string | null;
  data_inicio: string | null;
  updated_at: string | null;
};

type HealthStatus = "em_dia" | "atencao" | "atrasado" | "critico" | "pausado" | "concluido";

const STATUS_META: Record<HealthStatus, { label: string; cls: string; icon: any }> = {
  em_dia:    { label: "Em dia",    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  atencao:   { label: "Atenção",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",        icon: AlertTriangle },
  atrasado:  { label: "Atrasado",  cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",    icon: Clock },
  critico:   { label: "Crítico",   cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",                icon: AlertTriangle },
  pausado:   { label: "Pausado",   cls: "bg-muted text-muted-foreground border-border",                                   icon: Pause },
  concluido: { label: "Concluído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",             icon: CheckCircle2 },
};

function JornadaPage() {
  const { user, isConsultant } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [applyOpen, setApplyOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const { data: consultant } = useQuery({
    queryKey: ["consultant-me", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: customStages = [] } = useQuery({
    queryKey: ["journey-stages", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb
        .from("consultancy_journey_stages")
        .select("stage_key, label, position")
        .eq("consultant_id", consultant.id)
        .order("position", { ascending: true });
      return (data ?? []) as { stage_key: string; label: string; position: number }[];
    },
  });

  const stages: JourneyStage[] = useMemo(() => {
    if (customStages.length === 0) return [...DEFAULT_JOURNEY_STAGES];
    return customStages.map((r) => ({ v: r.stage_key, l: r.label }));
  }, [customStages]);

  const stageLabel = (v: string | null | undefined) =>
    !v ? "—" : (stages.find((s) => s.v === v)?.l ?? DEFAULT_JOURNEY_STAGES.find((s) => s.v === v)?.l ?? v);

  const { data: companies = [] } = useQuery({
    queryKey: ["jornada-companies", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb
        .from("consultant_company_links")
        .select("company:companies(id, nome, cnpj, responsavel, segmento, consultancy_stage, consultancy_progress, consultancy_status, data_inicio, updated_at)")
        .eq("consultant_id", consultant.id)
        .eq("status", "approved");
      return ((data ?? []).map((r: any) => r.company).filter(Boolean)) as CompanyRow[];
    },
  });

  const companyIds = useMemo(() => companies.map((c) => c.id), [companies]);

  const { data: pendings = [] } = useQuery({
    queryKey: ["jornada-pendings", companyIds],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const { data } = await sb.from("client_pending_items")
        .select("id, company_id, status, due_date, title")
        .in("company_id", companyIds);
      return data ?? [];
    },
  });

  const { data: acts = [] } = useQuery({
    queryKey: ["jornada-acts", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb.from("consultancy_activities")
        .select("id, company_id, title, activity_date, status, activity_type")
        .eq("consultant_id", consultant.id)
        .order("activity_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: actionPlans = [] } = useQuery({
    queryKey: ["jornada-plans", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb.from("action_plans")
        .select("id, company_id, status, due_date")
        .eq("consultant_id", consultant.id);
      return data ?? [];
    },
  });

  // Enrich each company with derived health, next action, pendings, deliverables
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const enriched = useMemo(() => {
    return companies.map((c) => {
      const cPendings = pendings.filter((p: any) => p.company_id === c.id && !["resolvido", "cancelado"].includes(p.status));
      const cActs = acts.filter((a: any) => a.company_id === c.id && a.status !== "concluida" && a.status !== "cancelada");
      const cPlans = actionPlans.filter((p: any) => p.company_id === c.id && !["concluido", "cancelado"].includes(p.status));

      const nextAct = cActs[0];
      const hasOverdue =
        cPendings.some((p: any) => p.due_date && new Date(p.due_date) < today) ||
        cPlans.some((p: any) => p.due_date && new Date(p.due_date) < today) ||
        cActs.some((a: any) => a.activity_date && new Date(a.activity_date) < today);

      const updatedAgoDays = c.updated_at
        ? Math.floor((today.getTime() - new Date(c.updated_at).getTime()) / 86400000) : 999;

      let status: HealthStatus = "em_dia";
      if (c.consultancy_status === "pausado") status = "pausado";
      else if (c.consultancy_status === "encerrado" || c.consultancy_stage === "encerrado") status = "concluido";
      else if (hasOverdue && updatedAgoDays > 21 && !nextAct) status = "critico";
      else if (hasOverdue) status = "atrasado";
      else if (cPendings.length > 0 || !nextAct) status = "atencao";

      return {
        ...c,
        _pendings: cPendings.length,
        _nextAct: nextAct,
        _hasOverdue: hasOverdue,
        _status: status,
        _progress: c.consultancy_progress ?? 0,
      };
    });
  }, [companies, pendings, acts, actionPlans]);

  // KPI counters
  const kpi = useMemo(() => {
    const byStageCount = (key: string) => enriched.filter((c) => c.consultancy_stage === key).length;
    return {
      onboarding: byStageCount("novo_cliente") + byStageCount("onboarding"),
      diagnostico: byStageCount("diagnostico_inicial"),
      organizacao: byStageCount("organizacao_financeira"),
      acompanhamento: byStageCount("acompanhamento_mensal"),
      atrasados: enriched.filter((c) => c._hasOverdue).length,
      semProxAcao: enriched.filter((c) => !c._nextAct).length,
      comPendencias: enriched.filter((c) => c._pendings > 0).length,
      emRisco: enriched.filter((c) => c._status === "critico" || c._status === "atrasado").length,
    };
  }, [enriched]);

  // Filtered list
  const filtered = useMemo(() => {
    return enriched.filter((c) => {
      if (search && !`${c.nome} ${c.cnpj ?? ""} ${c.responsavel ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (stageFilter !== "__all__" && c.consultancy_stage !== stageFilter) return false;
      if (statusFilter !== "__all__") {
        if (statusFilter === "atrasados" && !c._hasOverdue) return false;
        else if (statusFilter === "pendencias" && c._pendings === 0) return false;
        else if (statusFilter === "sem_acao" && c._nextAct) return false;
        else if (statusFilter in STATUS_META && c._status !== statusFilter) return false;
      }
      return true;
    });
  }, [enriched, search, stageFilter, statusFilter]);

  function exportCsv() {
    const headers = ["Empresa", "CNPJ", "Responsável", "Fase", "Progresso %", "Status", "Próxima ação", "Pendências"];
    const rows = filtered.map((c) => [
      c.nome, c.cnpj ?? "", c.responsavel ?? "", stageLabel(c.consultancy_stage),
      String(c._progress), STATUS_META[c._status].label,
      c._nextAct?.title ?? "—", String(c._pendings),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `jornada-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (!isConsultant) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        A Jornada da Consultoria é exclusiva do consultor.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho executivo */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Jornada da Consultoria</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o avanço de cada empresa cliente dentro do seu método de consultoria.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/app/agenda" })}>
            <Plus className="size-4" /> Novo procedimento
          </Button>
          <Button size="sm" variant="outline" onClick={() => setApplyOpen(true)}>
            <Layers className="size-4" /> Aplicar modelo de jornada
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCustomizeOpen(true)}>
            <Settings2 className="size-4" /> Personalizar método
          </Button>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-4" /> Exportar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Em onboarding" value={kpi.onboarding} icon={Users} color="text-blue-600"
          onClick={() => { setStageFilter("novo_cliente"); setStatusFilter("__all__"); }} />
        <KpiCard label="Em diagnóstico" value={kpi.diagnostico} icon={FileText} color="text-violet-600"
          onClick={() => { setStageFilter("diagnostico_inicial"); setStatusFilter("__all__"); }} />
        <KpiCard label="Organização financeira" value={kpi.organizacao} icon={TrendingUp} color="text-emerald-600"
          onClick={() => { setStageFilter("organizacao_financeira"); setStatusFilter("__all__"); }} />
        <KpiCard label="Acompanhamento mensal" value={kpi.acompanhamento} icon={Calendar} color="text-cyan-600"
          onClick={() => { setStageFilter("acompanhamento_mensal"); setStatusFilter("__all__"); }} />
        <KpiCard label="Entregas atrasadas" value={kpi.atrasados} icon={Clock} color="text-orange-600"
          onClick={() => { setStageFilter("__all__"); setStatusFilter("atrasados"); }} />
        <KpiCard label="Sem próxima ação" value={kpi.semProxAcao} icon={AlertTriangle} color="text-amber-600"
          onClick={() => { setStageFilter("__all__"); setStatusFilter("sem_acao"); }} />
        <KpiCard label="Com pendências" value={kpi.comPendencias} icon={FileWarning} color="text-rose-600"
          onClick={() => { setStageFilter("__all__"); setStatusFilter("pendencias"); }} />
        <KpiCard label="Em risco" value={kpi.emRisco} icon={AlertTriangle} color="text-red-600"
          onClick={() => { setStageFilter("__all__"); setStatusFilter("critico"); }} />
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <div className="relative">
              <Search className="size-4 absolute left-2 top-2.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Empresa, CNPJ ou responsável" className="pl-8" />
            </div>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Fase</label>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as fases</SelectItem>
                {stages.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="em_dia">Em dia</SelectItem>
                <SelectItem value="atencao">Atenção</SelectItem>
                <SelectItem value="atrasado">Atrasado</SelectItem>
                <SelectItem value="critico">Crítico</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="atrasados">Com atrasos</SelectItem>
                <SelectItem value="pendencias">Com pendências</SelectItem>
                <SelectItem value="sem_acao">Sem próxima ação</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStageFilter("__all__"); setStatusFilter("__all__"); }}>
            Limpar
          </Button>
        </CardContent>
      </Card>

      {/* Tabela / Kanban */}
      <Tabs defaultValue="tabela">
        <TabsList>
          <TabsTrigger value="tabela">Lista profissional</TabsTrigger>
          <TabsTrigger value="kanban">Quadro por fase</TabsTrigger>
        </TabsList>

        <TabsContent value="tabela" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Fase atual</TableHead>
                    <TableHead className="w-[160px]">Progresso</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Próxima ação</TableHead>
                    <TableHead>Pendências</TableHead>
                    <TableHead>Última atualização</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                      Nenhuma empresa encontrada com os filtros atuais.
                    </TableCell></TableRow>
                  )}
                  {filtered.map((c) => {
                    const meta = STATUS_META[c._status];
                    const Icon = meta.icon;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            <Building2 className="size-4 mt-0.5 text-muted-foreground" />
                            <div className="min-w-0">
                              <Link to="/app/empresa/$id" params={{ id: c.id }} className="font-medium hover:underline block truncate">
                                {c.nome}
                              </Link>
                              <div className="text-xs text-muted-foreground truncate">
                                {[c.cnpj, c.responsavel].filter(Boolean).join(" • ") || "—"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline">{stageLabel(c.consultancy_stage)}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={c._progress} className="h-1.5" />
                            <span className="text-xs text-muted-foreground tabular-nums w-8">{c._progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={meta.cls} variant="outline">
                            <Icon className="size-3 mr-1 inline" />{meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {c._nextAct ? (
                            <div className="text-sm truncate">{c._nextAct.title}
                              {c._nextAct.activity_date && (
                                <div className="text-[11px] text-muted-foreground">
                                  {new Date(c._nextAct.activity_date).toLocaleDateString("pt-BR")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-amber-600">Sem próxima ação</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c._pendings > 0 ? <Badge variant="destructive">{c._pendings}</Badge>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.updated_at ? new Date(c.updated_at).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="sm" variant="ghost" title="Ver jornada">
                              <Link to="/app/jornada/$companyId" params={{ companyId: c.id }}>
                                <Eye className="size-4" />
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost" title="Empresa">
                              <Link to="/app/empresa/$id" params={{ id: c.id }}>
                                <Building2 className="size-4" />
                              </Link>
                            </Button>
                            <Button asChild size="sm" variant="ghost" title="Agenda">
                              <Link to="/app/agenda"><Calendar className="size-4" /></Link>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <div className="flex gap-3 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const items = filtered.filter((c) => c.consultancy_stage === stage.v);
              return (
                <div key={stage.v} className="min-w-[260px] flex-shrink-0">
                  <div className="bg-muted/40 rounded-t-lg p-3 border-b">
                    <div className="font-medium text-sm">{stage.l}</div>
                    <div className="text-xs text-muted-foreground">{items.length} empresa(s)</div>
                  </div>
                  <div className="space-y-2 p-2 bg-muted/10 rounded-b-lg min-h-[120px]">
                    {items.map((c) => {
                      const meta = STATUS_META[c._status];
                      return (
                        <Card key={c.id}>
                          <CardContent className="p-3 space-y-2">
                            <Link to="/app/jornada/$companyId" params={{ companyId: c.id }} className="font-medium text-sm hover:underline block truncate">
                              {c.nome}
                            </Link>
                            <div className="flex items-center gap-2">
                              <Progress value={c._progress} className="h-1 flex-1" />
                              <span className="text-[10px] tabular-nums">{c._progress}%</span>
                            </div>
                            <Badge className={meta.cls + " text-[10px]"} variant="outline">{meta.label}</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {applyOpen && consultant?.id && (
        <ApplyModelDialog
          consultantId={consultant.id}
          companies={companies}
          onClose={() => setApplyOpen(false)}
        />
      )}
      {customizeOpen && consultant?.id && (
        <CustomizeMethodDialog
          consultantId={consultant.id}
          initial={stages}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color, onClick }: {
  label: string; value: number; icon: any; color: string; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="hover:shadow-md transition cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
            </div>
            <Icon className={`size-5 ${color}`} />
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function ApplyModelDialog({ consultantId, companies, onClose }: {
  consultantId: string; companies: CompanyRow[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [companyId, setCompanyId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [allowClient, setAllowClient] = useState(false);

  const apply = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Selecione uma empresa");
      const jid = await applyJourneyToCompany({
        consultantId, companyId, phases: PROFESSIONAL_JOURNEY_PHASES,
        startDate, allowClientView: allowClient,
      });
      return jid;
    },
    onSuccess: (jid) => {
      toast.success("Modelo aplicado");
      qc.invalidateQueries({ queryKey: ["company-journey"] });
      onClose();
      navigate({ to: "/app/jornada/$companyId", params: { companyId } });
      void jid;
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aplicar modelo de jornada</DialogTitle>
          <DialogDescription>
            Modelo padrão: <strong>Consultoria Financeira PJ — 4 semanas</strong> ({PROFESSIONAL_JOURNEY_PHASES.length} fases).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Empresa cliente</label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Data de início</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowClient} onChange={(e) => setAllowClient(e.target.checked)} />
            Liberar visualização da jornada para o cliente
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => apply.mutate()} disabled={apply.isPending || !companyId}>
            <ListChecks className="size-4" /> Aplicar modelo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomizeMethodDialog({ consultantId, initial, onClose }: {
  consultantId: string; initial: JourneyStage[]; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState(initial.map((s) => ({ ...s })));

  const save = useMutation({
    mutationFn: async () => {
      if (items.some((s) => !s.v.trim() || !s.l.trim())) throw new Error("Chave e nome são obrigatórios.");
      const keys = items.map((s) => s.v);
      if (new Set(keys).size !== keys.length) throw new Error("Chaves duplicadas.");
      await sb.from("consultancy_journey_stages").delete().eq("consultant_id", consultantId);
      if (items.length === 0) return;
      const rows = items.map((s, i) => ({
        consultant_id: consultantId, stage_key: s.v.trim(), label: s.l.trim(), position: i,
      }));
      const { error } = await sb.from("consultancy_journey_stages").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Método atualizado");
      qc.invalidateQueries({ queryKey: ["journey-stages", consultantId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Personalizar método</DialogTitle>
          <DialogDescription>
            Edite as fases principais que aparecem nos filtros e no quadro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {items.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input value={s.l} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, l: e.target.value } : x))} placeholder="Nome da fase" />
              <Input value={s.v} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} placeholder="chave_interna" className="font-mono text-xs" />
              <Button size="sm" variant="ghost" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remover</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setItems([...items, { v: `fase_${Date.now().toString(36)}`, l: "Nova fase" }])}>
            <Plus className="size-4" /> Adicionar fase
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Mantém export legado para compatibilidade com imports antigos
export { ArrowRight };
