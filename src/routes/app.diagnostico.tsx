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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Eye, FileText, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/app/diagnostico")({ component: DiagnosticoPage });

// Método Mordomia Questions Structure
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
    { key: "pre_3", text: "Revisa preços periodicamente?", points: { sim: 10, parcial: 5, nao: 0 } },
  ]},
  { key: "estoque", title: "ETAPA 4 – ESTOQUE", questions: [
    { key: "est_1", text: "Possui controle de estoque?", points: { sim: 10, parcial: 5, nao: 0 } },
    { key: "est_2", text: "Realiza inventário periódico?", points: { sim: 10, parcial: 5, nao: 0 } },
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

  if (!selectedCompanyId) return <div className="p-10 text-center text-muted-foreground">Selecione uma empresa para iniciar.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold font-display">Diagnóstico Financeiro | Método Mordomia</h1>
      {!activeId ? <DiagnosticList companyId={selectedCompanyId} onSelect={setActiveId} /> : <DiagnosticEditor id={activeId} onBack={() => setActiveId(null)} />}
    </div>
  );
}

function DiagnosticList({ companyId, onSelect }: { companyId: string; onSelect: (id: string) => void }) {
  const { data: list, refetch } = useQuery({
    queryKey: ["diagnostics", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("financial_diagnostics").select("*").eq("company_id", companyId).order("diagnostic_date", { ascending: false });
      return data ?? [];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => await supabase.from("financial_diagnostics").insert({ company_id: companyId, status: "em_andamento" }).select().single(),
    onSuccess: (d) => { refetch(); onSelect(d.data.id); },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Histórico</CardTitle>
        <Button onClick={() => createMut.mutate()}><Plus className="size-4 mr-2" /> Novo Diagnóstico</Button>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? <p className="text-sm text-center py-6 text-muted-foreground">Nenhum diagnóstico realizado.</p> : list.map(d => (
          <div key={d.id} className="flex justify-between items-center p-3 border-b hover:bg-muted/50 rounded">
            <div>
              <span className="font-semibold">{new Date(d.diagnostic_date || d.created_at).toLocaleDateString()}</span>
              <span className="ml-2 text-sm text-muted-foreground">· {d.classification || "Em andamento"}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onSelect(d.id)}><Eye className="size-4" /></Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DiagnosticEditor({ id, onBack }: { id: string; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const qc = useQueryClient();
  const { data: diag } = useQuery({ queryKey: ["diag", id], queryFn: async () => await supabase.from("financial_diagnostics").select("*").eq("id", id).single() });
  const [formData, setFormData] = useState<any>({ business_segment: "", employee_count: "", avg_monthly_revenue: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const saveMut = useMutation({
    mutationFn: async () => {
        const total = Object.entries(answers).reduce((acc, [key, ans]) => {
            const section = SECTIONS.find(s => s.questions?.find(q => q.key === key));
            const q = section?.questions?.find(q => q.key === key);
            return acc + (q?.points[ans as any] || 0);
        }, 0);
        
        let classification = "";
        if (total <= 60) classification = "Crítico";
        else if (total <= 120) classification = "Em desenvolvimento";
        else if (total <= 150) classification = "Organizada";
        else classification = "Estruturada";

        await supabase.from("financial_diagnostics").update({ 
            ...formData,
            total_points: total,
            classification,
            status: "finalizado" 
        }).eq("id", id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["diag", id] }); onBack(); }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4 mr-2" /> Voltar</Button>
        <span className="text-sm text-muted-foreground font-medium">{step + 1} de {SECTIONS.length}</span>
      </div>

      {step === 0 && (
        <Card>
            <CardHeader><CardTitle>Identificação da Empresa</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Label>Segmento</Label><Input value={formData.business_segment} onChange={e => setFormData({...formData, business_segment: e.target.value})} />
                <Label>Nº de Funcionários</Label>
                <Select onValueChange={v => setFormData({...formData, employee_count: v})}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1-5">1-5</SelectItem>
                        <SelectItem value="6-20">6-20</SelectItem>
                        <SelectItem value="20+">20+</SelectItem>
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>
      )}

      {step > 0 && step < SECTIONS.length && (
        <Card>
            <CardHeader><CardTitle>{SECTIONS[step].title}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {SECTIONS[step].questions.map(q => (
                    <div key={q.key} className="space-y-2">
                        <Label>{q.text}</Label>
                        <div className="flex gap-2">
                            {Object.keys(q.points).map(opt => (
                                <Button key={opt} variant={answers[q.key] === opt ? "default" : "outline"} onClick={() => setAnswers({...answers, [q.key]: opt})}>
                                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                                </Button>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
      )}

      {step === SECTIONS.length - 1 && (
         <Button onClick={() => saveMut.mutate()} className="w-full">Finalizar e Gerar Relatório</Button>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}><ChevronLeft className="size-4 mr-2" /> Anterior</Button>
        <Button variant="outline" onClick={() => setStep(s => Math.min(SECTIONS.length - 1, s + 1))} disabled={step === SECTIONS.length - 1}>Próximo <ChevronRight className="size-4 ml-2" /></Button>
      </div>
    </div>
  );
}
