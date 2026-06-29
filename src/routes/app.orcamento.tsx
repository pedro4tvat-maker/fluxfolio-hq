import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/orcamento")({ component: OrcamentoPage });

function OrcamentoPage() {
  const { selected } = useSelectedCompany();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ categoria_id: "", valor_orcado: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["categories", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, nome, tipo")
        .eq("company_id", selected!)
        .order("nome");
      return data ?? [];
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["orcamento", selected, mes, ano],
    enabled: !!selected,
    queryFn: async () => {
      const start = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
      const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
      const [budgets, txs] = await Promise.all([
        supabase
          .from("budgets")
          .select("id, categoria_id, valor_orcado")
          .eq("company_id", selected!)
          .eq("mes", mes)
          .eq("ano", ano),
        supabase
          .from("transactions")
          .select("categoria_id, tipo, valor")
          .eq("company_id", selected!)
          .is("deleted_at", null)
          .gte("data", start)
          .lte("data", end),
      ]);
      return { budgets: budgets.data ?? [], txs: txs.data ?? [] };
    },
  });

  const rows = (data?.budgets ?? []).map((b) => {
    const cat = categories?.find((c) => c.id === b.categoria_id);
    const realizado = (data?.txs ?? [])
      .filter((t) => t.categoria_id === b.categoria_id)
      .reduce((s, t) => s + Number(t.valor), 0);
    const orcado = Number(b.valor_orcado);
    const pct = orcado > 0 ? (realizado / orcado) * 100 : 0;
    return { ...b, categoria: cat?.nome ?? "—", tipo: cat?.tipo, realizado, orcado, pct };
  });

  const totalOrcado = rows.reduce((s, r) => s + r.orcado, 0);
  const totalRealizado = rows.reduce((s, r) => s + r.realizado, 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !form.categoria_id || !form.valor_orcado) return;
    setSaving(true);
    const { error } = await supabase.from("budgets").insert({
      company_id: selected,
      mes, ano,
      categoria_id: form.categoria_id,
      valor_orcado: Number(form.valor_orcado),
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Orçamento criado");
      setOpen(false);
      setForm({ categoria_id: "", valor_orcado: "" });
      refetch();
    }
  }

  async function salvarEdicao(id: string) {
    const v = Number(editValue);
    if (!Number.isFinite(v) || v < 0) return;
    const { error } = await supabase.from("budgets").update({ valor_orcado: v }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Orçamento atualizado"); setEditingId(null); refetch(); }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este orçamento?")) return;
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Orçamento excluído"); refetch(); }
  }


  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold">Orçamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Orçado × realizado por categoria, com acompanhamento mensal.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <SelectItem key={m} value={String(m)}>{m.toString().padStart(2, "0")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Input type="number" className="w-24" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
          </div>
          <Button onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Novo orçamento"}</Button>
        </div>
      </div>

      {open && (
        <form onSubmit={save} className="bg-card border rounded-2xl p-4 grid gap-3 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2">
            <Label>Categoria</Label>
            <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} ({c.tipo})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor orçado</Label>
            <Input type="number" min="0" step="0.01" value={form.valor_orcado} onChange={(e) => setForm({ ...form, valor_orcado: e.target.value })} />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <KPI label="Total orçado" value={formatMoney(totalOrcado)} />
        <KPI label="Total realizado" value={formatMoney(totalRealizado)} />
        <KPI label="% utilizado" value={`${totalOrcado > 0 ? ((totalRealizado / totalOrcado) * 100).toFixed(1) : 0}%`} />
      </div>

      <div className="bg-card border rounded-2xl p-4">
        {isLoading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Nenhum orçamento para {mes.toString().padStart(2, "0")}/{ano}.</div>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <div key={r.id} className="space-y-2 border-b last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.categoria} <span className="text-xs text-muted-foreground">({r.tipo})</span></p>
                    <p className="text-xs text-muted-foreground">{formatMoney(r.realizado)} de {formatMoney(r.orcado)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editingId === r.id ? (
                      <>
                        <Input type="number" min="0" step="0.01" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8 w-28" autoFocus />
                        <Button size="sm" className="h-8" onClick={() => salvarEdicao(r.id)}>Salvar</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditingId(null)}>Cancelar</Button>
                      </>
                    ) : (
                      <>
                        <span className={`text-sm font-display font-semibold ${r.pct > 100 ? "text-destructive" : r.pct > 80 ? "text-warning" : "text-success"}`}>
                          {r.pct.toFixed(1)}%
                        </span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(r.id); setEditValue(String(r.orcado)); }} aria-label="Editar"><Pencil className="size-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => excluir(r.id)} aria-label="Excluir"><Trash2 className="size-4" /></Button>
                      </>
                    )}
                  </div>
                </div>
                <Progress value={Math.min(r.pct, 100)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border rounded-2xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-2xl">{value}</div>
    </div>
  );
}
