import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpCircle, Building2, Search } from "lucide-react";

export const Route = createFileRoute("/app/contas-pagar")({ component: ContasAPagar });

type PayableItem = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
};

function ContasAPagar() {
  const { companies, selected } = useSelectedCompany();
  const [query, setQuery] = useState("");

  const { data = [], isLoading } = useQuery<PayableItem[]>({
    queryKey: ["payables", selected],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return [];
      const { data: payables, error } = await supabase
        .from("payables")
        .select("id, descricao, valor, vencimento, status")
        .eq("company_id", selected)
        .order("vencimento", { ascending: true });
      if (error) throw error;
      return (payables ?? []) as PayableItem[];
    },
  });

  const filtered = useMemo(
    () => data.filter((item) => item.descricao.toLowerCase().includes(query.toLowerCase())),
    [data, query],
  );

  const totalOpen = useMemo(
    () => filtered.reduce((sum, item) => sum + Number(item.valor), 0),
    [filtered],
  );

  const overdue = useMemo(
    () =>
      filtered
        .filter((item) => item.vencimento < new Date().toISOString().slice(0, 10))
        .reduce((sum, item) => sum + Number(item.valor), 0),
    [filtered],
  );

  if (!companies.length) {
    return (
      <div className="max-w-2xl mx-auto bg-card border rounded-2xl p-10 text-center shadow-card">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h2 className="font-display font-semibold mt-4">Nenhuma empresa disponível</h2>
        <p className="text-sm text-muted-foreground mt-1">Selecione uma empresa para gerenciar as contas a pagar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Contas a pagar</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral das obrigações financeiras da empresa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary"><ArrowUpCircle className="size-4" /> Nova conta</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total em aberto</div>
          <div className="font-display font-bold text-2xl mt-2">{formatMoney(totalOpen)}</div>
        </div>
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total vencido</div>
          <div className="font-display font-bold text-2xl mt-2 text-destructive">{formatMoney(overdue)}</div>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-4 shadow-card flex flex-wrap items-center gap-3">
        <Label className="text-xs text-muted-foreground">Buscar</Label>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Descrição da conta..." />
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                    Nenhuma conta a pagar encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{formatDate(item.vencimento)}</TableCell>
                    <TableCell className="font-medium">{item.descricao}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        item.status === "vencido"
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-warning/10 text-warning-foreground border-warning/30"
                      }`}>
                        {item.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-display font-semibold">{formatMoney(Number(item.valor))}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
