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
  cnpj: string | null;
  consultancy_stage: string | null;
  entradas: number;
  saidas: number;
  resultado: number;
  saldo: number;
  vencidos: number;
  coletasAtraso: number;
  pagamentosAtraso: number;
  semLancamento: boolean;
  ultimoLancamento: string | null;
  diasSemAtualizacao: number | null;
  status: "saudavel" | "atencao" | "critico" | "pausado" | "inativo";
  ativo: boolean;
  pendenciasAbertas: number;
  entregasAtrasadas: number;
  proximaAcao: { title: string; due_date: string | null } | null;
  relatorioPendente: boolean;
  createdAt: string;
}

const DIAS_SEM_ATUALIZACAO = 7;

async function loadCompaniesV2(): Promise<CompanyKpi[]> {
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, nome, responsavel, ativo, cnpj, consultancy_stage, consultancy_status, created_at")
    .order("nome");
  if (error) throw error;
  const range = monthRange();
  const todayISO = new Date().toISOString().slice(0, 10);

  return Promise.all((companies ?? []).map(async (c: any) => {
    const [
      { data: tx }, { data: pay }, { data: rec }, { data: accs },
      { data: allTx }, { data: lastTx },
      { data: pendings }, { data: plans },
    ] = await Promise.all([
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
      supabase.from("payables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "pago"),
      supabase.from("receivables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "recebido"),
      supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", c.id),
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado"),
      supabase.from("transactions").select("data").eq("company_id", c.id).order("data", { ascending: false }).limit(1),
      supabase.from("client_pending_items").select("id, status, due_date").eq("company_id", c.id).neq("status", "concluido"),
      supabase.from("action_plans").select("id, title, due_date, status, related_area").eq("company_id", c.id).neq("status", "concluido").order("due_date", { ascending: true, nullsFirst: false }),
    ]);

    const entradas = (tx ?? []).filter((t: any) => t.tipo === "entrada").reduce((s, t: any) => s + Number(t.valor), 0);
    const saidas = (tx ?? []).filter((t: any) => t.tipo === "saida").reduce((s, t: any) => s + Number(t.valor), 0);
    const saldoInicial = (accs ?? []).reduce((s, a: any) => s + Number(a.saldo_inicial), 0);
    const delta = (allTx ?? []).reduce((s, t: any) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
    const saldo = saldoInicial + delta;
    const pagamentosAtraso = (pay ?? []).filter((p: any) => p.vencimento < todayISO).length;
    const coletasAtraso = (rec ?? []).filter((r: any) => r.vencimento < todayISO).length;
    const vencidos = pagamentosAtraso + coletasAtraso;
    const resultado = entradas - saidas;
    const ultimoLancamento = (lastTx ?? [])[0]?.data ?? null;
    const semLancamento = !ultimoLancamento;
    const diasSemAtualizacao = ultimoLancamento
      ? Math.floor((Date.now() - new Date(ultimoLancamento).getTime()) / 86400000)
      : null;
    const pendenciasAbertas = (pendings ?? []).length;
    const entregasAtrasadas =
      (plans ?? []).filter((p: any) => p.due_date && p.due_date < todayISO).length +
      (pendings ?? []).filter((p: any) => p.due_date && p.due_date < todayISO).length;
    const relatorioPendente = (plans ?? []).some(
      (p: any) => (p.related_area === "relatorio" || /relat[óo]rio/i.test(p.title || "")) && p.status !== "concluido"
    );
    const proxAcao = (plans ?? [])[0];
    const proximaAcao = proxAcao ? { title: proxAcao.title, due_date: proxAcao.due_date } : null;

    let status: CompanyKpi["status"] = "saudavel";
    if (!c.ativo || c.consultancy_status === "inativo") status = "inativo";
    else if (c.consultancy_status === "pausado") status = "pausado";
    else if (saldo < 0 || resultado < 0 || vencidos > 2 || entregasAtrasadas > 0 || (diasSemAtualizacao ?? 0) > 14) status = "critico";
    else if (vencidos > 0 || pendenciasAbertas > 0 || (diasSemAtualizacao ?? 0) > DIAS_SEM_ATUALIZACAO || resultado < entradas * 0.1) status = "atencao";

    return {
      id: c.id, nome: c.nome, responsavel: c.responsavel, cnpj: c.cnpj, consultancy_stage: c.consultancy_stage,
      entradas, saidas, resultado, saldo, vencidos, coletasAtraso, pagamentosAtraso,
      semLancamento, ultimoLancamento, diasSemAtualizacao, status, ativo: c.ativo,
      pendenciasAbertas, entregasAtrasadas, proximaAcao, relatorioPendente,
      createdAt: c.created_at,
    };
  }));
}

const statusColors: Record<CompanyKpi["status"], string> = {
  saudavel: "bg-success/10 text-success border-success/20",
  atencao: "bg-warning/10 text-warning-foreground border-warning/30",
  critico: "bg-destructive/10 text-destructive border-destructive/20",
  pausado: "bg-muted text-muted-foreground border-border",
  inativo: "bg-muted text-muted-foreground border-border",
};
const statusLabel: Record<CompanyKpi["status"], string> = {
  saudavel: "Saudável", atencao: "Atenção", critico: "Crítico", pausado: "Pausado", inativo: "Inativo",
};

function ConsultantPanel() {
  const [seeding, setSeeding] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard-companies-v2"], queryFn: loadCompaniesV2 });

  const { data: consultancy } = useQuery({
    queryKey: ["my-consultancy-header"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("id, consultancy_name, invite_code").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const consultantId = consultancy?.id;
  const todayISO = new Date().toISOString().slice(0, 10);
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndISO = weekEnd.toISOString().slice(0, 10);
  const monthStart = new Date(); monthStart.setDate(1);
  const monthStartISO = monthStart.toISOString().slice(0, 10);

  const { data: activities } = useQuery({
    queryKey: ["consultant-activities", consultantId],
    enabled: !!consultantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultancy_activities")
        .select("id, title, activity_type, activity_date, start_time, due_date, priority, status, company_id")
        .eq("consultant_id", consultantId!)
        .neq("status", "cancelado")
        .order("activity_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: finance } = useQuery({
    queryKey: ["consultancy-finance", consultantId, monthStartISO],
    enabled: !!consultantId,
    queryFn: async () => {
      const [{ data: rec }, { data: pay }, { data: contracts }] = await Promise.all([
        supabase.from("consultancy_receivables").select("amount, due_date, received_date, status").eq("consultant_id", consultantId!),
        supabase.from("consultancy_payables").select("amount, due_date, payment_date, status").eq("consultant_id", consultantId!),
        supabase.from("consultancy_contracts").select("id, status").eq("consultant_id", consultantId!).eq("status", "ativo"),
      ]);
      const recMes = (rec ?? []).filter((r: any) => (r.received_date ?? "").slice(0, 10) >= monthStartISO).reduce((s, r: any) => s + Number(r.amount), 0);
      const payMes = (pay ?? []).filter((p: any) => (p.payment_date ?? "").slice(0, 10) >= monthStartISO).reduce((s, p: any) => s + Number(p.amount), 0);
      const aReceber = (rec ?? []).filter((r: any) => r.status === "em_aberto").reduce((s, r: any) => s + Number(r.amount), 0);
      const vencidasReceber = (rec ?? []).filter((r: any) => r.status === "em_aberto" && r.due_date < todayISO).length;
      return {
        receitaMes: recMes, despesaMes: payMes, resultado: recMes - payMes,
        aReceber, vencidasReceber, contratosAtivos: (contracts ?? []).length,
      };
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

  const copyCode = () => {
    if (!consultancy?.invite_code) return;
    navigator.clipboard.writeText(consultancy.invite_code);
    toast.success("Código copiado!");
  };

  // ===== Métricas =====
  const cias = data ?? [];
  const ativas = cias.filter((c) => c.ativo && c.status !== "inativo" && c.status !== "pausado");
  const emAtencao = cias.filter((c) => c.status === "atencao").length;
  const criticas = cias.filter((c) => c.status === "critico").length;
  const pausadas = cias.filter((c) => c.status === "pausado" || c.status === "inativo").length;
  const semAtualizacao = cias.filter((c) => c.ativo && (c.diasSemAtualizacao ?? 999) > DIAS_SEM_ATUALIZACAO).length;
  const novasNoMes = cias.filter((c) => c.createdAt >= monthStartISO).length;
  const entregasAtrasadas = cias.reduce((s, c) => s + c.entregasAtrasadas, 0);
  const pendenciasClientes = cias.reduce((s, c) => s + c.pendenciasAbertas, 0);
  const relatoriosPendentes = cias.filter((c) => c.relatorioPendente).length;
  const clientesRisco = criticas;

  const reunioesHoje = (activities ?? []).filter(
    (a: any) => a.activity_type === "reuniao" && a.activity_date === todayISO
  );
  const reunioesSemana = (activities ?? []).filter(
    (a: any) => a.activity_type === "reuniao" && a.activity_date >= todayISO && a.activity_date <= weekEndISO
  );

  const entregasSemana = (activities ?? []).filter(
    (a: any) => a.status !== "concluido" && a.due_date && a.due_date >= todayISO && a.due_date <= weekEndISO
  );

  // Próximos itens da agenda (até 8)
  const agendaSemana = [
    ...reunioesSemana.map((r: any) => ({
      id: r.id, kind: "Reunião", title: r.title, date: r.activity_date, time: r.start_time, priority: r.priority, status: r.status, company_id: r.company_id,
    })),
    ...entregasSemana.map((e: any) => ({
      id: e.id, kind: e.activity_type === "entrega" ? "Entrega" : "Atividade", title: e.title, date: e.due_date, time: null, priority: e.priority, status: e.status, company_id: e.company_id,
    })),
  ]
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .slice(0, 8);

  const companyName = (id: string | null | undefined) =>
    cias.find((c) => c.id === id)?.nome ?? "—";

  // ===== Alertas inteligentes =====
  const alerts: { text: string; tone: "warning" | "danger" | "info"; href?: string }[] = [];
  cias.filter((c) => c.ativo && (c.diasSemAtualizacao ?? 999) > DIAS_SEM_ATUALIZACAO).slice(0, 3).forEach((c) => {
    alerts.push({ text: `${c.nome} está há ${c.diasSemAtualizacao ?? "+"} dias sem lançamentos.`, tone: "warning" });
  });
  if (relatoriosPendentes > 0) alerts.push({ text: `Você possui ${relatoriosPendentes} relatório(s) a entregar.`, tone: "info" });
  if (pendenciasClientes > 0) alerts.push({ text: `Há ${pendenciasClientes} pendência(s) de clientes em aberto.`, tone: "warning" });
  if (reunioesHoje.length > 0) alerts.push({ text: `Você tem ${reunioesHoje.length} reunião(ões) agendada(s) para hoje.`, tone: "info" });
  const semProxAcao = cias.filter((c) => c.ativo && !c.proximaAcao).length;
  if (semProxAcao > 0) alerts.push({ text: `Nenhuma próxima ação definida para ${semProxAcao} empresa(s).`, tone: "warning" });

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-display font-bold">Painel do Consultor</h1>
          <p className="text-muted-foreground text-sm">Acompanhe seus clientes, entregas, riscos e resultados da consultoria.</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {consultancy?.consultancy_name && (
              <span className="text-xs text-muted-foreground">{consultancy.consultancy_name}</span>
            )}
            {consultancy?.invite_code && (
              <button
                onClick={copyCode}
                title="Copiar código de convite"
                className="text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-md font-mono hover:bg-primary/20 transition-colors"
              >
                Código: {consultancy.invite_code}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {data && data.length === 0 && (
            <Button onClick={handleSeed} variant="outline" disabled={seeding}>
              <Sparkles className="size-4" /> {seeding ? "Carregando..." : "Dados de demonstração"}
            </Button>
          )}
          <Button asChild variant="outline"><Link to="/app/agenda"><Calendar className="size-4" /> Ver agenda</Link></Button>
          <Button asChild variant="outline"><Link to="/app/relatorios"><FileText className="size-4" /> Relatórios</Link></Button>
          <Button asChild variant="outline"><Link to="/app/agenda"><PlusCircle className="size-4" /> Nova atividade</Link></Button>
          <Button asChild><Link to="/app/clientes"><PlusCircle className="size-4" /> Nova empresa</Link></Button>
        </div>
      </div>

      {/* Seção 1: O que exige sua atenção hoje */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-display font-semibold">O que exige sua atenção hoje</h2>
          <span className="text-xs text-muted-foreground">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard icon={AlertTriangle} tone="danger" label="Clientes em risco" value={clientesRisco} desc="Empresas críticas exigindo intervenção" to="/app/clientes" />
          <ActionCard icon={Clock} tone="danger" label="Entregas atrasadas" value={entregasAtrasadas} desc="Planos e pendências vencidos" to="/app/agenda" />
          <ActionCard icon={Calendar} tone="info" label="Reuniões de hoje" value={reunioesHoje.length} desc="Agendadas para hoje" to="/app/agenda" />
          <ActionCard icon={AlertCircle} tone="warning" label="Pendências de clientes" value={pendenciasClientes} desc="Solicitações abertas" to="/app/agenda" />
          <ActionCard icon={FileText} tone="warning" label="Relatórios a entregar" value={relatoriosPendentes} desc="Empresas com relatório pendente" to="/app/relatorios" />
          <ActionCard icon={Clock} tone="warning" label="Sem atualização recente" value={semAtualizacao} desc={`Empresas há mais de ${DIAS_SEM_ATUALIZACAO} dias sem lançamento`} to="/app/clientes" />
        </div>
      </section>

      {/* Seção 2: Carteira de clientes */}
      <section className="space-y-3">
        <h2 className="text-lg font-display font-semibold">Carteira de clientes</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MiniKpi icon={Building2} label="Ativas" value={ativas.length} />
          <MiniKpi icon={AlertCircle} label="Em atenção" value={emAtencao} tone="warning" />
          <MiniKpi icon={AlertTriangle} label="Críticas" value={criticas} tone="danger" />
          <MiniKpi icon={Building2} label="Pausadas/Inativas" value={pausadas} />
          <MiniKpi icon={Sparkles} label="Novas no mês" value={novasNoMes} />
          <MiniKpi icon={Clock} label="Sem atualização 7d+" value={semAtualizacao} tone={semAtualizacao > 0 ? "warning" : undefined} />
        </div>
      </section>

      {/* Seção 3: Agenda e entregas da semana */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-display font-semibold">Agenda e entregas da semana</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/app/agenda">Ver agenda completa <ArrowRight className="size-3.5" /></Link></Button>
        </div>
        <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
          {agendaSemana.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Nenhum compromisso ou entrega para os próximos 7 dias.</div>
          ) : (
            <ul className="divide-y">
              {agendaSemana.map((it) => (
                <li key={`${it.kind}-${it.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md ${it.kind === "Reunião" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning-foreground"}`}>{it.kind}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{it.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{companyName(it.company_id)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {it.date ? formatDate(it.date) : "—"}{it.time ? ` ${String(it.time).slice(0, 5)}` : ""}
                  </div>
                  {it.priority && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${it.priority === "alta" ? "bg-destructive/10 text-destructive" : it.priority === "media" ? "bg-warning/10 text-warning-foreground" : "bg-muted text-muted-foreground"}`}>
                      {it.priority}
                    </span>
                  )}
                  <Button asChild size="sm" variant="ghost"><Link to="/app/agenda">Ver</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Seção 4: Empresas acompanhadas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-display font-semibold">Empresas acompanhadas</h2>
          <span className="text-xs text-muted-foreground">{cias.length} no total</span>
        </div>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando empresas...</div>
        ) : cias.length === 0 ? (
          <div className="bg-card border rounded-2xl p-10 text-center shadow-card">
            <Building2 className="size-12 mx-auto text-muted-foreground/40" />
            <h3 className="font-display font-semibold mt-4">Nenhuma empresa cadastrada ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Cadastre sua primeira empresa cliente ou carregue dados de demonstração para explorar o sistema.
            </p>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Empresa</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Fase</th>
                    <th className="text-left px-4 py-2">Último lanç.</th>
                    <th className="text-left px-4 py-2">Próxima ação</th>
                    <th className="text-right px-4 py-2">Pend.</th>
                    <th className="text-right px-4 py-2">Atrasos</th>
                    <th className="text-right px-4 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cias.map((c) => (
                    <tr key={c.id} className={`border-t hover:bg-muted/20 ${!c.ativo ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2">
                        <Link
                          to="/app/empresa/$id" params={{ id: c.id }}
                          onClick={() => localStorage.setItem("sfp:selected_company", c.id)}
                          className="font-medium hover:text-primary"
                        >
                          {c.nome}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {c.cnpj && <span>{c.cnpj} · </span>}
                          {c.responsavel ?? "Sem responsável"}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-[11px] font-medium px-2 py-1 rounded-full border ${statusColors[c.status]}`}>
                          {statusLabel[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground capitalize">{c.consultancy_stage?.replace(/_/g, " ") ?? "—"}</td>
                      <td className="px-4 py-2 text-xs">
                        {c.ultimoLancamento ? (
                          <>
                            {formatDate(c.ultimoLancamento)}
                            {(c.diasSemAtualizacao ?? 0) > DIAS_SEM_ATUALIZACAO && (
                              <div className="text-[10px] text-warning-foreground">Sem atualização recente</div>
                            )}
                          </>
                        ) : (
                          <span className="text-warning-foreground">Sem lançamento</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {c.proximaAcao ? (
                          <>
                            <div className="truncate max-w-[160px]">{c.proximaAcao.title}</div>
                            {c.proximaAcao.due_date && <div className="text-[10px] text-muted-foreground">{formatDate(c.proximaAcao.due_date)}</div>}
                          </>
                        ) : (
                          <span className="text-warning-foreground">Sem próxima ação</span>
                        )}
                        {c.relatorioPendente && <div className="text-[10px] text-destructive mt-0.5">Relatório pendente</div>}
                      </td>
                      <td className="px-4 py-2 text-right">{c.pendenciasAbertas > 0 ? <span className="font-medium">{c.pendenciasAbertas}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2 text-right">{c.entregasAtrasadas > 0 ? <span className="text-destructive font-medium">{c.entregasAtrasadas}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild size="sm" variant="ghost"><Link to="/app/empresa/$id" params={{ id: c.id }}>Resumo</Link></Button>
                          <Button asChild size="sm" variant="ghost"><Link to="/app/relatorios">Relatórios</Link></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Seção 5: Minha Consultoria */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-lg font-display font-semibold">Minha Consultoria</h2>
          <Button asChild variant="ghost" size="sm"><Link to="/app/consultoria">Ver Minha Consultoria <ArrowRight className="size-3.5" /></Link></Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MiniKpi icon={TrendingUp} label="Receita do mês" value={formatMoney(finance?.receitaMes ?? 0)} tone="success" />
          <MiniKpi icon={TrendingDown} label="Despesas do mês" value={formatMoney(finance?.despesaMes ?? 0)} />
          <MiniKpi icon={DollarSign} label="Resultado líquido" value={formatMoney(finance?.resultado ?? 0)} tone={(finance?.resultado ?? 0) < 0 ? "danger" : "success"} />
          <MiniKpi icon={ArrowDownCircle} label="A receber" value={formatMoney(finance?.aReceber ?? 0)} />
          <MiniKpi icon={AlertCircle} label="Vencidas" value={finance?.vencidasReceber ?? 0} tone={(finance?.vencidasReceber ?? 0) > 0 ? "danger" : undefined} />
          <MiniKpi icon={FileText} label="Contratos ativos" value={finance?.contratosAtivos ?? 0} />
        </div>
      </section>

      {/* Seção 6: Alertas inteligentes */}
      {alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-display font-semibold">Alertas inteligentes</h2>
          <div className="space-y-2">
            {alerts.map((a, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${a.tone === "danger" ? "bg-destructive/5 border-destructive/20" : a.tone === "warning" ? "bg-warning/5 border-warning/20" : "bg-primary/5 border-primary/20"}`}>
                <AlertCircle className={`size-4 mt-0.5 ${a.tone === "danger" ? "text-destructive" : a.tone === "warning" ? "text-warning-foreground" : "text-primary"}`} />
                <div className="flex-1 text-sm">{a.text}</div>
                <Button asChild size="sm" variant="ghost"><Link to="/app/clientes">Ver</Link></Button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActionCard({ icon: Icon, label, value, desc, tone, to }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; desc: string; tone: "danger" | "warning" | "info" | "success"; to: string }) {
  const toneClasses =
    tone === "danger" ? "border-destructive/30 hover:border-destructive/50" :
    tone === "warning" ? "border-warning/30 hover:border-warning/50" :
    tone === "success" ? "border-success/30 hover:border-success/50" :
    "border-primary/30 hover:border-primary/50";
  const iconColor =
    tone === "danger" ? "text-destructive" :
    tone === "warning" ? "text-warning-foreground" :
    tone === "success" ? "text-success" :
    "text-primary";
  const num = typeof value === "number" ? value : parseInt(String(value));
  const showTone = !Number.isNaN(num) && num > 0;
  return (
    <Link to={to} className={`group bg-card border-2 ${showTone ? toneClasses : "border-border"} rounded-2xl p-5 shadow-card transition-colors block`}>
      <div className="flex items-start justify-between">
        <Icon className={`size-5 ${showTone ? iconColor : "text-muted-foreground"}`} />
        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className={`font-display font-bold text-3xl mt-3 ${showTone ? iconColor : ""}`}>{value}</div>
      <div className="text-sm font-medium mt-1">{label}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </Link>
  );
}

function MiniKpi({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; tone?: "success" | "warning" | "danger" }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "";
  return (
    <div className="bg-card border rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
      <div className={`font-display font-semibold text-xl mt-2 ${c}`}>{value}</div>
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


