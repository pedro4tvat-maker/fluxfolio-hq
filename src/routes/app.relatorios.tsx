import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { downloadCSV, formatDate, formatMoney, monthRange } from "@/lib/format";
import { Download, FileBarChart } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/relatorios")({ component: Relatorios });

type RelTipo =
  | "fluxo_caixa"
  | "contas_pagar"
  | "contas_receber"
  | "orcamento"
  | "centro_custos"
  | "vendas"
  | "estoque"
  | "precificacao"
  | "geral_mensal";

const TIPOS: { value: RelTipo; label: string }[] = [
  { value: "fluxo_caixa", label: "Fluxo de Caixa" },
  { value: "contas_pagar", label: "Contas a Pagar" },
  { value: "contas_receber", label: "Contas a Receber" },
  { value: "orcamento", label: "Orçamento" },
  { value: "centro_custos", label: "Centro de Custos" },
  { value: "vendas", label: "Fluxo de Vendas" },
  { value: "estoque", label: "Controle de Estoque" },
  { value: "precificacao", label: "Precificação e Margem" },
  { value: "geral_mensal", label: "Relatório Geral Mensal" },
];

function Relatorios() {
  const { isConsultant } = useAuth();
  const { companies, selected } = useSelectedCompany();
  const company = useMemo(() => companies.find((c) => c.id === selected), [companies, selected]);
  const range = monthRange();
  const [tipo, setTipo] = useState<RelTipo>("fluxo_caixa");
  const [inicio, setInicio] = useState(range.start);
  const [fim, setFim] = useState(range.end);
  const [status, setStatus] = useState<string>("todos");

  const { data: preview, isFetching, refetch } = useQuery({
    queryKey: ["report-preview", selected, tipo, inicio, fim, status],
    enabled: !!selected,
    queryFn: async () => {
      if (!selected) return { rows: [] as Record<string, unknown>[], total: 0 };

      switch (tipo) {
        case "fluxo_caixa": {
          let q = supabase
            .from("transactions")
            .select("data, tipo, descricao, valor, status, forma_pagamento, categories(nome), cost_centers(nome)")
            .eq("company_id", selected)
            .gte("data", inicio)
            .lte("data", fim)
            .order("data", { ascending: false });
          if (status !== "todos") q = q.eq("status", status as any);
          const { data, error } = await q;
          if (error) throw error;
          const rows = (data ?? []).map((r: any) => ({
            Data: formatDate(r.data),
            Tipo: r.tipo,
            Descrição: r.descricao,
            Categoria: r.categories?.nome ?? "",
            "Centro de custo": r.cost_centers?.nome ?? "",
            "Forma pagamento": r.forma_pagamento ?? "",
            Status: r.status,
            Valor: Number(r.valor).toFixed(2),
          }));
          return { rows, total: rows.length };
        }

        case "contas_pagar": {
          let q = supabase
            .from("payables")
            .select("descricao, fornecedor, valor, vencimento, data_pagamento, status, forma_pagamento, categories(nome)")
            .eq("company_id", selected)
            .gte("vencimento", inicio)
            .lte("vencimento", fim)
            .order("vencimento", { ascending: true });
          if (status !== "todos") q = q.eq("status", status as any);
          const { data, error } = await q;
          if (error) throw error;
          const rows = (data ?? []).map((r: any) => ({
            Descrição: r.descricao,
            Fornecedor: r.fornecedor ?? "",
            Categoria: r.categories?.nome ?? "",
            Vencimento: formatDate(r.vencimento),
            Pagamento: formatDate(r.data_pagamento),
            "Forma pagamento": r.forma_pagamento ?? "",
            Status: r.status,
            Valor: Number(r.valor).toFixed(2),
          }));
          return { rows, total: rows.length };
        }

        case "contas_receber": {
          let q = supabase
            .from("receivables")
            .select("descricao, cliente, valor, vencimento, data_recebimento, status, forma_recebimento, categories(nome)")
            .eq("company_id", selected)
            .gte("vencimento", inicio)
            .lte("vencimento", fim)
            .order("vencimento", { ascending: true });
          if (status !== "todos") q = q.eq("status", status as any);
          const { data, error } = await q;
          if (error) throw error;
          const rows = (data ?? []).map((r: any) => ({
            Descrição: r.descricao,
            Cliente: r.cliente ?? "",
            Categoria: r.categories?.nome ?? "",
            Vencimento: formatDate(r.vencimento),
            Recebimento: formatDate(r.data_recebimento),
            "Forma recebimento": r.forma_recebimento ?? "",
            Status: r.status,
            Valor: Number(r.valor).toFixed(2),
          }));
          return { rows, total: rows.length };
        }

        case "orcamento": {
          const [{ data: budgets, error }, { data: tx }] = await Promise.all([
            supabase.from("budgets").select("mes, ano, valor_orcado, categories(nome, id)").eq("company_id", selected),
            supabase.from("transactions").select("valor, categoria_id, tipo").eq("company_id", selected).eq("status", "realizado").gte("data", inicio).lte("data", fim),
          ]);
          if (error) throw error;
          const realizadoPorCat = new Map<string, number>();
          (tx ?? []).forEach((t: any) => {
            const k = t.categoria_id;
            if (!k) return;
            realizadoPorCat.set(k, (realizadoPorCat.get(k) ?? 0) + Number(t.valor));
          });
          const rows = (budgets ?? []).map((b: any) => {
            const real = realizadoPorCat.get(b.categories?.id) ?? 0;
            const pct = Number(b.valor_orcado) > 0 ? (real / Number(b.valor_orcado)) * 100 : 0;
            return {
              Mês: `${b.mes}/${b.ano}`,
              Categoria: b.categories?.nome ?? "",
              Orçado: Number(b.valor_orcado).toFixed(2),
              Realizado: real.toFixed(2),
              Restante: (Number(b.valor_orcado) - real).toFixed(2),
              "% utilizado": pct.toFixed(1) + "%",
            };
          });
          return { rows, total: rows.length };
        }

        case "centro_custos": {
          const [{ data: ccs, error }, { data: tx }] = await Promise.all([
            supabase.from("cost_centers").select("id, nome").eq("company_id", selected),
            supabase.from("transactions").select("tipo, valor, centro_custo_id").eq("company_id", selected).eq("status", "realizado").gte("data", inicio).lte("data", fim),
          ]);
          if (error) throw error;
          const rows = (ccs ?? []).map((cc: any) => {
            const txs = (tx ?? []).filter((t: any) => t.centro_custo_id === cc.id);
            const entradas = txs.filter((t: any) => t.tipo === "entrada").reduce((s: number, t: any) => s + Number(t.valor), 0);
            const saidas = txs.filter((t: any) => t.tipo === "saida").reduce((s: number, t: any) => s + Number(t.valor), 0);
            return {
              "Centro de custo": cc.nome,
              Entradas: entradas.toFixed(2),
              Saídas: saidas.toFixed(2),
              Resultado: (entradas - saidas).toFixed(2),
              Movimentações: txs.length,
            };
          });
          return { rows, total: rows.length };
        }

        case "vendas": {
          const { data: cats } = await supabase.from("categories").select("id, nome").eq("company_id", selected);
          const salesIds = (cats ?? []).filter((c: any) => typeof c.nome === "string" && c.nome.toLowerCase().includes("venda")).map((c: any) => c.id);
          if (!salesIds.length) return { rows: [], total: 0 };
          const { data, error } = await supabase
            .from("transactions")
            .select("data, descricao, valor, status, forma_pagamento, categories(nome)")
            .eq("company_id", selected)
            .eq("tipo", "entrada")
            .in("categoria_id", salesIds)
            .gte("data", inicio)
            .lte("data", fim)
            .order("data", { ascending: false });
          if (error) throw error;
          const rows = (data ?? []).map((r: any) => ({
            Data: formatDate(r.data),
            Descrição: r.descricao,
            Categoria: r.categories?.nome ?? "",
            "Forma pagamento": r.forma_pagamento ?? "",
            Status: r.status,
            Valor: Number(r.valor).toFixed(2),
          }));
          return { rows, total: rows.length };
        }

        case "estoque": {
          const { data, error } = await supabase
            .from("products")
            .select("nome, categoria, fornecedor, quantidade, custo_unitario, preco_venda, estoque_minimo")
            .eq("company_id", selected)
            .order("nome");
          if (error) throw error;
          const rows = (data ?? []).map((p: any) => {
            const valor = Number(p.quantidade) * Number(p.custo_unitario);
            const margem = Number(p.preco_venda) > 0 ? ((Number(p.preco_venda) - Number(p.custo_unitario)) / Number(p.preco_venda)) * 100 : 0;
            const st = Number(p.quantidade) <= 0 ? "zerado" : Number(p.quantidade) <= Number(p.estoque_minimo) ? "baixo" : "normal";
            return {
              Produto: p.nome,
              Categoria: p.categoria ?? "",
              Fornecedor: p.fornecedor ?? "",
              Quantidade: Number(p.quantidade).toFixed(2),
              "Custo unit.": Number(p.custo_unitario).toFixed(2),
              "Preço venda": Number(p.preco_venda).toFixed(2),
              "Estoque mínimo": Number(p.estoque_minimo).toFixed(2),
              "Valor total": valor.toFixed(2),
              "Margem %": margem.toFixed(1),
              Status: st,
            };
          });
          return { rows, total: rows.length };
        }

        case "precificacao": {
          const { data, error } = await supabase
            .from("products")
            .select("nome, custo_unitario, preco_venda")
            .eq("company_id", selected)
            .order("nome");
          if (error) throw error;
          const rows = (data ?? []).map((p: any) => {
            const custo = Number(p.custo_unitario);
            const preco = Number(p.preco_venda);
            const lucro = preco - custo;
            const margem = preco > 0 ? (lucro / preco) * 100 : 0;
            const precoSugerido40 = custo > 0 ? custo / (1 - 0.4) : 0;
            return {
              Produto: p.nome,
              Custo: custo.toFixed(2),
              "Preço atual": preco.toFixed(2),
              "Lucro R$": lucro.toFixed(2),
              "Margem %": margem.toFixed(1),
              "Preço sugerido (40%)": precoSugerido40.toFixed(2),
            };
          });
          return { rows, total: rows.length };
        }

        case "geral_mensal": {
          const [{ data: tx }, { data: pay }, { data: rec }, { data: prods }] = await Promise.all([
            supabase.from("transactions").select("tipo, valor").eq("company_id", selected).eq("status", "realizado").gte("data", inicio).lte("data", fim),
            supabase.from("payables").select("valor, status").eq("company_id", selected).gte("vencimento", inicio).lte("vencimento", fim),
            supabase.from("receivables").select("valor, status").eq("company_id", selected).gte("vencimento", inicio).lte("vencimento", fim),
            supabase.from("products").select("quantidade, custo_unitario, estoque_minimo").eq("company_id", selected),
          ]);
          const entradas = (tx ?? []).filter((t: any) => t.tipo === "entrada").reduce((s: number, t: any) => s + Number(t.valor), 0);
          const saidas = (tx ?? []).filter((t: any) => t.tipo === "saida").reduce((s: number, t: any) => s + Number(t.valor), 0);
          const aPagar = (pay ?? []).filter((p: any) => p.status !== "pago").reduce((s: number, p: any) => s + Number(p.valor), 0);
          const aReceber = (rec ?? []).filter((r: any) => r.status !== "recebido").reduce((s: number, r: any) => s + Number(r.valor), 0);
          const valorEstoque = (prods ?? []).reduce((s: number, p: any) => s + Number(p.quantidade) * Number(p.custo_unitario), 0);
          const alertaEstoque = (prods ?? []).filter((p: any) => Number(p.quantidade) <= Number(p.estoque_minimo)).length;
          const rows = [
            { Indicador: "Período", Valor: `${formatDate(inicio)} a ${formatDate(fim)}` },
            { Indicador: "Entradas realizadas", Valor: entradas.toFixed(2) },
            { Indicador: "Saídas realizadas", Valor: saidas.toFixed(2) },
            { Indicador: "Resultado", Valor: (entradas - saidas).toFixed(2) },
            { Indicador: "Contas a pagar em aberto", Valor: aPagar.toFixed(2) },
            { Indicador: "Contas a receber em aberto", Valor: aReceber.toFixed(2) },
            { Indicador: "Valor em estoque", Valor: valorEstoque.toFixed(2) },
            { Indicador: "Produtos em alerta", Valor: alertaEstoque },
          ];
          return { rows, total: rows.length };
        }
      }
    },
  });

  const exportCSV = () => {
    if (!preview?.rows.length) {
      toast.error("Nada para exportar — gere o relatório primeiro.");
      return;
    }
    const tipoLabel = TIPOS.find((t) => t.value === tipo)?.label ?? tipo;
    const empresa = company?.nome.replace(/[^a-z0-9]+/gi, "_") ?? "empresa";
    downloadCSV(`${empresa}_${tipoLabel.replace(/\s+/g, "_")}_${inicio}_${fim}.csv`, preview.rows);
    toast.success("Relatório exportado.");
  };

  const exportPDF = () => {
    toast.info("Exportação PDF estará disponível em breve. Use CSV ou imprima a tela.");
  };

  if (isConsultant) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Relatórios consolidados</h1>
          <p className="text-muted-foreground text-sm mt-1">Selecione uma empresa no painel para acessar seus relatórios.</p>
        </div>
        <div className="bg-card border rounded-2xl p-8 text-center text-muted-foreground">
          <FileBarChart className="size-10 mx-auto opacity-40" />
          <p className="mt-3">Acesse uma empresa pelo painel de consultor para gerar relatórios.</p>
        </div>
      </div>
    );
  }

  if (!selected) {
    return <div className="text-muted-foreground">Carregando empresa...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm mt-1">Centro de relatórios da {company?.nome ?? "sua empresa"}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCSV} variant="outline"><Download className="size-4" /> Exportar CSV</Button>
          <Button onClick={exportPDF} variant="ghost">Exportar PDF</Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-5 shadow-card grid gap-4 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto] items-end">
        <Field label="Tipo de relatório">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as RelTipo)} className="w-full rounded-lg border px-3 py-2 text-sm bg-background">
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Data inicial">
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Data final">
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm bg-background">
            <option value="todos">Todos</option>
            <option value="realizado">Realizado</option>
            <option value="pendente">Pendente</option>
            <option value="em_aberto">Em aberto</option>
            <option value="pago">Pago</option>
            <option value="recebido">Recebido</option>
            <option value="vencido">Vencido</option>
          </select>
        </Field>
        <Button onClick={() => refetch()}>Gerar</Button>
      </div>

      <div className="bg-card border rounded-2xl p-5 shadow-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Pré-visualização</h2>
          <span className="text-xs text-muted-foreground">{isFetching ? "Carregando..." : `${preview?.total ?? 0} registro(s)`}</span>
        </div>
        {!preview || preview.rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Sem dados para os filtros selecionados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                  {Object.keys(preview.rows[0]).map((h) => (
                    <th key={h} className="py-2 pr-4 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
                {preview.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {Object.keys(preview.rows[0]).map((h) => {
                      const v = (r as Record<string, unknown>)[h];
                      const isMoney = ["Valor", "Orçado", "Realizado", "Restante", "Entradas", "Saídas", "Resultado", "Custo", "Preço atual", "Preço sugerido (40%)", "Lucro R$", "Valor total", "Custo unit.", "Preço venda"].includes(h);
                      return (
                        <td key={h} className={`py-2 pr-4 ${isMoney ? "font-mono" : ""}`}>
                          {isMoney && typeof v === "string" && !isNaN(Number(v)) ? formatMoney(Number(v)) : String(v ?? "")}
                        </td>
                      );
                    })}
                  </tr>
                ))}

              </tbody>
            </table>
            {preview.rows.length > 50 && (
              <p className="text-xs text-muted-foreground mt-3">Exibindo 50 de {preview.rows.length}. Exporte o CSV para o relatório completo.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
