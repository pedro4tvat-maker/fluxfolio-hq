import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney, downloadCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { FiltroBotao } from "@/components/FiltroBotao";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, Package, PackageX, TrendingDown, TrendingUp, Plus, Pencil, Trash2, Download, ArrowDownToLine, ArrowUpFromLine, Scale, Search, Boxes, History } from "lucide-react";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/ui/currency-input";

export const Route = createFileRoute("/app/estoque")({ component: EstoquePage });

type Product = {
  id: string;
  nome: string;
  categoria: string | null;
  fornecedor: string | null;
  quantidade: number;
  custo_unitario: number;
  preco_venda: number;
  estoque_minimo: number;
};

type Movement = {
  id: string;
  product_id: string;
  tipo: "entrada" | "saida";
  quantidade: number;
  custo_unitario: number | null;
  motivo: string | null;
  data: string;
};

const emptyProduct = {
  nome: "",
  categoria: "",
  fornecedor: "",
  custo_unitario: "",
  preco_venda: "",
  estoque_minimo: "",
  quantidade_inicial: "",
};

const emptyMovement = {
  product_id: "",
  tipo: "entrada" as "entrada" | "saida",
  quantidade: "",
  custo_unitario: "",
  motivo: "",
  data: new Date().toISOString().slice(0, 10),
  stock_location_id: "",
};

function EstoquePage() {
  const { selected, isLoading: companiesLoading } = useSelectedCompany();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "out">("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [aba, setAba] = useState<"produtos" | "movimentacoes">("produtos");

  const [productOpen, setProductOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ ...emptyProduct });

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState({ ...emptyMovement });
  const [saving, setSaving] = useState(false);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ product_id: "", nova_quantidade: "", stock_location_id: "" });

  const { data: products, isLoading } = useQuery({
    queryKey: ["estoque-products", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, nome, categoria, fornecedor, quantidade, custo_unitario, preco_venda, estoque_minimo")
        .eq("company_id", selected!)
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const { data: movements } = useQuery({
    queryKey: ["estoque-movements", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, product_id, tipo, quantidade, custo_unitario, motivo, data")
        .eq("company_id", selected!)
        .is("deleted_at", null)
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data ?? []) as Movement[];
    },
  });

  const { data: locations } = useQuery({
    queryKey: ["estoque-locations", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_locations")
        .select("id, nome, tipo, ativa, is_default")
        .eq("company_id", selected!)
        .eq("ativa", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; tipo: string; ativa: boolean; is_default: boolean }[];
    },
  });

  const defaultLocationId = useMemo(() => {
    const list = locations ?? [];
    return (
      list.find((l) => l.is_default)?.id ??
      list.find((l) => l.tipo === "principal")?.id ??
      list[0]?.id ??
      null
    );
  }, [locations]);


  const { data: locationBalances } = useQuery({
    queryKey: ["estoque-location-balances", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("product_id, stock_location_id, tipo, quantidade")
        .eq("company_id", selected!)
        .is("deleted_at", null);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const m of data ?? []) {
        if (!m.stock_location_id) continue;
        const key = `${m.product_id}:${m.stock_location_id}`;
        const delta = m.tipo === "entrada" ? Number(m.quantidade) : -Number(m.quantidade);
        map.set(key, (map.get(key) ?? 0) + delta);
      }
      return map;
    },
  });

  const productMap = useMemo(
    () => new Map((products ?? []).map((p) => [p.id, p])),
    [products],
  );

  const getQty = (p: Product): number => {
    if (filterLocation === "all") return Number(p.quantidade);
    return locationBalances?.get(`${p.id}:${filterLocation}`) ?? 0;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (term && !`${p.nome} ${p.categoria ?? ""} ${p.fornecedor ?? ""}`.toLowerCase().includes(term)) return false;
      const qtd = getQty(p);
      if (filterStatus === "low" && !(qtd > 0 && qtd <= Number(p.estoque_minimo))) return false;
      if (filterStatus === "out" && qtd > 0) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, filterStatus, filterLocation, locationBalances]);

  const kpis = useMemo(() => {
    const list = products ?? [];
    const total = list.length;
    const lowCount = list.filter((p) => { const q = getQty(p); return q > 0 && q <= Number(p.estoque_minimo); }).length;
    const outCount = list.filter((p) => getQty(p) <= 0).length;
    const valor = list.reduce((acc, p) => acc + getQty(p) * Number(p.custo_unitario), 0);
    const venda = list.reduce((acc, p) => acc + getQty(p) * Number(p.preco_venda), 0);
    return { total, lowCount, outCount, valor, venda };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, filterLocation, locationBalances]);

  function openNewProduct() {
    setEditing(null);
    setProductForm({ ...emptyProduct });
    setProductOpen(true);
  }

  function openEditProduct(p: Product) {
    setEditing(p);
    setProductForm({
      nome: p.nome,
      categoria: p.categoria ?? "",
      fornecedor: p.fornecedor ?? "",
      custo_unitario: p.custo_unitario ? String(p.custo_unitario) : "",
      preco_venda: p.preco_venda ? String(p.preco_venda) : "",
      estoque_minimo: p.estoque_minimo ? String(p.estoque_minimo) : "",
      quantidade_inicial: "",
    });
    setProductOpen(true);
  }

  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!productForm.nome.trim()) {
      toast.error("Informe o nome do produto");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("products")
          .update({
            nome: productForm.nome.trim(),
            categoria: productForm.categoria || null,
            fornecedor: productForm.fornecedor || null,
            custo_unitario: Number(productForm.custo_unitario) || 0,
            preco_venda: Number(productForm.preco_venda) || 0,
            estoque_minimo: Number(productForm.estoque_minimo) || 0,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Produto atualizado");
      } else {
        const qtdInicial = Number(productForm.quantidade_inicial) || 0;
        const { data: created, error } = await supabase
          .from("products")
          .insert({
            company_id: selected,
            nome: productForm.nome.trim(),
            categoria: productForm.categoria || null,
            fornecedor: productForm.fornecedor || null,
            custo_unitario: Number(productForm.custo_unitario) || 0,
            preco_venda: Number(productForm.preco_venda) || 0,
            estoque_minimo: Number(productForm.estoque_minimo) || 0,
            quantidade: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (qtdInicial > 0 && created) {
          const { error: smErr } = await supabase.from("stock_movements").insert({
            company_id: selected,
            product_id: created.id,
            tipo: "entrada",
            quantidade: qtdInicial,
            custo_unitario: Number(productForm.custo_unitario) || null,
            motivo: "Estoque inicial",
            stock_location_id: defaultLocationId,
          });
          if (smErr) throw smErr;
        }
        toast.success("Produto cadastrado");
      }
      setProductOpen(false);
      qc.invalidateQueries({ queryKey: ["estoque-products"] });
      qc.invalidateQueries({ queryKey: ["estoque-movements"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(p: Product) {
    if (!confirm(`Excluir o produto "${p.nome}"? As movimentações ficarão no histórico.`)) return;
    const { error } = await supabase.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", p.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Produto removido");
    qc.invalidateQueries({ queryKey: ["estoque-products"] });
  }

  function openAdjustQuantity(p: Product) {
    setAdjustForm({ product_id: p.id, nova_quantidade: String(p.quantidade), stock_location_id: filterLocation !== "all" ? filterLocation : "" });
    setAdjustOpen(true);
  }

  async function handleAdjustQuantity(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const p = productMap.get(adjustForm.product_id);
    if (!p) return;
    const novaQtd = Number(adjustForm.nova_quantidade);
    if (isNaN(novaQtd) || novaQtd < 0) {
      toast.error("Quantidade inválida");
      return;
    }
    const diff = novaQtd - Number(p.quantidade);
    if (diff === 0) {
      setAdjustOpen(false);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("stock_movements").insert({
        company_id: selected,
        product_id: adjustForm.product_id,
        tipo: diff > 0 ? "entrada" : "saida",
        quantidade: Math.abs(diff),
        custo_unitario: p.custo_unitario || null,
        motivo: "Ajuste de estoque",
        data: new Date().toISOString().slice(0, 10),
        stock_location_id: adjustForm.stock_location_id || defaultLocationId || null,
      });
      if (error) throw error;
      toast.success("Quantidade ajustada");
      setAdjustOpen(false);
      qc.invalidateQueries({ queryKey: ["estoque-products"] });
      qc.invalidateQueries({ queryKey: ["estoque-movements"] });
      qc.invalidateQueries({ queryKey: ["estoque-location-balances"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao ajustar quantidade");
    } finally {
      setSaving(false);
    }
  }

  function openNewMovement(productId?: string) {
    setMoveForm({ ...emptyMovement, product_id: productId ?? "", stock_location_id: filterLocation !== "all" ? filterLocation : "" });
    setMoveOpen(true);
  }

  async function handleSaveMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!moveForm.product_id) {
      toast.error("Selecione um produto");
      return;
    }
    const qtd = Number(moveForm.quantidade);
    if (!qtd || qtd <= 0) {
      toast.error("Quantidade inválida");
      return;
    }
    if (moveForm.tipo === "saida") {
      const p = productMap.get(moveForm.product_id);
      if (p && qtd > Number(p.quantidade)) {
        if (!confirm(`Estoque atual (${p.quantidade}) é menor que a saída (${qtd}). Continuar?`)) return;
      }
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("stock_movements").insert({
        company_id: selected,
        product_id: moveForm.product_id,
        tipo: moveForm.tipo,
        quantidade: qtd,
        custo_unitario: moveForm.custo_unitario ? Number(moveForm.custo_unitario) : null,
        motivo: moveForm.motivo || (moveForm.tipo === "entrada" ? "Entrada manual" : "Saída manual"),
        data: moveForm.data,
        stock_location_id: moveForm.stock_location_id || defaultLocationId || null,
      });
      if (error) throw error;
      toast.success("Movimentação registrada");
      setMoveOpen(false);
      qc.invalidateQueries({ queryKey: ["estoque-products"] });
      qc.invalidateQueries({ queryKey: ["estoque-movements"] });
      qc.invalidateQueries({ queryKey: ["estoque-location-balances"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar movimentação");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const rows = (products ?? []).map((p) => ({
      Produto: p.nome,
      Categoria: p.categoria ?? "",
      Fornecedor: p.fornecedor ?? "",
      Quantidade: Number(p.quantidade),
      "Estoque mínimo": Number(p.estoque_minimo),
      "Custo unitário": Number(p.custo_unitario),
      "Preço de venda": Number(p.preco_venda),
      "Valor em estoque (custo)": Number(p.quantidade) * Number(p.custo_unitario),
    }));
    downloadCSV(`estoque-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  if (companiesLoading) {
    return <div className="text-muted-foreground p-10 text-center">Carregando dados da empresa...</div>;
  }

  if (!selected) {
    return <div className="text-muted-foreground p-10 text-center">Selecione uma empresa para gerenciar o estoque.</div>;
  }

  const lucroPotencial = kpis.venda - kpis.valor;
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const gruposMov: { data: string; itens: Movement[] }[] = [];
  for (const m of movements ?? []) {
    const g = gruposMov[gruposMov.length - 1];
    if (g && g.data === m.data) g.itens.push(m);
    else gruposMov.push({ data: m.data, itens: [m] });
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Controle de Estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre produtos, registre entradas e saídas e acompanhe o estoque mínimo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" className="rounded-full h-11 text-muted-foreground" onClick={exportCsv}><Download className="size-4" /> Exportar</Button>
          <Button variant="outline" className="rounded-full h-11 px-5" onClick={() => openNewMovement()}>
            <ArrowDownToLine className="size-4" /> Movimentação
          </Button>
          <Button className="rounded-full h-11 px-5 shadow-sm" onClick={openNewProduct}><Plus className="size-4" /> Novo produto</Button>
        </div>
      </div>

      {/* Resumo do estoque */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-7 sm:py-6 grid gap-5 lg:grid-cols-[1.1fr_1.6fr] lg:items-center">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Valor em estoque (custo)</div>
          <div className="font-display font-bold text-3xl sm:text-4xl mt-1 tabular-nums">{formatMoney(kpis.valor)}</div>
          <div className="text-xs text-muted-foreground mt-1">
            Vale {formatMoney(kpis.venda)} a preço de venda · lucro potencial{" "}
            <b className={lucroPotencial >= 0 ? "text-success" : "text-destructive"}>{formatMoney(lucroPotencial)}</b>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {([
            ["all", "Produtos", kpis.total, Boxes, "text-foreground"],
            ["low", "Estoque baixo", kpis.lowCount, AlertTriangle, kpis.lowCount > 0 ? "text-warning-foreground" : "text-muted-foreground"],
            ["out", "Sem estoque", kpis.outCount, PackageX, kpis.outCount > 0 ? "text-destructive" : "text-muted-foreground"],
          ] as const).map(([v, rotulo, n, Icone, cor]) => (
            <button
              key={v}
              type="button"
              onClick={() => { setFilterStatus(v); setAba("produtos"); }}
              className={`text-left rounded-2xl px-3.5 py-3 transition-colors ${filterStatus === v ? "bg-background shadow-sm ring-1 ring-primary/30" : "bg-background/60 hover:bg-background"}`}
              title={v === "all" ? "Mostrar todos os produtos" : `Mostrar só: ${rotulo.toLowerCase()}`}
            >
              <div className={`flex items-center gap-1.5 text-[11px] font-medium ${cor}`}><Icone className="size-3.5" /> {rotulo}</div>
              <div className="font-display font-bold text-2xl tabular-nums mt-0.5">{n}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Busca e filtros */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, categoria ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-full bg-card border shadow-sm"
          />
        </div>
        <FiltroBotao
          grupos={[
            { titulo: "Situação do estoque", valor: filterStatus, padrao: "all", onChange: (v) => setFilterStatus(v as typeof filterStatus),
              opcoes: [["all", "Todos"], ["low", "Estoque baixo"], ["out", "Sem estoque"]] },
            { titulo: "Centro de estoque", valor: filterLocation, padrao: "all", onChange: setFilterLocation, formato: "lista",
              opcoes: [["all", "Todos os centros"], ...(locations ?? []).map((l) => [l.id, l.nome] as [string, string])] },
          ]}
        />
        <div className="inline-flex rounded-full bg-muted p-1 self-start lg:self-auto" role="tablist" aria-label="O que mostrar">
          {([["produtos", "Produtos", Package], ["movimentacoes", "Movimentações", History]] as const).map(([v, r, Icone]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={aba === v}
              onClick={() => setAba(v)}
              className={`px-3.5 h-9 rounded-full text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${aba === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icone className="size-4" /> {r}
            </button>
          ))}
        </div>
      </div>

      {aba === "produtos" ? (
        <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhum produto encontrado.</p>
          ) : (
            <ul>
              {filtered.map((p) => {
                const qtd = getQty(p);
                const min = Number(p.estoque_minimo);
                const status: "ok" | "low" | "out" = qtd <= 0 ? "out" : qtd <= min ? "low" : "ok";
                const referencia = Math.max(min * 2, qtd, 1);
                const cor = status === "out" ? "bg-destructive" : status === "low" ? "bg-warning" : "bg-success";
                const custo = Number(p.custo_unitario);
                const venda = Number(p.preco_venda);
                const margem = venda > 0 ? ((venda - custo) / venda) * 100 : null;
                return (
                  <li key={p.id} className="group flex items-center gap-3 sm:gap-4 rounded-2xl px-3 py-3 hover:bg-muted/60 transition-colors">
                    <span className={`size-10 shrink-0 rounded-full grid place-items-center ${status === "out" ? "bg-destructive/10 text-destructive" : status === "low" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary"}`}>
                      {status === "out" ? <PackageX className="size-4" /> : status === "low" ? <AlertTriangle className="size-4" /> : <Package className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{p.nome}</span>
                        {status !== "ok" && (
                          <span className={`shrink-0 rounded-full px-2 py-px text-[10px] font-medium ${status === "out" ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                            {status === "out" ? "Sem estoque" : "Estoque baixo"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[p.categoria, p.fornecedor].filter(Boolean).join(" · ") || "Sem categoria"}
                        <span className="hidden sm:inline"> · custo {formatMoney(custo)} · venda {formatMoney(venda)}{margem !== null ? ` (${margem.toFixed(0)}% margem)` : ""}</span>
                      </div>
                    </div>
                    <div className="w-24 sm:w-32 shrink-0 text-right">
                      <div className="font-display font-semibold tabular-nums">
                        {qtd} <span className="text-xs font-normal text-muted-foreground">un.</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden" title={`Mínimo: ${min}`}>
                        <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(Math.max(qtd, 0) / referencia, 1) * 100}%`, opacity: 0.75 }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">mín. {min}</div>
                    </div>
                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button type="button" title="Entrada" className="size-8 grid place-items-center rounded-full hover:bg-background text-success" onClick={() => { setMoveForm({ ...emptyMovement, product_id: p.id, tipo: "entrada" }); setMoveOpen(true); }}>
                        <ArrowDownToLine className="size-3.5" />
                      </button>
                      <button type="button" title="Saída" className="size-8 grid place-items-center rounded-full hover:bg-background text-destructive" onClick={() => { setMoveForm({ ...emptyMovement, product_id: p.id, tipo: "saida" }); setMoveOpen(true); }}>
                        <ArrowUpFromLine className="size-3.5" />
                      </button>
                      <button type="button" title="Ajustar quantidade" className="size-8 grid place-items-center rounded-full hover:bg-background" onClick={() => openAdjustQuantity(p)}>
                        <Scale className="size-3.5" />
                      </button>
                      <button type="button" title="Editar" className="size-8 grid place-items-center rounded-full hover:bg-background" onClick={() => openEditProduct(p)}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" title="Excluir" className="size-8 grid place-items-center rounded-full hover:bg-background" onClick={() => handleDeleteProduct(p)}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
          {gruposMov.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma movimentação registrada.</p>
          ) : (
            gruposMov.map((g) => {
              const [ano, mes, dia] = g.data.split("-");
              return (
                <div key={g.data} className="pt-2">
                  <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {dia} {MESES[Number(mes) - 1]} {ano !== String(new Date().getFullYear()) ? ano : ""}
                  </div>
                  <ul>
                    {g.itens.map((m) => {
                      const prod = productMap.get(m.product_id);
                      const isIn = m.tipo === "entrada";
                      return (
                        <li key={m.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/60 transition-colors">
                          <span className={`size-9 shrink-0 rounded-full grid place-items-center ${isIn ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"}`}>
                            {isIn ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">{prod?.nome ?? "Produto removido"}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {[isIn ? "Entrada" : "Saída", m.motivo, m.custo_unitario ? `custo ${formatMoney(Number(m.custo_unitario))}` : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div className={`font-display font-semibold tabular-nums ${isIn ? "text-success" : "text-destructive"}`}>
                            {isIn ? "+" : "−"}{Number(m.quantidade)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </section>
      )}

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveProduct} className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Nome</Label>
              <Input value={productForm.nome} onChange={(e) => setProductForm({ ...productForm, nome: e.target.value })} required />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Input value={productForm.categoria} onChange={(e) => setProductForm({ ...productForm, categoria: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Fornecedor</Label>
              <Input value={productForm.fornecedor} onChange={(e) => setProductForm({ ...productForm, fornecedor: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Custo unitário</Label>
              <CurrencyInput value={productForm.custo_unitario} onChange={(v) => setProductForm({ ...productForm, custo_unitario: v })} />
            </div>
            <div className="space-y-1">
              <Label>Preço de venda</Label>
              <CurrencyInput value={productForm.preco_venda} onChange={(v) => setProductForm({ ...productForm, preco_venda: v })} />
            </div>
            <div className="space-y-1">
              <Label>Estoque mínimo</Label>
              <Input type="number" min="0" step="1" placeholder="0" value={productForm.estoque_minimo} onChange={(e) => setProductForm({ ...productForm, estoque_minimo: e.target.value })} />
            </div>
            {!editing && (
              <div className="space-y-1">
                <Label>Quantidade inicial</Label>
                <Input type="number" min="0" step="1" placeholder="0" value={productForm.quantidade_inicial} onChange={(e) => setProductForm({ ...productForm, quantidade_inicial: e.target.value })} />
              </div>
            )}
            <DialogFooter className="md:col-span-2">
              <Button type="button" variant="ghost" onClick={() => setProductOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova movimentação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveMovement} className="grid gap-3">
            <div className="space-y-1">
              <Label>Produto</Label>
              <Select value={moveForm.product_id} onValueChange={(v) => setMoveForm({ ...moveForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (estoque: {Number(p.quantidade)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={moveForm.tipo} onValueChange={(v: "entrada" | "saida") => setMoveForm({ ...moveForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={moveForm.data} onChange={(e) => setMoveForm({ ...moveForm, data: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Quantidade</Label>
                <Input type="number" min="0" step="1" placeholder="0" value={moveForm.quantidade} onChange={(e) => setMoveForm({ ...moveForm, quantidade: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Custo unitário (opcional)</Label>
                <CurrencyInput value={moveForm.custo_unitario} onChange={(v) => setMoveForm({ ...moveForm, custo_unitario: v })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Centro de estoque</Label>
              <Select value={moveForm.stock_location_id || "none"} onValueChange={(v) => setMoveForm({ ...moveForm, stock_location_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Estoque geral" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Estoque geral (sem centro)</SelectItem>
                  {(locations ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <Input value={moveForm.motivo} onChange={(e) => setMoveForm({ ...moveForm, motivo: e.target.value })} placeholder="Compra, ajuste, perda, venda manual..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setMoveOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustar quantidade em estoque</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdjustQuantity} className="grid gap-3">
            <div className="space-y-1">
              <Label>Produto</Label>
              <Select value={adjustForm.product_id} onValueChange={(v) => setAdjustForm({ ...adjustForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (estoque atual: {Number(p.quantidade)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Centro de estoque</Label>
              <Select value={adjustForm.stock_location_id || "none"} onValueChange={(v) => setAdjustForm({ ...adjustForm, stock_location_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Estoque geral" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Estoque geral (sem centro)</SelectItem>
                  {(locations ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nova quantidade</Label>
              <Input type="number" min="0" step="1" placeholder="0" value={adjustForm.nova_quantidade} onChange={(e) => setAdjustForm({ ...adjustForm, nova_quantidade: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Confirmar ajuste"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
