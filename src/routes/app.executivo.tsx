import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { BranchSwitcher } from "@/components/branch-switcher";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import {
  fetchReportData,
  buildDRE,
  buildFluxoRealizado,
  buildContasPagar,
  buildContasReceber,
  buildMargemContribuicao,
  buildPontoEquilibrio,
  buildVendasMargem,
  buildEstoqueFinanceiro,
  buildInconsistencias,
  buildSerieMensal,
  buildDestaquesAlertas,
  type SerieMes,
  type Inconsistencia,
  type Destaque,
} from "@/lib/reports";
import { generateExecutiveAnalysis } from "@/lib/executive-ai.functions";
import {
  ArrowLeft, Printer, Save, FileText, Sparkles, MessageCircle, AlertTriangle,
  TrendingUp, TrendingDown, CheckCircle2, Loader2, Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/app/executivo")({ component: Executivo });

const BRAND = {
  primary: "#628A4C",
  secondary: "#76993D",
  support: "#AFBE6C",
  light: "#C4E477",
  graphite: "#232323",
  sand: "#F1EEE6",
  neutral: "#D9D9D6",
};
const CHART_PALETTE = [BRAND.primary, BRAND.secondary, BRAND.support, BRAND.light, "#8AA663", "#4D6E3B"];

const fmt = (n: number) => formatMoney(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;
const iso = (d: Date) => d.toISOString().slice(0, 10);

function Executivo() {
  const { isConsultant, user } = useAuth();
  const { companies, selected, select } = useSelectedCompany();
  const { branchId } = useSelectedBranch();

  const now = new Date();
  const [inicio, setInicio] = useState<string>(iso(new Date(now.getFullYear(), now.getMonth() - 2, 1)));
  const [fim, setFim] = useState<string>(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [iaAnalysis, setIaAnalysis] = useState<string>("");
  const [iaLoading, setIaLoading] = useState(false);
  const [waOpen, setWaOpen] = useState(false);

  const { data: ownedCompanies } = useQuery({
    queryKey: ["all-companies-exec"],
    enabled: isConsultant,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome, cnpj").order("nome");
      return data ?? [];
    },
  });
  const allCompanies = isConsultant ? (ownedCompanies ?? []) : companies;
  const currentCompanyId = selected ?? allCompanies[0]?.id;
  const company = useMemo(
    () => allCompanies.find((c: any) => c.id === currentCompanyId),
    [allCompanies, currentCompanyId],
  );

  const period = useMemo(() => ({ start: inicio, end: fim }), [inicio, fim]);

  const { data, isFetching: fetchingData } = useQuery({
    queryKey: ["exec-data", currentCompanyId, branchId, period.start, period.end],
    enabled: !!currentCompanyId,
    queryFn: () => fetchReportData(currentCompanyId!, branchId, period),
  });

  const { data: serie, isFetching: fetchingSerie } = useQuery({
    queryKey: ["exec-serie", currentCompanyId, branchId, period.start, period.end],
    enabled: !!currentCompanyId,
    queryFn: () => buildSerieMensal(currentCompanyId!, branchId, period.start, period.end),
  });

  const dre = data ? buildDRE(data, period) : null;
  const fluxo = data ? buildFluxoRealizado(data, period) : null;
  const pay = data ? buildContasPagar(data, period) : null;
  const rec = data ? buildContasReceber(data, period) : null;
  const mc = data ? buildMargemContribuicao(data, period) : null;
  const pe = data ? buildPontoEquilibrio(data, period) : null;
  const vendas = data ? buildVendasMargem(data, period) : null;
  const estoque = data ? buildEstoqueFinanceiro(data) : null;
  const inconsist: Inconsistencia[] = data ? buildInconsistencias(data, period) : [];

  const destaques: Destaque[] = useMemo(() => {
    if (!serie || !vendas || !rec || !pay || !estoque) return [];
    return buildDestaquesAlertas(
      serie,
      { margemPct: vendas.summary.margemPct, custoZerado: vendas.summary.custoZerado, itensIncompletos: vendas.summary.itensIncompletos },
      { inadimplencia: rec.summary.inadimplencia, vencido: rec.summary.vencido },
      { vencido: pay.summary.vencido },
      { abaixoMin: estoque.summary.abaixoMin, zerados: estoque.summary.zerados },
    );
  }, [serie, vendas, rec, pay, estoque]);

  // Comparativo com mês anterior (último vs penúltimo da série)
  const cur = serie && serie.length > 0 ? serie[serie.length - 1] : null;
  const prev = serie && serie.length > 1 ? serie[serie.length - 2] : null;
  const growth = (a?: number | null, b?: number | null) => {
    if (a == null || b == null || b === 0) return null;
    return ((a - b) / Math.abs(b)) * 100;
  };

  // Diagnóstico salvo (mês atual)
  const mesRef = new Date(fim).getMonth() + 1;
  const anoRef = new Date(fim).getFullYear();
  const { data: saved, refetch: refetchSaved } = useQuery({
    queryKey: ["exec-saved", currentCompanyId, branchId, mesRef, anoRef],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      let q = supabase
        .from("executive_reports" as any)
        .select("*")
        .eq("company_id", currentCompanyId!)
        .eq("mes", mesRef)
        .eq("ano", anoRef);
      q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null);
      const { data } = await q.maybeSingle();
      return data as any;
    },
  });

  const [form, setForm] = useState({ diagnostico: "", problemas: "", recomendacoes: "", plano_acao: "", observacoes: "" });
  useEffect(() => {
    setForm({
      diagnostico: saved?.diagnostico ?? "",
      problemas: saved?.problemas ?? "",
      recomendacoes: saved?.recomendacoes ?? "",
      plano_acao: saved?.plano_acao ?? "",
      observacoes: saved?.observacoes ?? "",
    });
    setIaAnalysis(saved?.ia_analysis ?? "");
  }, [saved?.id, mesRef, anoRef, currentCompanyId, branchId]);

  const saveDiagnosis = async () => {
    if (!isConsultant) return;
    const snapshot = {
      periodo: { inicio, fim },
      kpis: cur ?? null,
      destaques: destaques.map((d) => d.texto),
      inconsist_count: inconsist.length,
    };
    const payload: any = {
      company_id: currentCompanyId,
      branch_id: branchId,
      mes: mesRef,
      ano: anoRef,
      ...form,
      snapshot,
      ia_analysis: iaAnalysis || null,
      periodo_inicio: inicio,
      periodo_fim: fim,
      created_by: user?.id,
    };
    const { error } = saved?.id
      ? await supabase.from("executive_reports" as any).update(payload).eq("id", saved.id)
      : await supabase.from("executive_reports" as any).insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Relatório salvo.");
      refetchSaved();
    }
  };

  const callIa = useServerFn(generateExecutiveAnalysis);
  const runIa = async () => {
    if (!cur) {
      toast.error("Sem indicadores suficientes para análise IA.");
      return;
    }
    setIaLoading(true);
    try {
      const topProdutos = (vendas?.produtos ?? [])
        .slice()
        .sort((a: any, b: any) => (b["Receita total"] as number) - (a["Receita total"] as number))
        .slice(0, 8)
        .map((p: any) => ({
          produto: p.Produto,
          quantidade: p.Quantidade,
          receita: p["Receita total"],
          margem_pct: p["Margem %"],
        }));
      const kpis = {
        receita_bruta: cur.receitaBruta,
        receita_liquida: cur.receitaLiquida,
        custos_variaveis: cur.custosVariaveis,
        custos_fixos: cur.custosFixos,
        resultado_operacional: cur.resultadoOperacional,
        margem_operacional_pct: cur.margemOperacional,
        lucro_liquido: cur.lucroLiquido,
        margem_liquida_pct: cur.margemLiquida,
        ticket_medio: cur.ticketMedio,
        qtd_vendas: cur.qtdVendas,
        contas_receber_vencidas: rec?.summary.vencido ?? 0,
        contas_pagar_vencidas: pay?.summary.vencido ?? 0,
      };
      const { analysis } = await callIa({
        data: {
          empresa: company?.nome ?? "—",
          periodo: `${inicio} a ${fim}`,
          kpis,
          serieMensal: (serie ?? []).map((s) => ({
            mes: s.label,
            receita_bruta: s.receitaBruta,
            receita_liquida: s.receitaLiquida,
            lucro: s.lucroLiquido,
            margem_op_pct: s.margemOperacional,
          })),
          topProdutos,
          destaques: destaques.map((d) => `[${d.tipo}] ${d.texto}`),
          inconsistencias: inconsist.length,
        },
      });
      setIaAnalysis(analysis);
      toast.success("Análise consultiva gerada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar análise IA");
    } finally {
      setIaLoading(false);
    }
  };

  const whatsappText = useMemo(() => {
    if (!cur) return "";
    const growthReceita = growth(cur.receitaBruta, prev?.receitaBruta);
    const linhas: string[] = [];
    linhas.push(`*Relatório Executivo — ${company?.nome ?? ""}*`);
    linhas.push(`Período: ${inicio} a ${fim}`);
    linhas.push("");
    linhas.push(`💰 Receita bruta: ${fmt(cur.receitaBruta)}${growthReceita != null ? ` (${growthReceita >= 0 ? "+" : ""}${growthReceita.toFixed(1)}% vs mês anterior)` : ""}`);
    linhas.push(`📈 Lucro líquido: ${fmt(cur.lucroLiquido)} • Margem: ${fmtPct(cur.margemLiquida)}`);
    linhas.push(`🎯 Margem operacional: ${fmtPct(cur.margemOperacional)}`);
    const atencoes = destaques.filter((d) => d.tipo !== "positivo").slice(0, 2);
    if (atencoes.length) {
      linhas.push("");
      linhas.push("⚠️ Pontos de atenção:");
      atencoes.forEach((a) => linhas.push(`• ${a.texto}`));
    }
    linhas.push("");
    linhas.push("_Relatório gerado pelo SistemaFP PJ_");
    return linhas.join("\n");
  }, [cur, prev, company, inicio, fim, destaques]);

  if (!currentCompanyId) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Análise Gerencial</h1>
        <p className="text-muted-foreground">Selecione uma empresa.</p>
      </div>
    );
  }

  const loading = fetchingData || fetchingSerie;

  return (
    <div className="space-y-6 max-w-7xl print:max-w-none print:space-y-4">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/app/relatorios"><Button variant="ghost" size="sm"><ArrowLeft className="size-4" /> Voltar</Button></Link>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Análise Gerencial</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isConsultant && <Button onClick={saveDiagnosis} variant="outline"><Save className="size-4" /> Salvar</Button>}
          <Button variant="outline" onClick={() => setWaOpen(true)}><MessageCircle className="size-4" /> WhatsApp</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Exportar PDF</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border rounded-2xl p-4 shadow-card flex flex-wrap gap-3 items-end print:hidden">
        {isConsultant && (
          <Field label="Empresa">
            <select value={currentCompanyId} onChange={(e) => select(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-background min-w-[220px]">
              {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
        )}
        <Field label="Período — início">
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Período — fim">
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <div className="ml-auto"><BranchSwitcher /></div>
      </div>

      {/* Cabeçalho do relatório */}
      <div className="bg-card border rounded-2xl p-6 shadow-card print:border-0 print:shadow-none print:rounded-none print:p-2">
        <div className="flex items-center gap-3 border-b pb-4 mb-4" style={{ borderColor: BRAND.support }}>
          <FileText className="size-6" style={{ color: BRAND.primary }} />
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold" style={{ color: BRAND.graphite }}>{company?.nome ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">
              {(company as any)?.cnpj ? `CNPJ ${(company as any).cnpj} • ` : ""}
              Período: {inicio} a {fim} • {branchId ? "Filial específica" : "Consolidado"}
            </p>
          </div>
          <div className="text-xs text-muted-foreground text-right">
            Gerado em<br />{new Date().toLocaleString("pt-BR")}
          </div>
        </div>

        {loading || !cur ? (
          <p className="text-muted-foreground py-8 text-center">Calculando indicadores...</p>
        ) : (
          <>
            {/* KPIs */}
            <SectionTitle>Indicadores do período</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <Kpi label="Receita bruta" value={fmt(cur.receitaBruta)} delta={growth(cur.receitaBruta, prev?.receitaBruta)} />
              <Kpi label="Receita líquida" value={fmt(cur.receitaLiquida)} delta={growth(cur.receitaLiquida, prev?.receitaLiquida)} />
              <Kpi label="Custos variáveis" value={fmt(cur.custosVariaveis)} />
              <Kpi label="Custos fixos" value={fmt(cur.custosFixos)} />
              <Kpi label="Despesas financeiras" value={fmt(cur.despesasFin)} />
              <Kpi label="Resultado operacional" value={fmt(cur.resultadoOperacional)} delta={growth(cur.resultadoOperacional, prev?.resultadoOperacional)} />
              <Kpi label="Margem operacional" value={fmtPct(cur.margemOperacional)} />
              <Kpi label="Margem contribuição" value={fmtPct(mc?.summary.mcPct ?? 0)} />
              <Kpi label="Lucro líquido" value={fmt(cur.lucroLiquido)} delta={growth(cur.lucroLiquido, prev?.lucroLiquido)} />
              <Kpi label="Ticket médio" value={fmt(cur.ticketMedio)} />
              <Kpi label="Qtd. vendas" value={String(cur.qtdVendas)} />
              <Kpi label="A receber (vencidas)" value={fmt(rec?.summary.vencido ?? 0)} />
              <Kpi label="A receber (abertas)" value={fmt(rec?.summary.totalReceber ?? 0)} />
              <Kpi label="A pagar (abertas)" value={fmt(pay?.summary.totalPagar ?? 0)} />
              <Kpi label="Ponto de equilíbrio" value={fmt((pe?.rows[2]?.Valor as number) ?? 0)} />
              <Kpi label="Inadimplência" value={fmtPct(rec?.summary.inadimplencia ?? 0)} />
            </div>

            {/* Gráficos */}
            {serie && serie.length > 0 && (
              <>
                <SectionTitle>Gráficos</SectionTitle>
                <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
                  <ChartCard title="Receita bruta × líquida por mês">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={serie}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BRAND.neutral} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend />
                        <Bar dataKey="receitaBruta" name="Bruta" fill={BRAND.primary} />
                        <Bar dataKey="receitaLiquida" name="Líquida" fill={BRAND.support} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Resultado operacional por mês">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={serie}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BRAND.neutral} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Bar dataKey="resultadoOperacional" name="Resultado op." fill={BRAND.secondary} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Margem operacional (%) por mês">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={serie}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BRAND.neutral} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                        <Line type="monotone" dataKey="margemOperacional" name="Margem op." stroke={BRAND.primary} strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="Evolução do faturamento">
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={serie}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BRAND.neutral} />
                        <XAxis dataKey="label" fontSize={11} />
                        <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Area type="monotone" dataKey="receitaBruta" name="Faturamento" stroke={BRAND.primary} fill={BRAND.light} fillOpacity={0.6} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  {fluxo && fluxo.saidasPorCategoria.length > 0 && (
                    <ChartCard title="Despesas por categoria">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={fluxo.saidasPorCategoria.slice(0, 8)} dataKey="Valor" nameKey="Categoria" outerRadius={80} label={(e: any) => e.Categoria}>
                            {fluxo.saidasPorCategoria.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number) => fmt(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}

                  {vendas && vendas.produtos.length > 0 && (
                    <ChartCard title="Top produtos por faturamento">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={vendas.produtos.slice().sort((a: any, b: any) => (b["Receita total"] as number) - (a["Receita total"] as number)).slice(0, 6)}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke={BRAND.neutral} />
                          <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                          <YAxis type="category" dataKey="Produto" fontSize={11} width={130} />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Bar dataKey="Receita total" name="Receita" fill={BRAND.primary} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  )}
                </div>

                {/* Tabela comparativa */}
                <SectionTitle>Tabela comparativa mensal</SectionTitle>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: BRAND.sand }}>
                      <tr>
                        <th className="text-left py-2 px-3 text-xs uppercase font-medium">Indicador</th>
                        {serie.map((s) => (
                          <th key={s.label} className="text-right py-2 px-3 text-xs uppercase font-medium">{s.label}</th>
                        ))}
                        <th className="text-right py-2 px-3 text-xs uppercase font-medium">Var último</th>
                      </tr>
                    </thead>
                    <tbody>
                      <ComparativoRow label="Receita bruta" values={serie.map((s) => s.receitaBruta)} money />
                      <ComparativoRow label="Receita líquida" values={serie.map((s) => s.receitaLiquida)} money />
                      <ComparativoRow label="Custos variáveis" values={serie.map((s) => s.custosVariaveis)} money />
                      <ComparativoRow label="Custos fixos" values={serie.map((s) => s.custosFixos)} money />
                      <ComparativoRow label="Resultado operacional" values={serie.map((s) => s.resultadoOperacional)} money />
                      <ComparativoRow label="Margem operacional (%)" values={serie.map((s) => s.margemOperacional)} />
                      <ComparativoRow label="Lucro líquido" values={serie.map((s) => s.lucroLiquido)} money />
                      <ComparativoRow label="Ticket médio" values={serie.map((s) => s.ticketMedio)} money />
                      <ComparativoRow label="Qtd. vendas" values={serie.map((s) => s.qtdVendas)} />
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Destaques */}
            <SectionTitle>Destaques do período</SectionTitle>
            {destaques.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum destaque gerado — dados insuficientes ou tudo dentro do esperado.</p>
            ) : (
              <ul className="space-y-2">
                {destaques.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm rounded-lg border p-3" style={{
                    borderColor: d.tipo === "critico" ? "#c0392b" : d.tipo === "atencao" ? BRAND.support : BRAND.primary,
                    backgroundColor: d.tipo === "critico" ? "#fff5f4" : d.tipo === "atencao" ? "#fdfbef" : "#f4f8ee",
                  }}>
                    {d.tipo === "positivo" ? <TrendingUp className="size-4 mt-0.5" style={{ color: BRAND.primary }} /> :
                     d.tipo === "critico" ? <AlertTriangle className="size-4 mt-0.5 text-red-600" /> :
                     <TrendingDown className="size-4 mt-0.5" style={{ color: BRAND.secondary }} />}
                    <span>{d.texto}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Inconsistências */}
            {inconsist.length > 0 && (
              <>
                <SectionTitle>Inconsistências encontradas</SectionTitle>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead style={{ backgroundColor: BRAND.sand }}>
                      <tr>
                        <th className="text-left py-2 px-3 text-xs uppercase">OS</th>
                        <th className="text-left py-2 px-3 text-xs uppercase">Cliente</th>
                        <th className="text-left py-2 px-3 text-xs uppercase">Problema</th>
                        <th className="text-left py-2 px-3 text-xs uppercase">Impacto</th>
                        <th className="text-left py-2 px-3 text-xs uppercase">Ação sugerida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inconsist.slice(0, 30).map((i, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2 px-3 font-mono text-xs">{i.os}</td>
                          <td className="py-2 px-3">{i.cliente}</td>
                          <td className="py-2 px-3">{i.problema}</td>
                          <td className="py-2 px-3 text-muted-foreground">{i.impacto}</td>
                          <td className="py-2 px-3">{i.acao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {inconsist.length > 30 && (
                    <div className="text-xs text-muted-foreground p-2">+ {inconsist.length - 30} inconsistências adicionais.</div>
                  )}
                </div>
              </>
            )}

            {/* IA */}
            <SectionTitle>Análise consultiva com IA</SectionTitle>
            <div className="border rounded-lg p-4" style={{ backgroundColor: BRAND.sand }}>
              {!iaAnalysis && !iaLoading && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-sm text-muted-foreground">
                    A IA analisa apenas os indicadores calculados acima. Nenhum número é inventado.
                  </p>
                  <Button onClick={runIa} className="print:hidden">
                    <Sparkles className="size-4" /> Gerar análise
                  </Button>
                </div>
              )}
              {iaLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Gerando análise consultiva...
                </div>
              )}
              {iaAnalysis && (
                <>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[13px]">{iaAnalysis}</div>
                  <div className="mt-3 print:hidden">
                    <Button size="sm" variant="ghost" onClick={runIa}><Sparkles className="size-4" /> Regerar</Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* Rodapé */}
        <div className="mt-8 pt-4 border-t text-xs text-muted-foreground text-center" style={{ borderColor: BRAND.neutral }}>
          Relatório gerado pelo SistemaFP PJ — Finanças em Propósito
        </div>
      </div>

      {/* Diagnóstico do consultor */}
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4 print:hidden">
        <h2 className="font-display text-xl font-bold">Diagnóstico do Consultor</h2>
        {!isConsultant && !saved && (
          <p className="text-sm text-muted-foreground">Aguardando preenchimento pelo consultor.</p>
        )}
        {(isConsultant || saved) && (
          <div className="grid gap-4">
            <ConsultantField label="Diagnóstico do mês" value={form.diagnostico} onChange={(v) => setForm((f) => ({ ...f, diagnostico: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Principais problemas encontrados" value={form.problemas} onChange={(v) => setForm((f) => ({ ...f, problemas: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Recomendações" value={form.recomendacoes} onChange={(v) => setForm((f) => ({ ...f, recomendacoes: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Plano de ação para o próximo mês" value={form.plano_acao} onChange={(v) => setForm((f) => ({ ...f, plano_acao: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Observações finais" value={form.observacoes} onChange={(v) => setForm((f) => ({ ...f, observacoes: v }))} readOnly={!isConsultant} />
          </div>
        )}
      </div>

      {/* WhatsApp modal */}
      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Versão para WhatsApp</DialogTitle>
          </DialogHeader>
          <Textarea value={whatsappText} readOnly rows={12} className="font-mono text-xs" />
          <Button
            onClick={() => {
              navigator.clipboard.writeText(whatsappText);
              toast.success("Texto copiado — cole no WhatsApp");
            }}
          >
            <Copy className="size-4" /> Copiar
          </Button>
        </DialogContent>
      </Dialog>

      {/* Print CSS */}
      <style>{`
        @media print {
          body { background: white !important; }
          nav, aside, header, .print\\:hidden { display: none !important; }
          .shadow-card, .shadow-elevated { box-shadow: none !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

// ============ Componentes ============

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-lg font-semibold mt-6 mb-3 pb-1 border-b" style={{ borderColor: BRAND.support, color: BRAND.graphite }}>
      {children}
    </h3>
  );
}

function Kpi({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  const showDelta = typeof delta === "number" && isFinite(delta);
  const positive = showDelta && (delta as number) >= 0;
  return (
    <div className="rounded-lg border p-3 bg-card" style={{ borderColor: BRAND.neutral }}>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="font-semibold text-lg mt-0.5" style={{ color: BRAND.graphite }}>{value}</div>
      {showDelta && (
        <div className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: positive ? BRAND.primary : "#c0392b" }}>
          {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {positive ? "+" : ""}{(delta as number).toFixed(1)}% vs anterior
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 bg-card" style={{ borderColor: BRAND.neutral }}>
      <div className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: BRAND.graphite }}>{title}</div>
      {children}
    </div>
  );
}

function ComparativoRow({ label, values, money }: { label: string; values: number[]; money?: boolean }) {
  const fmtVal = (v: number) => (money ? fmt(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
  const varLast = values.length >= 2 && values[values.length - 2] !== 0
    ? ((values[values.length - 1] - values[values.length - 2]) / Math.abs(values[values.length - 2])) * 100
    : null;
  return (
    <tr className="border-t">
      <td className="py-2 px-3 font-medium">{label}</td>
      {values.map((v, i) => (
        <td key={i} className="py-2 px-3 text-right font-mono">{fmtVal(v)}</td>
      ))}
      <td className="py-2 px-3 text-right font-mono" style={{ color: varLast == null ? undefined : varLast >= 0 ? BRAND.primary : "#c0392b" }}>
        {varLast == null ? "—" : `${varLast >= 0 ? "+" : ""}${varLast.toFixed(1)}%`}
      </td>
    </tr>
  );
}

function ConsultantField({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {readOnly ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap min-h-[60px]">{value || <span className="text-muted-foreground">Não preenchido.</span>}</div>
      ) : (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      )}
    </div>
  );
}

// silencia warning de import não usado quando IA vem cacheada
void CheckCircle2;
