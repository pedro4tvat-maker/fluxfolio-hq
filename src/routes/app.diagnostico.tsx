import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ArrowLeft, ClipboardCheck, Plus, Eye, Trash2, FileText, CheckCircle2, Copy,
} from "lucide-react";
import { maybeAdvanceStage } from "@/lib/journey-stages";

export const Route = createFileRoute("/app/diagnostico")({ component: DiagnosticoPage });

type AnswerValue = "sim" | "parcial" | "nao" | "na";
const ANSWER_SCORE: Record<AnswerValue, number | null> = {
  sim: 2, parcial: 1, nao: 0, na: null,
};
const ANSWER_LABEL: Record<AnswerValue, string> = {
  sim: "Sim", parcial: "Parcialmente", nao: "Não", na: "Não se aplica",
};

const BLOCKS: { key: string; title: string; questions: { key: string; text: string }[] }[] = [
  { key: "organizacao", title: "Organização Financeira", questions: [
    { key: "org_1", text: "A empresa possui controle de entradas e saídas?" },
    { key: "org_2", text: "A empresa registra o fluxo de caixa diariamente?" },
    { key: "org_3", text: "A empresa possui contas bancárias separadas da pessoa física?" },
    { key: "org_4", text: "O empresário sabe quanto entra e quanto sai por mês?" },
    { key: "org_5", text: "Existe rotina de fechamento financeiro mensal?" },
  ]},
  { key: "contas", title: "Contas a Pagar e Receber", questions: [
    { key: "cpr_1", text: "A empresa controla contas a pagar?" },
    { key: "cpr_2", text: "A empresa controla contas a receber?" },
    { key: "cpr_3", text: "Existem contas vencidas?" },
    { key: "cpr_4", text: "Existem clientes inadimplentes?" },
    { key: "cpr_5", text: "A empresa acompanha vencimentos futuros?" },
  ]},
  { key: "lucratividade", title: "Lucratividade e Resultado", questions: [
    { key: "luc_1", text: "A empresa sabe se teve lucro ou prejuízo no mês?" },
    { key: "luc_2", text: "A empresa possui DRE gerencial?" },
    { key: "luc_3", text: "A empresa conhece sua margem líquida?" },
    { key: "luc_4", text: "A empresa conhece sua margem de contribuição?" },
    { key: "luc_5", text: "A empresa sabe seu ponto de equilíbrio?" },
  ]},
  { key: "precificacao", title: "Precificação", questions: [
    { key: "pre_1", text: "A empresa sabe calcular preço de venda?" },
    { key: "pre_2", text: "Considera impostos, taxas e custos variáveis na precificação?" },
    { key: "pre_3", text: "A empresa conhece a margem dos produtos ou serviços?" },
    { key: "pre_4", text: "A empresa revisa preços periodicamente?" },
    { key: "pre_5", text: "Existem produtos ou serviços com margem negativa?" },
  ]},
  { key: "estoque", title: "Estoque", questions: [
    { key: "est_1", text: "A empresa controla estoque?" },
    { key: "est_2", text: "A empresa sabe quanto dinheiro está parado em estoque?" },
    { key: "est_3", text: "Existem produtos parados ou sem giro?" },
    { key: "est_4", text: "Existem produtos abaixo do estoque mínimo?" },
    { key: "est_5", text: "O estoque é atualizado após vendas e compras?" },
  ]},
  { key: "orcamento", title: "Orçamento e Metas", questions: [
    { key: "orc_1", text: "A empresa possui orçamento mensal por categoria?" },
    { key: "orc_2", text: "A empresa compara orçado x realizado?" },
    { key: "orc_3", text: "A empresa possui metas de faturamento?" },
    { key: "orc_4", text: "A empresa possui meta de lucro?" },
    { key: "orc_5", text: "A empresa possui meta de reserva financeira?" },
  ]},
  { key: "endividamento", title: "Endividamento e Caixa", questions: [
    { key: "end_1", text: "A empresa possui dívidas ativas?" },
    { key: "end_2", text: "A empresa sabe quanto paga de parcelas por mês?" },
    { key: "end_3", text: "A empresa conhece o custo das dívidas?" },
    { key: "end_4", text: "A empresa possui capital de giro suficiente?" },
    { key: "end_5", text: "O caixa projetado indica risco de ficar negativo?" },
  ]},
  { key: "gestao", title: "Gestão e Rotina", questions: [
    { key: "ges_1", text: "Existe responsável pelo financeiro?" },
    { key: "ges_2", text: "A empresa envia documentos e informações no prazo?" },
    { key: "ges_3", text: "Existe rotina semanal de análise financeira?" },
    { key: "ges_4", text: "A empresa usa relatórios para tomar decisão?" },
    { key: "ges_5", text: "O empresário acompanha indicadores financeiros?" },
  ]},
];

const STATUS_LABEL: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
  revisado: "Revisado",
};

function classify(score: number) {
  if (score <= 40) return { label: "Crítico", color: "bg-destructive text-destructive-foreground" };
  if (score <= 60) return { label: "Desorganizado", color: "bg-orange-500 text-white" };
  if (score <= 75) return { label: "Em organização", color: "bg-yellow-500 text-black" };
  if (score <= 90) return { label: "Boa gestão", color: "bg-blue-500 text-white" };
  return { label: "Gestão avançada", color: "bg-success text-success-foreground" };
}

const RECOMMENDATIONS: Record<string, string> = {
  organizacao: "Priorizar organização do fluxo de caixa e separação entre finanças pessoais e empresariais.",
  contas: "Criar rotina de cobrança e acompanhamento de inadimplência, e estruturar controle de contas a pagar.",
  lucratividade: "Implantar DRE gerencial e cálculo de margem e ponto de equilíbrio.",
  precificacao: "Realizar análise de precificação e margem dos principais produtos ou serviços.",
  estoque: "Implantar controle de estoque com inventário e estoque mínimo.",
  orcamento: "Criar orçamento mensal e acompanhar orçado x realizado.",
  endividamento: "Mapear dívidas ativas, custo financeiro e projeção de caixa.",
  gestao: "Definir responsável financeiro e rotina semanal de análise de indicadores.",
};

function DiagnosticoPage() {
  const { user, isConsultant, loading: authLoading } = useAuth();
  const { selected: selectedCompanyId } = useSelectedCompany();
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: consultant } = useQuery({
    queryKey: ["my-consultant", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await supabase.from("consultants").select("id, responsible_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: company } = useQuery({
    queryKey: ["dx-company", selectedCompanyId],
    enabled: !!selectedCompanyId,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome, cnpj, documento").eq("id", selectedCompanyId!).maybeSingle();
      return data;
    },
  });

  const { data: list, refetch } = useQuery({
    queryKey: ["diagnostics", selectedCompanyId],
    enabled: !!selectedCompanyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_diagnostics")
        .select("*")
        .eq("company_id", selectedCompanyId!)
        .order("diagnostic_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (authLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!selectedCompanyId) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center max-w-xl mx-auto">
        <ClipboardCheck className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Selecione uma empresa</h3>
        <p className="text-sm text-muted-foreground mt-1">Abra uma empresa cliente para iniciar o diagnóstico financeiro.</p>
        <Button asChild className="mt-4"><Link to="/app">Voltar ao painel</Link></Button>
      </div>
    );
  }

  if (activeId) {
    return <DiagnosticEditor id={activeId} onBack={() => { setActiveId(null); refetch(); }} canEdit={!!isConsultant} />;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          {company && (
            <Link to="/app/empresa/$id" params={{ id: company.id }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="size-3" /> Voltar para a empresa
            </Link>
          )}
          <h1 className="text-2xl md:text-3xl font-display font-bold mt-1">Diagnóstico Inicial</h1>
          <p className="text-muted-foreground text-sm">
            {company?.nome ?? "Empresa"} · {company?.cnpj ?? company?.documento ?? "—"}
          </p>
        </div>
        {isConsultant && consultant && (
          <NewDiagnosticButton
            consultantId={consultant.id}
            companyId={selectedCompanyId}
            responsibleName={consultant.responsible_name ?? ""}
            onCreated={(id) => { refetch(); setActiveId(id); }}
          />
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de diagnósticos</CardTitle></CardHeader>
        <CardContent>
          {!list?.length ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum diagnóstico cadastrado ainda.</div>
          ) : (
            <div className="space-y-2">
              {list.map((d) => {
                const cl = d.classification ?? classify(Number(d.overall_score)).label;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 border rounded-lg p-3 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-medium text-sm">{new Date(d.diagnostic_date).toLocaleDateString("pt-BR")} · {d.responsible_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{STATUS_LABEL[d.status] ?? d.status}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{Number(d.overall_score).toFixed(0)}%</div>
                      <Badge className={classify(Number(d.overall_score)).color}>{cl}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setActiveId(d.id)}>
                        <Eye className="size-3.5" /> {isConsultant ? "Editar" : "Ver"}
                      </Button>
                      {isConsultant && (
                        <DuplicateBtn diagnosticId={d.id} consultantId={consultant!.id} companyId={selectedCompanyId} onDone={() => refetch()} />
                      )}
                      {isConsultant && (
                        <DeleteBtn id={d.id} onDone={() => refetch()} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewDiagnosticButton({ consultantId, companyId, responsibleName, onCreated }: {
  consultantId: string; companyId: string; responsibleName: string; onCreated: (id: string) => void;
}) {
  const m = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("financial_diagnostics").insert({
        consultant_id: consultantId,
        company_id: companyId,
        responsible_name: responsibleName,
        status: "em_andamento",
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => { toast.success("Diagnóstico criado"); onCreated(id); },
    onError: (e: any) => toast.error(e.message),
  });
  return <Button onClick={() => m.mutate()} disabled={m.isPending}><Plus className="size-4" /> Novo diagnóstico</Button>;
}

function DuplicateBtn({ diagnosticId, consultantId, companyId, onDone }: { diagnosticId: string; consultantId: string; companyId: string; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      const { data: src, error: e1 } = await supabase.from("financial_diagnostics").select("*").eq("id", diagnosticId).single();
      if (e1) throw e1;
      const { data: ins, error: e2 } = await supabase.from("financial_diagnostics").insert({
        consultant_id: consultantId, company_id: companyId, branch_id: src.branch_id,
        responsible_name: src.responsible_name, status: "em_andamento",
        notes: src.notes,
      }).select("id").single();
      if (e2) throw e2;
      const { data: ans } = await supabase.from("financial_diagnostic_answers").select("*").eq("diagnostic_id", diagnosticId);
      if (ans?.length) {
        await supabase.from("financial_diagnostic_answers").insert(
          ans.map((a) => ({ diagnostic_id: ins.id, section: a.section, question_key: a.question_key, question: a.question, answer: a.answer, score: a.score, notes: a.notes }))
        );
      }
    },
    onSuccess: () => { toast.success("Diagnóstico duplicado"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}><Copy className="size-3.5" /></Button>;
}

function DeleteBtn({ id, onDone }: { id: string; onDone: () => void }) {
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("financial_diagnostics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir diagnóstico?")) m.mutate(); }}><Trash2 className="size-3.5" /></Button>;
}

function DiagnosticEditor({ id, onBack, canEdit }: { id: string; onBack: () => void; canEdit: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: diag, refetch } = useQuery({
    queryKey: ["diagnostic", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_diagnostics").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const { data: answersRaw } = useQuery({
    queryKey: ["diagnostic-answers", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_diagnostic_answers").select("*").eq("diagnostic_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [answers, setAnswers] = useState<Record<string, { answer: AnswerValue | ""; notes: string }>>({});
  const [header, setHeader] = useState({ responsible_name: "", diagnostic_date: "", notes: "", allow_client_view: false });

  useEffect(() => {
    if (diag) {
      setHeader({
        responsible_name: diag.responsible_name ?? "",
        diagnostic_date: diag.diagnostic_date,
        notes: diag.notes ?? "",
        allow_client_view: !!diag.allow_client_view,
      });
    }
  }, [diag]);

  useEffect(() => {
    if (answersRaw) {
      const map: Record<string, { answer: AnswerValue | ""; notes: string }> = {};
      for (const a of answersRaw) {
        map[a.question_key] = { answer: (a.answer as AnswerValue) ?? "", notes: a.notes ?? "" };
      }
      setAnswers(map);
    }
  }, [answersRaw]);

  const { perBlock, overall, answered, totalQ } = useMemo(() => {
    let totalEarned = 0, totalPossible = 0, ansCount = 0, q = 0;
    const perBlock: Record<string, { earned: number; possible: number; pct: number }> = {};
    for (const b of BLOCKS) {
      let earned = 0, possible = 0;
      for (const qn of b.questions) {
        q++;
        const a = answers[qn.key]?.answer as AnswerValue | "";
        if (!a) continue;
        ansCount++;
        const s = ANSWER_SCORE[a];
        if (s === null) continue;
        earned += s; possible += 2;
      }
      perBlock[b.key] = { earned, possible, pct: possible ? (earned / possible) * 100 : 0 };
      totalEarned += earned; totalPossible += possible;
    }
    const overall = totalPossible ? (totalEarned / totalPossible) * 100 : 0;
    return { perBlock, overall, answered: ansCount, totalQ: q };
  }, [answers]);

  const cls = classify(overall);

  const saveMut = useMutation({
    mutationFn: async (finalize: boolean) => {
      const status = finalize ? "finalizado" : "em_andamento";
      const weak = BLOCKS.filter((b) => perBlock[b.key]?.possible > 0 && perBlock[b.key].pct < 50).map((b) => b.title);
      const strong = BLOCKS.filter((b) => perBlock[b.key]?.possible > 0 && perBlock[b.key].pct >= 80).map((b) => b.title);
      const recs = BLOCKS.filter((b) => perBlock[b.key]?.possible > 0 && perBlock[b.key].pct < 60).map((b) => `• ${RECOMMENDATIONS[b.key]}`).join("\n");

      const { error } = await supabase.from("financial_diagnostics").update({
        responsible_name: header.responsible_name,
        diagnostic_date: header.diagnostic_date,
        notes: header.notes,
        allow_client_view: header.allow_client_view,
        status,
        overall_score: Number(overall.toFixed(2)),
        classification: cls.label,
        strengths: strong.join(", "),
        weaknesses: weak.join(", "),
        recommendations: recs,
        next_steps: finalize ? "Criar ações no Plano de Ação a partir das fragilidades identificadas." : null,
        finalized_at: finalize ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;

      // upsert answers
      const rows: any[] = [];
      for (const b of BLOCKS) {
        for (const qn of b.questions) {
          const a = answers[qn.key];
          if (!a?.answer) continue;
          const s = ANSWER_SCORE[a.answer];
          rows.push({
            diagnostic_id: id, section: b.key, question_key: qn.key,
            question: qn.text, answer: a.answer, score: s ?? 0, notes: a.notes || null,
          });
        }
      }
      if (rows.length) {
        const { error: e2 } = await supabase.from("financial_diagnostic_answers").upsert(rows, { onConflict: "diagnostic_id,question_key" });
        if (e2) throw e2;
      }
    },
    onSuccess: (_d, finalize) => {
      toast.success(finalize ? "Diagnóstico finalizado" : "Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["diagnostic", id] });
      qc.invalidateQueries({ queryKey: ["diagnostic-answers", id] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function setAns(key: string, patch: Partial<{ answer: AnswerValue | ""; notes: string }>) {
    setAnswers((prev) => ({ ...prev, [key]: { answer: prev[key]?.answer ?? "", notes: prev[key]?.notes ?? "", ...patch } }));
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Voltar ao histórico
          </button>
          <h1 className="text-2xl md:text-3xl font-display font-bold mt-1">Diagnóstico Inicial</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Badge variant="outline">{STATUS_LABEL[diag?.status ?? "em_andamento"]}</Badge>
            <span>· {answered}/{totalQ} respondidas</span>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveMut.mutate(false)} disabled={saveMut.isPending}>Salvar rascunho</Button>
            <Button onClick={() => saveMut.mutate(true)} disabled={saveMut.isPending}>
              <CheckCircle2 className="size-4" /> Finalizar
            </Button>
            <Button variant="outline" onClick={() => window.print()}><FileText className="size-4" /> PDF</Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={header.diagnostic_date} onChange={(e) => setHeader({ ...header, diagnostic_date: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={header.responsible_name} onChange={(e) => setHeader({ ...header, responsible_name: e.target.value })} disabled={!canEdit} />
            </div>
            <div className="flex items-end">
              {canEdit && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={header.allow_client_view} onCheckedChange={(v) => setHeader({ ...header, allow_client_view: !!v })} />
                  Liberar visualização para o cliente
                </label>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 items-center">
            <div>
              <div className="text-xs text-muted-foreground">Pontuação geral</div>
              <div className="text-4xl font-bold">{overall.toFixed(0)}%</div>
              <Badge className={`mt-1 ${cls.color}`}>{cls.label}</Badge>
              <Progress value={overall} className="mt-3" />
            </div>
            <div className="space-y-1.5">
              {BLOCKS.map((b) => {
                const p = perBlock[b.key];
                return (
                  <div key={b.key} className="flex items-center gap-2 text-xs">
                    <span className="w-44 truncate">{b.title}</span>
                    <Progress value={p?.pct ?? 0} className="flex-1 h-1.5" />
                    <span className="w-10 text-right">{(p?.pct ?? 0).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {BLOCKS.map((b) => (
        <Card key={b.key}>
          <CardHeader>
            <CardTitle className="text-base flex justify-between items-center">
              <span>{b.title}</span>
              <span className="text-sm font-normal text-muted-foreground">{(perBlock[b.key]?.pct ?? 0).toFixed(0)}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {b.questions.map((qn) => {
              const a = answers[qn.key];
              return (
                <div key={qn.key} className="border-b last:border-0 pb-3 last:pb-0 space-y-2">
                  <div className="text-sm font-medium">{qn.text}</div>
                  <div className="flex flex-wrap gap-2">
                    {(["sim", "parcial", "nao", "na"] as AnswerValue[]).map((v) => (
                      <Button key={v} size="sm" variant={a?.answer === v ? "default" : "outline"}
                        onClick={() => canEdit && setAns(qn.key, { answer: v })}
                        disabled={!canEdit}>
                        {ANSWER_LABEL[v]}
                      </Button>
                    ))}
                  </div>
                  <Textarea placeholder="Observações (opcional)" value={a?.notes ?? ""}
                    onChange={(e) => setAns(qn.key, { notes: e.target.value })}
                    disabled={!canEdit} className="text-xs" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-base">Observações do consultor</CardTitle></CardHeader>
          <CardContent>
            <Textarea rows={4} value={header.notes} onChange={(e) => setHeader({ ...header, notes: e.target.value })} placeholder="Comentários e contexto adicional..." />
          </CardContent>
        </Card>
      )}

      {diag?.status === "finalizado" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Resultado</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div><b>Pontos fortes:</b> {diag.strengths || "—"}</div>
            <div><b>Fragilidades:</b> {diag.weaknesses || "—"}</div>
            <div className="whitespace-pre-wrap"><b>Recomendações:</b>
              {"\n"}{diag.recommendations || "—"}</div>
            <div><b>Próximos passos:</b> {diag.next_steps || "—"}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
