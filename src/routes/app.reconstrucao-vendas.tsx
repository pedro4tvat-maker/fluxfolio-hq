import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wrench, Plus, Trash2, Upload, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { parseFile, parseAmount } from "@/lib/import-engine";

export const Route = createFileRoute("/app/reconstrucao-vendas")({ component: Page });

type PendingSale = {
  id: string;
  type: "vista" | "prazo";
  os_code: string | null;
  customer: string | null;
  date: string;
  due: string | null;
  amount: number;
  description: string | null;
  reconstruction_status: string | null;
};

type LineItem = {
  product_id: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  unit_cost: string;
  stock_location_id: string;
  observation: string;
};

function emptyItem(): LineItem {
  return { product_id: "", product_name: "", quantity: "", unit_price: "", unit_cost: "", stock_location_id: "", observation: "" };
}

function Page() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedSale, setSelectedSale] = useState<PendingSale | null>(null);
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [origin, setOrigin] = useState<string>("conferencia_manual");
  const [saving, setSaving] = useState(false);

  // Stats
  const { data: stats } = useQuery({
    queryKey: ["recovery-stats", selected],
    enabled: !!selected,
    queryFn: async () => {
      const [t1, t2, t3, t4, t5, t6, t7] = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("company_id", selected!),
        supabase.from("receivables").select("id", { count: "exact", head: true }).eq("company_id", selected!),
        supabase.from("sale_items").select("sale_id", { count: "exact", head: true }).eq("company_id", selected!),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("company_id", selected!).eq("needs_manual_item_reconstruction", true).eq("reconstruction_status", "pendente_revisao_manual"),
        supabase.from("receivables").select("id", { count: "exact", head: true }).eq("company_id", selected!).eq("needs_manual_item_reconstruction", true).eq("reconstruction_status", "pendente_revisao_manual"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("company_id", selected!).eq("reconstruction_status", "reconstruida_conferida"),
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("company_id", selected!).eq("reconstruction_status", "reconstruida_com_divergencia"),
      ]);
      return {
        totalVista: t1.count ?? 0,
        totalPrazo: t2.count ?? 0,
        comItens: t3.count ?? 0,
        pendentesVista: t4.count ?? 0,
        pendentesPrazo: t5.count ?? 0,
        conferidas: t6.count ?? 0,
        divergentes: t7.count ?? 0,
      };
    },
  });

  // Pending sales list
  const { data: sales = [], refetch } = useQuery({
    queryKey: ["recovery-pending", selected],
    enabled: !!selected,
    queryFn: async () => {
      const out: PendingSale[] = [];
      const { data: vista } = await supabase
        .from("transactions")
        .select("id, os_code, descricao, valor, data, reconstruction_status, crm_contacts(name)")
        .eq("company_id", selected!)
        .eq("needs_manual_item_reconstruction", true)
        .order("data", { ascending: false });
      (vista ?? []).forEach((r: any) => out.push({
        id: r.id, type: "vista", os_code: r.os_code, customer: r.crm_contacts?.name ?? null,
        date: r.data, due: null, amount: Number(r.valor ?? 0), description: r.descricao,
        reconstruction_status: r.reconstruction_status,
      }));
      const { data: prazo } = await supabase
        .from("receivables")
        .select("id, os_code, descricao, cliente, valor, vencimento, reconstruction_status")
        .eq("company_id", selected!)
        .eq("needs_manual_item_reconstruction", true)
        .order("vencimento", { ascending: false });
      (prazo ?? []).forEach((r: any) => out.push({
        id: r.id, type: "prazo", os_code: r.os_code, customer: r.cliente,
        date: r.vencimento, due: r.vencimento, amount: Number(r.valor ?? 0), description: r.descricao,
        reconstruction_status: r.reconstruction_status,
      }));
      return out;
    },
  });

  // Products for autocomplete
  const { data: products = [] } = useQuery({
    queryKey: ["products", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, nome, custo_unitario, preco_venda").eq("company_id", selected!);
      return data ?? [];
    },
  });
  const { data: stockLocations = [] } = useQuery({
    queryKey: ["stock-locations", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase.from("stock_locations").select("id, nome").eq("company_id", selected!).eq("ativa", true);
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (statusFilter !== "all" && (s.reconstruction_status ?? "pendente_revisao_manual") !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (q && !(s.os_code?.toLowerCase().includes(q) || s.customer?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [sales, search, statusFilter, typeFilter]);

  function openReconstruct(sale: PendingSale) {
    setSelectedSale(sale);
    setItems([emptyItem()]);
    setOrigin("conferencia_manual");
  }

  function addItem() { setItems((p) => [...p, emptyItem()]); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, patch: Partial<LineItem>) {
    setItems((p) => p.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  const totalItems = useMemo(() => items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0), [items]);

  async function saveReconstruction() {
    if (!selectedSale || !selected) return;
    const valid = items.filter((it) => it.product_name.trim() && Number(it.quantity) > 0);
    if (valid.length === 0) { toast.error("Adicione pelo menos um item com nome e quantidade."); return; }

    setSaving(true);
    try {
      // bloqueio de duplicidade
      const { count: existing } = await supabase
        .from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", selectedSale.id);
      if ((existing ?? 0) > 0) {
        toast.error("Esta venda já possui itens estruturados ou recuperação registrada. Revise antes de criar novos itens.");
        setSaving(false); return;
      }

      const totalItemsAmount = valid.reduce((a, it) => a + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);
      const diff = (selectedSale.amount || 0) - totalItemsAmount;
      const conferida = Math.abs(diff) < 0.01;

      const { data: log, error: logErr } = await (supabase as any).from("sales_recovery_log").insert({
        company_id: selected,
        sale_id: selectedSale.id,
        sale_type: selectedSale.type,
        os_number: selectedSale.os_code,
        recovery_method: "manual",
        status: conferida ? "reconstruida_conferida" : "reconstruida_com_divergencia",
        items_created_count: valid.length,
        total_sale_amount: selectedSale.amount,
        total_items_amount: totalItemsAmount,
        difference_amount: diff,
        notes: `Origem: ${origin}`,
      }).select("id").single();
      if (logErr) throw logErr;

      const rows = valid.map((it) => {
        const qtd = Number(it.quantity) || 0;
        const preco = Number(it.unit_price) || 0;
        const custo = Number(it.unit_cost) || 0;
        const receita = qtd * preco;
        const custoTotal = qtd * custo;
        const temPreco = preco > 0;
        const temCusto = custo > 0;
        return {
          company_id: selected,
          sale_id: selectedSale.id,
          sale_type: selectedSale.type,
          product_id: it.product_id || null,
          product_name_snapshot: it.product_name.trim(),
          quantity: qtd,
          unit_price: temPreco ? preco : null,
          unit_cost: temCusto ? custo : null,
          total_revenue: temPreco ? receita : null,
          total_cost: temCusto ? custoTotal : null,
          margin_value: temPreco && temCusto ? receita - custoTotal : null,
          margin_percentage: temPreco && temCusto && receita > 0 ? ((receita - custoTotal) / receita) * 100 : null,
          stock_location_id: it.stock_location_id || null,
          needs_review: !temPreco || !temCusto,
          review_reason: !temPreco ? "Preço de venda não informado" : !temCusto ? "Custo não informado" : null,
          recovered_from_stock_movement: false,
          recovery_status: "reconstruido_manual",
          recovery_log_id: log.id,
        };
      });

      const { error: itemsErr } = await (supabase as any).from("sale_items").insert(rows);
      if (itemsErr) throw itemsErr;

      const tbl = selectedSale.type === "vista" ? "transactions" : "receivables";
      await (supabase as any).from(tbl).update({
        reconstruction_status: conferida ? "reconstruida_conferida" : "reconstruida_com_divergencia",
        needs_manual_item_reconstruction: false,
      }).eq("id", selectedSale.id);

      toast.success(conferida ? "Reconstrução conferida com sucesso!" : "Reconstrução salva com divergência de valor.");
      setSelectedSale(null);
      qc.invalidateQueries({ queryKey: ["recovery-pending"] });
      qc.invalidateQueries({ queryKey: ["recovery-stats"] });
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? e));
    } finally {
      setSaving(false);
    }
  }

  async function markChecked(sale: PendingSale) {
    if (!confirm("Marcar esta venda como conferida sem reconstruir itens?")) return;
    const tbl = sale.type === "vista" ? "transactions" : "receivables";
    const { error } = await (supabase as any).from(tbl).update({
      needs_manual_item_reconstruction: false,
      reconstruction_status: "reconstruida_conferida",
    }).eq("id", sale.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Marcada como conferida.");
    refetch();
    qc.invalidateQueries({ queryKey: ["recovery-stats"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Wrench className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-semibold">Reconstrução de Itens de Vendas</h1>
          <p className="text-sm text-muted-foreground">Recupere produtos de vendas antigas sem alterar valores financeiros.</p>
        </div>
      </div>

      {/* Status report */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Vendas totais</div><div className="text-2xl font-semibold">{(stats?.totalVista ?? 0) + (stats?.totalPrazo ?? 0)}</div><div className="text-xs text-muted-foreground mt-1">{stats?.totalVista ?? 0} à vista · {stats?.totalPrazo ?? 0} a prazo</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Com itens estruturados</div><div className="text-2xl font-semibold text-green-700">{stats?.comItens ?? 0}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pendentes de reconstrução</div><div className="text-2xl font-semibold text-orange-600">{(stats?.pendentesVista ?? 0) + (stats?.pendentesPrazo ?? 0)}</div><div className="text-xs text-muted-foreground mt-1">{stats?.pendentesVista ?? 0} à vista · {stats?.pendentesPrazo ?? 0} a prazo</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Conferidas / divergentes</div><div className="text-2xl font-semibold">{stats?.conferidas ?? 0} / <span className="text-amber-600">{stats?.divergentes ?? 0}</span></div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pendentes</TabsTrigger>
          <TabsTrigger value="import">Importar planilha</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-4">
              <div><Label className="text-xs">Busca (OS, cliente, descrição)</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex.: E0042" /></div>
              <div><Label className="text-xs">Tipo</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="vista">À vista</SelectItem>
                    <SelectItem value="prazo">A prazo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendente_revisao_manual">Pendente</SelectItem>
                    <SelectItem value="reconstruida_com_divergencia">Com divergência</SelectItem>
                    <SelectItem value="reconstruida_conferida">Conferida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end text-xs text-muted-foreground">{filtered.length} vendas listadas</div>
            </CardContent>
          </Card>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={`${s.type}-${s.id}`}>
                    <TableCell><Badge variant={s.type === "vista" ? "default" : "secondary"}>{s.type === "vista" ? "À vista" : "A prazo"}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{s.os_code ?? "—"}</TableCell>
                    <TableCell>{s.customer ?? "—"}</TableCell>
                    <TableCell>{formatDate(s.date)}</TableCell>
                    <TableCell className="text-right">{formatMoney(s.amount)}</TableCell>
                    <TableCell>
                      {s.reconstruction_status === "reconstruida_conferida" ? <Badge className="bg-green-600">Conferida</Badge>
                        : s.reconstruction_status === "reconstruida_com_divergencia" ? <Badge variant="destructive">Divergência</Badge>
                        : <Badge variant="outline">Pendente</Badge>}
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => openReconstruct(s)}><Wrench className="size-3" /> Reconstruir</Button>
                      <Button size="sm" variant="ghost" onClick={() => markChecked(s)} title="Marcar como conferida sem itens"><CheckCircle2 className="size-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma venda pendente.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <ImportPanel sales={sales} products={products as any} stockLocations={stockLocations as any} onDone={() => { refetch(); qc.invalidateQueries({ queryKey: ["recovery-stats"] }); }} companyId={selected!} />
        </TabsContent>
      </Tabs>

      {/* Reconstruction modal */}
      <Dialog open={!!selectedSale} onOpenChange={(o) => !o && setSelectedSale(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reconstruir itens — OS {selectedSale?.os_code ?? "—"}</DialogTitle>
            <CardDescription>
              {selectedSale?.customer ?? "Sem cliente"} · {selectedSale && formatDate(selectedSale.date)} · Total da venda: <strong>{selectedSale && formatMoney(selectedSale.amount)}</strong>
            </CardDescription>
          </DialogHeader>

          <div className="space-y-3">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 p-3 rounded-lg border">
                <div className="col-span-12 md:col-span-4">
                  <Label className="text-xs">Produto</Label>
                  <Select value={it.product_id || "_custom"} onValueChange={(v) => {
                    if (v === "_custom") { updateItem(i, { product_id: "", product_name: it.product_name }); }
                    else { const p: any = (products as any[]).find((x) => x.id === v); updateItem(i, { product_id: v, product_name: p?.nome ?? "", unit_cost: p?.custo_unitario ? String(p.custo_unitario) : it.unit_cost, unit_price: p?.preco_venda && !it.unit_price ? String(p.preco_venda) : it.unit_price }); }
                  }}>
                    <SelectTrigger><SelectValue placeholder="Selecione ou digite manual" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_custom">— Digitar manualmente —</SelectItem>
                      {(products as any[]).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {!it.product_id && <Input className="mt-1" placeholder="Nome do produto/serviço" value={it.product_name} onChange={(e) => updateItem(i, { product_name: e.target.value })} />}
                </div>
                <div className="col-span-4 md:col-span-1"><Label className="text-xs">Qtd</Label><Input type="number" value={it.quantity} onChange={(e) => updateItem(i, { quantity: e.target.value })} /></div>
                <div className="col-span-4 md:col-span-2"><Label className="text-xs">Preço un.</Label><Input type="number" step="0.01" value={it.unit_price} onChange={(e) => updateItem(i, { unit_price: e.target.value })} /></div>
                <div className="col-span-4 md:col-span-2"><Label className="text-xs">Custo un.</Label><Input type="number" step="0.01" value={it.unit_cost} onChange={(e) => updateItem(i, { unit_cost: e.target.value })} /></div>
                <div className="col-span-10 md:col-span-2">
                  <Label className="text-xs">Local de estoque</Label>
                  <Select value={it.stock_location_id || "_none"} onValueChange={(v) => updateItem(i, { stock_location_id: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— Sem informação —</SelectItem>
                      {(stockLocations as any[]).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 md:col-span-1 flex items-end"><Button size="icon" variant="ghost" onClick={() => removeItem(i)}><Trash2 className="size-4" /></Button></div>
                <div className="col-span-12"><Input placeholder="Observação (opcional)" value={it.observation} onChange={(e) => updateItem(i, { observation: e.target.value })} /></div>
              </div>
            ))}
            <Button variant="outline" onClick={addItem}><Plus className="size-4" /> Adicionar item</Button>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Origem da informação</Label>
                <Select value={origin} onValueChange={setOrigin}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf_antigo">PDF antigo</SelectItem>
                    <SelectItem value="print">Print</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="planilha">Planilha</SelectItem>
                    <SelectItem value="conferencia_manual">Conferência manual</SelectItem>
                    <SelectItem value="memoria_operacional">Memória operacional</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="text-sm">
                  Soma dos itens: <strong>{formatMoney(totalItems)}</strong>
                  {selectedSale && Math.abs(totalItems - selectedSale.amount) > 0.01 && (
                    <Badge variant="destructive" className="ml-2"><AlertTriangle className="size-3 mr-1" /> Diferença: {formatMoney(totalItems - selectedSale.amount)}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSale(null)}>Cancelar</Button>
            <Button onClick={saveReconstruction} disabled={saving}>{saving ? "Salvando..." : "Salvar reconstrução"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportPanel({ sales, products, stockLocations, onDone, companyId }: { sales: PendingSale[]; products: any[]; stockLocations: any[]; onDone: () => void; companyId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function onFile(f: File) {
    try {
      const p = await parseFile(f);
      setRows(p.rows);
      toast.success(`${p.rows.length} linhas detectadas.`);
    } catch (e: any) { toast.error("Erro ao ler: " + e.message); }
  }

  function findSale(osNumber: string): PendingSale | null {
    if (!osNumber) return null;
    return sales.find((s) => (s.os_code ?? "").toLowerCase() === osNumber.toLowerCase().trim()) ?? null;
  }

  const grouped = useMemo(() => {
    const map = new Map<string, { sale: PendingSale | null; items: any[]; errors: string[] }>();
    for (const r of rows) {
      const os = String((r as any).os_number ?? (r as any).OS ?? "").trim();
      if (!os) continue;
      const key = os;
      if (!map.has(key)) {
        const sale = findSale(os);
        map.set(key, { sale, items: [], errors: sale ? [] : [`OS ${os} não encontrada entre as vendas pendentes`] });
      }
      map.get(key)!.items.push(r);
    }
    return Array.from(map.entries());
  }, [rows, sales]);

  async function confirmImport() {
    setImporting(true);
    let ok = 0, errs = 0;
    try {
      for (const [os, group] of grouped) {
        if (!group.sale || group.errors.length > 0) { errs++; continue; }
        const { count: existing } = await supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("sale_id", group.sale.id);
        if ((existing ?? 0) > 0) { errs++; continue; }

        const validItems = group.items
          .map((r: any) => {
            const name = String(r.product_name ?? r.produto ?? "").trim();
            const qty = parseAmount(String(r.quantity ?? r.qtd ?? ""));
            const unit_price = parseAmount(String(r.unit_price ?? r.preco_unitario ?? r.preco ?? ""));
            const unit_cost = parseAmount(String(r.unit_cost ?? r.custo_unitario ?? r.custo ?? ""));
            return { name, qty, unit_price, unit_cost, observation: String(r.observation ?? r.observacao ?? "") };
          })
          .filter((it) => it.name && it.qty && it.qty > 0);

        if (validItems.length === 0) { errs++; continue; }

        const totalItems = validItems.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price ?? 0) || 0), 0);
        const diff = (group.sale.amount || 0) - totalItems;
        const conferida = Math.abs(diff) < 0.01;

        const { data: log, error: logErr } = await (supabase as any).from("sales_recovery_log").insert({
          company_id: companyId, sale_id: group.sale.id, sale_type: group.sale.type, os_number: group.sale.os_code,
          recovery_method: "importacao_planilha",
          status: conferida ? "reconstruida_conferida" : "reconstruida_com_divergencia",
          items_created_count: validItems.length, total_sale_amount: group.sale.amount,
          total_items_amount: totalItems, difference_amount: diff,
        }).select("id").single();
        if (logErr) { errs++; continue; }

        const itemRows = validItems.map((it) => {
          const qtd = Number(it.qty) || 0;
          const preco = Number(it.unit_price ?? 0) || 0;
          const custo = Number(it.unit_cost ?? 0) || 0;
          const temPreco = preco > 0;
          const temCusto = custo > 0;
          return {
            company_id: companyId, sale_id: group.sale!.id, sale_type: group.sale!.type,
            product_name_snapshot: it.name, quantity: qtd,
            unit_price: temPreco ? preco : null, unit_cost: temCusto ? custo : null,
            total_revenue: temPreco ? qtd * preco : null, total_cost: temCusto ? qtd * custo : null,
            margin_value: temPreco && temCusto ? qtd * preco - qtd * custo : null,
            margin_percentage: temPreco && temCusto && qtd * preco > 0 ? ((qtd * preco - qtd * custo) / (qtd * preco)) * 100 : null,
            needs_review: !temPreco || !temCusto,
            recovery_status: "importado_planilha", recovery_log_id: log.id,
          };
        });
        const { error: insErr } = await (supabase as any).from("sale_items").insert(itemRows);
        if (insErr) { errs++; continue; }

        const tbl = group.sale.type === "vista" ? "transactions" : "receivables";
        await (supabase as any).from(tbl).update({
          reconstruction_status: conferida ? "reconstruida_conferida" : "reconstruida_com_divergencia",
          needs_manual_item_reconstruction: false,
        }).eq("id", group.sale.id);
        ok++;
      }
      toast.success(`Importação concluída: ${ok} OK, ${errs} com erro.`);
      onDone();
      setRows([]);
    } finally { setImporting(false); }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importar planilha de reconstrução</CardTitle>
          <CardDescription>
            Colunas aceitas: <code>os_number, product_name, quantity, unit_price, unit_cost, observation</code> (aceita também sinônimos em português).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/40"
          >
            <FileSpreadsheet className="size-8 mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm">Arraste CSV/XLSX ou clique</p>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>

          {grouped.length > 0 && (
            <>
              <div className="rounded-lg border overflow-x-auto max-h-[400px]">
                <Table>
                  <TableHeader><TableRow><TableHead>OS</TableHead><TableHead>Status</TableHead><TableHead>Itens</TableHead><TableHead>Total venda</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {grouped.map(([os, g]) => (
                      <TableRow key={os}>
                        <TableCell className="font-mono">{os}</TableCell>
                        <TableCell>{g.sale ? <Badge>OK</Badge> : <Badge variant="destructive">{g.errors[0]}</Badge>}</TableCell>
                        <TableCell>{g.items.length}</TableCell>
                        <TableCell>{g.sale ? formatMoney(g.sale.amount) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={confirmImport} disabled={importing}><Upload className="size-4" /> {importing ? "Importando..." : "Confirmar importação"}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
