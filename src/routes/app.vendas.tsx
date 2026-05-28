import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/app/vendas")({
  component: VendasPage,
});

function VendasPage() {
  const { selected, companies } = useSelectedCompany();
  const { data, isLoading } = useQuery({
    queryKey: ["vendas", selected],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return [];
      const { data: rows } = await supabase
        .from("transactions")
        .select("id, descricao, valor, data, status")
        .eq("company_id", selected)
        .eq("tipo", "entrada")
        .order("data", { ascending: false })
        .limit(100);
      return rows ?? [];
    },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">Registros de vendas e entradas relacionadas.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild><Link to="/app/fluxo-caixa">Novo lançamento</Link></Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-4">
        {isLoading ? (
          <div className="text-muted-foreground">Carregando vendas...</div>
        ) : (data.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhuma venda registrada.</div>
        ) : (
          <div className="space-y-2">
            {data.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{row.descricao || "Venda"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(row.data)}</p>
                </div>
                <div className="text-right">
                  <div className="font-display font-semibold text-success">{formatMoney(Number(row.valor))}</div>
                  <div className="text-xs text-muted-foreground">{row.status}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
