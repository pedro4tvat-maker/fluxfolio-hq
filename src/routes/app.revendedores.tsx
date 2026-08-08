import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Boxes } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/revendedores")({ component: RevendedoresPage });

const LOCATION_TYPES = [
  "principal", "deposito", "loja", "filial", "revendedor", "consignado", "producao", "transito", "outros",
] as const;
type LocType = (typeof LOCATION_TYPES)[number];

type StockLocationRow = {
  id: string;
  nome: string;
  tipo: LocType;
  responsavel: string | null;
  ativa: boolean;
  is_default: boolean;
};

type ResellerRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  stock_location_id: string | null;
  commission_pct: number;
  ativo: boolean;
};

function RevendedoresPage() {
  const { selected } = useSelectedCompany();

  if (!selected) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Revendedores e Centros de Estoque</h1>
        <p className="text-sm text-muted-foreground mt-2">Selecione uma empresa para continuar.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Revendedores e Centros de Estoque</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie locais de estoque, revendedores e acompanhe a prestação de contas.
        </p>
      </div>
      <Tabs defaultValue="locations">
        <TabsList>
          <TabsTrigger value="locations">Centros de Estoque</TabsTrigger>
          <TabsTrigger value="resellers">Revendedores</TabsTrigger>
          <TabsTrigger value="settlement">Prestação de Contas</TabsTrigger>
        </TabsList>
        <TabsContent value="locations" className="mt-4">
          <LocationsTab companyId={selected} />
        </TabsContent>
        <TabsContent value="resellers" className="mt-4">
          <ResellersTab companyId={selected} />
        </TabsContent>
        <TabsContent value="settlement" className="mt-4">
          <SettlementTab companyId={selected} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============= Centros de Estoque =============

function LocationsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocationRow | null>(null);
  const [form, setForm] = useState({ nome: "", tipo: "principal" as LocType, responsavel: "", ativa: true, is_default: false });

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["stock-locations-admin", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_locations")
        .select("id, nome, tipo, responsavel, ativa, is_default")
        .eq("company_id", companyId)
        .order("is_default", { ascending: false })
        .order("nome");
      return (data ?? []) as StockLocationRow[];
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ nome: "", tipo: "principal", responsavel: "", ativa: true, is_default: false });
    setOpen(true);
  }
  function openEdit(row: StockLocationRow) {
    setEditing(row);
    setForm({ nome: row.nome, tipo: row.tipo, responsavel: row.responsavel ?? "", ativa: row.ativa, is_default: row.is_default });
    setOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    try {
      if (form.is_default) {
        // garante único default por empresa
        await supabase.from("stock_locations").update({ is_default: false }).eq("company_id", companyId).neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      }
      let locationId = editing?.id ?? null;
      if (editing) {
        const { error } = await supabase.from("stock_locations").update({
          nome: form.nome, tipo: form.tipo, responsavel: form.responsavel || null, ativa: form.ativa, is_default: form.is_default,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase.from("stock_locations").insert({
          company_id: companyId, nome: form.nome, tipo: form.tipo, responsavel: form.responsavel || null, ativa: form.ativa, is_default: form.is_default,
        }).select("id").single();
        if (error) throw error;
        locationId = ins?.id ?? null;
      }
      // Se o centro for do tipo "revendedor", garante um registro na aba Revendedores vinculado a ele
      if (form.tipo === "revendedor" && locationId) {
        const { data: existing } = await supabase.from("resellers").select("id").eq("company_id", companyId).eq("stock_location_id", locationId).maybeSingle();
        if (!existing) {
          await supabase.from("resellers").insert({
            company_id: companyId, nome: form.nome, stock_location_id: locationId,
            commission_pct: 0, ativo: form.ativa,
          });
          toast.success("Revendedor criado automaticamente");
        }
      }
      toast.success("Centro de estoque salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["stock-locations-admin", companyId] });
      qc.invalidateQueries({ queryKey: ["stock-locations", companyId] });
      qc.invalidateQueries({ queryKey: ["resellers-admin", companyId] });
      qc.invalidateQueries({ queryKey: ["resellers", companyId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  }

  async function remove(row: StockLocationRow) {
    if (row.is_default) { toast.error("Não é possível excluir o centro padrão da empresa."); return; }
    // Verifica uso: movimentos de estoque e revendedores vinculados
    const [{ count: movCount }, { count: resCount }] = await Promise.all([
      supabase.from("stock_movements").select("id", { count: "exact", head: true }).eq("stock_location_id", row.id),
      supabase.from("resellers").select("id", { count: "exact", head: true }).eq("stock_location_id", row.id).is("deleted_at", null),
    ]);
    if ((movCount ?? 0) > 0 || (resCount ?? 0) > 0) {
      toast.error(
        `Centro "${row.nome}" está em uso (${movCount ?? 0} movimento(s), ${resCount ?? 0} revendedor(es)). Transfira o estoque e remova os vínculos antes de excluir.`,
      );
      return;
    }
    if (!window.confirm(`Excluir o centro "${row.nome}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("stock_locations").update({ deleted_at: new Date().toISOString(), ativa: false }).eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Centro excluído");
    qc.invalidateQueries({ queryKey: ["stock-locations-admin", companyId] });
    qc.invalidateQueries({ queryKey: ["stock-locations", companyId] });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <TransferDialog companyId={companyId} locations={locations} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="size-4" /> Novo centro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar centro" : "Novo centro de estoque"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as LocType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LOCATION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativa} onChange={(e) => setForm({ ...form, ativa: e.target.checked })} /> Ativo</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Padrão da empresa</label>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Responsável</TableHead><TableHead>Status</TableHead><TableHead className="w-44 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow> :
              locations.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum centro cadastrado.</TableCell></TableRow> :
              locations.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.nome} {l.is_default && <span className="text-xs text-muted-foreground">(padrão)</span>}</TableCell>
                  <TableCell>{l.tipo}</TableCell>
                  <TableCell>{l.responsavel ?? "-"}</TableCell>
                  <TableCell>{l.ativa ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell className="text-right">
                    <StockViewDialog companyId={companyId} location={l} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(l)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(l)}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============= Revendedores =============

function ResellersTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ResellerRow | null>(null);
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", documento: "", stock_location_id: "", commission_pct: "0", ativo: true });

  const { data: locations = [] } = useQuery({
    queryKey: ["stock-locations-for-reseller", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("stock_locations").select("id, nome, tipo").eq("company_id", companyId).eq("ativa", true).is("deleted_at", null).order("nome");
      return data ?? [];
    },
  });

  const { data: resellers = [], isLoading } = useQuery({
    queryKey: ["resellers-admin", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("resellers").select("id, nome, email, telefone, documento, stock_location_id, commission_pct, ativo").eq("company_id", companyId).is("deleted_at", null).order("nome");
      return (data ?? []) as ResellerRow[];
    },
  });

  function openCreate() {
    setEditing(null);
    setForm({ nome: "", email: "", telefone: "", documento: "", stock_location_id: "", commission_pct: "0", ativo: true });
    setOpen(true);
  }
  function openEdit(r: ResellerRow) {
    setEditing(r);
    setForm({ nome: r.nome, email: r.email ?? "", telefone: r.telefone ?? "", documento: r.documento ?? "", stock_location_id: r.stock_location_id ?? "", commission_pct: String(r.commission_pct ?? 0), ativo: r.ativo });
    setOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) { toast.error("Informe o nome"); return; }
    const payload = {
      company_id: companyId, nome: form.nome, email: form.email || null, telefone: form.telefone || null,
      documento: form.documento || null, stock_location_id: form.stock_location_id || null,
      commission_pct: Number(form.commission_pct) || 0, ativo: form.ativo,
    };
    try {
      if (editing) {
        const { company_id, ...rest } = payload;
        const { error } = await supabase.from("resellers").update(rest).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("resellers").insert(payload);
        if (error) throw error;
      }
      toast.success("Revendedor salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["resellers-admin", companyId] });
      qc.invalidateQueries({ queryKey: ["resellers", companyId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function remove(r: ResellerRow) {
    if (!window.confirm(`Excluir revendedor "${r.nome}"?`)) return;
    const { error } = await supabase.from("resellers").update({ deleted_at: new Date().toISOString(), ativo: false }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["resellers-admin", companyId] });
    qc.invalidateQueries({ queryKey: ["resellers", companyId] });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={openCreate}><Plus className="size-4" /> Novo revendedor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar revendedor" : "Novo revendedor"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>E-mail</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              </div>
              <div><Label>CPF/CNPJ</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
              <div>
                <Label>Centro de estoque vinculado</Label>
                <Select value={form.stock_location_id || "__none__"} onValueChange={(v) => setForm({ ...form, stock_location_id: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem vínculo</SelectItem>
                    {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.nome} ({l.tipo})</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Vendas com este revendedor sugerem este local automaticamente.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Comissão (%)</Label><Input type="number" min="0" step="0.01" value={form.commission_pct} onChange={(e) => setForm({ ...form, commission_pct: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm self-end pb-2"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativo</label>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Centro vinculado</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead className="w-28 text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow> :
              resellers.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum revendedor cadastrado.</TableCell></TableRow> :
              resellers.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell>{locations.find((l) => l.id === r.stock_location_id)?.nome ?? "-"}</TableCell>
                  <TableCell>{Number(r.commission_pct)}%</TableCell>
                  <TableCell>{r.ativo ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ============= Prestação de Contas =============

type PeriodPreset = "mes" | "90d" | "ano" | "tudo";

function periodRange(preset: PeriodPreset): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const to = iso(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  if (preset === "mes") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  if (preset === "90d") return { from: iso(new Date(Date.now() - 90 * 86400000)), to };
  if (preset === "ano") return { from: iso(new Date(now.getFullYear(), 0, 1)), to };
  return { from: "1900-01-01", to: "2999-12-31" };
}

function SettlementTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const initial = periodRange("mes");
  const [resellerId, setResellerId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [dateBasis, setDateBasis] = useState<"venda" | "vencimento">("venda");
  const [fixing, setFixing] = useState<string | null>(null);

  const applyPreset = (p: PeriodPreset) => {
    const r = periodRange(p);
    setDateFrom(r.from);
    setDateTo(r.to);
  };

  const { data: resellers = [] } = useQuery({
    queryKey: ["resellers-settlement", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("resellers").select("id, nome, stock_location_id, commission_pct").eq("company_id", companyId).eq("ativo", true).is("deleted_at", null).order("nome");
      return (data ?? []) as Array<{ id: string; nome: string; stock_location_id: string | null; commission_pct: number }>;
    },
  });

  const reseller = resellers.find((r) => r.id === resellerId) ?? null;
  const locationId = reseller?.stock_location_id ?? null;

  const { data: movs = [] } = useQuery({
    queryKey: ["reseller-movements", companyId, locationId, dateFrom, dateTo],
    enabled: !!locationId,
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_movements")
        .select("id, product_id, quantidade, tipo, motivo, custo_unitario, data, products(nome, preco_venda)")
        .eq("company_id", companyId)
        .eq("stock_location_id", locationId!)
        .is("deleted_at", null)
        .gte("data", dateFrom)
        .lte("data", dateTo)
        .order("data", { ascending: true });
      return (data ?? []) as Array<{
        id: string; product_id: string; quantidade: number; tipo: "entrada" | "saida";
        motivo: string | null; custo_unitario: number | null; data: string;
        products: { nome: string; preco_venda: number } | null;
      }>;
    },
  });

  const { data: commissions = [] } = useQuery({
    queryKey: ["reseller-commissions", companyId, resellerId, dateFrom, dateTo, dateBasis],
    enabled: !!resellerId,
    queryFn: async () => {
      const recQuery = supabase
        .from("receivables")
        .select("id, valor, commission_value, vencimento, created_at, descricao")
        .eq("company_id", companyId).eq("reseller_id", resellerId).is("deleted_at", null);
      const recFiltered = dateBasis === "venda"
        ? recQuery.gte("created_at", `${dateFrom}T00:00:00`).lte("created_at", `${dateTo}T23:59:59`)
        : recQuery.gte("vencimento", dateFrom).lte("vencimento", dateTo);

      const [tx, rec] = await Promise.all([
        supabase.from("transactions").select("id, valor, commission_value, data, descricao").eq("company_id", companyId).eq("reseller_id", resellerId).is("deleted_at", null).gte("data", dateFrom).lte("data", dateTo),
        recFiltered,
      ]);
      return [
        ...(tx.data ?? []).map((t) => ({ id: t.id, valor: Number(t.valor) || 0, comissao: Number(t.commission_value) || 0, data: t.data, descricao: t.descricao ?? "", kind: "À vista" })),
        ...((rec.data ?? []) as any[]).map((r) => ({
          id: r.id, valor: Number(r.valor) || 0, comissao: Number(r.commission_value) || 0,
          data: dateBasis === "venda" ? String(r.created_at).slice(0, 10) : r.vencimento,
          descricao: r.descricao ?? "", kind: "A prazo",
        })),
      ].sort((a, b) => a.data.localeCompare(b.data));
    },
  });

  // ===== Conferência de integridade (não depende do período) =====
  const { data: audit } = useQuery({
    queryKey: ["reseller-audit", companyId, resellerId, locationId],
    enabled: !!resellerId && !!locationId,
    queryFn: async () => {
      const { data: movRows } = await supabase
        .from("stock_movements")
        .select("related_sale_id, related_sale_type")
        .eq("company_id", companyId)
        .eq("stock_location_id", locationId!)
        .eq("tipo", "saida")
        .is("deleted_at", null)
        .not("related_sale_id", "is", null);

      const vistaIds = Array.from(new Set((movRows ?? []).filter((m: any) => m.related_sale_type === "vista").map((m: any) => m.related_sale_id as string)));
      const prazoIds = Array.from(new Set((movRows ?? []).filter((m: any) => m.related_sale_type === "prazo").map((m: any) => m.related_sale_id as string)));

      const [txAll, recAll, txMine, recMine] = await Promise.all([
        vistaIds.length
          ? supabase.from("transactions").select("id, data, os_code, descricao, valor, reseller_id").in("id", vistaIds).is("deleted_at", null)
          : Promise.resolve({ data: [] as any[] }),
        prazoIds.length
          ? supabase.from("receivables").select("id, vencimento, created_at, os_code, descricao, valor, reseller_id").in("id", prazoIds).is("deleted_at", null)
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("transactions").select("id, data, os_code, descricao, valor").eq("company_id", companyId).eq("reseller_id", resellerId).is("deleted_at", null),
        supabase.from("receivables").select("id, vencimento, created_at, os_code, descricao, valor").eq("company_id", companyId).eq("reseller_id", resellerId).is("deleted_at", null),
      ]);

      const orphans = [
        ...((txAll.data ?? []) as any[]).filter((t) => t.reseller_id !== resellerId).map((t) => ({
          id: t.id as string, kind: "vista" as const, data: t.data as string,
          os: (t.os_code as string) ?? "-", descricao: (t.descricao as string) ?? "", valor: Number(t.valor) || 0,
        })),
        ...((recAll.data ?? []) as any[]).filter((r) => r.reseller_id !== resellerId).map((r) => ({
          id: r.id as string, kind: "prazo" as const, data: String(r.created_at).slice(0, 10),
          os: (r.os_code as string) ?? "-", descricao: (r.descricao as string) ?? "", valor: Number(r.valor) || 0,
        })),
      ].sort((a, b) => a.data.localeCompare(b.data));

      const vistaSet = new Set(vistaIds);
      const prazoSet = new Set(prazoIds);
      const semMovimento = [
        ...((txMine.data ?? []) as any[]).filter((t) => !vistaSet.has(t.id)).map((t) => ({
          id: t.id as string, kind: "À vista", data: t.data as string, os: (t.os_code as string) ?? "-",
          descricao: (t.descricao as string) ?? "", valor: Number(t.valor) || 0,
        })),
        ...((recMine.data ?? []) as any[]).filter((r) => !prazoSet.has(r.id)).map((r) => ({
          id: r.id as string, kind: "A prazo", data: String(r.created_at).slice(0, 10), os: (r.os_code as string) ?? "-",
          descricao: (r.descricao as string) ?? "", valor: Number(r.valor) || 0,
        })),
      ].sort((a, b) => a.data.localeCompare(b.data));

      const atribuidasTotal =
        ((txMine.data ?? []) as any[]).reduce((a, t) => a + (Number(t.valor) || 0), 0) +
        ((recMine.data ?? []) as any[]).reduce((a, r) => a + (Number(r.valor) || 0), 0);
      const atribuidasQtd = ((txMine.data ?? []) as any[]).length + ((recMine.data ?? []) as any[]).length;

      return { orphans, semMovimento, atribuidasTotal, atribuidasQtd };
    },
  });

  const orphans = audit?.orphans ?? [];
  const semMovimento = audit?.semMovimento ?? [];
  const orphansTotal = orphans.reduce((a, o) => a + o.valor, 0);

  async function attachToReseller(o: { id: string; kind: "vista" | "prazo"; valor: number }) {
    if (!reseller) return;
    setFixing(o.id);
    const commission = Number(((o.valor * Number(reseller.commission_pct || 0)) / 100).toFixed(2));
    const table = o.kind === "vista" ? "transactions" : "receivables";
    const { error } = await supabase.from(table as any).update({ reseller_id: reseller.id, commission_value: commission }).eq("id", o.id);
    setFixing(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Venda atribuída a ${reseller.nome} · comissão ${formatMoney(commission)}`);
    qc.invalidateQueries({ queryKey: ["reseller-audit", companyId, resellerId, locationId] });
    qc.invalidateQueries({ queryKey: ["reseller-commissions"] });
  }

  const resumoProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; enviados: number; vendidos: number; devolvidos: number; transferidos: number; valorVendido: number }>();
    for (const m of movs) {
      const key = m.product_id;
      const cur = map.get(key) ?? { nome: m.products?.nome ?? "?", enviados: 0, vendidos: 0, devolvidos: 0, transferidos: 0, valorVendido: 0 };
      const q = Number(m.quantidade) || 0;
      const motivo = (m.motivo ?? "").toLowerCase();
      if (m.tipo === "entrada") cur.enviados += q;
      else if (m.tipo === "saida") {
        if (motivo.startsWith("devolu")) cur.devolvidos += q;
        else if (motivo.startsWith("transfer")) cur.transferidos += q;
        else if ((m.motivo ?? "") === "Venda") {
          cur.vendidos += q;
          cur.valorVendido += q * Number(m.products?.preco_venda ?? 0);
        } else {
          // outras saídas (ajustes, baixas) reduzem o saldo do centro
          cur.transferidos += q;
        }
      }
      map.set(key, cur);
    }
    // mantém somente produtos com qualquer movimentação no centro
    return Array.from(map.values())
      .filter((p) => p.enviados || p.vendidos || p.devolvidos || p.transferidos)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [movs]);

  const totalEnviados = resumoProdutos.reduce((a, b) => a + b.enviados, 0);
  const totalVendidos = resumoProdutos.reduce((a, b) => a + b.vendidos, 0);
  const totalDevolvidos = resumoProdutos.reduce((a, b) => a + b.devolvidos, 0);
  const totalTransferidos = resumoProdutos.reduce((a, b) => a + b.transferidos, 0);
  const totalEmPosse = totalEnviados - totalVendidos - totalDevolvidos - totalTransferidos;
  const totalVendidoValor = commissions.reduce((a, c) => a + c.valor, 0);
  const totalComissao = commissions.reduce((a, c) => a + c.comissao, 0);
  const liquido = totalVendidoValor - totalComissao;

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-4 gap-3">
        <div>
          <Label>Revendedor</Label>
          <Select value={resellerId || "__none__"} onValueChange={(v) => setResellerId(v === "__none__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione um revendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">—</SelectItem>
              {resellers.map((r) => <SelectItem key={r.id} value={r.id}>{r.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>De</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div><Label>Até</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <div>
          <Label>Base da data (a prazo)</Label>
          <Select value={dateBasis} onValueChange={(v) => setDateBasis(v as "venda" | "vencimento")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="venda">Data da venda</SelectItem>
              <SelectItem value="vencimento">Vencimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => applyPreset("mes")}>Mês atual</Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset("90d")}>Últimos 90 dias</Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset("ano")}>Ano</Button>
        <Button variant="outline" size="sm" onClick={() => applyPreset("tudo")}>Tudo</Button>
      </div>

      {!reseller ? (
        <p className="text-sm text-muted-foreground">Escolha um revendedor para ver a prestação de contas.</p>
      ) : !locationId ? (
        <p className="text-sm text-warning">Este revendedor não tem centro de estoque vinculado. Edite o cadastro na aba "Revendedores".</p>
      ) : (
        <>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => exportSettlementPDF({
              resellerNome: reseller.nome, dateFrom, dateTo,
              dateBasis: dateBasis === "venda" ? "Data da venda" : "Vencimento",
              totals: { totalEnviados, totalVendidos, totalDevolvidos, totalEmPosse, totalVendidoValor, totalComissao, liquido },
              produtos: resumoProdutos, commissions,
              conferencia: {
                atribuidasQtd: audit?.atribuidasQtd ?? 0,
                atribuidasTotal: audit?.atribuidasTotal ?? 0,
                orphans, semMovimento,
              },
            })}>Exportar PDF</Button>
          </div>

          {/* Conferência de integridade */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold">Conferência de integridade (histórico completo)</h3>
              <span className="text-xs text-muted-foreground">
                {audit?.atribuidasQtd ?? 0} vendas atribuídas · {formatMoney(audit?.atribuidasTotal ?? 0)}
              </span>
            </div>

            {orphans.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todas as vendas com saída do estoque deste revendedor estão atribuídas a ele.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-destructive font-medium">
                  {orphans.length} venda(s) saíram do estoque deste revendedor sem estar atribuídas a ele — total oculto de {formatMoney(orphansTotal)}.
                </p>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>OS</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                      {orphans.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell>{o.data}</TableCell>
                          <TableCell>{o.os}</TableCell>
                          <TableCell className="truncate max-w-[320px]">{o.descricao}</TableCell>
                          <TableCell className="text-right">{formatMoney(o.valor)}</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" disabled={fixing === o.id} onClick={() => attachToReseller(o)}>
                              {fixing === o.id ? "Atribuindo..." : "Atribuir ao revendedor"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {semMovimento.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-warning font-medium">
                  {semMovimento.length} venda(s) atribuídas sem baixa de estoque no centro deste revendedor (conferir)
                </summary>
                <div className="border rounded-lg mt-2">
                  <Table>
                    <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>OS</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {semMovimento.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.data}</TableCell>
                          <TableCell>{s.kind}</TableCell>
                          <TableCell>{s.os}</TableCell>
                          <TableCell className="truncate max-w-[320px]">{s.descricao}</TableCell>
                          <TableCell className="text-right">{formatMoney(s.valor)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card label="Enviados" value={totalEnviados.toString()} />
            <Card label="Vendidos" value={totalVendidos.toString()} />
            <Card label="Devolvidos" value={totalDevolvidos.toString()} />
            <Card label="Em posse" value={totalEmPosse.toString()} highlight />
            <Card label="Valor vendido (período)" value={formatMoney(totalVendidoValor)} />
            <Card label="Comissão" value={formatMoney(totalComissao)} />
            <Card label="Líquido para empresa" value={formatMoney(liquido)} highlight />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Produtos no centro do revendedor</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Enviados</TableHead><TableHead className="text-right">Vendidos</TableHead><TableHead className="text-right">Devolvidos</TableHead><TableHead className="text-right">Transf./Saídas</TableHead><TableHead className="text-right">Em posse</TableHead><TableHead className="text-right">Valor vendido</TableHead></TableRow></TableHeader>
                <TableBody>
                  {resumoProdutos.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Sem movimentações no período.</TableCell></TableRow> :
                    resumoProdutos.map((p) => (
                      <TableRow key={p.nome}>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-right">{p.enviados}</TableCell>
                        <TableCell className="text-right">{p.vendidos}</TableCell>
                        <TableCell className="text-right">{p.devolvidos}</TableCell>
                        <TableCell className="text-right">{p.transferidos}</TableCell>
                        <TableCell className="text-right font-semibold">{p.enviados - p.vendidos - p.devolvidos - p.transferidos}</TableCell>
                        <TableCell className="text-right">{formatMoney(p.valorVendido)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Vendas atribuídas ao revendedor</h3>
            <div className="border rounded-lg">
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Comissão</TableHead></TableRow></TableHeader>
                <TableBody>
                  {commissions.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem vendas atribuídas no período.</TableCell></TableRow> :
                    commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.data}</TableCell>
                        <TableCell>{c.kind}</TableCell>
                        <TableCell className="truncate max-w-[400px]">{c.descricao}</TableCell>
                        <TableCell className="text-right">{formatMoney(c.valor)}</TableCell>
                        <TableCell className="text-right">{formatMoney(c.comissao)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function Card({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`border rounded-lg p-3 ${highlight ? "bg-accent/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

// ============= Visualizar estoque de um centro =============

function StockViewDialog({ companyId, location }: { companyId: string; location: StockLocationRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ product_id: string; nome: string; saldo: number } | null>(null);
  const [novaQtd, setNovaQtd] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["location-stock", companyId, location.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("product_id, quantidade, tipo, products(nome, preco_venda, custo_unitario)")
        .eq("company_id", companyId)
        .eq("stock_location_id", location.id)
        .is("deleted_at", null);
      if (error) throw error;
      const map = new Map<string, { product_id: string; nome: string; saldo: number; preco_venda: number; custo: number }>();
      for (const m of (data ?? []) as Array<{ product_id: string; quantidade: number; tipo: string; products: { nome: string; preco_venda: number; custo_unitario: number } | null }>) {
        const cur = map.get(m.product_id) ?? { product_id: m.product_id, nome: m.products?.nome ?? "?", saldo: 0, preco_venda: Number(m.products?.preco_venda ?? 0), custo: Number(m.products?.custo_unitario ?? 0) };
        const q = Number(m.quantidade) || 0;
        cur.saldo += m.tipo === "entrada" ? q : -q;
        map.set(m.product_id, cur);
      }
      return Array.from(map.values()).filter((r) => r.saldo !== 0).sort((a, b) => a.nome.localeCompare(b.nome));
    },
  });

  const totalItens = rows.reduce((a, r) => a + r.saldo, 0);
  const valorEstoque = rows.reduce((a, r) => a + r.saldo * r.custo, 0);

  async function handleSaveAdjust() {
    if (!editing) return;
    const nova = Number(novaQtd);
    if (isNaN(nova) || nova < 0) { toast.error("Quantidade inválida"); return; }
    const diff = nova - editing.saldo;
    if (diff === 0) { setEditing(null); return; }
    setSaving(true);
    const { error } = await supabase.from("stock_movements").insert({
      company_id: companyId,
      product_id: editing.product_id,
      stock_location_id: location.id,
      tipo: diff > 0 ? "entrada" : "saida",
      quantidade: Math.abs(diff),
      motivo: `Ajuste manual · ${location.nome}`,
      data: new Date().toISOString().slice(0, 10),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Estoque ajustado");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["location-stock", companyId, location.id] });
    qc.invalidateQueries({ queryKey: ["estoque-products"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" title="Ver estoque"><Boxes className="size-4" /></Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Estoque · {location.nome}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mb-2">
          <Card label="Itens em estoque" value={String(totalItens)} />
          <Card label="Valor (a custo)" value={formatMoney(valorEstoque)} />
        </div>
        <div className="border rounded-lg max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Produto</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead className="text-right">Custo unit.</TableHead><TableHead className="text-right">Preço venda</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow> :
                rows.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum produto neste centro.</TableCell></TableRow> :
                rows.map((r) => (
                  <TableRow key={r.product_id}>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-right font-semibold">{r.saldo}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.custo)}</TableCell>
                    <TableCell className="text-right">{formatMoney(r.preco_venda)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" title="Ajustar saldo" onClick={() => { setEditing({ product_id: r.product_id, nome: r.nome, saldo: r.saldo }); setNovaQtd(String(r.saldo)); }}>
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Ajustar estoque · {editing?.nome}</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Nova quantidade</Label>
              <Input type="number" min="0" value={novaQtd} onChange={(e) => setNovaQtd(e.target.value)} />
              <p className="text-xs text-muted-foreground">Saldo atual: {editing?.saldo}. A diferença será registrada como entrada ou saída neste centro.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleSaveAdjust} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ============= Transferência entre centros =============

function TransferDialog({ companyId, locations }: { companyId: string; locations: StockLocationRow[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [origemId, setOrigemId] = useState("");
  const [destinoId, setDestinoId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-transfer", companyId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, nome").eq("company_id", companyId).is("deleted_at", null).order("nome");
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  const { data: saldo = 0 } = useQuery({
    queryKey: ["transfer-balance", productId, origemId],
    enabled: !!productId && !!origemId,
    queryFn: async () => {
      const { data } = await supabase.rpc("product_stock_by_location", { _product_id: productId, _location_id: origemId });
      return Number(data ?? 0);
    },
  });

  async function transfer() {
    if (!origemId || !destinoId || !productId || !quantidade) { toast.error("Preencha todos os campos"); return; }
    if (origemId === destinoId) { toast.error("Origem e destino devem ser diferentes"); return; }
    const q = Number(quantidade);
    if (!Number.isFinite(q) || q <= 0) { toast.error("Quantidade inválida"); return; }
    if (q > saldo) { toast.error(`Saldo insuficiente na origem (${saldo}).`); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const motivo = `Transferência${obs ? ` - ${obs}` : ""}`;
      const { error: e1 } = await supabase.from("stock_movements").insert({
        company_id: companyId, product_id: productId, tipo: "saida", quantidade: q, motivo, stock_location_id: origemId, data: today,
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("stock_movements").insert({
        company_id: companyId, product_id: productId, tipo: "entrada", quantidade: q, motivo, stock_location_id: destinoId, data: today,
      });
      if (e2) throw e2;
      toast.success("Transferência concluída");
      setOpen(false);
      setOrigemId(""); setDestinoId(""); setProductId(""); setQuantidade(""); setObs("");
      qc.invalidateQueries({ queryKey: ["reseller-movements"] });
      qc.invalidateQueries({ queryKey: ["transfer-balance"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Transferir estoque</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Transferência entre centros de estoque</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Origem</Label>
              <Select value={origemId} onValueChange={setOrigemId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locations.filter((l) => l.ativa).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locations.filter((l) => l.ativa).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Produto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
            {productId && origemId && <p className="text-xs text-muted-foreground mt-1">Saldo na origem: <b>{saldo}</b></p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantidade</Label><Input type="number" min="0" step="any" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></div>
            <div><Label>Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="opcional" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={transfer} disabled={saving}>{saving ? "Transferindo..." : "Confirmar transferência"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============= Exportar PDF (via janela de impressão) =============

type SettlementExport = {
  resellerNome: string; dateFrom: string; dateTo: string; dateBasis: string;
  totals: { totalEnviados: number; totalVendidos: number; totalDevolvidos: number; totalEmPosse: number; totalVendidoValor: number; totalComissao: number; liquido: number };
  produtos: Array<{ nome: string; enviados: number; vendidos: number; devolvidos: number; valorVendido: number }>;
  commissions: Array<{ id: string; valor: number; comissao: number; data: string; descricao: string; kind: string }>;
  conferencia: {
    atribuidasQtd: number;
    atribuidasTotal: number;
    orphans: Array<{ id: string; data: string; os: string; descricao: string; valor: number }>;
    semMovimento: Array<{ id: string; data: string; kind: string; os: string; descricao: string; valor: number }>;
  };
};

function exportSettlementPDF(s: SettlementExport) {
  const fmt = (n: number) => formatMoney(n);
  const rowsProd = s.produtos.map((p) => `<tr><td>${p.nome}</td><td style="text-align:right">${p.enviados}</td><td style="text-align:right">${p.vendidos}</td><td style="text-align:right">${p.devolvidos}</td><td style="text-align:right"><b>${p.enviados - p.vendidos - p.devolvidos}</b></td><td style="text-align:right">${fmt(p.valorVendido)}</td></tr>`).join("");
  const rowsCom = s.commissions.map((c) => `<tr><td>${c.data}</td><td>${c.kind}</td><td>${c.descricao}</td><td style="text-align:right">${fmt(c.valor)}</td><td style="text-align:right">${fmt(c.comissao)}</td></tr>`).join("");
  const orphansTotal = s.conferencia.orphans.reduce((a, o) => a + o.valor, 0);
  const rowsOrphans = s.conferencia.orphans.map((o) => `<tr><td>${o.data}</td><td>${o.os}</td><td>${o.descricao}</td><td style="text-align:right">${fmt(o.valor)}</td></tr>`).join("");
  const rowsSemMov = s.conferencia.semMovimento.map((o) => `<tr><td>${o.data}</td><td>${o.kind}</td><td>${o.os}</td><td>${o.descricao}</td><td style="text-align:right">${fmt(o.valor)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Prestação de contas - ${s.resellerNome}</title>
  <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{margin:0 0 4px}h2{margin:24px 0 8px;font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #ddd;padding:6px 8px}th{background:#f5f5f5;text-align:left}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.card{border:1px solid #ddd;border-radius:6px;padding:8px}.card .l{font-size:10px;color:#666}.card .v{font-size:16px;font-weight:700}.warn{color:#a33;font-size:12px;margin:4px 0}</style>
  </head><body>
  <h1>Prestação de Contas</h1>
  <div>Revendedor: <b>${s.resellerNome}</b> · Período: ${s.dateFrom} a ${s.dateTo} · Base da data: ${s.dateBasis}</div>
  <div class="cards">
    <div class="card"><div class="l">Enviados</div><div class="v">${s.totals.totalEnviados}</div></div>
    <div class="card"><div class="l">Vendidos</div><div class="v">${s.totals.totalVendidos}</div></div>
    <div class="card"><div class="l">Devolvidos</div><div class="v">${s.totals.totalDevolvidos}</div></div>
    <div class="card"><div class="l">Em posse</div><div class="v">${s.totals.totalEmPosse}</div></div>
    <div class="card"><div class="l">Valor vendido</div><div class="v">${fmt(s.totals.totalVendidoValor)}</div></div>
    <div class="card"><div class="l">Comissão</div><div class="v">${fmt(s.totals.totalComissao)}</div></div>
    <div class="card"><div class="l">Líquido empresa</div><div class="v">${fmt(s.totals.liquido)}</div></div>
  </div>
  <h2>Conferência de integridade (histórico completo)</h2>
  <div style="font-size:12px">Vendas atribuídas ao revendedor: <b>${s.conferencia.atribuidasQtd}</b> · Total <b>${fmt(s.conferencia.atribuidasTotal)}</b></div>
  ${s.conferencia.orphans.length
    ? `<div class="warn">${s.conferencia.orphans.length} venda(s) saíram do estoque do revendedor sem atribuição — total oculto ${fmt(orphansTotal)}</div>
       <table><thead><tr><th>Data</th><th>OS</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead><tbody>${rowsOrphans}</tbody></table>`
    : `<div style="font-size:12px;color:#2a6">Todas as vendas com saída do estoque estão atribuídas ao revendedor.</div>`}
  ${s.conferencia.semMovimento.length
    ? `<div class="warn">${s.conferencia.semMovimento.length} venda(s) atribuídas sem baixa de estoque no centro do revendedor (conferir)</div>
       <table><thead><tr><th>Data</th><th>Tipo</th><th>OS</th><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead><tbody>${rowsSemMov}</tbody></table>`
    : ""}
  <h2>Produtos no centro do revendedor</h2>
  <table><thead><tr><th>Produto</th><th style="text-align:right">Enviados</th><th style="text-align:right">Vendidos</th><th style="text-align:right">Devolvidos</th><th style="text-align:right">Em posse</th><th style="text-align:right">Valor vendido</th></tr></thead><tbody>${rowsProd || '<tr><td colspan="6" style="text-align:center;color:#666">Sem movimentações</td></tr>'}</tbody></table>
  <h2>Vendas atribuídas</h2>
  <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th style="text-align:right">Valor</th><th style="text-align:right">Comissão</th></tr></thead><tbody>${rowsCom || '<tr><td colspan="5" style="text-align:center;color:#666">Sem vendas</td></tr>'}</tbody></table>

  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) { toast.error("Permita pop-ups para exportar"); return; }
  w.document.write(html); w.document.close();
}

