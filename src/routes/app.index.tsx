import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { formatDate, formatMoney, monthRange } from "@/lib/format";
import { CompanySwitcher } from "@/components/company-switcher";
import { BranchSwitcher } from "@/components/branch-switcher";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, TrendingUp, TrendingDown, AlertCircle, PlusCircle, Sparkles, ArrowRight, ShoppingCart, Percent, Box, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Clock, Calendar, DollarSign, FileText } from "lucide-react";

import { toast } from "sonner";
import { useMemo, useState } from "react";

// Apply branch filter to any supabase query builder when a specific branch is selected.
const withBranch = <T extends { eq: (col: string, v: any) => T }>(q: T, branchId: string | null): T =>
  branchId ? q.eq("branch_id", branchId) : q;

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { isConsultant, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  return isConsultant ? <ConsultantPanel /> : <ClientDashboard />;
}

/* =============== CONSULTANT =============== */

interface CompanyKpi {
  id: string;
  nome: string;
  responsavel: string | null;
  entradas: number;
  saidas: number;
  resultado: number;
  saldo: number;
  vencidos: number;
  status: "saudavel" | "atencao" | "critico";
  unidades: number;
  matrizCidade: string | null;
}

async function loadCompanies(): Promise<CompanyKpi[]> {
  const { data: companies, error } = await supabase
    .from("companies").select("id, nome, responsavel, ativo")
    .eq("ativo", true).order("nome");
  if (error) throw error;
  const range = monthRange();

  return Promise.all((companies ?? []).map(async (c) => {
    const [{ data: tx }, { data: pay }, { data: rec }, { data: accs }, { data: allTx }, { data: brs }] = await Promise.all([
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
      supabase.from("payables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "pago"),
      supabase.from("receivables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "recebido"),
      supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", c.id),
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado"),
      supabase.from("branches").select("id, cidade, is_main_branch, ativa").eq("company_id", c.id),
    ]);
    const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
    const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
    const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
    const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
    const saldo = saldoInicial + delta;
    const today = new Date().toISOString().slice(0, 10);
    const vencidos = (pay ?? []).filter((p) => p.vencimento < today).length + (rec ?? []).filter((r) => r.vencimento < today).length;
    const resultado = entradas - saidas;
    const unidades = (brs ?? []).filter((b: any) => b.ativa).length;
    const matrizCidade = (brs ?? []).find((b: any) => b.is_main_branch)?.cidade ?? null;
    let status: CompanyKpi["status"] = "saudavel";
    if (saldo < 0 || resultado < 0 || vencidos > 2) status = "critico";
    else if (vencidos > 0 || resultado < entradas * 0.1) status = "atencao";
    return { id: c.id, nome: c.nome, responsavel: c.responsavel, entradas, saidas, resultado, saldo, vencidos, status, unidades, matrizCidade };
  }));
}

const statusColors = {
  saudavel: "bg-success/10 text-success border-success/20",
  atencao: "bg-warning/10 text-warning-foreground border-warning/30",
  critico: "bg-destructive/10 text-destructive border-destructive/20",
};
const statusLabel = { saudavel: "Saudável", atencao: "Atenção", critico: "Crítico" };

function ConsultantPanel() {
  const [seeding, setSeeding] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard-companies"], queryFn: loadCompanies });

  const handleSeed = async () => {
    setSeeding(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSeeding(false); return; }
    const { error } = await supabase.rpc("seed_demo_data", { _owner: userData.user.id });
    setSeeding(false);
    if (error) toast.error("Não foi possível carregar dados de demonstração", { description: error.message });
    else { toast.success("Dados de demonstração criados!"); refetch(); }
  };

  const total = data?.length ?? 0;
  const saudaveis = data?.filter((c) => c.status === "saudavel").length ?? 0;
  const atencao = data?.filter((c) => c.status === "atencao").length ?? 0;
  const critico = data?.filter((c) => c.status === "critico").length ?? 0;
  const resultadoConsolidado = data?.reduce((s, c) => s + c.resultado, 0) ?? 0;
  const vencidasConsolidadas = data?.reduce((s, c) => s + c.vencidos, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Painel do consultor</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral de todas as empresas acompanhadas.</p>
        </div>
        <div className="flex gap-2">
          {data && data.length === 0 && (
            <Button onClick={handleSeed} variant="outline" disabled={seeding}>
              <Sparkles className="size-4" /> {seeding ? "Carregando..." : "Carregar dados de demonstração"}
            </Button>
          )}
          <Button asChild><Link to="/app/clientes"><PlusCircle className="size-4" /> Nova empresa</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Empresas ativas" value={String(total)} />
        <Kpi label="Saudáveis" value={String(saudaveis)} tone="success" />
        <Kpi label="Em atenção / críticas" value={`${atencao} / ${critico}`} tone="warning" />
        <Kpi label="Resultado consolidado (mês)" value={formatMoney(resultadoConsolidado)} tone={resultadoConsolidado < 0 ? "danger" : "success"} />
      </div>

      {vencidasConsolidadas > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 text-destructive rounded-2xl p-4 flex items-center gap-2 text-sm">
          <AlertCircle className="size-4" /> {vencidasConsolidadas} conta(s) vencida(s) somando todas as empresas.
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground">Carregando empresas...</div>
      ) : !data || data.length === 0 ? (
        <div className="bg-card border rounded-2xl p-10 text-center shadow-card">
          <Building2 className="size-12 mx-auto text-muted-foreground/40" />
          <h3 className="font-display font-semibold mt-4">Nenhuma empresa cadastrada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Cadastre sua primeira empresa cliente ou carregue dados de demonstração para explorar o sistema.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Link
              key={c.id}
              to="/app/empresa/$id"
              params={{ id: c.id }}
              onClick={() => localStorage.setItem("sfp:selected_company", c.id)}
              className="bg-card border rounded-2xl p-5 shadow-card hover:shadow-elevated transition-shadow space-y-4 block"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display font-semibold leading-tight">{c.nome}</h3>
                  {c.responsavel && <p className="text-xs text-muted-foreground mt-0.5">{c.responsavel}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {c.unidades > 1 ? `${c.unidades} unidades` : "Apenas matriz"}{c.matrizCidade ? ` · Matriz: ${c.matrizCidade}` : ""}
                  </p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${statusColors[c.status]}`}>
                  {statusLabel[c.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo atual</div>
                  <div className={`font-display font-bold text-lg ${c.saldo < 0 ? "text-destructive" : ""}`}>{formatMoney(c.saldo)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Resultado do mês</div>
                  <div className={`font-display font-bold text-lg ${c.resultado < 0 ? "text-destructive" : "text-success"}`}>{formatMoney(c.resultado)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t text-sm">
                <div className="flex items-center gap-2"><TrendingUp className="size-4 text-success" /><span className="text-muted-foreground">Entradas:</span><span className="font-medium ml-auto">{formatMoney(c.entradas)}</span></div>
                <div className="flex items-center gap-2"><TrendingDown className="size-4 text-destructive" /><span className="text-muted-foreground">Saídas:</span><span className="font-medium ml-auto">{formatMoney(c.saidas)}</span></div>
              </div>

              {c.vencidos > 0 && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-2">
                  <AlertCircle className="size-4" /> {c.vencidos} {c.vencidos === 1 ? "conta vencida" : "contas vencidas"}
                </div>
              )}

              <div className="flex items-center gap-1 text-xs text-primary font-medium">
                Acessar resumo <ArrowRight className="size-3" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone, desc }: { icon?: React.ComponentType<{ className?: string }>; label: string; value: string | number; tone?: "success" | "warning" | "danger"; desc?: string; }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "";
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card">
      <div className="flex items-start gap-3">
        {Icon && <Icon className="size-6 text-muted-foreground" />}
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`font-display font-bold text-2xl mt-2 ${c}`}>{value}</div>
          {desc && <div className="text-xs text-muted-foreground mt-1">{desc}</div>}
        </div>
      </div>
    </div>
  );
}

/* =============== CLIENT =============== */

function ClientDashboard() {
  const { companies, selected, isLoading: companyLoading } = useSelectedCompany();
  const company = useMemo(() => companies.find((c) => c.id === selected), [companies, selected]);
  const { branchId, isAll, branches } = useSelectedBranch();

  const { data, isLoading } = useQuery({
    queryKey: ["client-dashboard", selected, branchId],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return null;
      const today = new Date();
      const formattedToday = today.toISOString().slice(0, 10);
      const last14 = new Date(today);
      last14.setDate(last14.getDate() - 13);
      const range = monthRange(today);
      const [{ data: tx }, { data: allTx }, { data: trendTx }, { data: pay }, { data: rec }, { data: accs }, { data: prods }, { data: latestTx }, { data: categories }, { data: budgets }] = await Promise.all([
        withBranch(supabase.from("transactions").select("tipo, valor, categoria_id, data").eq("company_id", selected).eq("status", "realizado").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor, categoria_id, data").eq("company_id", selected).eq("status", "realizado"), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor, data").eq("company_id", selected).eq("status", "realizado").gte("data", last14.toISOString().slice(0, 10)).lte("data", formattedToday), branchId),
        withBranch(supabase.from("payables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "pago").order("vencimento", { ascending: true }).limit(10), branchId),
        withBranch(supabase.from("receivables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "recebido").order("vencimento", { ascending: true }).limit(10), branchId),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", selected),
        withBranch(supabase.from("products").select("quantidade, estoque_minimo, preco_venda, custo_unitario").eq("company_id", selected), branchId),
        withBranch(supabase.from("transactions").select("id, descricao, tipo, valor, status, data").eq("company_id", selected).order("data", { ascending: false }).limit(5), branchId),
        supabase.from("categories").select("id, nome").eq("company_id", selected),
        withBranch(supabase.from("budgets").select("mes, ano, categoria_id, valor_orcado").eq("company_id", selected).eq("mes", today.getMonth() + 1).eq("ano", today.getFullYear()), branchId),
      ]);

      const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number((t as any).valor ?? 0), 0);
      const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number((t as any).valor ?? 0), 0);
      const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
      const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number((t as any).valor ?? 0), 0);
      const saldo = saldoInicial + delta;
      const aPagarAbertas = (pay ?? []).reduce((s, p) => s + Number(p.valor), 0);
      const aReceberAbertas = (rec ?? []).reduce((s, r) => s + Number(r.valor), 0);
      const pagarVencidas = (pay ?? []).filter((p) => p.vencimento < formattedToday).reduce((s, p) => s + Number(p.valor), 0);
      const receberVencidas = (rec ?? []).filter((r) => r.vencimento < formattedToday).reduce((s, r) => s + Number(r.valor), 0);
      const estoqueAlerta = (prods ?? []).filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;
      const nextPayables = (pay ?? []).slice(0, 3);
      const nextReceivables = (rec ?? []).slice(0, 3);
      const latest = (latestTx ?? []).map((item) => ({
        id: item.id,
        descricao: item.descricao,
        tipo: item.tipo,
        valor: Number(item.valor),
        status: item.status,
        data: item.data,
      }));

      const trendMap = new Map<string, { date: string; label: string; entradas: number; saidas: number }>();
      for (let i = 0; i < 14; i += 1) {
        const day = new Date(last14);
        day.setDate(last14.getDate() + i);
        const date = day.toISOString().slice(0, 10);
        const label = day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        trendMap.set(date, { date, label, entradas: 0, saidas: 0 });
      }
      (trendTx ?? []).forEach((txItem) => {
        const row = trendMap.get(txItem.data);
        if (!row) return;
        if (txItem.tipo === "entrada") row.entradas += Number(txItem.valor);
        if (txItem.tipo === "saida") row.saidas += Number(txItem.valor);
      });
      const trend = Array.from(trendMap.values());

      // Vendas do mês: transactions with category named like 'venda' and tipo 'entrada'
      const salesCategoryIds = (categories ?? []).filter((c) => typeof c.nome === "string" && c.nome.toLowerCase().includes("venda")).map((c) => c.id);
      const vendasTx = (allTx ?? []).filter((t) => t.tipo === "entrada" && salesCategoryIds.includes((t as any).categoria_id));
      const vendasMes = vendasTx.reduce((s, t) => s + Number((t as any).valor ?? 0), 0);
      const vendasCount = vendasTx.length;

      // Inventory value and estimated average margin from products
      const valorEstoque = (prods ?? []).reduce((s, p) => s + Number(p.quantidade ?? 0) * Number(p.custo_unitario ?? 0), 0);
      const margemMedia = (() => {
        const items = (prods ?? []).filter((p) => Number(p.preco_venda) > 0);
        if (!items.length) return null;
        const avg = items.reduce((acc, p) => acc + ((Number(p.preco_venda) - Number(p.custo_unitario)) / Number(p.preco_venda || 1)), 0) / items.length;
        return avg;
      })();

      // Budget utilization for current month
      const totalOrcado = (budgets ?? []).reduce((s, b) => s + Number(b.valor_orcado ?? 0), 0);
      let totalRealizado = 0;
      if ((budgets ?? []).length) {
        const budgetCategoryIds = (budgets ?? []).map((b) => b.categoria_id);
        totalRealizado = (allTx ?? []).filter((t) => budgetCategoryIds.includes((t as any).categoria_id)).reduce((s, t) => s + Number((t as any).valor ?? 0), 0);
      }
      const orcamentoUtilizado = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : null;
      return {
        company,
        entradas,
        saidas,
        saldo,
        resultado: entradas - saidas,
        aPagarAbertas,
        aReceberAbertas,
        pagarVencidas,
        receberVencidas,
        estoqueAlerta,
        nextPayables,
        nextReceivables,
        latest,
        trend,
        vendasMes,
        vendasCount,
        valorEstoque,
        margemMedia,
        orcamentoUtilizado,
      };
    },
  });

  if (companyLoading || isLoading) return <div className="text-muted-foreground">Carregando seu dashboard...</div>;
  if (!company || !data) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center shadow-card max-w-xl mx-auto">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Empresa não encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Sua empresa não foi encontrada ou você não tem acesso a ela. Faça logout e entre novamente.
        </p>
      </div>
    );
  }

  const today = new Date();
  const hours = today.getHours();
  const greeting = hours < 12 ? "Bom dia" : hours < 18 ? "Boa tarde" : "Boa noite";

  // Pontos de atenção
  const alerts: Array<{
    id: string;
    tone: "danger" | "warn" | "info";
    icon: React.ComponentType<{ className?: string }>;
    text: string;
    cta: string;
    to: string;
  }> = [];
  if (data.pagarVencidas > 0) {
    alerts.push({
      id: "pay-overdue",
      tone: "danger",
      icon: AlertTriangle,
      text: `Existem ${formatMoney(data.pagarVencidas)} em contas vencidas que precisam ser resolvidas.`,
      cta: "Resolver",
      to: "/app/contas-pagar",
    });
  }
  if (data.receberVencidas > 0) {
    alerts.push({
      id: "rec-overdue",
      tone: "warn",
      icon: Clock,
      text: `Você possui ${formatMoney(data.receberVencidas)} em recebimentos em atraso.`,
      cta: "Cobrar",
      to: "/app/contas-receber",
    });
  }
  if (data.orcamentoUtilizado != null && data.orcamentoUtilizado >= 90) {
    alerts.push({
      id: "budget",
      tone: data.orcamentoUtilizado >= 100 ? "danger" : "warn",
      icon: DollarSign,
      text: `Seu planejamento está em ${data.orcamentoUtilizado.toFixed(0)}% do limite do mês.`,
      cta: "Ver planejamento",
      to: "/app/orcamento",
    });
  }
  if (data.estoqueAlerta > 0) {
    alerts.push({
      id: "stock",
      tone: "warn",
      icon: Box,
      text: `${data.estoqueAlerta} ${data.estoqueAlerta === 1 ? "produto está" : "produtos estão"} com estoque baixo.`,
      cta: "Ver estoque",
      to: "/app/estoque",
    });
  }
  if (data.resultado < 0) {
    alerts.push({
      id: "result-neg",
      tone: "danger",
      icon: TrendingDown,
      text: `O resultado do mês está negativo (${formatMoney(data.resultado)}). Revise suas despesas.`,
      cta: "Analisar",
      to: "/app/fluxo-caixa",
    });
  }
  const visibleAlerts = alerts.slice(0, 5);

  // Próximos 7 dias
  const limit = new Date();
  limit.setDate(today.getDate() + 7);
  const limitISO = limit.toISOString().slice(0, 10);
  const upcomingPay = (data.nextPayables ?? []).filter((p: any) => p.vencimento <= limitISO).slice(0, 3);
  const upcomingRec = (data.nextReceivables ?? []).filter((r: any) => r.vencimento <= limitISO).slice(0, 3);

  const orc = data.orcamentoUtilizado;
  const totalMes = data.entradas + data.saidas;
  const pctEntradas = totalMes > 0 ? (data.entradas / totalMes) * 100 : 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* 1. Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">{company.nome}</h1>
            <CompanySwitcher />
            <BranchSwitcher />
          </div>
          <p className="text-muted-foreground">
            {greeting}. {branches.length > 1 && (
              <span className="text-foreground/80">
                Visualizando: <strong>{isAll ? "Consolidado geral" : (branches.find((b) => b.id === branchId)?.is_main_branch ? "Matriz" : branches.find((b) => b.id === branchId)?.nome)}</strong>.{" "}
              </span>
            )}
            Veja os principais pontos da sua empresa hoje.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/app/relatorios"><FileText className="size-4" /> Gerar relatório</Link>
          </Button>
          <Button asChild>
            <Link to="/app/fluxo-caixa"><PlusCircle className="size-4" /> Novo lançamento</Link>
          </Button>
        </div>
      </header>

      {/* 2. Saúde da empresa */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Saúde da empresa</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <HealthBlock
            label="Saldo atual"
            value={formatMoney(data.saldo)}
            hint="Disponível em contas"
            tone={data.saldo < 0 ? "danger" : "success"}
          />
          <HealthBlock
            label="Resultado do mês"
            value={formatMoney(data.resultado)}
            hint={data.resultado >= 0 ? "Mês positivo" : "Mês negativo"}
            tone={data.resultado < 0 ? "danger" : "success"}
          />
          <HealthBlock
            label="Contas vencidas"
            value={formatMoney(data.pagarVencidas)}
            hint={data.pagarVencidas > 0 ? "Precisa atenção" : "Tudo em dia"}
            tone={data.pagarVencidas > 0 ? "danger" : "neutral"}
          />
          <HealthBlock
            label="Recebimentos em aberto"
            value={formatMoney(data.aReceberAbertas)}
            hint={data.receberVencidas > 0 ? `${formatMoney(data.receberVencidas)} em atraso` : "Em dia"}
            tone={data.receberVencidas > 0 ? "warn" : "neutral"}
          />
        </div>
      </section>

      {/* 3. Pontos de Atenção */}
      <section className="bg-card border rounded-2xl p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display font-semibold text-lg">Pontos de atenção</h2>
            <p className="text-sm text-muted-foreground">O que precisa do seu olhar agora.</p>
          </div>
        </div>
        {visibleAlerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/20 p-4">
            <div className="size-9 rounded-full bg-success/10 grid place-items-center text-success">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="font-medium">Tudo em ordem por aqui.</p>
              <p className="text-sm text-muted-foreground">Nenhum ponto crítico exige sua atenção no momento.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAlerts.map((a) => (
              <AlertRow key={a.id} {...a} />
            ))}
          </div>
        )}
      </section>

      {/* 4. Ações rápidas */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ações rápidas</h2>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction icon={ArrowDownCircle} label="Lançar entrada" to="/app/fluxo-caixa" tone="success" />
          <QuickAction icon={ArrowUpCircle} label="Lançar saída" to="/app/fluxo-caixa" tone="danger" />
          <QuickAction icon={ArrowUpCircle} label="Conta a pagar" to="/app/contas-pagar" />
          <QuickAction icon={ArrowDownCircle} label="Conta a receber" to="/app/contas-receber" />
          <QuickAction icon={ShoppingCart} label="Nova venda" to="/app/vendas" />
          <QuickAction icon={Box} label="Novo produto" to="/app/estoque" />
        </div>
      </section>

      {/* 5. Visão do mês + 6. Operação */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-card border rounded-2xl p-6 shadow-card">
          <div className="mb-5">
            <h2 className="font-display font-semibold text-lg">Visão do mês</h2>
            <p className="text-sm text-muted-foreground">Como o mês está se comportando.</p>
          </div>
          <div className="space-y-5">
            <ProgressLine
              label="Entradas"
              value={formatMoney(data.entradas)}
              percent={pctEntradas}
              color="bg-success"
            />
            <ProgressLine
              label="Saídas"
              value={formatMoney(data.saidas)}
              percent={totalMes > 0 ? (data.saidas / totalMes) * 100 : 0}
              color="bg-destructive"
            />
            <div className="pt-4 border-t flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Resultado</div>
                <div className={`font-display font-bold text-xl mt-1 ${data.resultado < 0 ? "text-destructive" : "text-success"}`}>
                  {formatMoney(data.resultado)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Planejado x gasto</div>
                <div className="font-display font-bold text-xl mt-1">
                  {orc == null ? "—" : `${orc.toFixed(0)}%`}
                </div>
                {orc != null && (
                  <div className="mt-1 w-32 h-1.5 rounded-full bg-muted overflow-hidden ml-auto">
                    <div
                      className={`h-full ${orc >= 100 ? "bg-destructive" : orc >= 90 ? "bg-warning" : "bg-primary"}`}
                      style={{ width: `${Math.min(orc, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-card">
          <div className="mb-5">
            <h2 className="font-display font-semibold text-lg">Operação</h2>
            <p className="text-sm text-muted-foreground">Indicadores do dia a dia.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Vendas do mês" value={formatMoney(data.vendasMes ?? 0)} hint={`${data.vendasCount ?? 0} pedidos`} />
            <MiniStat label="Margem média" value={data.margemMedia == null ? "—" : `${(data.margemMedia * 100).toFixed(0)}%`} />
            <MiniStat label="Valor em estoque" value={formatMoney(data.valorEstoque ?? 0)} />
            <MiniStat
              label="Produtos em alerta"
              value={String(data.estoqueAlerta ?? 0)}
              tone={data.estoqueAlerta > 0 ? "warn" : "default"}
            />
          </div>
        </div>
      </section>

      {/* 7. Últimos movimentos + 8. Próximos compromissos */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-lg">Últimos movimentos</h2>
              <p className="text-sm text-muted-foreground">Suas 5 movimentações mais recentes.</p>
            </div>
          </div>
          {data.latest.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum lançamento ainda.</div>
          ) : (
            <ul className="divide-y">
              {data.latest.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-8 rounded-full grid place-items-center shrink-0 ${item.tipo === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {item.tipo === "entrada" ? <ArrowDownCircle className="size-4" /> : <ArrowUpCircle className="size-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.descricao || (item.tipo === "entrada" ? "Entrada" : "Saída")}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                    </div>
                  </div>
                  <div className={`font-display font-semibold tabular-nums ${item.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                    {item.tipo === "entrada" ? "+" : "−"} {formatMoney(item.valor)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 pt-3 border-t">
            <Button asChild variant="ghost" size="sm" className="w-full justify-between">
              <Link to="/app/fluxo-caixa">Ver fluxo de caixa <ArrowRight className="size-4" /></Link>
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display font-semibold text-lg">Próximos compromissos</h2>
              <p className="text-sm text-muted-foreground">A pagar e a receber nos próximos 7 dias.</p>
            </div>
          </div>
          {upcomingPay.length === 0 && upcomingRec.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhum compromisso nos próximos 7 dias.</div>
          ) : (
            <div className="space-y-4">
              {upcomingPay.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">A pagar</div>
                  <ul className="space-y-2">
                    {upcomingPay.map((p: any) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{p.descricao || "Conta a pagar"}</p>
                          <p className="text-xs text-muted-foreground">Vence em {formatDate(p.vencimento)}</p>
                        </div>
                        <span className="font-display font-semibold text-destructive tabular-nums">{formatMoney(Number(p.valor))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {upcomingRec.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">A receber</div>
                  <ul className="space-y-2">
                    {upcomingRec.map((r: any) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{r.descricao || "Recebimento"}</p>
                          <p className="text-xs text-muted-foreground">Vence em {formatDate(r.vencimento)}</p>
                        </div>
                        <span className="font-display font-semibold text-success tabular-nums">{formatMoney(Number(r.valor))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="mt-4 pt-3 border-t grid grid-cols-2 gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/contas-pagar">Contas a pagar</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/app/contas-receber">Contas a receber</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* =============== CLIENT — small building blocks =============== */

function HealthBlock({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger" | "warn" | "neutral";
}) {
  const valueTone =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning-foreground" : "";
  const accent =
    tone === "success" ? "bg-success" : tone === "danger" ? "bg-destructive" : tone === "warn" ? "bg-warning" : "bg-muted-foreground/30";
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card relative overflow-hidden">
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent}`} />
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-3 font-display font-bold text-2xl md:text-[28px] leading-tight tabular-nums ${valueTone}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

function AlertRow({
  tone,
  icon: Icon,
  text,
  cta,
  to,
}: {
  tone: "danger" | "warn" | "info";
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  cta: string;
  to: string;
}) {
  const styles = {
    danger: { bg: "bg-destructive/5 border-destructive/20", icon: "bg-destructive/10 text-destructive" },
    warn: { bg: "bg-warning/5 border-warning/30", icon: "bg-warning/10 text-warning-foreground" },
    info: { bg: "bg-primary/5 border-primary/20", icon: "bg-primary/10 text-primary" },
  }[tone];
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${styles.bg}`}>
      <div className={`size-9 rounded-full grid place-items-center shrink-0 ${styles.icon}`}>
        <Icon className="size-4" />
      </div>
      <p className="text-sm flex-1">{text}</p>
      <Button asChild size="sm" variant="ghost" className="shrink-0">
        <Link to={to}>{cta} <ArrowRight className="size-3 ml-1" /></Link>
      </Button>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  to,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  to: string;
  tone?: "success" | "danger";
}) {
  const iconTone =
    tone === "success" ? "text-success bg-success/10" : tone === "danger" ? "text-destructive bg-destructive/10" : "text-primary bg-primary/10";
  return (
    <Link
      to={to}
      className="group bg-card border rounded-xl p-3 hover:border-primary/40 hover:shadow-card transition-all flex items-center gap-3"
    >
      <div className={`size-9 rounded-lg grid place-items-center ${iconTone}`}>
        <Icon className="size-4" />
      </div>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </Link>
  );
}

function ProgressLine({ label, value, percent, color }: { label: string; value: string; percent: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-display font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, tone = "default" }: { label: string; value: string; hint?: string; tone?: "default" | "warn" }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display font-bold text-lg tabular-nums ${tone === "warn" ? "text-warning-foreground" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

