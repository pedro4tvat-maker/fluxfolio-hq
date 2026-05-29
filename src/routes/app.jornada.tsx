import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowRight, History, Building2 } from "lucide-react";

export const Route = createFileRoute("/app/jornada")({ component: JornadaPage });

const sb = supabase as any;

export const JOURNEY_STAGES = [
  { v: "novo_cliente", l: "Novo cliente" },
  { v: "diagnostico_inicial", l: "Diagnóstico inicial" },
  { v: "organizacao_financeira", l: "Organização financeira" },
  { v: "fluxo_caixa", l: "Fluxo de caixa" },
  { v: "contas_pagar_receber", l: "Contas a pagar e receber" },
  { v: "precificacao_margem", l: "Precificação e margem" },
  { v: "orcamento_metas", l: "Orçamento e metas" },
  { v: "dre_relatorios", l: "DRE e relatórios" },
  { v: "plano_acao", l: "Plano de ação" },
  { v: "acompanhamento_mensal", l: "Acompanhamento mensal" },
  { v: "renovacao", l: "Renovação" },
  { v: "encerrado", l: "Encerrado" },
] as const;

function stageLabel(v: string) {
  return JOURNEY_STAGES.find((s) => s.v === v)?.l ?? v;
}

function JornadaPage() {
  const { user, isConsultant } = useAuth();
  const qc = useQueryClient();
  const [moving, setMoving] = useState<{ id: string; nome: string; current: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const { data: consultant } = useQuery({
    queryKey: ["consultant-me", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

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
    JOURNEY_STAGES.forEach((s) => { map[s.v] = []; });
    companies.forEach((c: any) => {
      const stage = c.consultancy_stage ?? "novo_cliente";
      (map[stage] ?? map["novo_cliente"]).push(c);
    });
    return map;
  }, [companies]);

  if (!isConsultant) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        A Jornada da Consultoria é exclusiva do consultor.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Jornada da Consultoria</h1>
        <p className="text-sm text-muted-foreground">Acompanhe em qual fase cada empresa cliente está.</p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {JOURNEY_STAGES.map((stage) => (
          <div key={stage.v} className="min-w-[280px] flex-shrink-0">
            <div className="bg-muted/40 rounded-t-lg p-3 border-b">
              <div className="font-medium text-sm">{stage.l}</div>
              <div className="text-xs text-muted-foreground">{byStage[stage.v].length} empresa(s)</div>
            </div>
            <div className="space-y-2 p-2 bg-muted/10 rounded-b-lg min-h-[200px]">
              {byStage[stage.v].map((c: any) => {
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
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => setMoving({ id: c.id, nome: c.nome, current: c.consultancy_stage ?? "novo_cliente" })}>
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
      </div>

      {moving && (
        <MoveStageDialog
          item={moving}
          onClose={() => setMoving(null)}
          onSave={(newStage, notes) => moveStage.mutate({ id: moving.id, newStage, notes, current: moving.current })}
        />
      )}

      {historyFor && (
        <HistoryDialog companyId={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </div>
  );
}

function MoveStageDialog({ item, onClose, onSave }: { item: { id: string; nome: string; current: string }; onClose: () => void; onSave: (s: string, n: string) => void }) {
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
              <SelectContent>{JOURNEY_STAGES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
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

function HistoryDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
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
