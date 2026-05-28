import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney, monthRange } from "@/lib/format";
import { CompanySwitcher } from "@/components/company-switcher";
import { Button } from "@/components/ui/button";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, TrendingUp, TrendingDown, AlertCircle, PlusCircle, Sparkles, ArrowRight, ShoppingCart, Percent, Box, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Clock, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";

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
}

async function loadCompanies(): Promise<CompanyKpi[]> {
  const { data: companies, error } = await supabase
    .from("companies").select("id, nome, responsavel, ativo")
    .eq("ativo", true).order("nome");
  if (error) throw error;
  const range = monthRange();

  return Promise.all((companies ?? []).map(async (c) => {
    const [{ data: tx }, { data: pay }, { data: rec }, { data: accs }, { data: allTx }] = await Promise.all([
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
      supabase.from("payables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "pago"),
      supabase.from("receivables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "recebido"),
      supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", c.id),
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado"),
    ]);
    const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
    const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
    const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
    const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
    const saldo = saldoInicial + delta;
    const today = new Date().toISOString().slice(0, 10);
    const vencidos = (pay ?? []).filter((p) => p.vencimento < today).length + (rec ?? []).filter((r) => r.vencimento < today).length;
    const resultado = entradas - saidas;
    let status: CompanyKpi["status"] = "saudavel";
    if (saldo < 0 || resultado < 0 || vencidos > 2) status = "critico";
    else if (vencidos > 0 || resultado < entradas * 0.1) status = "atencao";
    return { id: c.id, nome: c.nome, responsavel: c.responsavel, entradas, saidas, resultado, saldo, vencidos, status };
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

  const { data, isLoading } = useQuery({
    queryKey: ["client-dashboard", selected],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return null;
      const today = new Date();
      const formattedToday = today.toISOString().slice(0, 10);
      const last14 = new Date(today);
      last14.setDate(last14.getDate() - 13);
      const range = monthRange(today);
      const [{ data: tx }, { data: allTx }, { data: trendTx }, { data: pay }, { data: rec }, { data: accs }, { data: prods }, { data: latestTx }, { data: categories }, { data: budgets }] = await Promise.all([
        supabase.from("transactions").select("tipo, valor, categoria_id, data").eq("company_id", selected).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
        supabase.from("transactions").select("tipo, valor, categoria_id, data").eq("company_id", selected).eq("status", "realizado"),
        supabase.from("transactions").select("tipo, valor, data").eq("company_id", selected).eq("status", "realizado").gte("data", last14.toISOString().slice(0, 10)).lte("data", formattedToday),
        supabase.from("payables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "pago").order("vencimento", { ascending: true }).limit(10),
        supabase.from("receivables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "recebido").order("vencimento", { ascending: true }).limit(10),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", selected),
        supabase.from("products").select("quantidade, estoque_minimo, preco_venda, custo_unitario").eq("company_id", selected),
        supabase.from("transactions").select("id, descricao, tipo, valor, status, data").eq("company_id", selected).order("data", { ascending: false }).limit(5),
        supabase.from("categories").select("id, nome").eq("company_id", selected),
        supabase.from("budgets").select("mes, ano, categoria_id, valor_orcado").eq("company_id", selected).eq("mes", today.getMonth() + 1).eq("ano", today.getFullYear()),
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

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Painel da empresa</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral da saúde financeira e operacional da sua empresa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CompanySwitcher />
          <Button asChild><Link to="/app/fluxo-caixa">Lançar movimentação</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Box} label="Saldo atual" value={formatMoney(data.saldo)} tone={data.saldo < 0 ? "danger" : "success"} desc="Disponível em contas" />
        <Kpi icon={TrendingUp} label="Entradas do mês" value={formatMoney(data.entradas)} tone="success" desc="Receitas realizadas" />
        <Kpi icon={TrendingDown} label="Saídas do mês" value={formatMoney(data.saidas)} tone="danger" desc="Despesas realizadas" />
        <Kpi icon={Percent} label="Resultado do mês" value={formatMoney(data.resultado)} tone={data.resultado < 0 ? "danger" : "success"} desc="Lucro / prejuízo no mês" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ArrowDownCircle} label="Contas a Pagar" value={formatMoney(data.aPagarAbertas)} tone={data.aPagarAbertas > 0 ? "warning" : undefined} desc="Em aberto" />
        <Kpi icon={ArrowUpCircle} label="Contas a Receber" value={formatMoney(data.aReceberAbertas)} tone={data.aReceberAbertas > 0 ? "success" : undefined} desc="A receber" />
        <Kpi icon={AlertCircle} label="Contas Vencidas" value={formatMoney(data.pagarVencidas)} tone={data.pagarVencidas > 0 ? "danger" : undefined} desc="Vencidas hoje" />
        <Kpi icon={Sparkles} label="Recebimentos Vencidos" value={formatMoney(data.receberVencidas)} tone={data.receberVencidas > 0 ? "warning" : undefined} desc="Atrasos" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ShoppingCart} label="Vendas do mês" value={formatMoney(data.vendasMes ?? 0)} desc={`Pedidos: ${data.vendasCount ?? 0}`} />
        <Kpi icon={Percent} label="Margem média" value={data.margemMedia == null ? "—" : `${(data.margemMedia * 100).toFixed(1)}%`} desc="Margem estimada" />
        <Kpi icon={Box} label="Valor em estoque" value={formatMoney(data.valorEstoque ?? 0)} desc="Custo dos itens em estoque" />
        <Kpi icon={Sparkles} label="Orçamento utilizado" value={data.orcamentoUtilizado == null ? "—" : `${data.orcamentoUtilizado.toFixed(1)}%`} desc="Percentual do orçamento" />
      </div>

      {/* Alertas Inteligentes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card border rounded-2xl p-4">
          <h3 className="font-semibold">Alertas Inteligentes</h3>
          <p className="text-sm text-muted-foreground">Principais alertas acionáveis para sua empresa.</p>
          <div className="mt-3 space-y-2">
            {data.pagarVencidas > 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4 text-destructive" /> Existem {formatMoney(data.pagarVencidas)} em contas a pagar vencidas. <Link to="/app/contas-pagar" className="text-primary ml-2">Ver</Link>
              </div>
            )}
            {data.receberVencidas > 0 && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <AlertTriangle className="size-4 text-warning-foreground" /> Existem {formatMoney(data.receberVencidas)} em recebimentos vencidos. <Link to="/app/contas-receber" className="text-primary ml-2">Ver</Link>
              </div>
            )}
            {/* Próximos 7 dias */}
            {(() => {
              const today = new Date();
              const limit = new Date();
              limit.setDate(today.getDate() + 7);
              const limitISO = limit.toISOString().slice(0, 10);
              const paySoon = (data.nextPayables ?? []).filter((p: any) => p.vencimento <= limitISO).length;
              const recSoon = (data.nextReceivables ?? []).filter((r: any) => r.vencimento <= limitISO).length;
              return (paySoon > 0 || recSoon > 0) ? (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Calendar className="size-4" /> Nos próximos 7 dias: {paySoon} contas a pagar, {recSoon} recebimentos. <Link to="/app/contas-pagar" className="text-primary ml-2">Abrir</Link>
                </div>
              ) : null;
            })()}
            {/* Orçamento */}
            {data.orcamentoUtilizado != null && data.orcamentoUtilizado >= 90 && (
              <div className="flex items-center gap-2 text-sm text-warning">
                <DollarSign className="size-4 text-warning-foreground" /> Orçamento do mês em {data.orcamentoUtilizado.toFixed(1)}% — ver orçamentos. <Link to="/app/orcamento" className="text-primary ml-2">Abrir</Link>
              </div>
            )}
            {/* Inatividade de vendas */}
            {(() => {
              const last3 = (data.trend ?? []).slice(-3).reduce((s: number, d: any) => s + (d.entradas ?? 0), 0);
              const inactive = (data.vendasCount ?? 0) > 0 && last3 === 0;
              return inactive ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" /> Sem vendas nos últimos 3 dias. <Link to="/app/vendas" className="text-primary ml-2">Ver vendas</Link>
                </div>
              ) : null;
            })()}
            {/* Resultado negativo */}
            {data.resultado < 0 && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="size-4 text-destructive" /> Resultado do mês está negativo ({formatMoney(data.resultado)}). Revise despesas. <Link to="/app/fluxo-caixa" className="text-primary ml-2">Analisar</Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-4">
          <h3 className="font-semibold">Alertas de estoque</h3>
          <div className="mt-3">
            {data.estoqueAlerta > 0 ? (
              <div className="flex items-center gap-2 text-sm text-warning">
                <AlertCircle className="size-4 text-warning-foreground" /> {data.estoqueAlerta} produto(s) em alerta de estoque mínimo. <Link to="/app/estoque" className="text-primary ml-2">Ver estoque</Link>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Sem alertas de estoque.</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tendência de receitas e despesas</p>
              <h2 className="font-semibold mt-2">Últimos 14 dias</h2>
            </div>
            <span className="text-xs text-muted-foreground">Análise rápida</span>
          </div>
          <div className="mt-5 h-[260px]">
            <ResponsiveContainer>
              <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="entriesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: "rgba(148,163,184,0.2)" }} formatter={(value: number) => formatMoney(value)} labelStyle={{ color: "#0f172a" }} />
                <Area type="monotone" dataKey="entradas" stroke="#22c55e" fill="url(#entriesGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="saidas" stroke="#f97316" fill="url(#expensesGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-4">
          <div className="bg-card border rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Próximas contas</p>
                <h2 className="font-semibold mt-2">Contas a pagar</h2>
              </div>
              <span className="text-xs text-muted-foreground">Top 3 vencimentos</span>
            </div>
            <div className="mt-4 space-y-3">
              {data.nextPayables.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem contas a pagar próximas.</div>
              ) : (
                data.nextPayables.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.descricao || "Conta a pagar"}</p>
                        <p className="text-xs text-muted-foreground">Vencimento {formatDate(item.vencimento)}</p>
                      </div>
                      <span className="font-mono font-semibold text-destructive">{formatMoney(Number(item.valor))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card border rounded-2xl p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Próximos recebimentos</p>
                <h2 className="font-semibold mt-2">Contas a receber</h2>
              </div>
              <span className="text-xs text-muted-foreground">Top 3 a vencer</span>
            </div>
            <div className="mt-4 space-y-3">
              {data.nextReceivables.length === 0 ? (
                <div className="text-sm text-muted-foreground">Sem recebimentos próximos.</div>
              ) : (
                data.nextReceivables.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.descricao || "Recebimento"}</p>
                        <p className="text-xs text-muted-foreground">Vencimento {formatDate(item.vencimento)}</p>
                      </div>
                      <span className="font-mono font-semibold text-success">{formatMoney(Number(item.valor))}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Últimas movimentações</p>
              <h2 className="font-semibold mt-2">Lançamentos recentes</h2>
            </div>
            <Link to="/app/fluxo-caixa" className="text-sm text-primary hover:underline">Ver todos</Link>
          </div>
          <div className="mt-5 space-y-3">
            {data.latest.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum lançamento recente.</div>
            ) : (
              data.latest.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-3">
                  <div>
                    <p className="font-medium">{item.descricao || (item.tipo === "entrada" ? "Receita" : "Despesa")}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(item.data)}</p>
                  </div>
                  <div className="text-right">
                    <div className={`font-display font-semibold ${item.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {item.tipo === "entrada" ? "+" : "−"} {formatMoney(item.valor)}
                    </div>
                    <span className="text-xs text-muted-foreground">{item.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ações rápidas</p>
              <h2 className="font-semibold mt-2">Acessos rápidos</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            <Button asChild variant="secondary"><Link to="/app/fluxo-caixa">Lançar movimentação</Link></Button>
            <Button asChild variant="outline"><Link to="/app/contas-pagar">Contas a pagar</Link></Button>
            <Button asChild variant="outline"><Link to="/app/contas-receber">Contas a receber</Link></Button>
            <Button asChild variant="outline"><Link to="/app/estoque">Estoque</Link></Button>
          </div>
        </div>
      </section>

      
    </div>
  );
}
