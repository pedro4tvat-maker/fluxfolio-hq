import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
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
        .is("deleted_at", null).order("nome");
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
          .eq("ano", ano).is("deleted_at", null),
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
    const { error } = await supabase.from("budgets").update({ valor_orcado: v }).eq("id", id).is("deleted_at", null);
    if (error) toast.error(error.message);
    else { toast.success("Orçamento atualizado"); setEditingId(null); refetch(); }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este orçamento?")) return;
    const { error } = await supabase.from("budgets").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Orçamento excluído"); refetch(); }
  }


  const NOMES_MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const mudarMes = (delta: number) => {
    const d = new Date(ano, mes - 1 + delta, 1);
    setMes(d.getMonth() + 1);
    setAno(d.getFullYear());
  };
  const pctTotal = totalOrcado > 0 ? (totalRealizado / totalOrcado) * 100 : 0;
  const grupos = [
    { tipo: "saida", titulo: "Despesas", itens: rows.filter((r) => r.tipo !== "entrada") },
    { tipo: "entrada", titulo: "Receitas", itens: rows.filter((r) => r.tipo === "entrada") },
  ].filter((g) => g.itens.length > 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Orçamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina quanto pretende gastar ou faturar em cada categoria e acompanhe mês a mês.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-card shadow-sm border h-11 px-1">
            <button type="button" onClick={() => mudarMes(-1)} className="size-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Mês anterior"><ChevronLeft className="size-4" /></button>
            <span className="px-2 text-sm font-medium min-w-[130px] text-center">{NOMES_MES[mes - 1]} {ano}</span>
            <button type="button" onClick={() => mudarMes(1)} className="size-9 grid place-items-center rounded-full hover:bg-muted" aria-label="Próximo mês"><ChevronRight className="size-4" /></button>
          </div>
          <Button className="rounded-full h-11 px-5 shadow-sm" onClick={() => setOpen((v) => !v)}>
            {open ? <><X className="size-4" /> Fechar</> : <><Plus className="size-4" /> Nova meta</>}
          </Button>
        </div>
      </div>

      {open && (
        <form onSubmit={save} className="bg-card rounded-3xl shadow-card p-5 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{categories?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} · {c.tipo === "entrada" ? "receita" : "despesa"}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Valor previsto para {NOMES_MES[mes - 1].toLowerCase()}</Label>
            <CurrencyInput className="rounded-xl" value={form.valor_orcado} onChange={(v) => setForm({ ...form, valor_orcado: v })} />
          </div>
          <Button type="submit" className="rounded-full" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </form>
      )}

      {/* Resumo do mês */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-7 sm:py-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Realizado no mês</div>
            <div className="font-display font-bold text-3xl sm:text-4xl mt-1 tabular-nums">{formatMoney(totalRealizado)}</div>
            <div className="text-xs text-muted-foreground mt-1">de {formatMoney(totalOrcado)} previstos</div>
          </div>
          <div className="text-right">
            <div className={`font-display font-bold text-2xl tabular-nums ${pctTotal > 100 ? "text-destructive" : ""}`}>{pctTotal.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">do orçamento usado</div>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-background/70 overflow-hidden">
          <div className={`h-full rounded-full ${pctTotal > 100 ? "bg-destructive" : pctTotal > 80 ? "bg-warning" : "bg-primary"}`} style={{ width: `${Math.min(pctTotal, 100)}%` }} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
      ) : rows.length === 0 ? (
        <div className="bg-card rounded-3xl shadow-card p-10 text-center">
          <p className="font-medium">Nenhuma meta para {NOMES_MES[mes - 1].toLowerCase()} de {ano}.</p>
          <p className="text-sm text-muted-foreground mt-1">Clique em "Nova meta" e defina quanto pretende gastar ou faturar em cada categoria.</p>
        </div>
      ) : (
        <div className={`grid gap-5 ${grupos.length > 1 ? "lg:grid-cols-2" : ""} items-start`}>
          {grupos.map((g) => (
            <section key={g.tipo} className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
              <h2 className="font-display font-semibold px-3 pt-2 pb-1">{g.titulo}</h2>
              <ul>
                {g.itens.map((r) => {
                  const receita = g.tipo === "entrada";
                  const diferenca = r.orcado - r.realizado;
                  const cor = receita
                    ? (r.pct >= 100 ? "bg-success" : "bg-primary")
                    : (r.pct > 100 ? "bg-destructive" : r.pct > 80 ? "bg-warning" : "bg-success");
                  const texto = receita
                    ? (diferenca <= 0 ? `Meta batida (+${formatMoney(-diferenca)})` : `Faltam ${formatMoney(diferenca)}`)
                    : (diferenca >= 0 ? `Sobram ${formatMoney(diferenca)}` : `Passou ${formatMoney(-diferenca)}`);
                  const corTexto = receita
                    ? (diferenca <= 0 ? "text-success" : "text-muted-foreground")
                    : (diferenca >= 0 ? "text-muted-foreground" : "text-destructive");
                  return (
                    <li key={r.id} className="group rounded-2xl px-3 py-3 hover:bg-muted/60 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{r.categoria}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">{formatMoney(r.realizado)} de {formatMoney(r.orcado)}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {editingId === r.id ? (
                            <>
                              <CurrencyInput value={editValue} onChange={setEditValue} className="h-8 w-32 rounded-full" autoFocus />
                              <Button size="sm" className="h-8 rounded-full" onClick={() => salvarEdicao(r.id)}>Salvar</Button>
                              <button type="button" className="size-8 grid place-items-center rounded-full hover:bg-background" onClick={() => setEditingId(null)} aria-label="Cancelar"><X className="size-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <span className={`text-xs font-medium mr-1 ${corTexto}`}>{texto}</span>
                              <button type="button" className="size-8 grid place-items-center rounded-full hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={() => { setEditingId(r.id); setEditValue(String(r.orcado)); }} aria-label="Editar"><Pencil className="size-3.5" /></button>
                              <button type="button" className="size-8 grid place-items-center rounded-full hover:bg-background text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={() => excluir(r.id)} aria-label="Excluir"><Trash2 className="size-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(r.pct, 100)}%`, opacity: 0.8 }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{r.pct.toFixed(0)}%</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
