import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney, monthRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, TrendingDown, AlertCircle, PlusCircle, Sparkles, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

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

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" | "danger" }) {
  const c = tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "";
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display font-bold text-2xl mt-2 ${c}`}>{value}</div>
    </div>
  );
}

/* =============== CLIENT =============== */

function ClientDashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["client-dashboard", user?.id],
    queryFn: async () => {
      const { data: cos } = await supabase.from("companies").select("id, nome").eq("ativo", true).order("nome").limit(1);
      const company = cos?.[0];
      if (!company) return null;
      localStorage.setItem("sfp:selected_company", company.id);
      const range = monthRange();
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: tx }, { data: allTx }, { data: pay }, { data: rec }, { data: accs }, { data: prods }] = await Promise.all([
        supabase.from("transactions").select("tipo, valor").eq("company_id", company.id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
        supabase.from("transactions").select("tipo, valor").eq("company_id", company.id).eq("status", "realizado"),
        supabase.from("payables").select("valor, vencimento, status").eq("company_id", company.id).neq("status", "pago"),
        supabase.from("receivables").select("valor, vencimento, status").eq("company_id", company.id).neq("status", "recebido"),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", company.id),
        supabase.from("products").select("quantidade, estoque_minimo").eq("company_id", company.id),
      ]);
      const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
      const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
      const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
      const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
      const saldo = saldoInicial + delta;
      const aPagarAbertas = (pay ?? []).reduce((s, p) => s + Number(p.valor), 0);
      const aReceberAbertas = (rec ?? []).reduce((s, r) => s + Number(r.valor), 0);
      const pagarVencidas = (pay ?? []).filter((p) => p.vencimento < today).reduce((s, p) => s + Number(p.valor), 0);
      const receberVencidas = (rec ?? []).filter((r) => r.vencimento < today).reduce((s, r) => s + Number(r.valor), 0);
      const estoqueAlerta = (prods ?? []).filter((p) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;
      return { company, entradas, saidas, saldo, resultado: entradas - saidas, aPagarAbertas, aReceberAbertas, pagarVencidas, receberVencidas, estoqueAlerta };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando seu dashboard...</div>;
  if (!data) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center shadow-card max-w-xl mx-auto">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h3 className="font-display font-semibold mt-4">Empresa não encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Sua empresa ainda não foi criada. Faça logout e cadastre-se novamente informando o nome da empresa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">{data.company.nome}</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumo financeiro da sua empresa.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Saldo atual" value={formatMoney(data.saldo)} tone={data.saldo < 0 ? "danger" : "success"} />
        <Kpi label="Entradas do mês" value={formatMoney(data.entradas)} tone="success" />
        <Kpi label="Saídas do mês" value={formatMoney(data.saidas)} tone="danger" />
        <Kpi label="Resultado do mês" value={formatMoney(data.resultado)} tone={data.resultado < 0 ? "danger" : "success"} />
        <Kpi label="Contas a pagar em aberto" value={formatMoney(data.aPagarAbertas)} />
        <Kpi label="Contas a receber em aberto" value={formatMoney(data.aReceberAbertas)} />
        <Kpi label="Contas vencidas" value={formatMoney(data.pagarVencidas)} tone={data.pagarVencidas > 0 ? "danger" : undefined} />
        <Kpi label="Recebimentos vencidos" value={formatMoney(data.receberVencidas)} tone={data.receberVencidas > 0 ? "warning" : undefined} />
      </div>

      {data.estoqueAlerta > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 text-sm flex items-center gap-2">
          <AlertCircle className="size-4 text-warning-foreground" />
          {data.estoqueAlerta} produto(s) em alerta de estoque mínimo.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/app/fluxo-caixa">Lançar movimentação</Link></Button>
        <Button asChild variant="outline"><Link to="/app/contas-pagar">Contas a pagar</Link></Button>
        <Button asChild variant="outline"><Link to="/app/contas-receber">Contas a receber</Link></Button>
        <Button asChild variant="outline"><Link to="/app/relatorios">Relatórios</Link></Button>
      </div>
    </div>
  );
}
