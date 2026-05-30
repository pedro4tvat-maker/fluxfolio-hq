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
    queryKey: ["client-dashboard", selected, branchId],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return null;
      const today = new Date();
      const formattedToday = today.toISOString().slice(0, 10);
      const last14 = new Date(today);
      last14.setDate(last14.getDate() - 13);
      const range = monthRange(today);
      const [{ data: tx }, { data: allTx }, { data: trendTx }, { data: pay }, { data: rec }, { data: accs }, { data: prods }, { data: latestTx }, { data: categories }, { data: budgets }, { data: vendasVista }, { data: vendasPrazo }, { data: stockMovs }] = await Promise.all([
        withBranch(supabase.from("transactions").select("tipo, valor, categoria_id, data").eq("company_id", selected).eq("status", "realizado").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor, categoria_id, data").eq("company_id", selected).eq("status", "realizado"), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor, data").eq("company_id", selected).eq("status", "realizado").gte("data", last14.toISOString().slice(0, 10)).lte("data", formattedToday), branchId),
        withBranch(supabase.from("payables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "pago").order("vencimento", { ascending: true }).limit(10), branchId),
        withBranch(supabase.from("receivables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).neq("status", "recebido").order("vencimento", { ascending: true }).limit(10), branchId),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", selected),
        withBranch(supabase.from("products").select("id, quantidade, estoque_minimo, preco_venda, custo_unitario").eq("company_id", selected), branchId),
        withBranch(supabase.from("transactions").select("id, descricao, tipo, valor, status, data").eq("company_id", selected).order("data", { ascending: false }).limit(5), branchId),
        supabase.from("categories").select("id, nome").eq("company_id", selected),
        withBranch(supabase.from("budgets").select("mes, ano, categoria_id, valor_orcado").eq("company_id", selected).eq("mes", today.getMonth() + 1).eq("ano", today.getFullYear()), branchId),
        withBranch(supabase.from("transactions").select("id, valor, data").eq("company_id", selected).eq("tipo", "entrada").ilike("descricao", "Venda%").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("receivables").select("id, valor, created_at").eq("company_id", selected).ilike("descricao", "Venda%").gte("created_at", range.start).lte("created_at", range.end + "T23:59:59"), branchId),
        withBranch(supabase.from("stock_movements").select("product_id, quantidade, custo_unitario, data").eq("company_id", selected).eq("tipo", "saida").gte("data", range.start).lte("data", range.end), branchId),
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

      // Vendas do mês: faturamento vem das vendas registradas (transações à vista + recebíveis a prazo
      // com descrição iniciando em "Venda"). OS count = quantidade de vendas registradas no mês.
      const vendasMes =
        (vendasVista ?? []).reduce((s, t) => s + Number((t as any).valor ?? 0), 0) +
        (vendasPrazo ?? []).reduce((s, r) => s + Number((r as any).valor ?? 0), 0);
      const ordensServico = (vendasVista ?? []).length + (vendasPrazo ?? []).length;
      const vendasCount = ordensServico;

      // Margem média do mês: baseada nas vendas reais (stock_movements de saída).
      // Faturamento = qtd * preco_venda do produto. Custo = qtd * custo_unitario do
      // momento da venda (snapshot do movimento), com fallback ao custo cadastrado.
      const prodMap = new Map<string, { preco_venda: number; custo_unitario: number }>();
      (prods ?? []).forEach((p: any) => {
        prodMap.set(p.id, {
          preco_venda: Number(p.preco_venda ?? 0),
          custo_unitario: Number(p.custo_unitario ?? 0),
        });
      });
      let faturamentoMovs = 0;
      let custoMovs = 0;
      (stockMovs ?? []).forEach((m: any) => {
        const p = prodMap.get(m.product_id);
        const qtd = Number(m.quantidade ?? 0);
        const preco = Number(p?.preco_venda ?? 0);
        const custoUnit =
          m.custo_unitario != null ? Number(m.custo_unitario) : Number(p?.custo_unitario ?? 0);
        faturamentoMovs += qtd * preco;
        custoMovs += qtd * custoUnit;
      });
      const margemMedia = faturamentoMovs > 0 ? (faturamentoMovs - custoMovs) / faturamentoMovs : null;

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
        ordensServico,
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
            <MiniStat label="OS do mês" value={String(data.ordensServico ?? 0)} hint="Ordens de serviço" />
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

