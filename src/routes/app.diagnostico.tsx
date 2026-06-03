import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Eye, ChevronRight, ChevronLeft, Calendar, TrendingUp, AlertCircle, FileText, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/app/diagnostico")({ component: DiagnosticoPage });

const SECTIONS = [
  { key: "identificacao", title: "ETAPA 1 – IDENTIFICAÇÃO", isForm: true },
  { key: "controle", title: "ETAPA 2 – CONTROLE FINANCEIRO", questions: [
    { key: "con_1", text: "Possui fluxo de caixa atualizado?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "con_2", text: "Possui controle de contas a pagar?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "con_3", text: "Possui controle de contas a receber?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "con_4", text: "Consegue prever o saldo da empresa para os próximos 30 dias?", points: { sim: 10, parcial: 5, nao: 0 } },
  ]},
  { key: "precificacao", title: "ETAPA 3 – PRECIFICAÇÃO E MARGEM", questions: [
    { key: "pre_1", text: "Conhece a margem dos seus principais produtos ou serviços?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "pre_2", text: "Possui metodologia de precificação?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "pre_3", text: "Revisa preços periodicamente?", points: { sim: 10, as_vezes: 5, nao: 0 } },
  ]},
  { key: "estoque", title: "ETAPA 4 – ESTOQUE", questions: [
    { key: "est_1", text: "Possui controle de estoque?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "est_2", text: "Realiza inventário periódico?", points: { sim: 10, as_vezes: 5, nao: 0 } },
    { key: "est_3", text: "Conhece o valor financeiro do estoque atual?", points: { sim: 10, parcial: 5, nao: 0 } },
  ]},
  { key: "socios", title: "ETAPA 5 – SÓCIOS E RETIRADAS", questions: [
    { key: "soc_1", text: "Existe pró-labore definido?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "soc_2", text: "Existe separação entre contas pessoais e empresariais?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "soc_3", text: "Existem retiradas sem controle?", points: { nunca: 10, as_vezes: 5, frequentemente: 0 } },
  ]},
  { key: "leitura", title: "ETAPA 6 – LEITURA DOS NÚMEROS", questions: [
    { key: "lei_1", text: "Você sabe qual foi o lucro dos últimos 3 meses?", points: { sim: 10, aproximadamente: 5, nao: 0 } },
    { key: "lei_2", text: "Analisa relatórios financeiros regularmente?", points: { sim: 10, as_vezes: 5, nao: 0 } },
    { key: "lei_3", text: "Toma decisões baseadas em números?", points: { sim: 10, as_vezes: 5, nao: 0 } },
  ]},
  { key: "gestao", title: "ETAPA 7 – GESTÃO", questions: [
    { key: "ges_1", text: "Possui metas financeiras definidas?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "ges_2", text: "Possui orçamento mensal?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "ges_3", text: "A empresa possui indicadores de desempenho?", points: { sim: 10, parcial: 5, nao: 0 } },
  ]},
];

function DiagnosticoPage() {
  const { selected: selectedCompanyId } = useSelectedCompany();
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!selectedCompanyId) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center space-y-4">
        <FileText className="size-16 text-muted-foreground opacity-20" />
        <h2 className="text-xl font-semibold">Selecione uma empresa</h2>
        <p className="text-muted-foreground max-w-xs mx-auto">Abra uma empresa cliente para iniciar ou visualizar diagnósticos financeiros.</p>
        <Button asChild variant="outline"><Link to="/app">Ir para Empresas</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display">Diagnóstico Financeiro</h1>
          <p className="text-muted-foreground">Método Mordomia | Finanças em Propósito</p>
        </div>
        {activeId && (
          <Button variant="ghost" onClick={() => setActiveId(null)}><ArrowLeft className="size-4 mr-2" /> Voltar ao Histórico</Button>
        )}
      </div>

      {!activeId ? <DiagnosticList companyId={selectedCompanyId} onSelect={setActiveId} /> : <DiagnosticEditor id={activeId} onBack={() => setActiveId(null)} />}
    </div>
  );
}

function DiagnosticList({ companyId, onSelect }: { companyId: string; onSelect: (id: string) => void }) {
  const { user, isConsultant } = useAuth();
  const { data: list, refetch } = useQuery({
    queryKey: ["diagnostics", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("financial_diagnostics").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
        const { data: consultant } = await supabase.from("consultants").select("id").eq("user_id", user?.id || "").maybeSingle();
        if (!consultant) throw new Error("Consultor não encontrado. Verifique seu perfil.");
        const { data, error } = await supabase.from("financial_diagnostics").insert({ 
            company_id: companyId, 
            status: "em_andamento", 
            consultant_id: consultant.id 
        }).select().single();
        if (error) throw error;
        return data;
    },
    onSuccess: (data) => { refetch(); onSelect(data.id); },
    onError: (e: any) => toast.error("Falha ao criar diagnóstico: " + e.message),
  });

  return (
    <div className="grid gap-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
          <TrendingUp className="size-12 text-primary" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Diagnóstico Estratégico</h3>
            <p className="text-muted-foreground max-w-md">Avalie a maturidade financeira da empresa e gere um relatório executivo automático com recomendações.</p>
          </div>
          {isConsultant && (
            <Button onClick={() => createMut.mutate()} size="lg" className="px-10"><Plus className="size-4 mr-2" /> Iniciar Agora</Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Calendar className="size-5" /> Histórico de Avaliações</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list?.map(d => (
            <Card key={d.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => onSelect(d.id)}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <Badge variant={d.status === "finalizado" ? "default" : "outline"}>{d.status === "finalizado" ? "Finalizado" : "Em rascunho"}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <div className="text-2xl font-bold">{d.total_points || 0}/180</div>
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{d.classification || "—"}</div>
                </div>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto text-primary hover:bg-transparent">
                  Visualizar detalhes <ChevronRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {!list?.length && (
            <div className="col-span-full py-10 text-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              Nenhum diagnóstico realizado para esta empresa ainda.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const qc = useQueryClient();
  const { data: diag } = useQuery({ queryKey: ["diag", id], queryFn: async () => await supabase.from("financial_diagnostics").select("*").eq("id", id).single() });
  const { data: existingAnswers } = useQuery({ 
    queryKey: ["diag-answers", id], 
    queryFn: async () => {
      const { data } = await supabase.from("financial_diagnostic_answers").select("*").eq("diagnostic_id", id);
      return data || [];
    }
  });

  const [formData, setFormData] = useState<any>({ business_segment: "", employee_count: "", avg_monthly_revenue: "", business_city: "", business_phone: "", business_email: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (diag?.data) {
      setFormData({
        business_segment: diag.data.business_segment || "",
        business_city: diag.data.business_city || "",
        business_phone: diag.data.business_phone || "",
        business_email: diag.data.business_email || "",
        employee_count: diag.data.employee_count || "",
        avg_monthly_revenue: diag.data.avg_monthly_revenue || "",
      });
    }
  }, [diag]);

  useEffect(() => {
    if (existingAnswers?.length) {
      const map: Record<string, string> = {};
      existingAnswers.forEach(a => {
        map[a.question_key] = a.answer || "";
      });
      setAnswers(map);
    }
  }, [existingAnswers]);

  const saveMut = useMutation({
    mutationFn: async (finalize: boolean) => {
        let total = 0;
        const strengths: string[] = [];
        const bottlenecks: string[] = [];
        
        SECTIONS.forEach(section => {
          if (section.questions) {
            let sectionScore = 0;
            section.questions.forEach(q => {
              const ans = answers[q.key];
              if (ans) {
                const points = (q.points as any)[ans] || 0;
                sectionScore += points;
                total += points;
              }
            });
            if (sectionScore >= 30) strengths.push(section.title.split(" – ")[1] || section.title);
            if (sectionScore <= 15) bottlenecks.push(section.title.split(" – ")[1] || section.title);
          }
        });
        
        let classification = "";
        if (total <= 60) classification = "Crítico";
        else if (total <= 120) classification = "Em desenvolvimento";
        else if (total <= 150) classification = "Organizada";
        else classification = "Estruturada";

        const { error } = await supabase.from("financial_diagnostics").update({ 
            ...formData,
            total_points: total,
            classification,
            strengths: strengths.join(", "),
            weaknesses: bottlenecks.join(", "),
            status: finalize ? "finalizado" : "em_andamento" 
        }).eq("id", id);
        if (error) throw error;

        // Save individual answers
        const answerRows = Object.entries(answers).map(([key, ans]) => {
          const section = SECTIONS.find(s => s.questions?.find(q => q.key === key));
          const q = section?.questions?.find(q => q.key === key);
          return {
            diagnostic_id: id,
            section: section?.key || "",
            question_key: key,
            question: q?.text || "",
            answer: ans,
            score: (q?.points as any)[ans] || 0
          };
        });

        if (answerRows.length > 0) {
          const { error: err2 } = await supabase.from("financial_diagnostic_answers").upsert(answerRows, { onConflict: "diagnostic_id,question_key" });
          if (err2) throw err2;
        }
    },
    onSuccess: () => { 
        qc.invalidateQueries({ queryKey: ["diag", id] }); 
        qc.invalidateQueries({ queryKey: ["diag-answers", id] });
        toast.success("Diagnóstico salvo com sucesso!");
        if (step === SECTIONS.length - 1) onBack();
    },
    onError: (e: any) => toast.error("Falha ao salvar: " + e.message),
  });

  if (!diag?.data) return <div className="p-20 text-center text-muted-foreground">Carregando...</div>;

  const isFinalized = diag.data.status === "finalizado";

  if (isFinalized) {
      return <DiagnosticReport data={diag.data} onBack={onBack} />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${((step + 1) / SECTIONS.length) * 100}%` }} />
        </div>
        <span className="text-sm font-semibold whitespace-nowrap">{step + 1} / {SECTIONS.length}</span>
      </div>

      <div className="min-h-[400px]">
        {step === 0 && (
          <Card>
              <CardHeader><CardTitle>Identificação da Empresa</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Segmento</Label>
                    <Input placeholder="Ex: Varejo, Serviços..." value={formData.business_segment} onChange={e => setFormData({...formData, business_segment: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input placeholder="Cidade - UF" value={formData.business_city} onChange={e => setFormData({...formData, business_city: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Nº de Funcionários</Label>
                    <Input placeholder="Quantidade total" value={formData.employee_count} onChange={e => setFormData({...formData, employee_count: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Faturamento Médio Mensal</Label>
                    <Select value={formData.avg_monthly_revenue} onValueChange={v => setFormData({...formData, avg_monthly_revenue: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecione a faixa" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ate_20k">Até R$ 20.000</SelectItem>
                            <SelectItem value="20k_50k">R$ 20.001 a R$ 50.000</SelectItem>
                            <SelectItem value="50k_100k">R$ 50.001 a R$ 100.000</SelectItem>
                            <SelectItem value="100k_300k">R$ 100.001 a R$ 300.000</SelectItem>
                            <SelectItem value="acima_300k">Acima de R$ 300.000</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input placeholder="(00) 00000-0000" value={formData.business_phone} onChange={e => setFormData({...formData, business_phone: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input placeholder="contato@empresa.com.br" type="email" value={formData.business_email} onChange={e => setFormData({...formData, business_email: e.target.value})} />
                  </div>
              </CardContent>
          </Card>
        )}

        {step > 0 && (
          <Card>
              <CardHeader><CardTitle>{SECTIONS[step].title}</CardTitle></CardHeader>
              <CardContent className="space-y-8">
                  {SECTIONS[step].questions?.map(q => (
                      <div key={q.key} className="space-y-4">
                          <Label className="text-base font-medium leading-relaxed">{q.text}</Label>
                          <div className="flex gap-2 flex-wrap">
                              {Object.keys(q.points).map(opt => (
                                  <Button key={opt} variant={answers[q.key] === opt ? "default" : "outline"} className="flex-1 min-w-[120px]" onClick={() => setAnswers({...answers, [q.key]: opt})}>
                                      {opt.replace("_", " ").charAt(0).toUpperCase() + opt.replace("_", " ").slice(1)}
                                  </Button>
                              ))}
                          </div>
                      </div>
                  ))}
              </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-between pt-4 border-t">
        <Button variant="outline" size="lg" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft className="size-4 mr-2" /> Anterior</Button>
        <div className="flex gap-2">
            <Button variant="ghost" onClick={() => saveMut.mutate(false)}>Salvar Rascunho</Button>
            {step < SECTIONS.length - 1 ? (
                <Button size="lg" onClick={() => setStep(s => s + 1)}>Próximo <ChevronRight className="size-4 ml-2" /></Button>
            ) : (
                <Button size="lg" onClick={() => saveMut.mutate(true)} className="px-10"><CheckCircle2 className="size-4 mr-2" /> Finalizar Diagnóstico</Button>
            )}
        </div>
      </div>
    </div>
  );
}

function DiagnosticReport({ data, onBack }: { data: any; onBack: () => void }) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-none shadow-2xl overflow-hidden">
                <div className="bg-primary p-10 text-primary-foreground">
                    <div className="flex justify-between items-start mb-6">
                        <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none">Relatório Executivo</Badge>
                        <span className="text-sm opacity-80">{new Date(data.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex flex-col md:flex-row gap-10 items-center justify-between">
                        <div className="space-y-2 text-center md:text-left">
                            <h2 className="text-4xl font-bold font-display tracking-tight">Resultado da Avaliação</h2>
                            <p className="text-xl opacity-90 max-w-md">Sua empresa possui um nível de maturidade: <span className="font-bold underline decoration-2 underline-offset-4">{data.classification}</span></p>
                        </div>
                        <div className="bg-white/10 p-8 rounded-full border border-white/20 aspect-square flex flex-col items-center justify-center min-w-[200px]">
                            <span className="text-5xl font-black">{data.total_points}</span>
                            <span className="text-sm font-medium opacity-70">DE 180 PONTOS</span>
                        </div>
                    </div>
                </div>
                <CardContent className="p-8 space-y-10 bg-card">
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-success"><CheckCircle2 className="size-5" /> Principais Pontos Fortes</h3>
                            <div className="flex flex-wrap gap-2">
                                {data.strengths?.split(", ").map((s: string) => <Badge key={s} variant="outline" className="px-3 py-1 border-success/30 text-success bg-success/5">{s}</Badge>) || <span className="text-muted-foreground text-sm italic">Nenhum identificado</span>}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-bold text-lg flex items-center gap-2 text-destructive"><AlertCircle className="size-5" /> Principais Gargalos</h3>
                            <div className="flex flex-wrap gap-2">
                                {data.weaknesses?.split(", ").map((s: string) => <Badge key={s} variant="outline" className="px-3 py-1 border-destructive/30 text-destructive bg-destructive/5">{s}</Badge>) || <span className="text-muted-foreground text-sm italic">Nenhum identificado</span>}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-bold text-lg">Oportunidades de Melhoria</h3>
                        <div className="grid gap-3">
                            {data.weaknesses?.split(", ").map((g: string) => (
                                <div key={g} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                                    <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">!</div>
                                    <div>
                                        <div className="font-bold text-sm">Implantar melhorias em {g}</div>
                                        <p className="text-xs text-muted-foreground mt-1">Estruturar processos e ferramentas para garantir o controle de {g.toLowerCase()}.</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-bold text-lg">Parecer Executivo | Método Mordomia</h3>
                        <div className="p-6 bg-muted/30 rounded-xl leading-relaxed text-muted-foreground whitespace-pre-wrap italic text-sm">
                            {data.total_points <= 60 && "Sua empresa encontra-se em uma situação de vulnerabilidade financeira alta. A ausência de controles básicos impede uma visão clara do lucro e coloca em risco a continuidade do negócio. É necessária uma intervenção imediata para estruturar o fluxo de caixa e separar as contas pessoais das empresariais."}
                            {data.total_points > 60 && data.total_points <= 120 && "A empresa possui alguns controles, mas ainda carece de processos robustos para garantir previsibilidade. O crescimento pode estar sendo freado por gargalos operacionais e falta de análise de margens. Recomenda-se estruturar a leitura dos números para decisões mais assertivas."}
                            {data.total_points > 120 && data.total_points <= 150 && "Parabéns! Sua empresa demonstra uma organização sólida. O próximo nível envolve a otimização de metas, orçamentos e uma gestão mais profunda de indicadores de desempenho para maximizar o lucro."}
                            {data.total_points > 150 && "Excelência! Sua empresa possui uma maturidade financeira acima da média. O foco agora deve ser a escalabilidade com segurança e a manutenção da cultura de propósito financeiro."}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-6">
                        <Button className="flex-1 py-6 text-lg font-bold shadow-lg" onClick={() => window.open('https://calendly.com', '_blank')}><Calendar className="size-5 mr-2" /> Agendar Reunião Estratégica</Button>
                        <Button variant="outline" className="flex-1 py-6 text-lg font-bold" onClick={() => window.print()}><FileText className="size-5 mr-2" /> Gerar PDF do Relatório</Button>
                    </div>
                </CardContent>
            </Card>
            <div className="text-center">
                <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4 mr-2" /> Voltar ao Painel</Button>
            </div>
        </div>
    );
}
