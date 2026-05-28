import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney, monthRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  ArrowLeftRight, ArrowDownCircle, ArrowUpCircle, Target, Package, FileBarChart,
  Layers, ShoppingCart, Tag, ArrowLeft, AlertCircle, Building2,
} from "lucide-react";

export const Route = createFileRoute("/app/empresa/$id")({ component: EmpresaResumo });

const modules = [
  { to: "/app/fluxo-caixa", label: "Fluxo de Caixa", icon: ArrowLeftRight },
  { to: "/app/contas-pagar", label: "Contas a Pagar", icon: ArrowUpCircle },
  { to: "/app/contas-receber", label: "Contas a Receber", icon: ArrowDownCircle },
  { to: "/app/orcamento", label: "Orçamento", icon: Target },
  { to: "/app/centro-custos", label: "Centro de Custos", icon: Layers },
  { to: "/app/vendas", label: "Fluxo de Vendas", icon: ShoppingCart },
  { to: "/app/estoque", label: "Controle de Estoque", icon: Package },
  { to: "/app/precificacao", label: "Precificação e Margem", icon: Tag },
  { to: "/app/relatorios", label: "Relatórios", icon: FileBarChart },
] as const;

function EmpresaResumo() {
  const { id } = useParams({ from: "/app/empresa/$id" });
  const { user, isConsultant, loading: authLoading } = useAuth();

  useEffect(() => {
    localStorage.setItem("sfp:selected_company", id);
  }, [id]);

  const { data: hasAccess, isLoading: accessLoading } = useQuery({
    queryKey: ["company-access", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isConsultant) return true;
      const { data, error } = await supabase
        .from("company_members")
        .select("id")
        .eq("company_id", id)
        .eq("user_id", user!.id)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["empresa-resumo", id],
    enabled: !!user && !authLoading && !!hasAccess,
    queryFn: async () => {
      const { data: company } = await supabase.from("companies").select("*").eq("id", id).single();
      if (!company) return null;
      const range = monthRange();
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: tx }, { data: allTx }, { data: pay }, { data: rec }, { data: accs }, { data: prods }] = await Promise.all([
        supabase.from("transactions").select("tipo, valor").eq("company_id", id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
        supabase.from("transactions").select("tipo, valor").eq("company_id", id).eq("status", "realizado"),
        supabase.from("payables").select("valor, vencimento, status").eq("company_id", id).neq("status", "pago"),
        supabase.from("receivables").select("valor, vencimento, status").eq("company_id", id).neq("status", "recebido"),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", id),
        supabase.from("products").select("quantidade, estoque_minimo").eq("company_id", id),
      ]);
      const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
      const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
      const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
      const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
      const saldo = saldoInicial + delta;
      const pagarVencidas = (pay ?? []).filter((p) => p.vencimento < today).reduce((s, p) => s + Number(p.valor), 0);
      const receberVencidas = (rec ?? []).filter((r) => r.vencimento < today).reduce((s, r) => s + Number(r.valor), 0);
      const aPagar = (pay ?? []).reduce((s, p) => s + Number(p.valor), 0);
      const aReceber = (rec ?? []).reduce((s, r) => s + Number(r.valor), 0);
      const estoqueAlerta = (prods ?? []).filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;
      return { company, entradas, saidas, resultado: entradas - saidas, saldo, aPagar, aReceber, pagarVencidas, receberVencidas, estoqueAlerta };
    },
  });

  if (authLoading || accessLoading) return <div className="text-muted-foreground">Verificando acesso...</div>;
  if (!hasAccess) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center shadow-card max-w-xl mx-auto">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Empresa não encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">Você não tem acesso a esta empresa.</p>
        <Button asChild className="mt-4"><Link to="/app">Voltar ao painel</Link></Button>
      </div>
    );
  }

  if (isLoading) return <div className="text-muted-foreground">Carregando empresa...</div>;
  if (!data) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center shadow-card max-w-xl mx-auto">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Empresa não encontrada</h3>
        <Button asChild className="mt-4"><Link to="/app">Voltar ao painel</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link to="/app" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3" /> Painel do consultor
          </Link>
          <h1 className="text-2xl md:text-3xl font-display font-bold mt-1">{data.company.nome}</h1>
          {data.company.responsavel && (
            <p className="text-muted-foreground text-sm">{data.company.responsavel} · {data.company.segmento ?? "—"}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Saldo atual" value={formatMoney(data.saldo)} tone={data.saldo < 0 ? "danger" : "success"} />
        <Kpi label="Entradas do mês" value={formatMoney(data.entradas)} tone="success" />
        <Kpi label="Saídas do mês" value={formatMoney(data.saidas)} tone="danger" />
        <Kpi label="Resultado do mês" value={formatMoney(data.resultado)} tone={data.resultado < 0 ? "danger" : "success"} />
        <Kpi label="A pagar em aberto" value={formatMoney(data.aPagar)} />
        <Kpi label="A receber em aberto" value={formatMoney(data.aReceber)} />
        <Kpi label="Contas vencidas" value={formatMoney(data.pagarVencidas)} tone={data.pagarVencidas > 0 ? "danger" : undefined} />
        <Kpi label="Recebimentos vencidos" value={formatMoney(data.receberVencidas)} tone={data.receberVencidas > 0 ? "warning" : undefined} />
      </div>

      {data.estoqueAlerta > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 text-sm flex items-center gap-2">
          <AlertCircle className="size-4" /> {data.estoqueAlerta} produto(s) em alerta de estoque mínimo.
        </div>
      )}

      <div>
        <h2 className="font-display font-semibold mb-3">Acessar módulos da empresa</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link key={m.to} to={m.to} className="bg-card border rounded-2xl p-4 shadow-card hover:shadow-elevated transition flex items-center gap-3">
              <m.icon className="size-5 text-primary" />
              <span className="font-medium">{m.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "";
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display font-bold text-2xl mt-2 ${c}`}>{value}</div>
    </div>
  );
}
