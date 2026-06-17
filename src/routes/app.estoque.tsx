import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney, downloadCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, TrendingDown, TrendingUp, Plus, Pencil, Trash2, Download, ArrowDownToLine, ArrowUpFromLine, Scale } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
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
        .eq("company_id", selected!);
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
    const { error } = await supabase.from("products").delete().eq("id", p.id);
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
        stock_location_id: moveForm.stock_location_id || null,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Controle de Estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre produtos, registre entradas e saídas e acompanhe alertas de estoque mínimo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" /> Exportar CSV</Button>
          <Button variant="outline" onClick={() => openNewMovement()}>
            <ArrowDownToLine className="size-4 mr-1" /> Movimentação
          </Button>
          <Button onClick={openNewProduct}><Plus className="size-4 mr-1" /> Novo produto</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={<Package className="size-4" />} label="Produtos cadastrados" value={String(kpis.total)} />
        <KpiCard
          icon={<AlertTriangle className="size-4" />}
          label="Estoque baixo"
          value={String(kpis.lowCount)}
          tone={kpis.lowCount > 0 ? "warn" : "default"}
        />
        <KpiCard
          icon={<AlertTriangle className="size-4" />}
          label="Sem estoque"
          value={String(kpis.outCount)}
          tone={kpis.outCount > 0 ? "danger" : "default"}
        />
        <KpiCard icon={<TrendingUp className="size-4" />} label="Valor em estoque (custo)" value={formatMoney(kpis.valor)} />
      </div>

      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label>Buscar</Label>
            <Input placeholder="Nome, categoria ou fornecedor" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={filterStatus} onValueChange={(v: "all" | "low" | "out") => setFilterStatus(v)}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="low">Estoque baixo</SelectItem>
                <SelectItem value="out">Sem estoque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Centro de estoque</Label>
            <Select value={filterLocation} onValueChange={setFilterLocation}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos (estoque geral)</SelectItem>
                {(locations ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 pr-3 text-right">Qtd.</th>
                <th className="py-2 pr-3 text-right">Mín.</th>
                <th className="py-2 pr-3 text-right">Custo</th>
                <th className="py-2 pr-3 text-right">Venda</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-6 text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-6 text-muted-foreground">Nenhum produto encontrado.</td></tr>
              ) : (
                filtered.map((p) => {
                  const qtd = getQty(p);
                  const min = Number(p.estoque_minimo);
                  const status: "ok" | "low" | "out" = qtd <= 0 ? "out" : qtd <= min ? "low" : "ok";
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.nome}</div>
                        {p.fornecedor && <div className="text-xs text-muted-foreground">{p.fornecedor}</div>}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground">{p.categoria ?? "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{qtd}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{min}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(p.custo_unitario))}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(Number(p.preco_venda))}</td>
                      <td className="py-2 pr-3">
                        {status === "out" ? (
                          <Badge variant="destructive">Sem estoque</Badge>
                        ) : status === "low" ? (
                          <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Baixo</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Entrada" onClick={() => { setMoveForm({ ...emptyMovement, product_id: p.id, tipo: "entrada" }); setMoveOpen(true); }}>
                            <ArrowDownToLine className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Saída" onClick={() => { setMoveForm({ ...emptyMovement, product_id: p.id, tipo: "saida" }); setMoveOpen(true); }}>
                            <ArrowUpFromLine className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Ajustar quantidade" onClick={() => openAdjustQuantity(p)}>
                            <Scale className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Editar" onClick={() => openEditProduct(p)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Excluir" onClick={() => handleDeleteProduct(p)}>
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-display font-semibold">Movimentações recentes</h2>
        <div className="bg-card border rounded-2xl p-4">
          {!movements || movements.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</div>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => {
                const p = productMap.get(m.product_id);
                const isIn = m.tipo === "entrada";
                return (
                  <div key={m.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${isIn ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                        {isIn ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                      </div>
                      <div>
                        <p className="font-medium">{p?.nome ?? "Produto removido"}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(m.data)} • {m.motivo ?? "—"}</p>
                      </div>
                    </div>
                    <div className={`font-display font-semibold tabular-nums ${isIn ? "text-success" : "text-destructive"}`}>
                      {isIn ? "+" : "-"}{Number(m.quantidade)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

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

      {selected && (
        <section className="space-y-2 max-w-5xl">
          <h2 className="font-display font-semibold">Documentos do estoque</h2>
          <div className="bg-card border rounded-2xl p-4 shadow-card">
            <AttachmentsPanel companyId={selected} module="products" />
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, tone = "default" }: { icon: React.ReactNode; label: string; value: string; tone?: "default" | "warn" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "border-destructive/30 bg-destructive/5"
      : tone === "warn"
      ? "border-warning/30 bg-warning/5"
      : "";
  return (
    <div className={`bg-card border rounded-2xl p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-display font-bold tabular-nums">{value}</div>
    </div>
  );
}
