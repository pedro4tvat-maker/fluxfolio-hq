import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { BranchSwitcher } from "@/components/branch-switcher";
import { downloadCSV, formatMoney, monthRange } from "@/lib/format";
import {
  fetchReportData, buildDRE, buildFluxoRealizado, buildFluxoProjetado,
  buildLucroOperacional, buildMargemContribuicao, buildPontoEquilibrio,
  buildContasPagar, buildContasReceber, buildOrcadoRealizado, buildCapitalGiro,
  buildEstoqueFinanceiro, buildVendasMargem, buildIndicadores, buildComparativo,
  buildCentroCustos, buildComparativoFiliais,
} from "@/lib/reports";
import { supabase } from "@/integrations/supabase/client";
import {
  FileBarChart, TrendingUp, ShieldCheck, Target as TargetIcon,
  Wallet, AlertTriangle, Download, Sparkles, ArrowRight, FileText,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/relatorios")({ component: Relatorios });

type ReportKey =
  | "dre" | "fluxo_realizado" | "fluxo_projetado" | "contas_pagar" | "contas_receber" | "capital_giro"
  | "lucro_operacional" | "margem_contribuicao" | "ponto_equilibrio" | "vendas_margem"
  | "orcado_realizado" | "centro_custos" | "estoque_financeiro"
  | "indicadores" | "comparativo_periodos" | "comparativo_filiais";

type Group = { title: string; icon: any; tone: string; reports: { key: ReportKey; label: string; desc: string }[] };

const GROUPS: Group[] = [
  {
    title: "Sobrevivência",
    icon: ShieldCheck,
    tone: "from-blue-500/10 to-blue-500/0 border-blue-500/20",
    reports: [
      { key: "fluxo_realizado", label: "Fluxo de Caixa Realizado", desc: "Entradas e saídas efetivadas no período." },
      { key: "fluxo_projetado", label: "Fluxo de Caixa Projetado", desc: "Projeção dos próximos 60 dias com base em contas." },
      { key: "contas_pagar", label: "Contas a Pagar", desc: "Total a pagar, vencido, a vencer e quitado." },
      { key: "contas_receber", label: "Contas a Receber", desc: "Total a receber, inadimplência e próximos." },
      { key: "capital_giro", label: "Capital de Giro", desc: "Saldo, recebíveis, estoque e necessidade de giro." },
    ],
  },
  {
    title: "Lucro",
    icon: TrendingUp,
    tone: "from-emerald-500/10 to-emerald-500/0 border-emerald-500/20",
    reports: [
      { key: "dre", label: "DRE Gerencial", desc: "Demonstração do Resultado do Exercício." },
      { key: "lucro_operacional", label: "Lucro Operacional", desc: "Resultado da operação e margem operacional." },
      { key: "margem_contribuicao", label: "Margem de Contribuição", desc: "MC total e por produto/serviço." },
      { key: "ponto_equilibrio", label: "Ponto de Equilíbrio", desc: "Receita mínima necessária para cobrir custos." },
      { key: "vendas_margem", label: "Vendas e Margem", desc: "Total vendido, ticket médio e produtos rentáveis." },
    ],
  },
  {
    title: "Controle",
    icon: TargetIcon,
    tone: "from-amber-500/10 to-amber-500/0 border-amber-500/20",
    reports: [
      { key: "orcado_realizado", label: "Orçado x Realizado", desc: "Comparação entre orçamento e execução." },
      { key: "centro_custos", label: "Centro de Custos", desc: "Resultado por centro de custo." },
      { key: "estoque_financeiro", label: "Estoque Financeiro", desc: "Valor parado, alertas e produtos zerados." },
    ],
  },
  {
    title: "Estratégicos",
    icon: Sparkles,
    tone: "from-violet-500/10 to-violet-500/0 border-violet-500/20",
    reports: [
      { key: "indicadores", label: "Indicadores Financeiros", desc: "Margens, EBITDA, liquidez, PMR/PMP e mais." },
      { key: "comparativo_periodos", label: "Comparativo de Períodos", desc: "Compare períodos lado a lado." },
      { key: "comparativo_filiais", label: "Comparativo de Filiais", desc: "Resultados por unidade." },
    ],
  },
];

function Relatorios() {
  const { isConsultant } = useAuth();
  const { companies, selected, select } = useSelectedCompany();
  const { branchId } = useSelectedBranch();
  const company = useMemo(() => companies.find((c) => c.id === selected), [companies, selected]);

  // Para consultor: carrega também empresas que ele possui (não só member)
  const { data: ownedCompanies } = useQuery({
    queryKey: ["owned-companies-consultant"],
    enabled: isConsultant,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome").order("nome");
      return data ?? [];
    },
  });

  const allCompanies = isConsultant ? (ownedCompanies ?? []) : companies;
  const currentCompanyId = selected ?? (isConsultant ? allCompanies[0]?.id : null);

  const range = monthRange();
  const [inicio, setInicio] = useState(range.start);
  const [fim, setFim] = useState(range.end);
  const [active, setActive] = useState<ReportKey | null>(null);
  const [costCenterId, setCostCenterId] = useState<string>("");

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost_centers", currentCompanyId],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      const { data } = await supabase.from("cost_centers").select("id, nome").eq("company_id", currentCompanyId!).order("nome");
      return data ?? [];
    },
  });

  // período anterior automático
  const prevPeriod = useMemo(() => {
    const d = new Date(inicio);
    const days = Math.round((new Date(fim).getTime() - d.getTime()) / 86400000) + 1;
    const prevEnd = new Date(d);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days + 1);
    return { start: prevStart.toISOString().slice(0, 10), end: prevEnd.toISOString().slice(0, 10) };
  }, [inicio, fim]);

  const { data, isFetching } = useQuery({
    queryKey: ["report-data", currentCompanyId, branchId, inicio, fim, costCenterId],
    enabled: !!currentCompanyId,
    queryFn: () => fetchReportData(currentCompanyId!, branchId, { start: inicio, end: fim }, costCenterId || null),
  });

  const { data: dataPrev } = useQuery({
    queryKey: ["report-data-prev", currentCompanyId, branchId, prevPeriod.start, prevPeriod.end, costCenterId],
    enabled: !!currentCompanyId && active === "comparativo_periodos",
    queryFn: () => fetchReportData(currentCompanyId!, branchId, prevPeriod, costCenterId || null),
  });

  const { data: filiaisData } = useQuery({
    queryKey: ["report-filiais", currentCompanyId, inicio, fim],
    enabled: !!currentCompanyId && active === "comparativo_filiais",
    queryFn: () => buildComparativoFiliais(currentCompanyId!, { start: inicio, end: fim }),
  });

  const period = { start: inicio, end: fim };

  const exportCSV = (rows: Record<string, unknown>[], name: string) => {
    if (!rows?.length) {
      toast.error("Nada para exportar.");
      return;
    }
    const empresa = (company?.nome ?? "empresa").replace(/[^a-z0-9]+/gi, "_");
    downloadCSV(`${empresa}_${name}_${inicio}_${fim}.csv`, rows);
    toast.success("Exportado.");
  };

  if (!currentCompanyId) {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Relatórios</h1>
        <div className="bg-card border rounded-2xl p-8 text-center text-muted-foreground">
          <FileBarChart className="size-10 mx-auto opacity-40" />
          <p className="mt-3">Selecione uma empresa para visualizar relatórios.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            {isConsultant ? "Central de Relatórios" : "Relatórios"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isConsultant ? "Acesse relatórios de todas as empresas vinculadas." : `Relatórios da ${company?.nome ?? "sua empresa"}.`}
          </p>
        </div>
        <Link to="/app/executivo">
          <Button><FileText className="size-4" /> Relatório Executivo Mensal</Button>
        </Link>
      </div>

      {/* Filter bar */}
      <div className="bg-card border rounded-2xl p-4 shadow-card flex flex-wrap gap-3 items-end">
        {isConsultant && (
          <Field label="Empresa">
            <select
              value={currentCompanyId ?? ""}
              onChange={(e) => select(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm bg-background min-w-[220px]"
            >
              {allCompanies.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Data inicial">
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Data final">
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Centro de custo">
          <select
            value={costCenterId}
            onChange={(e) => setCostCenterId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm bg-background min-w-[180px]"
          >
            <option value="">Todos</option>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Field>
        <div className="ml-auto"><BranchSwitcher /></div>
      </div>

      {/* Group cards */}
      {!active && (
        <div className="space-y-6">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <div className="flex items-center gap-2 mb-3">
                <g.icon className="size-4 text-muted-foreground" />
                <h2 className="font-semibold">{g.title}</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {g.reports.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setActive(r.key)}
                    className={`text-left bg-gradient-to-br ${g.tone} border rounded-2xl p-5 hover:shadow-md transition-shadow group`}
                  >
                    <div className="font-semibold">{r.label}</div>
                    <p className="text-sm text-muted-foreground mt-1">{r.desc}</p>
                    <div className="mt-4 text-xs text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                      Gerar relatório <ArrowRight className="size-3" />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Active report view */}
      {active && (
        <div className="bg-card border rounded-2xl p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setActive(null)}>← Voltar aos relatórios</Button>
            <span className="text-xs text-muted-foreground">{isFetching ? "Carregando..." : "Período: " + inicio + " → " + fim}</span>
          </div>

          {!data ? <Loading /> : (
            <RenderReport
              type={active}
              data={data}
              dataPrev={dataPrev}
              filiais={filiaisData}
              period={period}
              prevPeriod={prevPeriod}
              onExport={exportCSV}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return <div className="text-sm text-muted-foreground py-8 text-center">Carregando dados...</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Money({ v }: { v: number | string }) {
  const n = typeof v === "string" ? Number(v) : v;
  return <span className={n < 0 ? "text-destructive" : ""}>{formatMoney(n)}</span>;
}

function Table({ rows, moneyCols = [] as string[] }: { rows: Record<string, unknown>[]; moneyCols?: string[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-muted-foreground border-b">
            {headers.map((h) => <th key={h} className="py-2 pr-4 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {headers.map((h) => {
                const v = r[h];
                const isMoney = moneyCols.includes(h) || (typeof v === "number" && /valor|saldo|total|orçado|realizado|diferença|atual|anterior|preço|custo|margem|ebitda|receita|lucro|entradas|saídas|resultado|a pagar|a receber/i.test(h));
                return (
                  <td key={h} className={`py-2 pr-4 ${isMoney ? "font-mono text-right" : ""}`}>
                    {typeof v === "number" && isMoney ? <Money v={v} /> : typeof v === "number" ? v.toLocaleString("pt-BR") : String(v ?? "")}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KpiGrid({ items }: { items: { label: string; value: number; money?: boolean; suffix?: string }[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">{it.label}</div>
          <div className="text-xl font-semibold mt-1">
            {it.money ? formatMoney(it.value) : `${it.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${it.suffix ?? ""}`}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExportBtn({ rows, name, onExport }: { rows: Record<string, unknown>[]; name: string; onExport: (r: any[], n: string) => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => onExport(rows, name)}>
        <Download className="size-4" /> Exportar CSV
      </Button>
      <Button variant="ghost" size="sm" onClick={() => toast.info("Exportação PDF estará disponível em breve.")}>
        Exportar PDF
      </Button>
    </div>
  );
}

function RenderReport({ type, data, dataPrev, filiais, period, prevPeriod, onExport }: any) {
  switch (type) {
    case "dre": {
      const r = buildDRE(data, period);
      return (
        <>
          <Header title="DRE Gerencial" onExport={onExport} rows={r.rows} name="dre" />
          {r.semClassificacao > 0 && (
            <div className="rounded-xl border-amber-500/30 bg-amber-500/10 border p-3 text-sm flex gap-2 items-start">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Existem <strong>{r.semClassificacao}</strong> categorias sem classificação financeira. Isso pode afetar a precisão da DRE. Configure-as no Centro de Custos.</span>
            </div>
          )}
          <Table rows={r.rows} moneyCols={["Valor"]} />
        </>
      );
    }
    case "fluxo_realizado": {
      const r = buildFluxoRealizado(data, period);
      return (
        <>
          <Header title="Fluxo de Caixa Realizado" onExport={onExport} rows={r.lancamentos} name="fluxo_realizado" />
          <KpiGrid items={[
            { label: "Saldo Inicial", value: r.summary.saldoInicial, money: true },
            { label: "Entradas", value: r.summary.entradas, money: true },
            { label: "Saídas", value: r.summary.saidas, money: true },
            { label: "Saldo Final", value: r.summary.saldoFinal, money: true },
          ]} />
          <Section title="Entradas por categoria"><Table rows={r.entradasPorCategoria} /></Section>
          <Section title="Saídas por categoria"><Table rows={r.saidasPorCategoria} /></Section>
          <Section title="Lançamentos do período"><Table rows={r.lancamentos.slice(0, 100)} /></Section>
        </>
      );
    }
    case "fluxo_projetado": {
      const r = buildFluxoProjetado(data);
      return (
        <>
          <Header title="Fluxo de Caixa Projetado" onExport={onExport} rows={r.projecao} name="fluxo_projetado" />
          {r.summary.riscoNegativo && (
            <div className="rounded-xl border-destructive/30 bg-destructive/10 border p-3 text-sm flex gap-2 items-start">
              <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
              <span>Atenção: a projeção indica saldo negativo em algum dia dos próximos 60 dias.</span>
            </div>
          )}
          <KpiGrid items={[
            { label: "Saldo Atual", value: r.summary.saldoAtual, money: true },
            { label: "A Pagar (futuro)", value: r.summary.totalPagar, money: true },
            { label: "A Receber (futuro)", value: r.summary.totalReceber, money: true },
            { label: "Saldo Projetado", value: r.summary.saldoProjetado, money: true },
          ]} />
          <Table rows={r.projecao} />
        </>
      );
    }
    case "lucro_operacional": {
      const r = buildLucroOperacional(data, period);
      return <><Header title="Lucro Operacional" onExport={onExport} rows={r.rows} name="lucro_operacional" /><Table rows={r.rows} /></>;
    }
    case "margem_contribuicao": {
      const r = buildMargemContribuicao(data, period);
      return (
        <>
          <Header title="Margem de Contribuição" onExport={onExport} rows={r.produtos} name="margem_contribuicao" />
          <KpiGrid items={[
            { label: "Receita", value: r.summary.receita, money: true },
            { label: "Custos Variáveis", value: r.summary.custosVariaveis, money: true },
            { label: "MC R$", value: r.summary.mc, money: true },
            { label: "MC %", value: r.summary.mcPct, suffix: "%" },
          ]} />
          <Section title="Margem por produto"><Table rows={r.produtos} /></Section>
        </>
      );
    }
    case "ponto_equilibrio": {
      const r = buildPontoEquilibrio(data, period);
      return (
        <>
          <Header title="Ponto de Equilíbrio" onExport={onExport} rows={r.rows} name="ponto_equilibrio" />
          <div className={`rounded-xl border p-3 text-sm font-medium ${r.status === "acima" ? "border-emerald-500/30 bg-emerald-500/10" : r.status === "abaixo" ? "border-destructive/30 bg-destructive/10" : "border-amber-500/30 bg-amber-500/10"}`}>
            Status: {r.status === "acima" ? "Acima do PE" : r.status === "abaixo" ? "Abaixo do PE" : r.status === "proximo" ? "Próximo do PE" : "Indefinido"}
          </div>
          <Table rows={r.rows} />
        </>
      );
    }
    case "contas_pagar": {
      const r = buildContasPagar(data, period);
      return (
        <>
          <Header title="Contas a Pagar" onExport={onExport} rows={r.lista} name="contas_pagar" />
          <KpiGrid items={[
            { label: "Total a Pagar", value: r.summary.totalPagar, money: true },
            { label: "Vencido", value: r.summary.vencido, money: true },
            { label: "A Vencer", value: r.summary.aVencer, money: true },
            { label: "Pago", value: r.summary.pago, money: true },
          ]} />
          <Section title="Por fornecedor"><Table rows={r.porFornecedor} /></Section>
          <Section title="Por categoria"><Table rows={r.porCategoria} /></Section>
          <Section title="Lista"><Table rows={r.lista.slice(0, 100)} /></Section>
        </>
      );
    }
    case "contas_receber": {
      const r = buildContasReceber(data, period);
      return (
        <>
          <Header title="Contas a Receber" onExport={onExport} rows={r.proximos} name="contas_receber" />
          <KpiGrid items={[
            { label: "Total a Receber", value: r.summary.totalReceber, money: true },
            { label: "Vencido", value: r.summary.vencido, money: true },
            { label: "A Vencer", value: r.summary.aVencer, money: true },
            { label: "Inadimplência", value: r.summary.inadimplencia, suffix: "%" },
          ]} />
          <Section title="Por cliente"><Table rows={r.porCliente} /></Section>
          <Section title="Próximos recebimentos"><Table rows={r.proximos} /></Section>
        </>
      );
    }
    case "orcado_realizado": {
      const r = buildOrcadoRealizado(data, period);
      return <><Header title="Orçado x Realizado" onExport={onExport} rows={r.rows} name="orcado_realizado" /><Table rows={r.rows} /></>;
    }
    case "capital_giro": {
      const r = buildCapitalGiro(data);
      return (
        <>
          <Header title="Capital de Giro" onExport={onExport} rows={r.rows} name="capital_giro" />
          <div className="rounded-xl border p-3 text-sm">Situação: <strong>{r.situacao}</strong></div>
          <Table rows={r.rows} />
        </>
      );
    }
    case "estoque_financeiro": {
      const r = buildEstoqueFinanceiro(data);
      return (
        <>
          <Header title="Estoque Financeiro" onExport={onExport} rows={r.maiorValor} name="estoque_financeiro" />
          <KpiGrid items={[
            { label: "Valor total", value: r.summary.total, money: true },
            { label: "Produtos", value: r.summary.totalProdutos },
            { label: "Abaixo do mínimo", value: r.summary.abaixoMin },
            { label: "Zerados", value: r.summary.zerados },
          ]} />
          <Section title="Maior valor parado"><Table rows={r.maiorValor} /></Section>
          <Section title="Por categoria"><Table rows={r.porCategoria} /></Section>
        </>
      );
    }
    case "vendas_margem": {
      const r = buildVendasMargem(data, period);
      return (
        <>
          <Header title="Vendas e Margem" onExport={onExport} rows={r.produtos} name="vendas_margem" />
          <KpiGrid items={[
            { label: "Total vendido", value: r.summary.totalVendido, money: true },
            { label: "Custo total", value: r.summary.custoTotal, money: true },
            { label: "Margem bruta", value: r.summary.margemBruta, money: true },
            { label: "Qtd. vendas", value: r.summary.qtd },
            { label: "Sem custo", value: r.summary.custoZerado },
            { label: "Itens incompletos", value: r.summary.itensIncompletos },
          ]} />
          <Section title="Itens vendidos e margem"><Table rows={r.produtos} /></Section>
        </>
      );
    }
    case "centro_custos": {
      const r = buildCentroCustos(data, period);
      return <><Header title="Centro de Custos" onExport={onExport} rows={r.rows} name="centro_custos" /><Table rows={r.rows} /></>;
    }
    case "indicadores": {
      const r = buildIndicadores(data, period);
      return <><Header title="Indicadores Financeiros" onExport={onExport} rows={r.rows} name="indicadores" /><Table rows={r.rows} /></>;
    }
    case "comparativo_periodos": {
      if (!dataPrev) return <Loading />;
      const r = buildComparativo(data, dataPrev, period, prevPeriod);
      return (
        <>
          <Header title={`Comparativo: ${period.start}→${period.end} vs ${prevPeriod.start}→${prevPeriod.end}`} onExport={onExport} rows={r.rows} name="comparativo" />
          <Table rows={r.rows} />
        </>
      );
    }
    case "comparativo_filiais": {
      if (!filiais) return <Loading />;
      if (!filiais.rows.length) return <p className="text-sm text-muted-foreground py-6">Cadastre filiais para usar este relatório.</p>;
      return <><Header title="Comparativo de Filiais" onExport={onExport} rows={filiais.rows} name="comparativo_filiais" /><Table rows={filiais.rows} /></>;
    }
    default:
      return null;
  }
}

function Header({ title, rows, name, onExport }: { title: string; rows: any[]; name: string; onExport: (r: any[], n: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h2 className="text-lg font-display font-semibold">{title}</h2>
      <ExportBtn rows={rows} name={name} onExport={onExport} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  );
}
