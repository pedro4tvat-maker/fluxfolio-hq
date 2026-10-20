import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { formatDate, formatMoney, monthRange } from "@/lib/format";
import { CompanySwitcher } from "@/components/company-switcher";
import { BranchSwitcher } from "@/components/branch-switcher";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, TrendingUp, TrendingDown, AlertCircle, PlusCircle, Sparkles, ArrowRight, ShoppingCart, Percent, Box, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Clock, Calendar, DollarSign, FileText, BadgeCheck, Bell, Check, X, Plus, Minus, FileBarChart, Upload, CalendarClock, Wallet } from "lucide-react";

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

async function loadCompaniesV2(isConsultant: boolean, userId: string): Promise<CompanyKpi[]> {
  const query = supabase
    .from("companies")
    .select("id, nome, responsavel, ativo, cnpj, consultancy_stage, consultancy_status, created_at, consultant_id")
    .order("nome");
    
  if (!isConsultant) {
    query.eq("owner_id", userId);
  } else {
    // If consultant, show companies linked to them or where they are the owner
    // First, we need to find the consultant record
    const { data: consultant } = await supabase.from("consultants").select("id").eq("user_id", userId).maybeSingle();
    if (consultant) {
      query.or(`consultant_id.eq.${consultant.id},owner_id.eq.${userId}`);
    } else {
      query.eq("owner_id", userId);
    }
  }
  
  const { data: companies, error } = await query;
  if (error) throw error;
  const range = monthRange();
  const todayISO = new Date().toISOString().slice(0, 10);

  return Promise.all((companies ?? []).map(async (c: any) => {
    const [
      { data: tx }, { data: pay }, { data: rec }, { data: accs },
      { data: lastTx },
      { data: pendings }, { data: plans },
    ] = await Promise.all([
      supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).is("deleted_at", null).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
      supabase.from("payables").select("valor, vencimento, status").eq("company_id", c.id).is("deleted_at", null).neq("status", "pago"),
      supabase.from("receivables").select("valor, vencimento, status").eq("company_id", c.id).is("deleted_at", null).neq("status", "recebido"),
      supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", c.id),
      supabase.from("transactions").select("data").eq("company_id", c.id).is("deleted_at", null).order("data", { ascending: false }).limit(1),
      supabase.from("client_pending_items").select("id, status, due_date").eq("company_id", c.id).neq("status", "concluido"),
      supabase.from("action_plans").select("id, title, due_date, status, related_area").eq("company_id", c.id).is("deleted_at", null).neq("status", "concluido").order("due_date", { ascending: true, nullsFirst: false }),
    ]);

    const entradas = (tx ?? []).filter((t: any) => t.tipo === "entrada").reduce((s, t: any) => s + Number(t.valor), 0);
    const saidas = (tx ?? []).filter((t: any) => t.tipo === "saida").reduce((s, t: any) => s + Number(t.valor), 0);
    const saldoInicial = (accs ?? []).reduce((s, a: any) => s + Number(a.saldo_inicial), 0);
    
    // Simplificando o cálculo do delta para evitar buscar todo o histórico
    const { data: totalIn } = await supabase.from("transactions").select("valor.sum()").eq("company_id", c.id).is("deleted_at", null).eq("status", "realizado").eq("tipo", "entrada").maybeSingle();
    const { data: totalOut } = await supabase.from("transactions").select("valor.sum()").eq("company_id", c.id).is("deleted_at", null).eq("status", "realizado").eq("tipo", "saida").maybeSingle();
    
    const delta = (Number((totalIn as any)?.sum) || 0) - (Number((totalOut as any)?.sum) || 0);
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
  const { user, isConsultant } = useAuth();
  const { data, isLoading, refetch } = useQuery({ 
    queryKey: ["dashboard-companies-v2", isConsultant, user?.id], 
    queryFn: () => loadCompaniesV2(isConsultant, user?.id!),
    enabled: !!user?.id
  });

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
        .is("deleted_at", null).order("activity_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: finance } = useQuery({
    queryKey: ["consultancy-finance", consultantId, monthStartISO],
    enabled: !!consultantId,
    queryFn: async () => {
      const [{ data: rec }, { data: pay }, { data: contracts }] = await Promise.all([
        supabase.from("consultancy_receivables").select("amount, due_date, received_date, status").eq("consultant_id", consultantId!).is("deleted_at", null),
        supabase.from("consultancy_payables").select("amount, due_date, payment_date, status").eq("consultant_id", consultantId!).is("deleted_at", null),
        supabase.from("consultancy_contracts").select("id, status").eq("consultant_id", consultantId!).is("deleted_at", null).eq("status", "ativo"),
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
  const semDiagnostico = cias.filter(c => c.ativo && c.consultancy_stage === 'diagnostico_inicial').length;
  if (semDiagnostico > 0) alerts.push({ text: `${semDiagnostico} empresa(s) aguardando diagnóstico inicial.`, tone: "info", href: "/app/diagnostico" });

  return (
    <div className="space-y-6 max-w-7xl animate-in fade-in duration-500 pb-12">
      {/* Header Simplificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground">Painel do Consultor</h1>
          <p className="text-muted-foreground text-sm mt-1">Bem-vindo de volta. Aqui está o resumo da sua consultoria hoje.</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {consultancy?.consultancy_name && (
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">{consultancy.consultancy_name}</span>
            )}
            {consultancy?.invite_code && (
              <button
                onClick={copyCode}
                title="Copiar código de convite"
                className="text-[11px] bg-muted text-muted-foreground px-2 py-1 rounded-md font-mono hover:bg-muted/80 transition-colors border"
              >
                Código: {consultancy.invite_code}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <LinkRequestsBell />
          <div className="flex bg-muted/50 p-1 rounded-lg border">
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-medium"><Link to="/app/agenda">Agenda</Link></Button>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-medium"><Link to="/app/relatorios">Relatórios</Link></Button>
            <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-medium"><Link to="/app/diagnostico">Diagnóstico</Link></Button>
          </div>
          <Button asChild size="sm" className="h-10 px-4 shadow-sm"><Link to="/app/clientes"><PlusCircle className="size-4 mr-2" /> Nova empresa</Link></Button>
        </div>

      </div>

      {/* Seção 1: Resumo Executivo */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard 
          label="Empresas Ativas" 
          value={ativas.length} 
          icon={Building2} 
          trend={novasNoMes > 0 ? `+${novasNoMes} este mês` : undefined}
          to="/app/clientes"
        />
        <MetricCard 
          label="Receita Mensal" 
          value={formatMoney(finance?.receitaMes ?? 0)} 
          icon={DollarSign} 
          trend={finance?.resultado && finance.resultado > 0 ? "Em crescimento" : undefined}
          to="/app/consultoria"
        />
        <MetricCard 
          label="Alertas Críticos" 
          value={criticas} 
          icon={AlertTriangle} 
          variant={criticas > 0 ? "destructive" : "default"}
          to="/app/clientes"
        />
        <MetricCard 
          label="Relatórios Pendentes" 
          value={relatoriosPendentes} 
          icon={FileText} 
          variant={relatoriosPendentes > 0 ? "warning" : "default"}
          to="/app/relatorios"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prioridades e Agenda */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/30">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Calendar className="size-4 text-primary" /> Prioridades e Agenda</h2>
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs"><Link to="/app/agenda">Ver agenda completa</Link></Button>
            </div>
            <div className="p-0">
              {agendaSemana.length === 0 && alerts.length === 0 ? (
                <div className="p-10 text-center">
                  <BadgeCheck className="size-10 mx-auto text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground mt-2">Tudo em dia por aqui.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {/* Alertas Críticos Primeiro */}
                  {alerts.slice(0, 3).map((a, i) => (
                    <div key={`alert-${i}`} className="flex items-start gap-4 p-4 hover:bg-muted/30 transition-colors group">
                      <div className={`mt-1 p-2 rounded-lg ${a.tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning-foreground"}`}>
                        <AlertCircle className="size-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{a.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">Ação recomendada</p>
                      </div>
                      <Button asChild variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity"><Link to={a.href || "/app/clientes"}>Tratar</Link></Button>
                    </div>
                  ))}
                  
                  {/* Próximos compromissos */}
                  {agendaSemana.map((it) => (
                    <div key={`${it.kind}-${it.id}`} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                      <div className={`w-2 h-2 rounded-full ${it.kind === "Reunião" ? "bg-primary" : "bg-warning"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{it.kind}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs font-medium text-foreground">{it.date ? formatDate(it.date) : ""}</span>
                        </div>
                        <div className="text-sm font-semibold truncate mt-0.5">{it.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{companyName(it.company_id)}</div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-medium">{it.time ? String(it.time).slice(0, 5) : "--:--"}</div>
                        {it.priority && (
                          <span className={`text-[10px] font-bold uppercase ${it.priority === "alta" ? "text-destructive" : "text-muted-foreground"}`}>
                            {it.priority}
                          </span>
                        )}
                      </div>
                      <Button asChild variant="outline" size="sm" className="h-8"><Link to="/app/agenda">Ver</Link></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Lista de Empresas */}
          <section className="bg-card border rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/30">
              <h2 className="text-sm font-semibold flex items-center gap-2"><Building2 className="size-4 text-primary" /> Empresas Acompanhadas</h2>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{cias.length} TOTAL</span>
            </div>
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-8 text-center text-sm text-muted-foreground italic">Carregando dados das empresas...</div>
              ) : cias.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 className="size-12 mx-auto text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground mt-4">Nenhuma empresa vinculada à sua consultoria.</p>
                  <Button asChild variant="outline" size="sm" className="mt-4"><Link to="/app/clientes">Cadastrar Primeira Empresa</Link></Button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/10">
                      <th className="text-left px-5 py-3 border-b">Empresa</th>
                      <th className="text-left px-5 py-3 border-b">Status</th>
                      <th className="text-left px-5 py-3 border-b hidden md:table-cell">Último Lanç.</th>
                      <th className="text-right px-5 py-3 border-b">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {cias.slice(0, 10).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-5 py-3">
                          <Link
                            to="/app/empresa/$id" params={{ id: c.id }}
                            onClick={() => localStorage.setItem("sfp:selected_company", c.id)}
                            className="font-semibold text-foreground hover:text-primary transition-colors block"
                          >
                            {c.nome}
                          </Link>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 capitalize">
                            {c.consultancy_stage?.replace(/_/g, " ")}
                            {c.responsavel && <><span>•</span> {c.responsavel}</>}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`size-2 rounded-full ${
                              c.status === "saudavel" ? "bg-success" : 
                              c.status === "critico" ? "bg-destructive animate-pulse" : 
                              c.status === "atencao" ? "bg-warning" : "bg-muted"
                            }`} />
                            <span className="text-xs font-medium">{statusLabel[c.status]}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 hidden md:table-cell">
                          <div className="text-xs">
                            {c.ultimoLancamento ? formatDate(c.ultimoLancamento) : <span className="text-muted-foreground">Nunca</span>}
                            {(c.diasSemAtualizacao ?? 0) > DIAS_SEM_ATUALIZACAO && (
                              <div className="text-[10px] text-destructive font-bold uppercase mt-0.5">Atrasado</div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Link to="/app/empresa/$id" params={{ id: c.id }}><ArrowRight className="size-4" /></Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {cias.length > 10 && (
              <div className="p-3 text-center border-t bg-muted/10">
                <Button asChild variant="link" size="sm" className="text-xs"><Link to="/app/clientes">Ver todas as empresas ({cias.length})</Link></Button>
              </div>
            )}
          </section>
        </div>

        {/* Lateral: Saúde da Consultoria e Atalhos */}
        <div className="space-y-6">
          <section className="bg-card border rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Saúde Financeira</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs text-muted-foreground">Faturamento Mensal</span>
                <span className="text-sm font-bold text-success">{formatMoney(finance?.receitaMes ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs text-muted-foreground">A Receber Total</span>
                <span className="text-sm font-bold text-foreground">{formatMoney(finance?.aReceber ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-3">
                <span className="text-xs text-muted-foreground">Contratos Ativos</span>
                <span className="text-sm font-bold text-foreground">{finance?.contratosAtivos ?? 0}</span>
              </div>
              {(finance?.vencidasReceber ?? 0) > 0 && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-destructive font-semibold">Mensalidades em Atraso</span>
                  <span className="bg-destructive/10 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">{finance?.vencidasReceber}</span>
                </div>
              )}
            </div>
            <Button asChild variant="outline" className="w-full mt-6 text-xs h-9 bg-muted/50"><Link to="/app/consultoria">Gerenciar Consultoria</Link></Button>
          </section>

          <section className="bg-primary/5 border border-primary/20 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-primary"><Sparkles className="size-4" /> Atalhos Rápidos</h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickLink to="/app/agenda" icon={PlusCircle} label="Atividade" />
              <QuickLink to="/app/clientes" icon={PlusCircle} label="Cliente" />
              <QuickLink to="/app/relatorios" icon={FileText} label="Relatórios" />
              <QuickLink to="/app/diagnostico" icon={BadgeCheck} label="Diagnóstico" />
            </div>
          </section>
          
          {data && data.length === 0 && (
            <div className="bg-muted/30 border border-dashed rounded-xl p-5 text-center">
              <p className="text-xs text-muted-foreground mb-3">Sua conta está vazia. Comece carregando dados de teste.</p>
              <Button onClick={handleSeed} variant="outline" size="sm" className="w-full h-8" disabled={seeding}>
                {seeding ? "Carregando..." : "Popular com Demonstração"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, trend, variant = "default", to }: { label: string; value: string | number; icon: any; trend?: string; variant?: "default" | "destructive" | "warning"; to: string }) {
  return (
    <Link to={to} className="bg-card border rounded-xl p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${
          variant === "destructive" ? "bg-destructive/10 text-destructive" : 
          variant === "warning" ? "bg-warning/10 text-warning-foreground" : 
          "bg-primary/10 text-primary"
        }`}>
          <Icon className="size-5" />
        </div>
        <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
      </div>
      <div className="space-y-1">
        <div className={`text-2xl font-bold tracking-tight ${
          variant === "destructive" && Number(value) > 0 ? "text-destructive" : 
          variant === "warning" && Number(value) > 0 ? "text-warning-foreground" : "text-foreground"
        }`}>
          {value}
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        {trend && <div className="text-[10px] text-success font-semibold mt-1">{trend}</div>}
      </div>
    </Link>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center justify-center p-3 bg-card border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all text-center">
      <Icon className="size-4 text-primary mb-1.5" />
      <span className="text-[10px] font-bold uppercase text-foreground leading-none">{label}</span>
    </Link>
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
        withBranch(supabase.from("transactions").select("tipo, valor").eq("company_id", selected).is("deleted_at", null).eq("status", "realizado").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor").eq("company_id", selected).is("deleted_at", null).eq("status", "realizado").gte("data", prevRange.start).lte("data", prevRange.end), branchId),
        withBranch(supabase.from("transactions").select("tipo, valor, data").eq("company_id", selected).is("deleted_at", null).eq("status", "realizado"), branchId),
        withBranch(supabase.from("payables").select("id, descricao, valor, vencimento, status").eq("company_id", selected).is("deleted_at", null).neq("status", "pago").order("vencimento", { ascending: true }), branchId),
        withBranch(supabase.from("receivables").select("id, descricao, valor, vencimento, status, cliente").eq("company_id", selected).is("deleted_at", null).neq("status", "recebido").order("vencimento", { ascending: true }), branchId),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", selected),
        withBranch(supabase.from("products").select("id, quantidade, estoque_minimo").eq("company_id", selected).is("deleted_at", null), branchId),
        withBranch(supabase.from("transactions").select("id, valor").eq("company_id", selected).is("deleted_at", null).eq("tipo", "entrada").ilike("descricao", "Venda%").gte("data", range.start).lte("data", range.end), branchId),
        withBranch(supabase.from("receivables").select("id, valor").eq("company_id", selected).is("deleted_at", null).ilike("descricao", "Venda%").gte("created_at", range.start).lte("created_at", range.end + "T23:59:59"), branchId),
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

      // Últimos 6 meses (entradas x saídas) para o gráfico
      const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      const serie6m = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
        return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, rotulo: MESES_CURTOS[d.getMonth()], Entradas: 0, Saídas: 0 };
      });
      for (const t of (allTx ?? []) as Array<{ tipo: string; valor: number; data: string | null }>) {
        const m = serie6m.find((x) => x.chave === (t.data ?? "").slice(0, 7));
        if (!m) continue;
        if (t.tipo === "entrada") m.Entradas += Number(t.valor);
        else m.Saídas += Number(t.valor);
      }

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
        serie6m,
      };
    },
  });

  const waitingForSelection = companies.length > 0 && !selected;
  if (companyLoading || waitingForSelection || (selected && isLoading) || (selected && !data)) {
    return <div className="text-muted-foreground p-10 text-center">Carregando seu dashboard...</div>;
  }
  if (!companies.length) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center shadow-card max-w-xl mx-auto">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Nenhuma empresa encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Você ainda não possui uma empresa vinculada.
        </p>
      </div>
    );
  }
  if (!company || !data) {
    return <div className="text-muted-foreground p-10 text-center">Carregando seu dashboard...</div>;
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

  const proximos = [
    ...data.upcomingRec.map((r: any) => ({ id: `r-${r.id}`, tipo: "receber" as const, desc: r.cliente || r.descricao, venc: r.vencimento as string, valor: Number(r.valor) })),
    ...data.upcomingPay.map((p: any) => ({ id: `p-${p.id}`, tipo: "pagar" as const, desc: p.descricao, venc: p.vencimento as string, valor: Number(p.valor) })),
  ].sort((x, y) => x.venc.localeCompare(y.venc)).slice(0, 6);
  const temSerie = data.serie6m.some((m: { Entradas: number; Saídas: number }) => m.Entradas > 0 || m.Saídas > 0);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Cabeçalho compacto */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{greeting}</p>
          <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Visão geral</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CompanySwitcher />
          {branches.length > 1 && <BranchSwitcher />}
        </div>
      </header>

      {/* Linha 1: resumo + gráfico | lançamento rápido */}
      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr] items-stretch">
        <section className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo disponível</div>
              <div className={`font-display font-bold text-3xl sm:text-4xl mt-1 tabular-nums ${data.saldo < 0 ? "text-destructive" : ""}`}>{formatMoney(data.saldo)}</div>
              <div className="text-xs text-muted-foreground mt-1">{company.nome}{branches.length > 1 ? ` · ${branchLabel}` : ""}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 w-full sm:w-auto">
              {([
                ["Entradas", data.entradas, data.entradasDelta, "text-success", false],
                ["Saídas", data.saidas, data.saidasDelta, "text-destructive", true],
                ["Resultado", data.resultado, null, data.resultado < 0 ? "text-destructive" : "text-success", false],
              ] as const).map(([rotulo, valor, delta, cor, inverso]) => (
                <Link key={rotulo} to="/app/fluxo-caixa" className="rounded-2xl bg-background/70 hover:bg-background px-3 py-2.5 transition-colors min-w-0">
                  <div className={`text-[11px] font-medium ${cor}`}>{rotulo} do mês</div>
                  <div className="font-display font-semibold text-sm sm:text-base tabular-nums truncate">{formatMoney(valor)}</div>
                  {delta != null && (
                    <div className={`text-[10px] ${(delta >= 0) !== inverso ? "text-success" : "text-destructive"}`}>
                      {delta >= 0 ? "+" : ""}{delta.toFixed(0)}% vs mês passado
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-medium">Últimos 6 meses</h2>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#5B8C3E]" />Entradas</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[#C0573F]" />Saídas</span>
              </div>
            </div>
            <div className="h-44">
              {temSerie ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.serie6m} margin={{ left: -8, right: 6, top: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="dEntradas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5B8C3E" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#5B8C3E" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="dSaidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C0573F" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#C0573F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
                    <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil` : String(Math.round(v))} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={52} />
                    <Tooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                      content={({ active, payload, label }) => active && payload?.length ? (
                        <div className="rounded-xl bg-popover/95 backdrop-blur border shadow-lg px-3 py-2 text-xs">
                          <div className="font-semibold mb-1 capitalize">{label}</div>
                          {payload.map((p) => (
                            <div key={String(p.name)} className="flex items-center gap-2">
                              <span className="size-2 rounded-full" style={{ background: p.color }} />
                              <span className="text-muted-foreground">{p.name}</span>
                              <span className="ml-auto font-medium tabular-nums">{formatMoney(Number(p.value))}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    />
                    <Area type="monotone" dataKey="Entradas" stroke="#5B8C3E" strokeWidth={2.5} fill="url(#dEntradas)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    <Area type="monotone" dataKey="Saídas" stroke="#C0573F" strokeWidth={2.5} fill="url(#dSaidas)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-sm text-muted-foreground">O gráfico aparece assim que houver lançamentos.</div>
              )}
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="bg-card rounded-3xl shadow-card p-5">
            <h2 className="font-display font-semibold">Lançar agora</h2>
            <p className="text-xs text-muted-foreground mb-4">Registre em segundos, sem sair procurando.</p>
            <div className="grid grid-cols-2 gap-2.5">
              <Link to="/app/fluxo-caixa" search={{ novo: "entrada" }} className="rounded-2xl bg-success/10 hover:bg-success/15 text-success px-3 py-4 flex flex-col items-center gap-1.5 transition-colors">
                <span className="size-9 rounded-full bg-success text-white grid place-items-center"><Plus className="size-4" /></span>
                <span className="text-sm font-semibold">Entrada</span>
              </Link>
              <Link to="/app/fluxo-caixa" search={{ novo: "saida" }} className="rounded-2xl bg-destructive/10 hover:bg-destructive/15 text-destructive px-3 py-4 flex flex-col items-center gap-1.5 transition-colors">
                <span className="size-9 rounded-full bg-destructive text-white grid place-items-center"><Minus className="size-4" /></span>
                <span className="text-sm font-semibold">Saída</span>
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {([
                ["/app/vendas", "Venda", ShoppingCart],
                ["/app/contas-pagar", "A pagar", ArrowUpCircle],
                ["/app/contas-receber", "A receber", ArrowDownCircle],
              ] as const).map(([to, rotulo, Icone]) => (
                <Link key={to} to={to} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted/70 hover:bg-muted text-xs font-medium transition-colors">
                  <Icone className="size-3.5 text-primary" /> {rotulo}
                </Link>
              ))}
              <Link to="/app/fluxo-caixa" search={{ conciliar: true }} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted/70 hover:bg-muted text-xs font-medium transition-colors">
                <Upload className="size-3.5 text-primary" /> Conciliar extrato
              </Link>
            </div>
          </section>

          <Link to="/app/executivo" className="group relative overflow-hidden rounded-3xl bg-primary text-primary-foreground p-5 shadow-card hover:shadow-lg transition-shadow flex-1 min-h-[140px] flex flex-col justify-between">
            <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10 pointer-events-none" />
            <div className="relative flex items-center gap-2 text-xs font-medium uppercase tracking-wider opacity-90">
              <Sparkles className="size-4" /> Diferencial
            </div>
            <div className="relative">
              <div className="font-display font-bold text-xl leading-tight">Análise gerencial</div>
              <div className="text-sm opacity-90 mt-1">Entenda, em linguagem simples, o que os números da sua empresa estão dizendo.</div>
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold mt-3">
                Ver análise <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        </aside>
      </div>

      {/* Linha 2: próximos 7 dias | pontos de atenção */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
        <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
          <div className="flex items-center justify-between px-3 pt-2 pb-1">
            <h2 className="font-display font-semibold">Próximos 7 dias</h2>
            <span className="text-xs text-muted-foreground">
              <span className="text-success">+{formatMoney(data.recNext7Total)}</span> · <span className="text-destructive">−{formatMoney(data.payNext7Total)}</span>
            </span>
          </div>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nada vencendo nos próximos 7 dias.</p>
          ) : (
            <ul>
              {proximos.map((it) => {
                const receber = it.tipo === "receber";
                return (
                  <li key={it.id}>
                    <Link to={receber ? "/app/contas-receber" : "/app/contas-pagar"} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/60 transition-colors">
                      <span className={`size-9 shrink-0 rounded-full grid place-items-center ${receber ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"}`}>
                        <CalendarClock className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{it.desc || (receber ? "Recebimento" : "Pagamento")}</div>
                        <div className="text-xs text-muted-foreground">{receber ? "A receber" : "A pagar"} · vence {formatDate(it.venc)}</div>
                      </div>
                      <div className={`text-sm font-display font-semibold tabular-nums ${receber ? "text-success" : "text-destructive"}`}>
                        {receber ? "+" : "−"} {formatMoney(it.valor)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
          <div className="px-3 pt-2 pb-1">
            <h2 className="font-display font-semibold">Pontos de atenção</h2>
          </div>
          {visibleAlerts.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-4">
              <span className="size-9 rounded-full bg-success/10 grid place-items-center text-success shrink-0"><BadgeCheck className="size-4" /></span>
              <div>
                <p className="text-sm font-medium">Tudo certo por enquanto.</p>
                <p className="text-xs text-muted-foreground">Nenhum ponto crítico identificado.</p>
              </div>
            </div>
          ) : (
            <ul>
              {visibleAlerts.map((a) => {
                const Icone = a.icon;
                const cor = a.tone === "danger" ? "bg-destructive/10 text-destructive" : a.tone === "warn" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary";
                return (
                  <li key={a.id}>
                    <Link to={a.to} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/60 transition-colors">
                      <span className={`size-9 shrink-0 rounded-full grid place-items-center ${cor}`}><Icone className="size-4" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground">{a.desc}</div>
                      </div>
                      <ArrowRight className="size-4 text-muted-foreground shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {data.vendasCount > 0 && (
            <div className="mx-3 mb-2 mt-1 rounded-2xl bg-muted/50 px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <span className="inline-flex items-center gap-2 text-muted-foreground"><Wallet className="size-4" /> Vendas do mês</span>
              <span className="font-display font-semibold tabular-nums">{formatMoney(data.vendasMes)} <span className="text-xs font-normal text-muted-foreground">· {data.vendasCount} venda(s)</span></span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* =============== LINK REQUESTS BELL =============== */
function LinkRequestsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: pending = [] } = useQuery({
    queryKey: ["link-requests-bell"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_company_links")
        .select("id, created_at, companies(id, nome, nome_fantasia, cnpj, responsavel)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const patch: any = { status, responded_at: new Date().toISOString() };
      if (status === "approved") patch.linked_at = new Date().toISOString();
      const { error } = await supabase.from("consultant_company_links").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "Vínculo aprovado!" : "Solicitação recusada.");
      qc.invalidateQueries({ queryKey: ["link-requests-bell"] });
      qc.invalidateQueries({ queryKey: ["link-requests"] });
      qc.invalidateQueries({ queryKey: ["companies-v2"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const count = pending.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-10 w-10 p-0" title="Solicitações de vínculo">
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center shadow">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b">
          <div className="font-semibold text-sm">Solicitações de vínculo</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {count === 0 ? "Nenhuma pendente" : `${count} aguardando aprovação`}
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {count === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              <BadgeCheck className="size-8 mx-auto mb-2 text-muted-foreground/40" />
              Você está em dia!
            </div>
          ) : (
            pending.map((r: any) => (
              <div key={r.id} className="p-3 border-b last:border-0 hover:bg-muted/30">
                <div className="font-medium text-sm">{r.companies?.nome_fantasia || r.companies?.nome || "Empresa"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.companies?.responsavel ? `${r.companies.responsavel} · ` : ""}
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" className="flex-1 h-8" disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: r.id, status: "rejected" })}>
                    <X className="size-3.5 mr-1" /> Recusar
                  </Button>
                  <Button size="sm" className="flex-1 h-8" disabled={respond.isPending}
                    onClick={() => respond.mutate({ id: r.id, status: "approved" })}>
                    <Check className="size-3.5 mr-1" /> Aprovar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
