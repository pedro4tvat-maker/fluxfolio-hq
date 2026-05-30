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
  coletasAtraso: number;
  pagamentosAtraso: number;
  semLancamento: boolean;
  ultimoLancamento: string | null;
  status: "saudavel" | "atencao" | "critico";
  unidades: number;
  matrizCidade: string | null;
  ativo: boolean;
}

async function loadCompanies(): Promise<CompanyKpi[]> {
  const { data: companies, error } = await supabase
    .from("companies").select("id, nome, responsavel, ativo")
    .order("nome");
  if (error) throw error;
  const range = monthRange();

  return Promise.all((companies ?? []).map(async (c) => {
    const [{ data: tx }, { data: pay }, { data: rec }, { data: accs }, { data: allTx }, { data: brs }, { data: lastTx }] = await Promise.all([
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
      supabase.from("payables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "pago"),
      supabase.from("receivables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "recebido"),
      supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", c.id),
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado"),
      supabase.from("branches").select("id, cidade, is_main_branch, ativa").eq("company_id", c.id),
      supabase.from("transactions").select("data").eq("company_id", c.id).order("data", { ascending: false }).limit(1),
    ]);
    const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
    const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
    const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
    const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
    const saldo = saldoInicial + delta;
    const today = new Date().toISOString().slice(0, 10);
    const pagamentosAtraso = (pay ?? []).filter((p) => p.vencimento < today).length;
    const coletasAtraso = (rec ?? []).filter((r) => r.vencimento < today).length;
    const vencidos = pagamentosAtraso + coletasAtraso;
    const resultado = entradas - saidas;
    const unidades = (brs ?? []).filter((b: any) => b.ativa).length;
    const matrizCidade = (brs ?? []).find((b: any) => b.is_main_branch)?.cidade ?? null;
    const semLancamento = (tx ?? []).length === 0;
    const ultimoLancamento = (lastTx ?? [])[0]?.data ?? null;
    let status: CompanyKpi["status"] = "saudavel";
    if (saldo < 0 || resultado < 0 || vencidos > 2) status = "critico";
    else if (vencidos > 0 || resultado < entradas * 0.1) status = "atencao";
    return { id: c.id, nome: c.nome, responsavel: c.responsavel, entradas, saidas, resultado, saldo, vencidos, coletasAtraso, pagamentosAtraso, semLancamento, ultimoLancamento, status, unidades, matrizCidade, ativo: c.ativo };
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
  const { data: consultancy } = useQuery({
    queryKey: ["my-consultancy-header"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("consultancy_name, invite_code").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const handleSeed = async () => {
    setSeeding(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSeeding(false); return; }
    const { error } = await supabase.rpc("seed_demo_data", { _owner: userData.user.id });
    setSeeding(false);
    if (error) toast.error("Não foi possível carregar dados de demonstração", { description: error.message });
    else { toast.success("Dados de demonstração criados!"); refetch(); }
  };

  const inativar = async (id: string, nome: string) => {
    if (!confirm(`Inativar a empresa "${nome}"? Ela deixará de aparecer como ativa.`)) return;
    const { error } = await supabase.from("companies").update({ ativo: false }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Empresa inativada"); refetch(); }
  };
  const reativar = async (id: string) => {
    const { error } = await supabase.from("companies").update({ ativo: true }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Empresa reativada"); refetch(); }
  };
  const excluir = async (id: string, nome: string) => {
    if (!confirm(`EXCLUIR permanentemente "${nome}"? Esta ação não pode ser desfeita.`)) return;
    if (!confirm(`Tem certeza? Todos os lançamentos serão removidos junto com a empresa "${nome}".`)) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Empresa excluída"); refetch(); }
  };
  const copyCode = () => {
    if (!consultancy?.invite_code) return;
    navigator.clipboard.writeText(consultancy.invite_code);
    toast.success("Código copiado!");
  };

  const ativas = data?.filter((c) => c.ativo).length ?? 0;
  const atencao = data?.filter((c) => c.ativo && c.status === "atencao").length ?? 0;
  const critico = data?.filter((c) => c.ativo && c.status === "critico").length ?? 0;
  const semLancamento = data?.filter((c) => c.ativo && c.semLancamento).length ?? 0;
  const coletasAtraso = data?.reduce((s, c) => s + (c.ativo ? c.coletasAtraso : 0), 0) ?? 0;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">
            {consultancy?.consultancy_name ?? "Painel do consultor"}
          </h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-muted-foreground text-sm">Visão geral das empresas acompanhadas.</p>
            {consultancy?.invite_code && (
              <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-mono">
                <span>{consultancy.invite_code}</span>
                <button onClick={copyCode} className="hover:bg-primary/20 rounded p-0.5" title="Copiar código">
                  <FileText className="size-3" />
                </button>
              </div>
            )}
          </div>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi icon={Building2} label="Empresas ativas" value={String(ativas)} />
        <Kpi icon={AlertCircle} label="Em atenção" value={String(atencao)} tone="warning" />
        <Kpi icon={AlertTriangle} label="Críticas" value={String(critico)} tone="danger" />
        <Kpi icon={Clock} label="Sem lançamento (mês)" value={String(semLancamento)} tone={semLancamento > 0 ? "warning" : undefined} />
        <Kpi icon={ArrowDownCircle} label="Coletas em atraso" value={String(coletasAtraso)} tone={coletasAtraso > 0 ? "danger" : undefined} />
      </div>

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
        <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between">
            <h3 className="font-display font-semibold">Empresas acompanhadas</h3>
            <span className="text-xs text-muted-foreground">{data.length} no total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Empresa</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Saldo</th>
                  <th className="text-right px-4 py-2">Resultado mês</th>
                  <th className="text-right px-4 py-2">Vencidos</th>
                  <th className="text-left px-4 py-2">Último lanç.</th>
                  <th className="text-right px-4 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className={`border-t hover:bg-muted/20 ${!c.ativo ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2">
                      <Link
                        to="/app/empresa/$id"
                        params={{ id: c.id }}
                        onClick={() => localStorage.setItem("sfp:selected_company", c.id)}
                        className="font-medium hover:text-primary"
                      >
                        {c.nome}
                      </Link>
                      {c.responsavel && <div className="text-xs text-muted-foreground">{c.responsavel}</div>}
                    </td>
                    <td className="px-4 py-2">
                      {!c.ativo ? (
                        <span className="text-[11px] font-medium px-2 py-1 rounded-full border bg-muted text-muted-foreground">Inativa</span>
                      ) : (
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${statusColors[c.status]}`}>
                          {statusLabel[c.status]}
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-2 text-right font-medium ${c.saldo < 0 ? "text-destructive" : ""}`}>{formatMoney(c.saldo)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${c.resultado < 0 ? "text-destructive" : c.resultado > 0 ? "text-success" : ""}`}>{formatMoney(c.resultado)}</td>
                    <td className="px-4 py-2 text-right">{c.vencidos > 0 ? <span className="text-destructive font-medium">{c.vencidos}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{c.ultimoLancamento ? formatDate(c.ultimoLancamento) : <span className="text-warning-foreground">Sem lanç.</span>}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {c.ativo ? (
                          <Button size="sm" variant="ghost" onClick={() => inativar(c.id, c.nome)} title="Inativar">Inativar</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => reativar(c.id)} title="Reativar">Reativar</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => excluir(c.id, c.nome)} title="Excluir">Excluir</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    queryKey: ["client-dashboard-v2", selected, branchId],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return null;
      const today = new Date();
      const todayISO = today.toISOString().slice(0, 10);
      const in7 = new Date(today);
      in7.setDate(today.getDate() + 7);
      const in7ISO = in7.toISOString().slice(0, 10);

      const range = monthRange(today);
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const prevRange = monthRange(prev);

      const [
        { data: txMes },
        { data: txMesAnterior },
        { data: allTx },
        { data: pay },
        { data: rec },
        { data: accs },
        { data: prods },
        { data: vendasVista },
        { data: vendasPrazo },
      ] = await Promise.all([
        withBranch(supabase.from("transactions").select("tipo, valor").eq("company_id", selected).eq("status", "realizado").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor").eq("company_id", selected).eq("status", "realizado").gte("data", prevRange.start).lte("data", prevRange.end), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor").eq("company_id", selected).eq("status", "realizado"), branchId),
        withBranch(supabase.from("payables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "pago").order("vencimento", { ascending: true }), branchId),
        withBranch(supabase.from("receivables").select("id, descricao, valor, vencimento, status, cliente").eq("company_id", selected).neq("status", "recebido").order("vencimento", { ascending: true }), branchId),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", selected),
        withBranch(supabase.from("products").select("id, quantidade, estoque_minimo").eq("company_id", selected), branchId),
        withBranch(supabase.from("transactions").select("id, valor").eq("company_id", selected).eq("tipo", "entrada").ilike("descricao", "Venda%").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("receivables").select("id, valor").eq("company_id", selected).ilike("descricao", "Venda%").gte("created_at", range.start).lte("created_at", range.end + "T23:59:59"), branchId),
      ]);

      const sum = (arr: any[] | null, k = "valor") => (arr ?? []).reduce((s, x) => s + Number(x[k] ?? 0), 0);

      const entradas = (txMes ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
      const saidas = (txMes ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
      const entradasAnt = (txMesAnterior ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
      const saidasAnt = (txMesAnterior ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);

      const saldoInicial = sum(accs, "saldo_inicial");
      const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
      const saldo = saldoInicial + delta;

      const payOpen = pay ?? [];
      const recOpen = rec ?? [];

      const payNext7 = payOpen.filter((p) => p.vencimento >= todayISO && p.vencimento <= in7ISO);
      const recNext7 = recOpen.filter((r) => r.vencimento >= todayISO && r.vencimento <= in7ISO);
      const payOverdue = payOpen.filter((p) => p.vencimento < todayISO);
      const recOverdue = recOpen.filter((r) => r.vencimento < todayISO);

      const estoqueAlerta = (prods ?? []).filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;
      const clientesAtraso = new Set(recOverdue.map((r) => r.cliente).filter(Boolean)).size;

      const vendasMes = sum(vendasVista) + sum(vendasPrazo);
      const vendasCount = (vendasVista ?? []).length + (vendasPrazo ?? []).length;
      const ticketMedio = vendasCount > 0 ? vendasMes / vendasCount : null;

      const totalMovsMes = (txMes ?? []).length + (txMesAnterior ?? []).length;
      const entradasDelta = entradasAnt > 0 ? ((entradas - entradasAnt) / entradasAnt) * 100 : null;
      const saidasDelta = saidasAnt > 0 ? ((saidas - saidasAnt) / saidasAnt) * 100 : null;

      return {
        company,
        saldo,
        entradas,
        saidas,
        resultado: entradas - saidas,
        entradasDelta,
        saidasDelta,
        hasComparison: totalMovsMes > 0 && (entradasAnt > 0 || saidasAnt > 0),
        payNext7Total: sum(payNext7),
        payNext7Count: payNext7.length,
        recNext7Total: sum(recNext7),
        recNext7Count: recNext7.length,
        payOverdueTotal: sum(payOverdue),
        payOverdueCount: payOverdue.length,
        recOverdueTotal: sum(recOverdue),
        recOverdueCount: recOverdue.length,
        upcomingPay: payNext7.slice(0, 5),
        upcomingRec: recNext7.slice(0, 5),
        estoqueAlerta,
        clientesAtraso,
        vendasMes,
        vendasCount,
        ticketMedio,
        hasAnyMovement: (allTx ?? []).length > 0,
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

  const hours = new Date().getHours();
  const greeting = hours < 12 ? "Bom dia" : hours < 18 ? "Boa tarde" : "Boa noite";
  const branchLabel = isAll
    ? "Consolidado geral"
    : branches.find((b) => b.id === branchId)?.is_main_branch
    ? "Matriz"
    : branches.find((b) => b.id === branchId)?.nome ?? "—";

  // ===== Alerts =====
  const alerts: Array<{
    id: string;
    tone: "danger" | "warn" | "info";
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    desc: string;
    cta: string;
    to: string;
  }> = [];
  if (data.payOverdueCount > 0) {
    alerts.push({
      id: "pay-overdue", tone: "danger", icon: AlertTriangle,
      title: "Contas vencidas",
      desc: `${data.payOverdueCount} ${data.payOverdueCount === 1 ? "conta" : "contas"} em atraso (${formatMoney(data.payOverdueTotal)}).`,
      cta: "Ver contas", to: "/app/contas-pagar",
    });
  }
  if (data.recOverdueCount > 0) {
    alerts.push({
      id: "rec-overdue", tone: "warn", icon: Clock,
      title: "Recebimentos em atraso",
      desc: `${formatMoney(data.recOverdueTotal)} ainda não foi recebido.`,
      cta: "Ver recebimentos", to: "/app/contas-receber",
    });
  }
  if (data.resultado < 0) {
    alerts.push({
      id: "result-neg", tone: "danger", icon: TrendingDown,
      title: "Resultado do mês negativo",
      desc: `As saídas estão acima das entradas (${formatMoney(data.resultado)}).`,
      cta: "Analisar fluxo", to: "/app/fluxo-caixa",
    });
  }
  if (data.estoqueAlerta > 0) {
    alerts.push({
      id: "stock", tone: "warn", icon: Box,
      title: "Estoque baixo",
      desc: `${data.estoqueAlerta} ${data.estoqueAlerta === 1 ? "produto está" : "produtos estão"} no nível mínimo.`,
      cta: "Ver estoque", to: "/app/estoque",
    });
  }
  if (!data.hasAnyMovement) {
    alerts.push({
      id: "no-mov", tone: "info", icon: AlertCircle,
      title: "Sem lançamentos",
      desc: "Cadastre seu primeiro lançamento para acompanhar o resultado.",
      cta: "Lançar agora", to: "/app/fluxo-caixa",
    });
  }
  const visibleAlerts = alerts.slice(0, 5);

  return (
    <div className="space-y-10 max-w-6xl">
      {/* 1. Cabeçalho */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight">{company.nome}</h1>
            <CompanySwitcher />
            <BranchSwitcher />
          </div>
          <p className="text-muted-foreground text-sm">
            {greeting}. Veja os principais pontos da sua empresa hoje.
          </p>
          {branches.length > 1 && (
            <p className="text-xs text-muted-foreground">Visualizando: <span className="text-foreground/80 font-medium">{branchLabel}</span></p>
          )}
        </div>
      </header>

      {/* 2. Visão rápida */}
      <section>
        <SectionTitle>Visão rápida</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <QuickCard
            label="Saldo disponível"
            value={formatMoney(data.saldo)}
            hint="Disponível nas contas"
            tone={data.saldo < 0 ? "danger" : "neutral"}
          />
          <QuickCard
            label="Resultado do mês"
            value={formatMoney(data.resultado)}
            hint={
              !data.hasAnyMovement
                ? "Sem movimentação suficiente"
                : data.resultado > 0
                ? "Mês positivo"
                : data.resultado < 0
                ? "Mês negativo"
                : "Equilibrado"
            }
            tone={data.resultado > 0 ? "success" : data.resultado < 0 ? "danger" : "neutral"}
          />
          <QuickCard
            label="A pagar — 7 dias"
            value={data.payNext7Count === 0 ? "—" : formatMoney(data.payNext7Total)}
            hint={data.payNext7Count === 0 ? "Nenhuma conta próxima" : `${data.payNext7Count} ${data.payNext7Count === 1 ? "conta" : "contas"}`}
            tone="neutral"
          />
          <QuickCard
            label="A receber — 7 dias"
            value={data.recNext7Count === 0 ? "—" : formatMoney(data.recNext7Total)}
            hint={data.recNext7Count === 0 ? "Nenhum recebimento próximo" : `${data.recNext7Count} ${data.recNext7Count === 1 ? "recebimento" : "recebimentos"}`}
            tone="neutral"
          />
        </div>
      </section>

      {/* 3. Ações rápidas */}
      <section>
        <SectionTitle>Ações rápidas</SectionTitle>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <QuickAction icon={ArrowDownCircle} label="Lançar entrada" to="/app/fluxo-caixa" tone="success" />
          <QuickAction icon={ArrowUpCircle} label="Lançar saída" to="/app/fluxo-caixa" tone="danger" />
          <QuickAction icon={ArrowUpCircle} label="Nova conta a pagar" to="/app/contas-pagar" />
          <QuickAction icon={ArrowDownCircle} label="Nova conta a receber" to="/app/contas-receber" />
          <QuickAction icon={ShoppingCart} label="Nova venda" to="/app/vendas" />
          <QuickAction icon={FileText} label="Importar extrato" to="/app/importacoes" />
        </div>
      </section>

      {/* 4. Pontos de atenção */}
      <section>
        <SectionTitle>Pontos de atenção</SectionTitle>
        {visibleAlerts.length === 0 ? (
          <div className="bg-card border rounded-2xl p-5 flex items-center gap-3">
            <div className="size-9 rounded-full bg-success/10 grid place-items-center text-success shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div>
              <p className="font-medium">Tudo certo por enquanto.</p>
              <p className="text-sm text-muted-foreground">Nenhum ponto crítico identificado.</p>
            </div>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl divide-y overflow-hidden">
            {visibleAlerts.map((a) => (
              <AlertRow key={a.id} {...a} />
            ))}
          </div>
        )}
      </section>

      {/* 5. Movimento do mês */}
      <section>
        <SectionTitle>Movimento do mês</SectionTitle>
        <div className="bg-card border rounded-2xl p-6">
          {data.entradas === 0 && data.saidas === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhuma movimentação registrada ainda neste mês.
            </p>
          ) : (
            <div className="space-y-6">
              <FlowBar
                label="Entradas"
                value={data.entradas}
                max={Math.max(data.entradas, data.saidas)}
                color="bg-success"
                delta={data.entradasDelta}
              />
              <FlowBar
                label="Saídas"
                value={data.saidas}
                max={Math.max(data.entradas, data.saidas)}
                color="bg-destructive"
                delta={data.saidasDelta}
                deltaInverse
              />
              <div className="pt-4 border-t flex items-end justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">Resultado</div>
                  <div className={`mt-1 font-display font-bold text-2xl tabular-nums ${data.resultado < 0 ? "text-destructive" : "text-success"}`}>
                    {formatMoney(data.resultado)}
                  </div>
                </div>
                {!data.hasComparison && (
                  <p className="text-xs text-muted-foreground max-w-xs text-right">
                    Ainda não há dados suficientes para comparar com o mês anterior.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. Próximos compromissos */}
      <section>
        <SectionTitle>Próximos compromissos</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
          <CommitmentList
            title="Próximas contas a pagar"
            items={data.upcomingPay}
            emptyText="Nenhuma conta prevista para os próximos dias."
            tone="danger"
            ctaTo="/app/contas-pagar"
            ctaLabel="Ver todas as contas a pagar"
          />
          <CommitmentList
            title="Próximos recebimentos"
            items={data.upcomingRec}
            emptyText="Nenhum recebimento previsto para os próximos dias."
            tone="success"
            ctaTo="/app/contas-receber"
            ctaLabel="Ver todos os recebimentos"
          />
        </div>
      </section>

      <section>
        <SectionTitle>Resumo operacional</SectionTitle>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <SmallStat
            label="Vendas do mês"
            value={data.vendasCount === 0 ? "—" : formatMoney(data.vendasMes)}
            hint={data.vendasCount === 0 ? "Cadastre vendas para acompanhar" : `${data.vendasCount} ${data.vendasCount === 1 ? "venda" : "vendas"}`}
          />
          <SmallStat
            label="Ticket médio"
            value={data.ticketMedio == null ? "—" : formatMoney(data.ticketMedio)}
            hint={data.ticketMedio == null ? "Cadastre vendas para visualizar" : "Média por venda"}
          />
          <SmallStat
            label="Estoque baixo"
            value={String(data.estoqueAlerta)}
            hint={data.estoqueAlerta === 0 ? "Tudo abastecido" : "Produtos no mínimo"}
            tone={data.estoqueAlerta > 0 ? "warn" : "default"}
          />
          <SmallStat
            label="Clientes em atraso"
            value={String(data.clientesAtraso)}
            hint={data.clientesAtraso === 0 ? "Nenhum em atraso" : "Com recebimentos vencidos"}
            tone={data.clientesAtraso > 0 ? "warn" : "default"}
          />
        </div>
      </section>
    </div>
  );
}

/* =============== CLIENT — small building blocks =============== */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.12em] mb-3">{children}</h2>
  );
}

function QuickCard({
  label, value, hint, tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "success" | "danger" | "warn" | "neutral";
}) {
  const valueTone =
    tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning-foreground" : "";
  return (
    <div className="bg-card border rounded-2xl p-6">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-3 font-display font-bold text-[26px] leading-tight tabular-nums ${valueTone}`}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-2">{hint}</div>}
    </div>
  );
}

function AlertRow({
  tone, icon: Icon, title, desc, cta, to,
}: {
  tone: "danger" | "warn" | "info";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  cta: string;
  to: string;
}) {
  const iconBg =
    tone === "danger" ? "bg-destructive/10 text-destructive"
    : tone === "warn" ? "bg-warning/10 text-warning-foreground"
    : "bg-primary/10 text-primary";
  return (
    <div className="flex items-center gap-4 p-4">
      <div className={`size-10 rounded-full grid place-items-center shrink-0 ${iconBg}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium leading-tight">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Button asChild size="sm" variant="ghost" className="shrink-0">
        <Link to={to}>{cta} <ArrowRight className="size-3 ml-1" /></Link>
      </Button>
    </div>
  );
}

function FlowBar({
  label, value, max, color, delta, deltaInverse,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  delta: number | null;
  deltaInverse?: boolean;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const positive = delta != null && delta >= 0;
  // For "saidas" (deltaInverse), going up is bad
  const deltaTone =
    delta == null ? "" : (deltaInverse ? (positive ? "text-destructive" : "text-success") : (positive ? "text-success" : "text-destructive"));
  const deltaLabel =
    delta == null ? null
    : `${positive ? "+" : ""}${delta.toFixed(0)}% vs mês anterior`;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2 gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-3">
          {deltaLabel && <span className={`text-xs ${deltaTone}`}>{deltaLabel}</span>}
          <span className="font-display font-semibold tabular-nums">{formatMoney(value)}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} />
      </div>
    </div>
  );
}

function CommitmentList({
  title, items, emptyText, tone, ctaTo, ctaLabel,
}: {
  title: string;
  items: Array<{ id: string; descricao: string | null; valor: number | string; vencimento: string; status?: string | null }>;
  emptyText: string;
  tone: "success" | "danger";
  ctaTo: string;
  ctaLabel: string;
}) {
  const valueTone = tone === "success" ? "text-success" : "text-destructive";
  return (
    <div className="bg-card border rounded-2xl p-6 flex flex-col">
      <h3 className="font-display font-semibold mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center flex-1">{emptyText}</p>
      ) : (
        <ul className="divide-y flex-1">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{item.descricao || "—"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vence em {formatDate(item.vencimento)}</p>
              </div>
              <span className={`font-display font-semibold tabular-nums ${valueTone}`}>{formatMoney(Number(item.valor))}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 pt-3 border-t">
        <Button asChild variant="ghost" size="sm" className="w-full justify-between">
          <Link to={ctaTo}>{ctaLabel} <ArrowRight className="size-4" /></Link>
        </Button>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon, label, to, tone,
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
      className="group bg-card border rounded-xl p-3 hover:border-primary/40 transition-colors flex items-center gap-3"
    >
      <div className={`size-9 rounded-lg grid place-items-center shrink-0 ${iconTone}`}>
        <Icon className="size-4" />
      </div>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </Link>
  );
}

function SmallStat({
  label, value, hint, tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display font-bold text-lg tabular-nums ${tone === "warn" ? "text-warning-foreground" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}


