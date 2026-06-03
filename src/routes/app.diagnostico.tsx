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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, ClipboardCheck, Plus, Eye, Trash2, FileText, CheckCircle2, Copy, Calendar,
} from "lucide-react";
import { maybeAdvanceStage } from "@/lib/journey-stages";

export const Route = createFileRoute("/app/diagnostico")({ component: DiagnosticoPage });

// ============ TYPES ============
type QuestionOption = { value: string; label: string; points: number };
type Question = { key: string; text: string; options: QuestionOption[] };
type Block = { key: string; title: string; questions: Question[] };
type CompanyInfo = { num_funcionarios: string; faturamento: string };

// ============ MÉTODO MORDOMIA BLOCKS ============
const BLOCKS: Block[] = [
  {
    key: "controle",
    title: "CONTROLE FINANCEIRO",
    questions: [
      { key: "con_1", text: "Possui fluxo de caixa atualizado?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "con_2", text: "Possui controle de contas a pagar?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "con_3", text: "Possui controle de contas a receber?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "con_4", text: "Consegue prever o saldo da empresa para os próximos 30 dias?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
    ],
  },
  {
    key: "precificacao",
    title: "PRECIFICAÇÃO E MARGEM",
    questions: [
      { key: "pre_1", text: "Conhece a margem dos seus principais produtos ou serviços?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "pre_2", text: "Possui metodologia de precificação?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "pre_3", text: "Revisa preços periodicamente?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "as_vezes", label: "Às vezes", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
    ],
  },
  {
    key: "estoque",
    title: "ESTOQUE",
    questions: [
      { key: "est_1", text: "Possui controle de estoque?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "est_2", text: "Realiza inventário periódico?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "as_vezes", label: "Às vezes", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "est_3", text: "Conhece o valor financeiro do estoque atual?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
    ],
  },
  {
    key: "socios",
    title: "SÓCIOS E RETIRADAS",
    questions: [
      { key: "soc_1", text: "Existe pró-labore definido?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "soc_2", text: "Existe separação entre contas pessoais e empresariais?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "soc_3", text: "Existem retiradas sem controle?", options: [{ value: "nunca", label: "Nunca", points: 10 }, { value: "as_vezes", label: "Às vezes", points: 5 }, { value: "frequente", label: "Frequentemente", points: 0 }] },
    ],
  },
  {
    key: "leitura",
    title: "LEITURA DOS NÚMEROS",
    questions: [
      { key: "lei_1", text: "Você sabe qual foi o lucro dos últimos 3 meses?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "aprox", label: "Aproximadamente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "lei_2", text: "Analisa relatórios financeiros regularmente?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "as_vezes", label: "Às vezes", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "lei_3", text: "Toma decisões baseadas em números?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "as_vezes", label: "Às vezes", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
    ],
  },
  {
    key: "gestao",
    title: "GESTÃO",
    questions: [
      { key: "ges_1", text: "Possui metas financeiras definidas?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "ges_2", text: "Possui orçamento mensal?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
      { key: "ges_3", text: "A empresa possui indicadores de desempenho?", options: [{ value: "sim", label: "Sim", points: 10 }, { value: "parcial", label: "Parcialmente", points: 5 }, { value: "nao", label: "Não", points: 0 }] },
    ],
  },
];

const MAX_SCORE = 180; // 18 questions × 10 points

const FATURAMENTO_OPTIONS = [
  "Até R$ 20.000",
  "R$ 20.001 a R$ 50.000",
  "R$ 50.001 a R$ 100.000",
  "R$ 100.001 a R$ 300.000",
  "Acima de R$ 300.000",
];

const STATUS_LABEL: Record<string, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  finalizado: "Finalizado",
  revisado: "Revisado",
};

function classify(score: number) {
  if (score <= 60) return { label: "Situação Crítica", color: "bg-destructive text-destructive-foreground", desc: "A empresa necessita de estruturação financeira urgente." };
  if (score <= 120) return { label: "Em Desenvolvimento", color: "bg-orange-500 text-white", desc: "Possui controles básicos, porém existem riscos relevantes." };
  if (score <= 150) return { label: "Empresa Organizada", color: "bg-yellow-500 text-black", desc: "Existem oportunidades de melhoria e crescimento." };
  return { label: "Financeiramente Estruturada", color: "bg-success text-success-foreground", desc: "Possui boa maturidade financeira." };
}

const RECOMMENDATIONS: Record<string, string> = {
  controle: "Implantar fluxo de caixa e organizar o controle de contas a pagar e receber.",
  precificacao: "Estruturar metodologia de precificação e revisar margens dos produtos e serviços.",
  estoque: "Implantar controle de estoque com inventário periódico e valorização financeira.",
  socios: "Definir pró-labore, separar contas pessoais e empresariais e controlar retiradas.",
  leitura: "Analisar relatórios financeiros regularmente e tomar decisões baseadas em dados.",
  gestao: "Definir metas financeiras, criar orçamento mensal e acompanhar indicadores de desempenho.",
};

function generateNextSteps(blockScores: Record<string, { pct: number; max: number }>): string {
  const steps: string[] = [];
  if ((blockScores.controle?.pct ?? 100) < 70) steps.push("1. Implantar fluxo de caixa e organizar contas a pagar e receber.");
  if ((blockScores.precificacao?.pct ?? 100) < 70) steps.push("2. Estruturar precificação e calcular margens dos produtos/serviços.");
  if ((blockScores.estoque?.pct ?? 100) < 70) steps.push("3. Implantar controle de estoque com inventário periódico.");
  if ((blockScores.socios?.pct ?? 100) < 70) steps.push("4. Separar finanças PF/PJ e definir pró-labore.");
  if ((blockScores.leitura?.pct ?? 100) < 70) steps.push("5. Criar rotina de análise de relatórios financeiros.");
  if ((blockScores.gestao?.pct ?? 100) < 70) steps.push("6. Implantar orçamento mensal e definir metas financeiras.");
  if (!steps.length) steps.push("Continue mantendo a disciplina financeira e explore estratégias de crescimento.");
  return steps.join("\n");
}

function generateExecutiveSummary(score: number, classification: string): string {
  const percent = Math.round((score / MAX_SCORE) * 100);
  if (score <= 60) {
    return `Esta empresa apresenta situação financeira crítica, com pontuação de ${score}/${MAX_SCORE} pontos (${percent}%). Os indicadores revelam ausência de controles fundamentais que colocam em risco a sustentabilidade do negócio. Recomendamos início imediato da implementação dos controles básicos, começando pelo fluxo de caixa e separação das finanças pessoais e empresariais. O Método Mordomia indica que a reorganização financeira é o passo mais urgente.`;
  }
  if (score <= 120) {
    return `Esta empresa está em desenvolvimento financeiro, com pontuação de ${score}/${MAX_SCORE} pontos (${percent}%). Há controles básicos em funcionamento, porém existem riscos relevantes que precisam ser endereçados. Com foco nas áreas identificadas como gargalos e aplicação consistente do Método Mordomia, é possível avançar significativamente na maturidade financeira nos próximos 90 dias.`;
  }
  if (score <= 150) {
    return `Esta empresa está organizada financeiramente, com pontuação de ${score}/${MAX_SCORE} pontos (${percent}%). Os controles básicos estão estabelecidos e funcionando. O próximo passo é aprimorar a gestão estratégica com metas, indicadores e orçamento estruturado para alcançar o próximo nível de maturidade financeira com o Método Mordomia.`;
  }
  return `Esta empresa está financeiramente estruturada, com pontuação de ${score}/${MAX_SCORE} pontos (${percent}%). Parabéns pela maturidade financeira demonstrada! Continue mantendo os controles existentes e explore oportunidades de crescimento com base nos indicadores de desempenho. O Método Mordomia confirma uma gestão financeira sólida e consistente.`;
}

// ============ MAIN PAGE ============
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
          <h1 className="text-2xl md:text-3xl font-display font-bold mt-1">Diagnóstico Financeiro Empresarial</h1>
          <p className="text-base text-muted-foreground">Método Mordomia | Finanças em Propósito</p>
          <p className="text-sm text-muted-foreground mt-1">
            {company?.nome ?? "Empresa"} · {(company as any)?.cnpj ?? (company as any)?.documento ?? "—"}
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
                const score = Number(d.overall_score ?? 0);
                const cl = classify(score);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 border rounded-lg p-3 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-medium text-sm">{new Date(d.diagnostic_date).toLocaleDateString("pt-BR")} · {d.responsible_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{STATUS_LABEL[d.status] ?? d.status}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{score.toFixed(0)}/{MAX_SCORE}</div>
                      <Badge className={cl.color}>{d.classification || cl.label}</Badge>
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

// ============ HELPER BUTTONS ============
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

// ============ DIAGNOSTIC EDITOR ============
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

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [header, setHeader] = useState({
    responsible_name: "",
    diagnostic_date: new Date().toISOString().slice(0, 10),
    notes: "",
    allow_client_view: false,
  });
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
    num_funcionarios: "",
    faturamento: "",
  });

  useEffect(() => {
    if (diag) {
      let parsedNotes = "";
      let parsedEtapa1: CompanyInfo = { num_funcionarios: "", faturamento: "" };
      try {
        const parsed = JSON.parse(diag.notes ?? "{}");
        parsedNotes = parsed.notes ?? "";
        if (parsed.etapa1) parsedEtapa1 = parsed.etapa1;
      } catch {
        parsedNotes = diag.notes ?? "";
      }
      setHeader({
        responsible_name: diag.responsible_name ?? "",
        diagnostic_date: diag.diagnostic_date ?? new Date().toISOString().slice(0, 10),
        notes: parsedNotes,
        allow_client_view: !!diag.allow_client_view,
      });
      setCompanyInfo(parsedEtapa1);
    }
  }, [diag]);

  useEffect(() => {
    if (answersRaw) {
      const map: Record<string, string> = {};
      for (const a of answersRaw) {
        map[a.question_key] = a.answer ?? "";
      }
      setAnswers(map);
    }
  }, [answersRaw]);

  const { blockScores, totalScore, answeredCount, totalQuestions } = useMemo(() => {
    let total = 0;
    let answered = 0;
    const blockScores: Record<string, { earned: number; max: number; pct: number }> = {};

    for (const b of BLOCKS) {
      let earned = 0;
      const max = b.questions.length * 10;
      for (const q of b.questions) {
        const ans = answers[q.key];
        if (!ans) continue;
        answered++;
        const opt = q.options.find((o) => o.value === ans);
        if (opt) earned += opt.points;
      }
      blockScores[b.key] = { earned, max, pct: max > 0 ? (earned / max) * 100 : 0 };
      total += earned;
    }

    return {
      blockScores,
      totalScore: total,
      answeredCount: answered,
      totalQuestions: BLOCKS.reduce((s, b) => s + b.questions.length, 0),
    };
  }, [answers]);

  const cls = classify(totalScore);

  const saveMut = useMutation({
    mutationFn: async (finalize: boolean) => {
      const status = finalize ? "finalizado" : "em_andamento";

      const strong = BLOCKS.filter((b) => blockScores[b.key]?.pct >= 80).map((b) => b.title);
      const weak = BLOCKS.filter((b) => (blockScores[b.key]?.pct ?? 100) < 50 && (blockScores[b.key]?.max ?? 0) > 0).map((b) => b.title);
      const recs = BLOCKS
        .filter((b) => (blockScores[b.key]?.pct ?? 100) < 70 && (blockScores[b.key]?.max ?? 0) > 0)
        .map((b) => `• ${RECOMMENDATIONS[b.key]}`)
        .join("\n");

      const notesJson = JSON.stringify({ etapa1: companyInfo, notes: header.notes });

      const { error } = await supabase.from("financial_diagnostics").update({
        responsible_name: header.responsible_name,
        diagnostic_date: header.diagnostic_date,
        notes: notesJson,
        allow_client_view: header.allow_client_view,
        status,
        overall_score: Number(totalScore.toFixed(2)),
        classification: cls.label,
        strengths: strong.join(", "),
        weaknesses: weak.join(", "),
        recommendations: recs,
        next_steps: finalize ? generateNextSteps(blockScores) : null,
        finalized_at: finalize ? new Date().toISOString() : null,
      }).eq("id", id);
      if (error) throw error;

      const rows: any[] = [];
      for (const b of BLOCKS) {
        for (const q of b.questions) {
          const ans = answers[q.key];
          if (!ans) continue;
          const opt = q.options.find((o) => o.value === ans);
          rows.push({
            diagnostic_id: id,
            section: b.key,
            question_key: q.key,
            question: q.text,
            answer: ans,
            score: opt?.points ?? 0,
            notes: null,
          });
        }
      }
      if (rows.length) {
        const { error: e2 } = await supabase.from("financial_diagnostic_answers").upsert(rows, { onConflict: "diagnostic_id,question_key" });
        if (e2) throw e2;
      }
    },
    onSuccess: async (_d, finalize) => {
      toast.success(finalize ? "Diagnóstico finalizado" : "Rascunho salvo");
      if (finalize && diag?.company_id && diag?.consultant_id && user?.id) {
        const moved = await maybeAdvanceStage({
          companyId: diag.company_id,
          consultantId: diag.consultant_id,
          targetStage: "organizacao_financeira",
          userId: user.id,
          note: "Diagnóstico financeiro Método Mordomia finalizado",
        });
        if (moved) toast.info("Fase da empresa avançada para 'Organização financeira'.");
      }
      qc.invalidateQueries({ queryKey: ["diagnostic", id] });
      qc.invalidateQueries({ queryKey: ["diagnostic-answers", id] });
      qc.invalidateQueries({ queryKey: ["jornada-companies"] });
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setAns = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div>
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Voltar ao histórico
          </button>
          <h1 className="text-2xl md:text-3xl font-display font-bold mt-1">Diagnóstico Financeiro Empresarial</h1>
          <p className="text-sm text-muted-foreground">Método Mordomia | Finanças em Propósito</p>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Badge variant="outline">{STATUS_LABEL[diag?.status ?? "em_andamento"]}</Badge>
            <span>· {answeredCount}/{totalQuestions} respondidas</span>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => saveMut.mutate(false)} disabled={saveMut.isPending}>Salvar rascunho</Button>
            <Button onClick={() => saveMut.mutate(true)} disabled={saveMut.isPending}>
              <CheckCircle2 className="size-4" /> Finalizar
            </Button>
            <Button variant="outline" onClick={() => window.print()}><FileText className="size-4" /> PDF</Button>
          </div>
        )}
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">Diagnóstico Financeiro Empresarial</h1>
        <p className="text-lg text-muted-foreground">Método Mordomia | Finanças em Propósito</p>
      </div>

      {/* ETAPA 1: Company Identification */}
      <Card>
        <CardHeader><CardTitle className="text-base">ETAPA 1 — IDENTIFICAÇÃO DA EMPRESA</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <Label>Data do diagnóstico</Label>
              <Input
                type="date"
                value={header.diagnostic_date}
                onChange={(e) => setHeader({ ...header, diagnostic_date: e.target.value })}
                disabled={!canEdit}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Responsável pelo diagnóstico</Label>
              <Input
                value={header.responsible_name}
                onChange={(e) => setHeader({ ...header, responsible_name: e.target.value })}
                disabled={!canEdit}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Número de funcionários</Label>
              <Input
                value={companyInfo.num_funcionarios}
                onChange={(e) => setCompanyInfo({ ...companyInfo, num_funcionarios: e.target.value })}
                disabled={!canEdit}
                placeholder="Ex.: 5"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Faturamento médio mensal</Label>
              <Select
                value={companyInfo.faturamento || "none"}
                onValueChange={(v) => setCompanyInfo({ ...companyInfo, faturamento: v === "none" ? "" : v })}
                disabled={!canEdit}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar faixa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecionar faixa</SelectItem>
                  {FATURAMENTO_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {canEdit && (
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={header.allow_client_view}
                    onCheckedChange={(v) => setHeader({ ...header, allow_client_view: !!v })}
                  />
                  Liberar visualização para o cliente
                </label>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo da Pontuação</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 items-center">
            <div>
              <div className="text-xs text-muted-foreground">Pontuação geral</div>
              <div className="text-4xl font-bold mt-1">
                {totalScore.toFixed(0)}
                <span className="text-xl text-muted-foreground">/{MAX_SCORE}</span>
              </div>
              <Badge className={`mt-2 ${cls.color}`}>{cls.label}</Badge>
              <p className="text-sm text-muted-foreground mt-2">{cls.desc}</p>
              <Progress value={(totalScore / MAX_SCORE) * 100} className="mt-3" />
            </div>
            <div className="space-y-2">
              {BLOCKS.map((b) => {
                const s = blockScores[b.key];
                return (
                  <div key={b.key} className="flex items-center gap-2 text-xs">
                    <span className="w-44 truncate">{b.title}</span>
                    <Progress value={s?.pct ?? 0} className="flex-1 h-1.5" />
                    <span className="w-16 text-right text-muted-foreground">{s?.earned ?? 0}/{s?.max ?? 0} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Question Blocks (ETAPA 2–7) */}
      {BLOCKS.map((b, blockIdx) => (
        <Card key={b.key}>
          <CardHeader>
            <CardTitle className="text-base flex justify-between items-center">
              <span>ETAPA {blockIdx + 2} — {b.title}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {blockScores[b.key]?.earned ?? 0}/{blockScores[b.key]?.max ?? 0} pontos
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {b.questions.map((q) => {
              const currentAnswer = answers[q.key];
              return (
                <div key={q.key} className="border-b last:border-0 pb-4 last:pb-0 space-y-2">
                  <div className="text-sm font-medium">{q.text}</div>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => (
                      <Button
                        key={opt.value}
                        size="sm"
                        variant={currentAnswer === opt.value ? "default" : "outline"}
                        onClick={() => canEdit && setAns(q.key, opt.value)}
                        disabled={!canEdit}
                      >
                        {opt.label}
                        <span className="ml-1.5 text-[10px] opacity-70">({opt.points} pts)</span>
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Consultant Notes */}
      {canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-base">Observações do consultor</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={header.notes}
              onChange={(e) => setHeader({ ...header, notes: e.target.value })}
              placeholder="Comentários e contexto adicional sobre a empresa..."
            />
          </CardContent>
        </Card>
      )}

      {/* Results Report (shown after finalization) */}
      {diag?.status === "finalizado" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Relatório Executivo — Método Mordomia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score highlight */}
            <div className="rounded-xl border p-4 text-center">
              <div className="text-4xl font-bold">{Number(diag.overall_score ?? totalScore).toFixed(0)}/{MAX_SCORE}</div>
              <Badge className={`mt-2 ${classify(Number(diag.overall_score ?? totalScore)).color}`}>
                {diag.classification || cls.label}
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">{classify(Number(diag.overall_score ?? totalScore)).desc}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4 bg-success/5 border-success/20">
                <h4 className="font-semibold text-sm text-success mb-2">✅ Principais Pontos Fortes</h4>
                <p className="text-sm">{diag.strengths || "Nenhum identificado."}</p>
              </div>
              <div className="rounded-xl border p-4 bg-destructive/5 border-destructive/20">
                <h4 className="font-semibold text-sm text-destructive mb-2">⚠️ Principais Gargalos</h4>
                <p className="text-sm">{diag.weaknesses || "Nenhum identificado."}</p>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h4 className="font-semibold text-sm mb-2">📋 Oportunidades de Melhoria</h4>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">{diag.recommendations || "—"}</div>
            </div>

            <div className="rounded-xl border p-4 bg-primary/5 border-primary/20">
              <h4 className="font-semibold text-sm text-primary mb-2">🚀 Próximos Passos Recomendados</h4>
              <div className="text-sm whitespace-pre-wrap">{diag.next_steps || "—"}</div>
            </div>

            <div className="rounded-xl border p-4 bg-muted/30">
              <h4 className="font-semibold text-sm mb-2">📊 Parecer Executivo — Método Mordomia</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {generateExecutiveSummary(Number(diag.overall_score ?? totalScore), diag.classification ?? cls.label)}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="outline" onClick={() => window.print()}>
                <FileText className="size-4" /> Gerar PDF
              </Button>
              <Button asChild>
                <Link to="/app/agenda">
                  <Calendar className="size-4" /> Agendar Reunião Estratégica
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom save buttons */}
      {canEdit && (
        <div className="flex gap-2 flex-wrap print:hidden">
          <Button variant="outline" onClick={() => saveMut.mutate(false)} disabled={saveMut.isPending}>Salvar rascunho</Button>
          <Button onClick={() => saveMut.mutate(true)} disabled={saveMut.isPending}>
            <CheckCircle2 className="size-4" /> Finalizar diagnóstico
          </Button>
          <Button variant="outline" onClick={() => window.print()}><FileText className="size-4" /> Gerar PDF</Button>
        </div>
      )}
    </div>
  );
}
