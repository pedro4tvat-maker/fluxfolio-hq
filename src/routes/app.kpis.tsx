import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Gauge, TrendingUp, Wallet, Activity, Plus, Pencil, Trash2,
  Download, RefreshCw, AlertTriangle, Info, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { BranchSwitcher } from "@/components/branch-switcher";
import { CompanySwitcher } from "@/components/company-switcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/kpis")({ component: KPIsPage });

// ----- helpers -----
const db: any = supabase;
const BRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PCT = (n: number) =>
  `${(Math.round(n * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1 })}%`;
const withBranch = <T extends { eq: (c: string, v: any) => T }>(q: T, b: string | null) =>
  b ? q.eq("branch_id", b) : q;

type Status = "ok" | "warn" | "crit" | "na";
const statusStyle: Record<Status, string> = {
  ok: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  crit: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  na: "bg-muted text-muted-foreground border-border",
};
const statusLabel: Record<Status, string> = {
  ok: "Saudável", warn: "Atenção", crit: "Crítico", na: "Sem dados",
};

const CLASSIFICATIONS = [
  { v: "receita_operacional", l: "Receita operacional" },
  { v: "receita_nao_operacional", l: "Receita não operacional" },
  { v: "custo_variavel", l: "Custo variável" },
  { v: "custo_fixo", l: "Custo fixo" },
  { v: "despesa_operacional", l: "Despesa operacional" },
  { v: "despesa_administrativa", l: "Despesa administrativa" },
  { v: "despesa_comercial", l: "Despesa comercial" },
  { v: "marketing_vendas", l: "Marketing e vendas" },
  { v: "imposto", l: "Imposto" },
  { v: "juros", l: "Juros" },
  { v: "investimento", l: "Investimento" },
  { v: "retirada_socios", l: "Retirada dos sócios" },
  { v: "depreciacao", l: "Depreciação" },
  { v: "amortizacao", l: "Amortização" },
  { v: "outros", l: "Outros" },
];
const classLabel = (v?: string | null) =>
  CLASSIFICATIONS.find((c) => c.v === v)?.l ?? "Não classificada";

// ----- root page -----
function KPIsPage() {
  const { selected: companyId } = useSelectedCompany();
  const { branchId } = useSelectedBranch();

  // default range: ano corrente até hoje
  const today = new Date();
  const yStart = new Date(today.getFullYear(), 0, 1);
  const [start, setStart] = useState(yStart.toISOString().slice(0, 10));
  const [end, setEnd] = useState(today.toISOString().slice(0, 10));

  if (!companyId) {
    return <div className="text-muted-foreground">Selecione uma empresa para visualizar os KPIs.</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <Gauge className="size-7 text-primary" /> KPIs Financeiros
          </h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Indicadores automáticos para acompanhar a rentabilidade, o caixa e o crescimento da empresa.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySwitcher />
          <BranchSwitcher />
        </div>
      </header>

      <div className="bg-card border rounded-2xl p-4 shadow-card flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Início</Label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">Fim</Label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
        </div>
        <div className="ml-auto" />
      </div>

      <Tabs defaultValue="indicadores">
        <TabsList>
          <TabsTrigger value="indicadores">Indicadores</TabsTrigger>
          <TabsTrigger value="roi">Análise de ROI</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="indicadores" className="mt-6">
          <IndicatorsView companyId={companyId} branchId={branchId} start={start} end={end} />
        </TabsContent>

        <TabsContent value="roi" className="mt-6">
          <ROISection companyId={companyId} branchId={branchId} />
        </TabsContent>

        <TabsContent value="config" className="mt-6 space-y-6">
          <AssumptionsForm companyId={companyId} />
          <CategoryClassification companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----- core data hook -----
function useKpiData(companyId: string, branchId: string | null, start: string, end: string) {
  return useQuery({
    queryKey: ["kpi-data", companyId, branchId, start, end],
    queryFn: async () => {
      const [
        { data: cats },
        { data: tx },
        { data: pay },
        { data: rec },
        { data: acc },
        { data: assump },
      ] = await Promise.all([
        db.from("categories").select("id, nome, tipo, kpi_classification").eq("company_id", companyId),
        withBranch(
          db.from("transactions")
            .select("id, tipo, valor, categoria_id, data, status")
            .eq("company_id", companyId)
            .eq("status", "realizado")
            .gte("data", start).lte("data", end),
          branchId
        ),
        withBranch(
          db.from("payables")
            .select("id, valor, status, vencimento")
            .eq("company_id", companyId),
          branchId
        ),
        withBranch(
          db.from("receivables")
            .select("id, valor, status, vencimento, data_recebimento, created_at")
            .eq("company_id", companyId),
          branchId
        ),
        db.from("financial_accounts").select("saldo_inicial").eq("company_id", companyId).eq("ativo", true),
        db.from("kpi_assumptions").select("*").eq("company_id", companyId).maybeSingle(),
      ]);

      return {
        categories: cats ?? [],
        transactions: tx ?? [],
        payables: pay ?? [],
        receivables: rec ?? [],
        accounts: acc ?? [],
        assumptions: assump ?? null,
      };
    },
  });
}

// ----- indicators view -----
function IndicatorsView({
  companyId, branchId, start, end,
}: { companyId: string; branchId: string | null; start: string; end: string }) {
  const { data, isLoading, refetch, isFetching } = useKpiData(companyId, branchId, start, end);

  const k = useMemo(() => (data ? computeKpis(data, start, end) : null), [data, start, end]);

  if (isLoading || !k) {
    return <div className="text-muted-foreground text-sm">Calculando indicadores…</div>;
  }

  return (
    <div className="space-y-6">
      {k.warnings.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div className="font-medium text-foreground">Atenção aos dados</div>
            <ul className="list-disc pl-4 text-muted-foreground space-y-0.5">
              {k.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Rentabilidade e lucratividade</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCsv(k, start, end)}>
            <Download className="size-4" /> Exportar relatório
          </Button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Margem de Lucro Líquido"
          value={k.margemLiquida != null ? PCT(k.margemLiquida) : "—"}
          status={k.margemLiquidaStatus}
          desc="Quanto sobra de lucro real para cada R$ 100,00 vendidos, após custos, despesas, impostos e juros."
          formula="Lucro líquido / Receita total × 100"
          details={[
            ["Receita total", BRL(k.receitaTotal)],
            ["Custos", BRL(k.custos)],
            ["Despesas", BRL(k.despesas)],
            ["Impostos", BRL(k.impostos)],
            ["Juros", BRL(k.juros)],
            ["Lucro líquido", BRL(k.lucroLiquido)],
          ]}
        />
        <KpiCard
          title="EBITDA"
          value={k.ebitda != null ? BRL(k.ebitda) : "—"}
          status={k.ebitdaStatus}
          desc="Geração operacional de caixa antes de juros, impostos, depreciação e amortização."
          formula="Lucro operacional + Depreciação + Amortização"
          details={[
            ["Receita operacional", BRL(k.receitaOperacional)],
            ["Custos operacionais", BRL(k.custosOperacionais)],
            ["Despesas operacionais", BRL(k.despesasOperacionais)],
            ["Depreciação", BRL(k.depreciacao)],
            ["Amortização", BRL(k.amortizacao)],
            ["Lucro operacional", BRL(k.lucroOperacional)],
          ]}
        />
        <KpiCard
          title="Margem de Contribuição"
          value={k.margemContribuicaoPct != null ? PCT(k.margemContribuicaoPct) : "—"}
          status={k.mcStatus}
          desc="Quanto sobra das vendas depois dos custos variáveis para cobrir custos fixos e gerar lucro."
          formula="(Receita - Custos variáveis) / Receita × 100"
          details={[
            ["Receita de vendas", BRL(k.receitaVendas)],
            ["Custos variáveis", BRL(k.custosVariaveis)],
            ["Margem de contribuição", BRL(k.margemContribuicao)],
          ]}
        />
      </div>

      <h2 className="text-lg font-semibold pt-2">Liquidez e saúde do caixa</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="Liquidez Corrente"
          value={k.liquidez != null ? k.liquidez.toFixed(2) : "—"}
          status={k.liquidezStatus}
          desc="Capacidade de pagar obrigações de curto prazo com o que a empresa tem e tem a receber."
          formula="(Saldo + Contas a receber abertas) / Contas a pagar abertas"
          details={[
            ["Saldo disponível", BRL(k.saldoDisponivel)],
            ["Contas a receber abertas", BRL(k.arAberto)],
            ["Contas a pagar abertas", BRL(k.apAberto)],
          ]}
        />
        <KpiCard
          title="Ponto de Equilíbrio"
          value={k.pontoEquilibrio != null ? BRL(k.pontoEquilibrio) : "—"}
          status={k.peStatus}
          desc="Quanto a empresa precisa vender para cobrir todos os custos antes de começar a lucrar."
          formula="Custos fixos / Margem de contribuição %"
          details={[
            ["Custos fixos", BRL(k.custosFixos)],
            ["Margem de contribuição %", k.margemContribuicaoPct != null ? PCT(k.margemContribuicaoPct) : "—"],
            ["Receita atual", BRL(k.receitaVendas)],
            ["Diferença", k.pontoEquilibrio != null ? BRL(k.receitaVendas - k.pontoEquilibrio) : "—"],
          ]}
          missing={k.pontoEquilibrio == null ? "Classifique categorias como custos fixos e variáveis para calcular." : undefined}
        />
        <KpiCard
          title="Prazo Médio de Recebimento"
          value={k.pmr != null ? `${Math.round(k.pmr)} dias` : "—"}
          status={k.pmrStatus}
          desc="Em média, quantos dias a empresa leva para receber suas vendas a prazo."
          formula="(Contas a receber médio / Vendas a prazo) × dias do período"
          details={[
            ["Contas a receber médio", BRL(k.arMedio)],
            ["Vendas a prazo (período)", BRL(k.vendasPrazo)],
            ["Dias do período", `${k.dias}`],
          ]}
          missing={k.pmr == null ? "Sem vendas a prazo no período para calcular o PMR." : undefined}
        />
      </div>

      <h2 className="text-lg font-semibold pt-2">Crescimento e retorno</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          title="CAC"
          value={k.cac != null ? BRL(k.cac) : "—"}
          status="na"
          desc="Custo médio para conquistar cada novo cliente no período."
          formula="Investimento em vendas e marketing / Novos clientes"
          details={[
            ["Investimento vendas/marketing", BRL(k.invMarketing)],
            ["Novos clientes", `${k.novosClientes}`],
          ]}
          missing={k.cac == null ? "Informe o número de novos clientes no período em Configuração." : undefined}
        />
        <KpiCard
          title="LTV"
          value={k.ltv != null ? BRL(k.ltv) : "—"}
          status="na"
          desc="Quanto, em média, um cliente gera de receita durante o relacionamento com a empresa."
          formula="Ticket médio × Compras médias × Tempo médio (meses)"
          details={[
            ["Ticket médio", BRL(k.ticketMedio)],
            ["Compras médias / cliente", `${k.comprasMedias}`],
            ["Tempo médio (meses)", `${k.tempoMedio}`],
          ]}
          missing={k.ltv == null ? "Informe compras médias e tempo médio de relacionamento em Configuração." : undefined}
        />
        <KpiCard
          title="Relação LTV / CAC"
          value={k.ltvCac != null ? `${k.ltvCac.toFixed(2)} : 1` : "—"}
          status={k.ltvCacStatus}
          desc="Compara o valor gerado por cliente com o custo de conquistá-lo. Próximo de 3:1 costuma ser saudável."
          formula="LTV / CAC"
          missing={k.ltvCac == null ? "Complete os dados de CAC e LTV para calcular esta relação." : undefined}
        />
      </div>
    </div>
  );
}

// ----- KPI card -----
function KpiCard({
  title, value, status, desc, formula, details, missing,
}: {
  title: string; value: string; status: Status; desc: string; formula: string;
  details?: [string, string][]; missing?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusStyle[status]}`}>
          {statusLabel[status]}
        </span>
      </div>
      <div className="text-3xl font-display font-bold tracking-tight">{value}</div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      {missing && (
        <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
          <Info className="size-3.5 shrink-0 mt-0.5" /> {missing}
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-primary hover:underline self-start">
        {open ? "Ocultar detalhes" : "Ver detalhes"}
      </button>
      {open && (
        <div className="border-t pt-3 space-y-1 text-xs">
          <div className="text-muted-foreground">Fórmula: <span className="text-foreground">{formula}</span></div>
          {details?.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ----- KPI computations -----
function computeKpis(data: any, start: string, end: string) {
  const { categories, transactions, payables, receivables, accounts, assumptions } = data;
  const byCat = new Map<string, string | null>(
    categories.map((c: any) => [c.id, c.kpi_classification ?? null])
  );
  const cls = (id: string | null) => (id ? byCat.get(id) ?? null : null);

  const dStart = new Date(start);
  const dEnd = new Date(end);
  const dias = Math.max(1, Math.round((+dEnd - +dStart) / (1000 * 60 * 60 * 24)) + 1);

  const warnings: string[] = [];
  const naoClassif = categories.filter((c: any) => !c.kpi_classification);
  if (naoClassif.length > 0) {
    warnings.push(`${naoClassif.length} categoria(s) ainda sem classificação financeira. Isso reduz a precisão dos indicadores.`);
  }

  // Sums by category bucket
  let receitaTotal = 0, receitaOperacional = 0, receitaVendas = 0;
  let custosVariaveis = 0, custosFixos = 0;
  let despesasOperacionais = 0, despesasGerais = 0;
  let impostos = 0, juros = 0, invMarketing = 0;
  let saidasTotais = 0;
  let nVendas = 0;

  for (const t of transactions) {
    const v = Number(t.valor) || 0;
    const c = cls(t.categoria_id);
    if (t.tipo === "entrada") {
      receitaTotal += v;
      if (c === "receita_operacional" || c == null) receitaOperacional += v;
      if (c === "receita_operacional" || c == null) { receitaVendas += v; nVendas += 1; }
    } else {
      saidasTotais += v;
      switch (c) {
        case "custo_variavel": custosVariaveis += v; break;
        case "custo_fixo": custosFixos += v; break;
        case "despesa_operacional": despesasOperacionais += v; break;
        case "despesa_administrativa":
        case "despesa_comercial":
          despesasGerais += v; break;
        case "marketing_vendas": invMarketing += v; break;
        case "imposto": impostos += v; break;
        case "juros": juros += v; break;
        default: break;
      }
    }
  }

  const custos = custosVariaveis + custosFixos;
  const despesas = despesasOperacionais + despesasGerais + invMarketing;
  const custosOperacionais = custos;
  const lucroLiquido = receitaTotal - custos - despesas - impostos - juros;
  const lucroOperacional = receitaOperacional - custosOperacionais - despesasOperacionais - invMarketing;

  const depreciacao = Number(assumptions?.depreciacao ?? 0);
  const amortizacao = Number(assumptions?.amortizacao ?? 0);
  if (!assumptions || (depreciacao === 0 && amortizacao === 0)) {
    warnings.push("Depreciação e amortização não informadas. EBITDA está sendo calculado considerando esses valores como zero.");
  }
  const ebitda = lucroOperacional + depreciacao + amortizacao;

  const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : null;
  const margemContribuicao = receitaVendas - custosVariaveis;
  const margemContribuicaoPct = receitaVendas > 0 ? (margemContribuicao / receitaVendas) * 100 : null;
  const pontoEquilibrio = margemContribuicaoPct && margemContribuicaoPct > 0
    ? (custosFixos / (margemContribuicaoPct / 100)) : null;

  // Liquidez
  const saldoInicial = accounts.reduce((s: number, a: any) => s + (Number(a.saldo_inicial) || 0), 0);
  // movimentações totais até hoje (não só do período) — saldo "agora"
  // simplificação: usa saldo inicial + entradas - saídas do período como aproximação
  const saldoDisponivel = saldoInicial + receitaTotal - saidasTotais;
  const arAberto = receivables
    .filter((r: any) => r.status !== "recebido")
    .reduce((s: number, r: any) => s + (Number(r.valor) || 0), 0);
  const apAberto = payables
    .filter((p: any) => p.status !== "pago")
    .reduce((s: number, p: any) => s + (Number(p.valor) || 0), 0);
  const liquidez = apAberto > 0 ? (saldoDisponivel + arAberto) / apAberto : null;

  // PMR — aproximação: AR aberto / receita do período * dias
  const arMedio = arAberto;
  const vendasPrazo = receivables
    .filter((r: any) => {
      const v = r.vencimento ?? r.created_at?.slice(0, 10);
      return v && v >= start && v <= end;
    })
    .reduce((s: number, r: any) => s + (Number(r.valor) || 0), 0);
  const pmr = vendasPrazo > 0 ? (arMedio / vendasPrazo) * dias : null;

  // CAC / LTV
  const novosClientes = Number(assumptions?.novos_clientes ?? 0);
  const cac = novosClientes > 0 ? invMarketing / novosClientes : null;
  const ticketMedio = nVendas > 0 ? receitaVendas / nVendas : 0;
  const comprasMedias = Number(assumptions?.compras_medias_cliente ?? 0);
  const tempoMedio = Number(assumptions?.tempo_medio_meses ?? 0);
  const ltv = (ticketMedio > 0 && comprasMedias > 0 && tempoMedio > 0)
    ? ticketMedio * comprasMedias * tempoMedio : null;
  const ltvCac = (ltv != null && cac != null && cac > 0) ? ltv / cac : null;

  // Statuses
  const margemLiquidaStatus: Status = margemLiquida == null ? "na"
    : margemLiquida < 0 ? "crit" : margemLiquida < 5 ? "crit" : margemLiquida < 15 ? "warn" : "ok";
  const ebitdaStatus: Status = ebitda === 0 ? "warn" : ebitda > 0 ? "ok" : "crit";
  const mcStatus: Status = margemContribuicaoPct == null ? "na"
    : margemContribuicaoPct < 20 ? "crit" : margemContribuicaoPct < 40 ? "warn" : "ok";
  const liquidezStatus: Status = liquidez == null ? "na"
    : liquidez < 1 ? "crit" : liquidez < 1.5 ? "warn" : "ok";
  const peStatus: Status = pontoEquilibrio == null ? "na"
    : receitaVendas >= pontoEquilibrio ? "ok"
    : receitaVendas >= pontoEquilibrio * 0.8 ? "warn" : "crit";
  const pmrStatus: Status = pmr == null ? "na" : pmr <= 15 ? "ok" : pmr <= 30 ? "warn" : "crit";
  const ltvCacStatus: Status = ltvCac == null ? "na"
    : ltvCac >= 3 ? "ok" : ltvCac >= 1 ? "warn" : "crit";

  return {
    warnings, dias,
    receitaTotal, receitaOperacional, receitaVendas,
    custos, custosVariaveis, custosFixos, custosOperacionais,
    despesas, despesasOperacionais, invMarketing,
    impostos, juros,
    lucroLiquido, lucroOperacional, depreciacao, amortizacao, ebitda,
    margemLiquida, margemContribuicao, margemContribuicaoPct,
    pontoEquilibrio,
    saldoDisponivel, arAberto, apAberto, liquidez,
    arMedio, vendasPrazo, pmr,
    invMarketingTotal: invMarketing, novosClientes, cac,
    ticketMedio, comprasMedias, tempoMedio, ltv, ltvCac,
    margemLiquidaStatus, ebitdaStatus, mcStatus, liquidezStatus, peStatus, pmrStatus, ltvCacStatus,
  };
}

// ----- CSV export -----
function exportCsv(k: any, start: string, end: string) {
  const rows: [string, string, string][] = [
    ["Indicador", "Valor", "Status"],
    ["Período", `${start} a ${end}`, ""],
    ["Receita total", BRL(k.receitaTotal), ""],
    ["Lucro líquido", BRL(k.lucroLiquido), ""],
    ["Margem de Lucro Líquido", k.margemLiquida != null ? PCT(k.margemLiquida) : "—", statusLabel[k.margemLiquidaStatus]],
    ["EBITDA", BRL(k.ebitda), statusLabel[k.ebitdaStatus]],
    ["Margem de Contribuição", k.margemContribuicaoPct != null ? PCT(k.margemContribuicaoPct) : "—", statusLabel[k.mcStatus]],
    ["Liquidez Corrente", k.liquidez != null ? k.liquidez.toFixed(2) : "—", statusLabel[k.liquidezStatus]],
    ["Ponto de Equilíbrio", k.pontoEquilibrio != null ? BRL(k.pontoEquilibrio) : "—", statusLabel[k.peStatus]],
    ["PMR", k.pmr != null ? `${Math.round(k.pmr)} dias` : "—", statusLabel[k.pmrStatus]],
    ["CAC", k.cac != null ? BRL(k.cac) : "—", ""],
    ["LTV", k.ltv != null ? BRL(k.ltv) : "—", ""],
    ["LTV/CAC", k.ltvCac != null ? k.ltvCac.toFixed(2) : "—", statusLabel[k.ltvCacStatus]],
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `kpis_${start}_${end}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ----- ROI section -----
function ROISection({ companyId, branchId }: { companyId: string; branchId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: actions } = useQuery({
    queryKey: ["kpi-actions", companyId, branchId],
    queryFn: async () => {
      let q = db.from("kpi_actions").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      if (branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Excluir esta ação?")) return;
    const { error } = await db.from("kpi_actions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Ação removida"); qc.invalidateQueries({ queryKey: ["kpi-actions"] }); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Análise de ROI</h2>
          <p className="text-sm text-muted-foreground">Cadastre ações e investimentos para medir o retorno individual.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="size-4" /> Nova ação
        </Button>
      </div>

      <div className="bg-card border rounded-2xl shadow-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground text-xs">
            <tr>
              <th className="text-left p-3">Ação</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-right p-3">Investido</th>
              <th className="text-right p-3">Retorno</th>
              <th className="text-right p-3">Lucro</th>
              <th className="text-right p-3">ROI</th>
              <th className="text-left p-3">Período</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {(actions ?? []).map((a: any) => {
              const inv = Number(a.valor_investido) || 0;
              const ret = Number(a.retorno_obtido) || 0;
              const lucro = ret - inv;
              const roi = inv > 0 ? (lucro / inv) * 100 : null;
              const st: Status = roi == null ? "na" : roi >= 20 ? "ok" : roi >= 0 ? "warn" : "crit";
              return (
                <tr key={a.id} className="border-t">
                  <td className="p-3 font-medium">{a.nome}</td>
                  <td className="p-3 text-muted-foreground">{a.tipo ?? "—"}</td>
                  <td className="p-3 text-right">{BRL(inv)}</td>
                  <td className="p-3 text-right">{BRL(ret)}</td>
                  <td className="p-3 text-right">{BRL(lucro)}</td>
                  <td className="p-3 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle[st]}`}>
                      {roi != null ? PCT(roi) : "—"}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs">
                    {a.data_inicio ?? "—"} → {a.data_fim ?? "—"}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                      <Trash2 className="size-3.5 text-rose-500" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {(actions ?? []).length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-muted-foreground text-sm">Nenhuma ação cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ROIDialog open={open} onOpenChange={setOpen} editing={editing} companyId={companyId} branchId={branchId} />
    </div>
  );
}

function ROIDialog({
  open, onOpenChange, editing, companyId, branchId,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: any; companyId: string; branchId: string | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    setForm(editing ?? { nome: "", tipo: "marketing", valor_investido: 0, retorno_obtido: 0, data_inicio: "", data_fim: "", observacoes: "" });
  }, [editing, open]);

  const save = async () => {
    if (!form.nome) { toast.error("Informe o nome da ação"); return; }
    const payload = {
      company_id: companyId,
      branch_id: branchId,
      nome: form.nome,
      tipo: form.tipo || null,
      valor_investido: Number(form.valor_investido) || 0,
      retorno_obtido: Number(form.retorno_obtido) || 0,
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      observacoes: form.observacoes || null,
    };
    const { error } = editing
      ? await db.from("kpi_actions").update(payload).eq("id", editing.id)
      : await db.from("kpi_actions").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Ação atualizada" : "Ação cadastrada");
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["kpi-actions"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar ação" : "Nova ação"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.tipo ?? ""} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="campanha">Campanha</SelectItem>
                <SelectItem value="equipamento">Compra de equipamento</SelectItem>
                <SelectItem value="treinamento">Treinamento</SelectItem>
                <SelectItem value="expansao">Expansão</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor investido</Label>
              <Input type="number" step="0.01" value={form.valor_investido ?? 0} onChange={(e) => setForm({ ...form, valor_investido: e.target.value })} />
            </div>
            <div>
              <Label>Retorno obtido</Label>
              <Input type="number" step="0.01" value={form.retorno_obtido ?? 0} onChange={(e) => setForm({ ...form, retorno_obtido: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Fim</Label>
              <Input type="date" value={form.data_fim ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Input value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save}><Save className="size-4" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Assumptions -----
function AssumptionsForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["kpi-assumptions", companyId],
    queryFn: async () => {
      const { data } = await db.from("kpi_assumptions").select("*").eq("company_id", companyId).maybeSingle();
      return data ?? {
        company_id: companyId, depreciacao: 0, amortizacao: 0,
        novos_clientes: 0, compras_medias_cliente: 0, tempo_medio_meses: 0,
      };
    },
  });
  const [f, setF] = useState<any>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  if (!f) return null;

  const save = async () => {
    const payload = {
      company_id: companyId,
      depreciacao: Number(f.depreciacao) || 0,
      amortizacao: Number(f.amortizacao) || 0,
      novos_clientes: Number(f.novos_clientes) || 0,
      compras_medias_cliente: Number(f.compras_medias_cliente) || 0,
      tempo_medio_meses: Number(f.tempo_medio_meses) || 0,
    };
    const { error } = await db.from("kpi_assumptions").upsert(payload, { onConflict: "company_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Premissas salvas");
    qc.invalidateQueries({ queryKey: ["kpi-assumptions"] });
    qc.invalidateQueries({ queryKey: ["kpi-data"] });
  };

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card space-y-4">
      <div>
        <h3 className="font-semibold">Premissas dos KPIs</h3>
        <p className="text-sm text-muted-foreground">Valores manuais usados quando o sistema não tem dados suficientes (EBITDA, CAC, LTV).</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="Depreciação do período" value={f.depreciacao} onChange={(v) => setF({ ...f, depreciacao: v })} money />
        <Field label="Amortização do período" value={f.amortizacao} onChange={(v) => setF({ ...f, amortizacao: v })} money />
        <Field label="Novos clientes no período" value={f.novos_clientes} onChange={(v) => setF({ ...f, novos_clientes: v })} />
        <Field label="Compras médias por cliente" value={f.compras_medias_cliente} onChange={(v) => setF({ ...f, compras_medias_cliente: v })} />
        <Field label="Tempo médio de relacionamento (meses)" value={f.tempo_medio_meses} onChange={(v) => setF({ ...f, tempo_medio_meses: v })} />
      </div>
      <Button onClick={save}><Save className="size-4" /> Salvar premissas</Button>
    </div>
  );
}
function Field({ label, value, onChange, money }: { label: string; value: any; onChange: (v: string) => void; money?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" step={money ? "0.01" : "1"} value={value ?? 0} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ----- Category classification -----
function CategoryClassification({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data: cats } = useQuery({
    queryKey: ["kpi-cats", companyId],
    queryFn: async () => {
      const { data } = await db.from("categories")
        .select("id, nome, tipo, kpi_classification")
        .eq("company_id", companyId).order("nome");
      return data ?? [];
    },
  });

  const setCls = async (id: string, v: string) => {
    const { error } = await db.from("categories").update({ kpi_classification: v || null }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["kpi-cats"] });
    qc.invalidateQueries({ queryKey: ["kpi-data"] });
  };

  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card space-y-3">
      <div>
        <h3 className="font-semibold">Classificação financeira das categorias</h3>
        <p className="text-sm text-muted-foreground">Classifique cada categoria para alimentar EBITDA, margem de contribuição, ponto de equilíbrio e CAC.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left p-2">Categoria</th>
              <th className="text-left p-2">Tipo</th>
              <th className="text-left p-2">Classificação</th>
            </tr>
          </thead>
          <tbody>
            {(cats ?? []).map((c: any) => (
              <tr key={c.id} className="border-t">
                <td className="p-2 font-medium">{c.nome}</td>
                <td className="p-2 text-muted-foreground capitalize">{c.tipo}</td>
                <td className="p-2">
                  <Select value={c.kpi_classification ?? ""} onValueChange={(v) => setCls(c.id, v)}>
                    <SelectTrigger className="h-8 w-[260px]">
                      <SelectValue placeholder="Não classificada" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSIFICATIONS.map((opt) => (
                        <SelectItem key={opt.v} value={opt.v}>{opt.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
            {(cats ?? []).length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-muted-foreground text-sm">Nenhuma categoria cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
