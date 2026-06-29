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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";

export const Route = createFileRoute("/app/correcao-os")({ component: CorrecaoOSPage });

type Sale = {
  id: string;
  tipo: "vista" | "prazo";
  os_code: string;
  cliente: string;
  data: string;
  valor: number;
  status: string | null;
  loc_ids: string[];
};

function CorrecaoOSPage() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [chosenLoc, setChosenLoc] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [fCliente, setFCliente] = useState("");
  const [fTipo, setFTipo] = useState<"todos" | "vista" | "prazo">("todos");
  const [fOs, setFOs] = useState("");
  const [fDataIni, setFDataIni] = useState("");
  const [fDataFim, setFDataFim] = useState("");
  const [fSemCentro, setFSemCentro] = useState(true);
  const [confirmFallback, setConfirmFallback] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [previewBatch, setPreviewBatch] = useState<Array<Sale & { newOs: string; locName: string }> | null>(null);

  const { data: locations = [] } = useQuery({
    queryKey: ["stock-locations", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_locations")
        .select("id, nome")
        .eq("company_id", selected!)
        .order("nome");
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  const { data: sales = [], refetch } = useQuery({
    queryKey: ["correcao-os-sales", selected],
    enabled: !!selected,
    queryFn: async () => {
      const [vista, prazo, mov] = await Promise.all([
        supabase.from("transactions").select("id, os_code, descricao, data, valor, status, company_id")
          .eq("company_id", selected!).is("deleted_at", null).not("os_code", "is", null),
        supabase.from("receivables").select("id, os_code, cliente, vencimento, valor, status, company_id")
          .eq("company_id", selected!).is("deleted_at", null).not("os_code", "is", null),
        supabase.from("stock_movements").select("related_sale_id, related_sale_type, stock_location_id")
          .eq("company_id", selected!).is("deleted_at", null).not("related_sale_id", "is", null),
      ]);
      const locsBySale = new Map<string, Set<string>>();
      (mov.data ?? []).forEach((m: any) => {
        if (!m.related_sale_id || !m.stock_location_id) return;
        const key = `${m.related_sale_type}:${m.related_sale_id}`;
        if (!locsBySale.has(key)) locsBySale.set(key, new Set());
        locsBySale.get(key)!.add(m.stock_location_id);
      });

      const rows: Sale[] = [];
      (vista.data ?? []).forEach((t: any) => {
        const set = locsBySale.get(`vista:${t.id}`);
        rows.push({
          id: t.id, tipo: "vista", os_code: t.os_code,
          cliente: t.descricao ?? "", data: t.data, valor: Number(t.valor),
          status: t.status, loc_ids: set ? Array.from(set) : [],
        });
      });
      (prazo.data ?? []).forEach((r: any) => {
        const set = locsBySale.get(`prazo:${r.id}`);
        rows.push({
          id: r.id, tipo: "prazo", os_code: r.os_code,
          cliente: r.cliente ?? "", data: r.vencimento, valor: Number(r.valor),
          status: r.status, loc_ids: set ? Array.from(set) : [],
        });
      });

      // restringe a vendas duplicadas (mesmo os_code aparece mais de 1x)
      const counts = new Map<string, number>();
      rows.forEach((r) => counts.set(r.os_code, (counts.get(r.os_code) ?? 0) + 1));
      return rows.filter((r) => (counts.get(r.os_code) ?? 0) > 1);
    },
  });

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (fSemCentro && s.loc_ids.length > 0) return false;
      if (!fSemCentro && s.loc_ids.length === 0) return false;
      if (fTipo !== "todos" && s.tipo !== fTipo) return false;
      if (fCliente && !(s.cliente || "").toLowerCase().includes(fCliente.toLowerCase())) return false;
      if (fOs && !s.os_code.toLowerCase().includes(fOs.toLowerCase())) return false;
      if (fDataIni && s.data < fDataIni) return false;
      if (fDataFim && s.data > fDataFim) return false;
      return true;
    });
  }, [sales, fSemCentro, fTipo, fCliente, fOs, fDataIni, fDataFim]);

  const prefixOf = (locId: string | undefined) => {
    if (!locId) return "V";
    const nome = locations.find((l) => l.id === locId)?.nome ?? "";
    const letter = nome.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase();
    return letter || "V";
  };

  async function generateNextOs(prefix: string): Promise<string> {
    if (!selected) throw new Error("Empresa não selecionada");
    const [t, r] = await Promise.all([
      supabase.from("transactions").select("os_code").eq("company_id", selected).is("deleted_at", null).ilike("os_code", `${prefix}%`),
      supabase.from("receivables").select("os_code").eq("company_id", selected).is("deleted_at", null).ilike("os_code", `${prefix}%`),
    ]);
    const seqs = [...(t.data ?? []), ...(r.data ?? [])]
      .map((x: any) => parseInt(String(x.os_code).replace(/^[A-Za-z]+/, ""), 10))
      .filter((n) => Number.isFinite(n));
    const max = seqs.length ? Math.max(...seqs) : 0;
    return `${prefix}${String(max + 1).padStart(4, "0")}`;
  }

  async function buildPreview(rows: Sale[]) {
    const previews: Array<Sale & { newOs: string; locName: string }> = [];
    const counters: Record<string, number> = {};
    // pré-carrega max atuais por prefixo distinto
    const prefixes = Array.from(new Set(rows.map((r) => prefixOf(chosenLoc[r.id]))));
    for (const p of prefixes) {
      const next = await generateNextOs(p);
      counters[p] = parseInt(next.replace(/^[A-Za-z]+/, ""), 10);
    }
    for (const r of rows) {
      const locId = chosenLoc[r.id];
      const prefix = prefixOf(locId);
      const seq = counters[prefix]++;
      previews.push({
        ...r,
        newOs: `${prefix}${String(seq).padStart(4, "0")}`,
        locName: locations.find((l) => l.id === locId)?.nome ?? (prefix === "V" ? "(fallback V)" : "-"),
      });
    }
    return previews;
  }

  async function applyBatch() {
    if (!previewBatch) return;
    setApplying(true);
    let ok = 0, fail = 0;
    for (const row of previewBatch) {
      const { error } = await supabase.rpc("apply_os_renumbering", {
        _sale_id: row.id,
        _sale_type: row.tipo,
        _new_os_code: row.newOs,
        _stock_location_id: chosenLoc[row.id] ?? null,
        _reason: chosenLoc[row.id]
          ? "Correção manual — centro atribuído pelo usuário"
          : "Correção manual — fallback V aprovado pelo usuário",
      });
      if (error) { fail++; toast.error(`${row.os_code}: ${error.message}`); }
      else ok++;
    }
    setApplying(false);
    setPreviewBatch(null);
    setSelectedRows({});
    toast.success(`${ok} OS renumerada(s)${fail ? `, ${fail} falha(s)` : ""}`);
    refetch();
    qc.invalidateQueries({ queryKey: ["os-renumber-log"] });
  }

  async function startApplyOne(row: Sale) {
    if (!chosenLoc[row.id]) {
      setConfirmFallback(row.id);
      return;
    }
    const previews = await buildPreview([row]);
    setPreviewBatch(previews);
  }

  async function startApplySelected() {
    const rows = filtered.filter((r) => selectedRows[r.id]);
    if (rows.length === 0) { toast.info("Selecione ao menos uma venda."); return; }
    const semCentro = rows.filter((r) => !chosenLoc[r.id]);
    if (semCentro.length > 0) {
      toast.error(`${semCentro.length} venda(s) selecionada(s) sem centro escolhido. Atribua o centro ou confirme fallback V individualmente.`);
      return;
    }
    const previews = await buildPreview(rows);
    setPreviewBatch(previews);
  }

  async function confirmAndApplyFallback() {
    if (!confirmFallback) return;
    const row = filtered.find((r) => r.id === confirmFallback);
    setConfirmFallback(null);
    if (!row) return;
    const previews = await buildPreview([row]);
    setPreviewBatch(previews);
  }

  const { data: logEntries = [] } = useQuery({
    queryKey: ["os-renumber-log", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("os_renumbering_log")
        .select("id, source_type, source_id, old_os_code, new_os_code, stock_location_name, prefix_used, reason, created_at, reverted_at")
        .eq("company_id", selected!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  async function revert(logId: string) {
    if (!confirm("Reverter esta renumeração (voltar o os_code antigo)?")) return;
    const { error } = await supabase.rpc("revert_os_renumbering", { _log_id: logId });
    if (error) toast.error(error.message);
    else { toast.success("Renumeração revertida"); refetch(); qc.invalidateQueries({ queryKey: ["os-renumber-log"] }); }
  }

  const allChecked = filtered.length > 0 && filtered.every((r) => selectedRows[r.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Correção de Centro de Estoque das OSs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vendas com OS duplicada e sem centro de estoque vinculado. Atribua o centro correto para que a nova OS use o prefixo certo. Nada do estoque, financeiro ou itens é alterado — somente o <code>os_code</code>.
        </p>
      </div>

      <div className="bg-card border rounded-2xl p-4 grid gap-3 md:grid-cols-6">
        <div className="space-y-1 md:col-span-2">
          <Label>Cliente</Label>
          <Input value={fCliente} onChange={(e) => setFCliente(e.target.value)} placeholder="Buscar..." />
        </div>
        <div className="space-y-1">
          <Label>OS atual</Label>
          <Input value={fOs} onChange={(e) => setFOs(e.target.value)} placeholder="Ex: E0003" />
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={fTipo} onValueChange={(v) => setFTipo(v as typeof fTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="vista">À vista</SelectItem>
              <SelectItem value="prazo">A prazo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>De</Label>
          <Input type="date" value={fDataIni} onChange={(e) => setFDataIni(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Até</Label>
          <Input type="date" value={fDataFim} onChange={(e) => setFDataFim(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 md:col-span-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={fSemCentro} onCheckedChange={(v) => setFSemCentro(!!v)} />
            Mostrar apenas vendas sem centro
          </label>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} venda(s) listada(s)</span>
        </div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(v) => {
                const next: Record<string, boolean> = {};
                if (v) filtered.forEach((r) => (next[r.id] = true));
                setSelectedRows(next);
              }}
            />
            Selecionar todas as visíveis
          </label>
          <Button size="sm" onClick={startApplySelected} disabled={applying}>
            {applying && <Loader2 className="size-4 mr-1 animate-spin" />} Aplicar selecionadas
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="p-3 w-8"></th>
                <th className="text-left p-3">Tipo</th>
                <th className="text-left p-3">OS atual</th>
                <th className="text-left p-3">Cliente</th>
                <th className="text-left p-3">Data</th>
                <th className="text-right p-3">Valor</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Centro atual</th>
                <th className="text-left p-3 min-w-[220px]">Centro correto</th>
                <th className="text-right p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Nenhuma venda nos filtros atuais.</td></tr>
              ) : filtered.map((r) => {
                const locId = chosenLoc[r.id];
                const prefix = prefixOf(locId);
                return (
                  <tr key={`${r.tipo}:${r.id}`} className="border-t">
                    <td className="p-3">
                      <Checkbox
                        checked={!!selectedRows[r.id]}
                        onCheckedChange={(v) => setSelectedRows((s) => ({ ...s, [r.id]: !!v }))}
                      />
                    </td>
                    <td className="p-3"><Badge variant={r.tipo === "vista" ? "default" : "secondary"}>{r.tipo === "vista" ? "À vista" : "A prazo"}</Badge></td>
                    <td className="p-3 font-mono">{r.os_code}</td>
                    <td className="p-3 max-w-[260px] truncate">{r.cliente || "(sem descrição)"}</td>
                    <td className="p-3">{r.data}</td>
                    <td className="p-3 text-right">{formatMoney(r.valor)}</td>
                    <td className="p-3">{r.status ?? "-"}</td>
                    <td className="p-3 text-muted-foreground">
                      {r.loc_ids.length === 0 ? <span className="italic">sem centro</span>
                        : r.loc_ids.map((id) => locations.find((l) => l.id === id)?.nome ?? id).join(", ")}
                    </td>
                    <td className="p-3">
                      <Select value={locId ?? ""} onValueChange={(v) => setChosenLoc((s) => ({ ...s, [r.id]: v }))}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Selecionar centro" /></SelectTrigger>
                        <SelectContent>
                          {locations.map((l) => (
                            <SelectItem key={l.id} value={l.id}>{l.nome} ({prefixOf(l.id)})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Nova OS prefixo: <b>{prefix}</b>{!locId && " (fallback V — requer confirmação)"}
                      </p>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => startApplyOne(r)} disabled={applying}>
                        Aplicar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="p-3 border-b font-medium">Histórico de renumerações</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Quando</th>
                <th className="text-left p-3">OS antiga → nova</th>
                <th className="text-left p-3">Centro</th>
                <th className="text-left p-3">Motivo</th>
                <th className="text-right p-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {logEntries.length === 0 ? (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem renumerações registradas ainda.</td></tr>
              ) : logEntries.map((l: any) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                  <td className="p-3 font-mono">{l.old_os_code} → {l.new_os_code}</td>
                  <td className="p-3">{l.stock_location_name ?? `(prefixo ${l.prefix_used})`}</td>
                  <td className="p-3 text-muted-foreground">{l.reason}</td>
                  <td className="p-3 text-right">
                    {l.reverted_at ? <span className="text-xs text-muted-foreground">revertido</span>
                      : <Button size="sm" variant="ghost" onClick={() => revert(l.id)}><Undo2 className="size-4 mr-1" /> Reverter</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!confirmFallback} onOpenChange={(o) => !o && setConfirmFallback(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="size-5 text-amber-500" /> Usar prefixo V (fallback)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta venda não possui centro de estoque identificado. Usar prefixo V pode não representar a origem real do produto. Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAndApplyFallback}>Confirmar fallback V</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!previewBatch} onOpenChange={(o) => !o && setPreviewBatch(null)}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Prévia da renumeração</AlertDialogTitle>
            <AlertDialogDescription>
              Será atualizado <b>apenas o campo os_code</b> das vendas abaixo. Estoque, itens, financeiro e valores permanecem inalterados. Confirma?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-[50vh] overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase sticky top-0">
                <tr>
                  <th className="text-left p-2">Cliente</th>
                  <th className="text-left p-2">OS atual → nova</th>
                  <th className="text-left p-2">Centro</th>
                  <th className="text-right p-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {(previewBatch ?? []).map((p) => (
                  <tr key={`${p.tipo}:${p.id}`} className="border-t">
                    <td className="p-2 max-w-[200px] truncate">{p.cliente || "—"}</td>
                    <td className="p-2 font-mono">{p.os_code} → {p.newOs}</td>
                    <td className="p-2">{p.locName}</td>
                    <td className="p-2 text-right">{formatMoney(p.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyBatch} disabled={applying}>
              {applying && <Loader2 className="size-4 mr-1 animate-spin" />} Confirmar e aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
