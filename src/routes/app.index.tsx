import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatMoney, monthRange } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Building2, TrendingUp, TrendingDown, AlertCircle, PlusCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/app/")({
  component: PainelGeral,
});

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
    .from("companies")
    .select("id, nome, responsavel, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  const range = monthRange();

  const results: CompanyKpi[] = await Promise.all(
    (companies ?? []).map(async (c) => {
      const [{ data: tx }, { data: pay }, { data: rec }, { data: accs }] = await Promise.all([
        supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado").gte("data", range.start).lte("data", range.end),
        supabase.from("payables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "pago"),
        supabase.from("receivables").select("valor, vencimento, status").eq("company_id", c.id).neq("status", "recebido"),
        supabase.from("financial_accounts").select("saldo_inicial").eq("company_id", c.id),
      ]);

      const entradas = (tx ?? []).filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
      const saidas = (tx ?? []).filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);

      const saldoInicial = (accs ?? []).reduce((s, a) => s + Number(a.saldo_inicial), 0);
      // saldo total: somar todas as transações realizadas
      const { data: allTx } = await supabase.from("transactions").select("tipo, valor").eq("company_id", c.id).eq("status", "realizado");
      const delta = (allTx ?? []).reduce((s, t) => s + (t.tipo === "entrada" ? 1 : -1) * Number(t.valor), 0);
      const saldo = saldoInicial + delta;

      const today = new Date().toISOString().slice(0, 10);
      const vencidos =
        (pay ?? []).filter((p) => p.vencimento < today).length +
        (rec ?? []).filter((r) => r.vencimento < today).length;

      const resultado = entradas - saidas;
      let status: CompanyKpi["status"] = "saudavel";
      if (saldo < 0 || resultado < 0 || vencidos > 2) status = "critico";
      else if (vencidos > 0 || resultado < entradas * 0.1) status = "atencao";

      return { id: c.id, nome: c.nome, responsavel: c.responsavel, entradas, saidas, resultado, saldo, vencidos, status };
    })
  );
  return results;
}

const statusColors = {
  saudavel: "bg-success/10 text-success border-success/20",
  atencao: "bg-warning/10 text-warning-foreground border-warning/30",
  critico: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabel = { saudavel: "Saudável", atencao: "Atenção", critico: "Crítico" };

function PainelGeral() {
  const { isConsultant } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["dashboard-companies"], queryFn: loadCompanies });

  const handleSeed = async () => {
    setSeeding(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { error } = await supabase.rpc("seed_demo_data", { _owner: userData.user.id });
    setSeeding(false);
    if (error) toast.error("Não foi possível carregar dados de demonstração", { description: error.message });
    else { toast.success("Dados de demonstração criados!"); refetch(); }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Painel do consultor</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral de todas as empresas acompanhadas.</p>
        </div>
        <div className="flex gap-2">
          {isConsultant && data && data.length === 0 && (
            <Button onClick={handleSeed} variant="outline" disabled={seeding}>
              <Sparkles className="size-4" /> {seeding ? "Carregando..." : "Carregar dados de demonstração"}
            </Button>
          )}
          {isConsultant && (
            <Button asChild>
              <Link to="/app/clientes"><PlusCircle className="size-4" /> Nova empresa</Link>
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando empresas...</div>
      ) : !data || data.length === 0 ? (
        <div className="bg-card border rounded-2xl p-10 text-center shadow-card">
          <Building2 className="size-12 mx-auto text-muted-foreground/40" />
          <h3 className="font-display font-semibold mt-4">Nenhuma empresa cadastrada ainda</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            {isConsultant
              ? "Comece cadastrando sua primeira empresa cliente ou carregue dados de demonstração para explorar o sistema."
              : "Aguarde seu consultor liberar acesso à sua empresa."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((c) => (
            <Link key={c.id} to="/app/fluxo-caixa" onClick={() => localStorage.setItem("sfp:selected_company", c.id)} className="bg-card border rounded-2xl p-5 shadow-card hover:shadow-elevated transition-shadow space-y-4 block">
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
                <div className="flex items-center gap-2"><TrendingUp className="size-4 text-success" /> <span className="text-muted-foreground">Entradas:</span> <span className="font-medium ml-auto">{formatMoney(c.entradas)}</span></div>
                <div className="flex items-center gap-2"><TrendingDown className="size-4 text-destructive" /> <span className="text-muted-foreground">Saídas:</span> <span className="font-medium ml-auto">{formatMoney(c.saidas)}</span></div>
              </div>

              {c.vencidos > 0 && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 rounded-lg p-2">
                  <AlertCircle className="size-4" /> {c.vencidos} {c.vencidos === 1 ? "conta vencida" : "contas vencidas"}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
