import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/centro-custos")({ component: CentroCustosPage });

function CentroCustosPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editClass, setEditClass] = useState("");
  const { selected } = useSelectedCompany();
  const [nome, setNome] = useState("");
  const [novaClass, setNovaClass] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: centers, refetch } = useQuery({
    queryKey: ["cost-centers", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("cost_centers")
        .select("id, nome, kpi_classification")
        .eq("company_id", selected!)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: totals } = useQuery({
    queryKey: ["cost-center-totals", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("centro_custo_id, tipo, valor")
        .eq("company_id", selected!)
        .is("deleted_at", null);
      return data ?? [];
    },
  });

  const rows = (centers ?? []).map((c: any) => {
    const linked = (totals ?? []).filter((t) => t.centro_custo_id === c.id);
    const entradas = linked.filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
    const saidas = linked.filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);
    return { ...c, entradas, saidas, resultado: entradas - saidas };
  });

  const classificacoesExistentes = Array.from(
    new Set((centers ?? []).map((c: any) => c.kpi_classification).filter(Boolean) as string[]),
  ).sort();

  const semCentro = (totals ?? []).filter((t) => !t.centro_custo_id);
  const semEntradas = semCentro.filter((t) => t.tipo === "entrada").reduce((s, t) => s + Number(t.valor), 0);
  const semSaidas = semCentro.filter((t) => t.tipo === "saida").reduce((s, t) => s + Number(t.valor), 0);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !nome.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("cost_centers").insert({
      company_id: selected,
      nome: nome.trim(),
      kpi_classification: novaClass.trim() || null,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Centro de custo criado"); setNome(""); setNovaClass(""); refetch(); }
  }

  async function salvarEdicao(id: string) {
    if (!editValue.trim()) return;
    const { error } = await supabase
      .from("cost_centers")
      .update({ nome: editValue.trim(), kpi_classification: editClass.trim() || null })
      .eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Centro atualizado"); setEditingId(null); refetch(); }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o centro "${nome}"? Lançamentos vinculados ficarão sem centro.`)) return;
    const { error } = await supabase.from("cost_centers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Centro excluído"); refetch(); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Centro de Custos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Agrupe receitas e despesas por área. A <strong>Classificação (DRE)</strong> define em que linha do relatório esse centro aparece — você pode reutilizar uma classificação existente ou criar uma nova linha digitando um nome novo.
        </p>
      </div>

      <form onSubmit={adicionar} className="bg-card border rounded-2xl p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="space-y-1">
          <Label>Novo centro de custo</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Marketing, Operação" />
        </div>
        <div className="space-y-1">
          <Label>Classificação DRE (opcional)</Label>
          <Input
            list="classificacoes-existentes"
            value={novaClass}
            onChange={(e) => setNovaClass(e.target.value)}
            placeholder="Ex: Custo Variável, Despesa Operacional"
          />
        </div>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Adicionar"}</Button>
      </form>

      <datalist id="classificacoes-existentes">
        {classificacoesExistentes.map((c) => <option key={c} value={c} />)}
      </datalist>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-muted/50 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Centro</th>
                <th className="text-left p-3">Classificação (DRE)</th>
                <th className="text-right p-3">Entradas</th>
                <th className="text-right p-3">Saídas</th>
                <th className="text-right p-3">Resultado</th>
                <th className="text-right p-3 w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhum centro cadastrado.</td></tr>
              ) : rows.map((r: any) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-medium">
                    {editingId === r.id ? (
                      <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus className="h-8" />
                    ) : r.nome}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {editingId === r.id ? (
                      <Input
                        list="classificacoes-existentes"
                        value={editClass}
                        onChange={(e) => setEditClass(e.target.value)}
                        placeholder="(sem classificação)"
                        className="h-8"
                      />
                    ) : (r.kpi_classification || <span className="italic">—</span>)}
                  </td>
                  <td className="p-3 text-right text-success">{formatMoney(r.entradas)}</td>
                  <td className="p-3 text-right text-destructive">{formatMoney(r.saidas)}</td>
                  <td className={`p-3 text-right font-display font-semibold ${r.resultado >= 0 ? "text-success" : "text-destructive"}`}>{formatMoney(r.resultado)}</td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                      {editingId === r.id ? (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => salvarEdicao(r.id)} aria-label="Salvar"><Check className="size-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)} aria-label="Cancelar"><X className="size-4" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(r.id); setEditValue(r.nome); setEditClass(r.kpi_classification ?? ""); }} aria-label="Editar"><Pencil className="size-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => excluir(r.id, r.nome)} aria-label="Excluir"><Trash2 className="size-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(semEntradas > 0 || semSaidas > 0) && (
                <tr className="border-t bg-muted/30">
                  <td className="p-3 italic text-muted-foreground">Sem centro de custo</td>
                  <td className="p-3" />
                  <td className="p-3 text-right">{formatMoney(semEntradas)}</td>
                  <td className="p-3 text-right">{formatMoney(semSaidas)}</td>
                  <td className="p-3 text-right font-display font-semibold">{formatMoney(semEntradas - semSaidas)}</td>
                  <td className="p-3" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
