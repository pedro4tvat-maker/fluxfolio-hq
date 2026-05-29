import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, History, Building2, Settings2, Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { DEFAULT_JOURNEY_STAGES, type JourneyStage } from "@/lib/journey-stages";

export const Route = createFileRoute("/app/jornada")({ component: JornadaPage });

const sb = supabase as any;

// kept for backward compatibility with other imports
export const JOURNEY_STAGES = DEFAULT_JOURNEY_STAGES;

function JornadaPage() {
  const { user, isConsultant } = useAuth();
  const qc = useQueryClient();
  const [moving, setMoving] = useState<{ id: string; nome: string; current: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [editingStages, setEditingStages] = useState(false);

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

  const stageLabel = (v: string) => stages.find((s) => s.v === v)?.l
    ?? DEFAULT_JOURNEY_STAGES.find((s) => s.v === v)?.l ?? v;

  const { data: companies = [] } = useQuery({
    queryKey: ["jornada-companies", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb
        .from("consultant_company_links")
        .select("company:companies(id, nome, cnpj, responsavel, consultancy_stage, consultancy_progress, consultancy_status)")
        .eq("consultant_id", consultant.id)
        .eq("status", "approved");
      return (data ?? []).map((r: any) => r.company).filter(Boolean);
    },
  });

  const companyIds = useMemo(() => companies.map((c: any) => c.id), [companies]);

  const { data: pendings = [] } = useQuery({
    queryKey: ["jornada-pendings", companyIds],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const { data } = await sb.from("client_pending_items")
        .select("id, company_id, status")
        .in("company_id", companyIds);
      return data ?? [];
    },
  });

  const { data: nextActs = [] } = useQuery({
    queryKey: ["jornada-acts", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb.from("consultancy_activities")
        .select("id, company_id, title, activity_date, status")
        .eq("consultant_id", consultant.id)
        .neq("status", "concluida")
        .order("activity_date", { ascending: true });
      return data ?? [];
    },
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, newStage, notes, current }: { id: string; newStage: string; notes: string; current: string }) => {
      if (!consultant?.id) throw new Error("Sem consultor");
      const { error } = await sb.from("companies").update({ consultancy_stage: newStage }).eq("id", id);
      if (error) throw error;
      const { error: e2 } = await sb.from("consultancy_stage_history").insert({
        consultant_id: consultant.id, company_id: id, previous_stage: current, new_stage: newStage,
        changed_by: user!.id, notes: notes || null,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jornada-companies"] });
      toast.success("Fase atualizada");
      setMoving(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const byStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    stages.forEach((s) => { map[s.v] = []; });
    map["__other__"] = [];
    companies.forEach((c: any) => {
      const stage = c.consultancy_stage ?? stages[0]?.v ?? "novo_cliente";
      if (map[stage]) map[stage].push(c);
      else map["__other__"].push(c);
    });
    return map;
  }, [companies, stages]);

  if (!isConsultant) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        A Jornada da Consultoria é exclusiva do consultor.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">Jornada da Consultoria</h1>
          <p className="text-sm text-muted-foreground">Acompanhe em qual fase cada empresa cliente está.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditingStages(true)}>
          <Settings2 className="size-4" /> Personalizar fases
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.v} className="min-w-[280px] flex-shrink-0">
            <div className="bg-muted/40 rounded-t-lg p-3 border-b">
              <div className="font-medium text-sm">{stage.l}</div>
              <div className="text-xs text-muted-foreground">{(byStage[stage.v] ?? []).length} empresa(s)</div>
            </div>
            <div className="space-y-2 p-2 bg-muted/10 rounded-b-lg min-h-[200px]">
              {(byStage[stage.v] ?? []).map((c: any) => {
                const cPendings = pendings.filter((p: any) => p.company_id === c.id && !["resolvido", "cancelado"].includes(p.status));
                const nextAct = nextActs.find((a: any) => a.company_id === c.id);
                return (
                  <Card key={c.id} className="hover:shadow-md transition">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to="/app/empresa/$id" params={{ id: c.id }} className="font-medium text-sm hover:underline block truncate">
                            <Building2 className="size-3 inline mr-1" />{c.nome}
                          </Link>
                          {c.cnpj && <div className="text-[10px] text-muted-foreground truncate">{c.cnpj}</div>}
                          {c.responsavel && <div className="text-[10px] text-muted-foreground truncate">{c.responsavel}</div>}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {cPendings.length > 0 && <Badge variant="destructive" className="text-[10px]">{cPendings.length} pend.</Badge>}
                        {nextAct && <Badge variant="secondary" className="text-[10px] truncate max-w-full">{nextAct.title}</Badge>}
                      </div>
                      <div className="flex gap-1 pt-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setMoving({ id: c.id, nome: c.nome, current: c.consultancy_stage ?? stages[0]?.v ?? "novo_cliente" })}>
                          <ArrowRight className="size-3" /> Mover
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setHistoryFor(c.id)}>
                          <History className="size-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
        {(byStage["__other__"] ?? []).length > 0 && (
          <div className="min-w-[280px] flex-shrink-0">
            <div className="bg-muted/40 rounded-t-lg p-3 border-b">
              <div className="font-medium text-sm">Outras fases</div>
              <div className="text-xs text-muted-foreground">{byStage["__other__"].length} empresa(s) em fases desativadas</div>
            </div>
            <div className="space-y-2 p-2 bg-muted/10 rounded-b-lg min-h-[200px]">
              {byStage["__other__"].map((c: any) => (
                <Card key={c.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="font-medium text-sm truncate">{c.nome}</div>
                    <div className="text-[10px] text-muted-foreground">Fase: {stageLabel(c.consultancy_stage)}</div>
                    <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => setMoving({ id: c.id, nome: c.nome, current: c.consultancy_stage })}>
                      <ArrowRight className="size-3" /> Mover
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {moving && (
        <MoveStageDialog
          stages={stages}
          item={moving}
          stageLabel={stageLabel}
          onClose={() => setMoving(null)}
          onSave={(newStage, notes) => moveStage.mutate({ id: moving.id, newStage, notes, current: moving.current })}
        />
      )}

      {historyFor && (
        <HistoryDialog companyId={historyFor} stageLabel={stageLabel} onClose={() => setHistoryFor(null)} />
      )}

      {editingStages && consultant?.id && (
        <EditStagesDialog
          consultantId={consultant.id}
          initial={stages}
          onClose={() => setEditingStages(false)}
        />
      )}
    </div>
  );
}

function MoveStageDialog({ item, stages, stageLabel, onClose, onSave }: {
  item: { id: string; nome: string; current: string };
  stages: JourneyStage[];
  stageLabel: (v: string) => string;
  onClose: () => void;
  onSave: (s: string, n: string) => void;
}) {
  const [stage, setStage] = useState(item.current);
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Mover fase — {item.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Fase atual: <strong>{stageLabel(item.current)}</strong></div>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{stages.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Textarea placeholder="Observação (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(stage, notes)} disabled={stage === item.current}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ companyId, stageLabel, onClose }: { companyId: string; stageLabel: (v: string) => string; onClose: () => void }) {
  const { data = [] } = useQuery({
    queryKey: ["stage-history", companyId],
    queryFn: async () => {
      const { data } = await sb.from("consultancy_stage_history").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Histórico de fases</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="text-sm text-muted-foreground">Sem histórico ainda.</p>}
          {data.map((h: any) => (
            <div key={h.id} className="border rounded p-3 text-sm">
              <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
              <div>{stageLabel(h.previous_stage ?? "—")} <ArrowRight className="size-3 inline" /> <strong>{stageLabel(h.new_stage)}</strong></div>
              {h.notes && <div className="text-xs text-muted-foreground mt-1">{h.notes}</div>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditStagesDialog({ consultantId, initial, onClose }: {
  consultantId: string;
  initial: JourneyStage[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [items, setItems] = useState<{ v: string; l: string }[]>(() => initial.map((s) => ({ ...s })));

  function move(idx: number, dir: -1 | 1) {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
  }
  function add() {
    const key = `fase_${Date.now().toString(36)}`;
    setItems([...items, { v: key, l: "Nova fase" }]);
  }
  function remove(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }
  function update(idx: number, patch: Partial<{ v: string; l: string }>) {
    setItems(items.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  const save = useMutation({
    mutationFn: async () => {
      if (items.some((s) => !s.v.trim() || !s.l.trim())) throw new Error("Chave e nome são obrigatórios.");
      const keys = items.map((s) => s.v);
      if (new Set(keys).size !== keys.length) throw new Error("Chaves duplicadas.");
      // Strategy: delete all then insert fresh
      await sb.from("consultancy_journey_stages").delete().eq("consultant_id", consultantId);
      if (items.length === 0) return;
      const rows = items.map((s, i) => ({
        consultant_id: consultantId, stage_key: s.v.trim(), label: s.l.trim(), position: i,
      }));
      const { error } = await sb.from("consultancy_journey_stages").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fases atualizadas");
      qc.invalidateQueries({ queryKey: ["journey-stages", consultantId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Personalizar fases da jornada</DialogTitle></DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Sem fases. Adicione pelo menos uma — ou feche para manter as fases padrão.</p>
          )}
          {items.map((s, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input value={s.l} onChange={(e) => update(i, { l: e.target.value })} placeholder="Nome da fase" />
              <Input value={s.v} onChange={(e) => update(i, { v: e.target.value })} placeholder="chave_interna" className="font-mono text-xs" />
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}><Plus className="size-4" /> Adicionar fase</Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
