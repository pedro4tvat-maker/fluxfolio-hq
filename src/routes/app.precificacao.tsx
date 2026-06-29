import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { formatMoney, downloadCSV } from "@/lib/format";
import { Pencil, Trash2, Plus, Download, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/precificacao")({ component: PrecificacaoPage });

type PricingRecord = {
  id: string;
  company_id: string;
  product_id: string | null;
  nome: string;
  categoria: string | null;
  unidade: string | null;
  observacoes: string | null;
  custo_compra: number;
  custo_materia_prima: number;
  custo_embalagem: number;
  custo_frete: number;
  custo_mao_obra: number;
  outros_custos_diretos: number;
  taxa_cartao: number;
  comissao: number;
  impostos: number;
  marketplace: number;
  desconto_medio: number;
  outras_despesas_variaveis: number;
  rateio_fixo: number;
  rateio_administrativo: number;
  rateio_comercial: number;
  margem_desejada: number;
  preco_atual: number;
  preco_sugerido: number;
  preco_minimo: number;
  markup: number;
  margem_atual: number;
  created_at: string;
};

const empty = (): Partial<PricingRecord> => ({
  nome: "",
  categoria: "",
  unidade: "un",
  observacoes: "",
  custo_compra: 0,
  custo_materia_prima: 0,
  custo_embalagem: 0,
  custo_frete: 0,
  custo_mao_obra: 0,
  outros_custos_diretos: 0,
  taxa_cartao: 0,
  comissao: 0,
  impostos: 0,
  marketplace: 0,
  desconto_medio: 0,
  outras_despesas_variaveis: 0,
  rateio_fixo: 0,
  rateio_administrativo: 0,
  rateio_comercial: 0,
  margem_desejada: 30,
  preco_atual: 0,
});

function PrecificacaoPage() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRecord | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["pricing", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_records")
        .select("*")
        .eq("company_id", selected!)
        .is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PricingRecord[];
    },
  });

  function openCreate() { setEditing(null); setOpen(true); }
  function openEdit(r: PricingRecord) { setEditing(r); setOpen(true); }

  async function remove(r: PricingRecord) {
    if (!confirm(`Excluir precificação "${r.nome}"?`)) return;
    const { error } = await supabase.from("pricing_records").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["pricing", selected] }); }
  }

  function exportCSV() {
    if (!records.length) { toast.info("Sem dados"); return; }
    downloadCSV(`precificacoes.csv`, records.map((r) => ({
      Nome: r.nome,
      Categoria: r.categoria ?? "",
      "Custo total": Number(custoTotal(r)).toFixed(2),
      "Despesas variáveis %": pctVariaveis(r).toFixed(2),
      "Rateio fixo": Number(rateioTotal(r)).toFixed(2),
      "Margem desejada %": Number(r.margem_desejada).toFixed(2),
      "Preço atual": Number(r.preco_atual).toFixed(2),
      "Preço sugerido": Number(r.preco_sugerido).toFixed(2),
      "Preço mínimo": Number(r.preco_minimo).toFixed(2),
      Markup: Number(r.markup).toFixed(2),
      "Margem atual %": Number(r.margem_atual).toFixed(2),
    })));
  }

  if (!selected) {
    return <div className="text-muted-foreground">Selecione uma empresa para precificar.</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Precificação e Margem</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Calcule preço de venda considerando custos diretos, despesas variáveis, rateio de custos fixos e margem desejada.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="size-4" /> Exportar</Button>
          <Button onClick={openCreate}><Plus className="size-4" /> Nova precificação</Button>
        </div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Produto/Serviço</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 font-medium text-right">Custo total</th>
                <th className="px-4 py-2 font-medium text-right">Preço sugerido</th>
                <th className="px-4 py-2 font-medium text-right">Preço atual</th>
                <th className="px-4 py-2 font-medium text-right">Margem atual</th>
                <th className="px-4 py-2 font-medium text-right">Markup</th>
                <th className="px-4 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Carregando...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Nenhuma precificação cadastrada ainda. Clique em "Nova precificação" para começar.</td></tr>
              ) : records.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{r.nome}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{r.categoria ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(custoTotal(r))}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatMoney(Number(r.preco_sugerido))}</td>
                  <td className="px-4 py-2 text-right">{formatMoney(Number(r.preco_atual))}</td>
                  <td className={`px-4 py-2 text-right ${Number(r.margem_atual) < 0 ? "text-destructive" : ""}`}>{Number(r.margem_atual).toFixed(1)}%</td>
                  <td className="px-4 py-2 text-right">{Number(r.markup).toFixed(2)}x</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PricingForm
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        companyId={selected}
        onSaved={() => qc.invalidateQueries({ queryKey: ["pricing", selected] })}
      />
    </div>
  );
}

function custoTotal(r: Partial<PricingRecord>) {
  return Number(r.custo_compra ?? 0) + Number(r.custo_materia_prima ?? 0) +
    Number(r.custo_embalagem ?? 0) + Number(r.custo_frete ?? 0) +
    Number(r.custo_mao_obra ?? 0) + Number(r.outros_custos_diretos ?? 0);
}
function pctVariaveis(r: Partial<PricingRecord>) {
  return Number(r.taxa_cartao ?? 0) + Number(r.comissao ?? 0) + Number(r.impostos ?? 0) +
    Number(r.marketplace ?? 0) + Number(r.desconto_medio ?? 0) + Number(r.outras_despesas_variaveis ?? 0);
}
function rateioTotal(r: Partial<PricingRecord>) {
  return Number(r.rateio_fixo ?? 0) + Number(r.rateio_administrativo ?? 0) + Number(r.rateio_comercial ?? 0);
}

function PricingForm({
  open, onOpenChange, editing, companyId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: PricingRecord | null;
  companyId: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<Partial<PricingRecord>>(empty());
  const [saving, setSaving] = useState(false);
  const [applyToProduct, setApplyToProduct] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["pricing-products", companyId],
    enabled: open && !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("products")
        .select("id, nome, custo_unitario, preco_venda")
        .eq("company_id", companyId).is("deleted_at", null).order("nome");
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : empty());
      setApplyToProduct(false);
    }
  }, [open, editing]);

  function set<K extends keyof PricingRecord>(k: K, v: PricingRecord[K] | number | string | null) {
    setForm((p) => ({ ...p, [k]: v as PricingRecord[K] }));
  }
  function num<K extends keyof PricingRecord>(k: K, v: string) {
    set(k, (Number(v.replace(",", ".")) || 0) as PricingRecord[K]);
  }

  // calculations
  const calc = useMemo(() => {
    const ct = custoTotal(form);
    const pctVar = pctVariaveis(form);
    const rateio = rateioTotal(form);
    const margem = Number(form.margem_desejada ?? 0);
    const totalPct = pctVar + margem;
    const baseComRateio = ct + rateio;
    const precoSugerido = totalPct >= 100 ? 0 : baseComRateio / (1 - totalPct / 100);
    const precoMinimo = pctVar >= 100 ? 0 : baseComRateio / (1 - pctVar / 100);
    const markup = ct > 0 && precoSugerido > 0 ? precoSugerido / ct : 0;
    const precoAtual = Number(form.preco_atual ?? 0);
    const margemAtual = precoAtual > 0
      ? ((precoAtual - baseComRateio - precoAtual * pctVar / 100) / precoAtual) * 100
      : 0;
    const lucroUnidade = precoSugerido > 0
      ? precoSugerido - baseComRateio - precoSugerido * pctVar / 100
      : 0;
    return { ct, pctVar, rateio, baseComRateio, precoSugerido, precoMinimo, markup, margemAtual, lucroUnidade, totalPct };
  }, [form]);

  function onPickProduct(id: string) {
    if (id === "none") { set("product_id", null); return; }
    set("product_id", id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setForm((prev) => ({
        ...prev,
        product_id: id,
        nome: prev.nome || p.nome,
        custo_compra: prev.custo_compra || Number(p.custo_unitario ?? 0),
        preco_atual: prev.preco_atual || Number(p.preco_venda ?? 0),
      }));
    }
  }

  async function save() {
    if (!form.nome || !form.nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const payload = {
      company_id: companyId,
      product_id: form.product_id ?? null,
      nome: form.nome.trim(),
      categoria: form.categoria?.trim() || null,
      unidade: form.unidade?.trim() || null,
      observacoes: form.observacoes?.trim() || null,
      custo_compra: Number(form.custo_compra ?? 0),
      custo_materia_prima: Number(form.custo_materia_prima ?? 0),
      custo_embalagem: Number(form.custo_embalagem ?? 0),
      custo_frete: Number(form.custo_frete ?? 0),
      custo_mao_obra: Number(form.custo_mao_obra ?? 0),
      outros_custos_diretos: Number(form.outros_custos_diretos ?? 0),
      taxa_cartao: Number(form.taxa_cartao ?? 0),
      comissao: Number(form.comissao ?? 0),
      impostos: Number(form.impostos ?? 0),
      marketplace: Number(form.marketplace ?? 0),
      desconto_medio: Number(form.desconto_medio ?? 0),
      outras_despesas_variaveis: Number(form.outras_despesas_variaveis ?? 0),
      rateio_fixo: Number(form.rateio_fixo ?? 0),
      rateio_administrativo: Number(form.rateio_administrativo ?? 0),
      rateio_comercial: Number(form.rateio_comercial ?? 0),
      margem_desejada: Number(form.margem_desejada ?? 0),
      preco_atual: Number(form.preco_atual ?? 0),
      preco_sugerido: Number(calc.precoSugerido.toFixed(2)),
      preco_minimo: Number(calc.precoMinimo.toFixed(2)),
      markup: Number(calc.markup.toFixed(4)),
      margem_atual: Number(calc.margemAtual.toFixed(2)),
      created_by: editing ? undefined : user?.id ?? null,
    };
    const { error } = editing
      ? await supabase.from("pricing_records").update(payload).eq("id", editing.id).is("deleted_at", null)
      : await supabase.from("pricing_records").insert(payload);

    if (error) { setSaving(false); toast.error(error.message); return; }

    if (applyToProduct && form.product_id) {
      const { error: pErr } = await supabase.from("products")
        .update({
          preco_venda: Number(calc.precoSugerido.toFixed(2)),
          custo_unitario: calc.ct,
        })
        .eq("id", form.product_id);
      if (pErr) toast.warning("Salvo, mas falha ao aplicar ao produto: " + pErr.message);
    }

    setSaving(false);
    toast.success(editing ? "Precificação atualizada" : "Precificação salva");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar precificação" : "Nova precificação"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Identificação */}
          <Section title="Identificação">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Produto (opcional)</Label>
                <Select value={form.product_id ?? "none"} onValueChange={onPickProduct}>
                  <SelectTrigger><SelectValue placeholder="Cálculo manual" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cálculo manual (sem vincular)</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} (atual: {formatMoney(Number(p.preco_venda))})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Nome *" value={form.nome ?? ""} onChange={(v) => set("nome", v)} />
              <Field label="Categoria" value={form.categoria ?? ""} onChange={(v) => set("categoria", v)} />
              <Field label="Unidade" value={form.unidade ?? ""} onChange={(v) => set("unidade", v)} />
              <NumField label="Preço atual praticado (R$)" value={form.preco_atual} onChange={(v) => num("preco_atual", v)} />
            </div>
          </Section>

          {/* Custos diretos */}
          <Section title="Custos diretos (R$ por unidade)">
            <div className="grid gap-3 md:grid-cols-3">
              <NumField label="Custo de compra" value={form.custo_compra} onChange={(v) => num("custo_compra", v)} />
              <NumField label="Matéria-prima" value={form.custo_materia_prima} onChange={(v) => num("custo_materia_prima", v)} />
              <NumField label="Embalagem" value={form.custo_embalagem} onChange={(v) => num("custo_embalagem", v)} />
              <NumField label="Frete" value={form.custo_frete} onChange={(v) => num("custo_frete", v)} />
              <NumField label="Mão de obra" value={form.custo_mao_obra} onChange={(v) => num("custo_mao_obra", v)} />
              <NumField label="Outros custos diretos" value={form.outros_custos_diretos} onChange={(v) => num("outros_custos_diretos", v)} />
            </div>
            <div className="mt-3 text-sm border-t pt-3">
              Custo total direto: <span className="font-display font-bold text-lg">{formatMoney(calc.ct)}</span>
            </div>
          </Section>

          {/* Despesas variáveis */}
          <Section title="Despesas variáveis (% do preço de venda)">
            <div className="grid gap-3 md:grid-cols-3">
              <NumField label="Taxa cartão %" value={form.taxa_cartao} onChange={(v) => num("taxa_cartao", v)} />
              <NumField label="Comissão %" value={form.comissao} onChange={(v) => num("comissao", v)} />
              <NumField label="Impostos %" value={form.impostos} onChange={(v) => num("impostos", v)} />
              <NumField label="Marketplace %" value={form.marketplace} onChange={(v) => num("marketplace", v)} />
              <NumField label="Desconto médio %" value={form.desconto_medio} onChange={(v) => num("desconto_medio", v)} />
              <NumField label="Outras despesas %" value={form.outras_despesas_variaveis} onChange={(v) => num("outras_despesas_variaveis", v)} />
            </div>
            <div className="mt-3 text-sm border-t pt-3">
              Total de despesas variáveis: <span className="font-display font-bold text-lg">{calc.pctVar.toFixed(2)}%</span>
            </div>
          </Section>

          {/* Rateio de custos fixos */}
          <Section title="Rateio de custos fixos (R$ por unidade)">
            <div className="grid gap-3 md:grid-cols-3">
              <NumField label="Custos fixos diretos" value={form.rateio_fixo} onChange={(v) => num("rateio_fixo", v)} />
              <NumField label="Rateio administrativo" value={form.rateio_administrativo} onChange={(v) => num("rateio_administrativo", v)} />
              <NumField label="Rateio comercial" value={form.rateio_comercial} onChange={(v) => num("rateio_comercial", v)} />
            </div>
            <div className="mt-3 text-sm border-t pt-3">
              Rateio total: <span className="font-display font-bold text-lg">{formatMoney(calc.rateio)}</span>
            </div>
          </Section>

          {/* Margem e resultado */}
          <Section title="Margem desejada e resultado">
            <div className="grid gap-3 md:grid-cols-2">
              <NumField label="Margem de lucro desejada (%)" value={form.margem_desejada} onChange={(v) => num("margem_desejada", v)} />
            </div>

            {calc.totalPct >= 100 ? (
              <p className="text-destructive text-sm mt-3">
                Soma de despesas variáveis + margem ≥ 100%. Reduza algum percentual.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-4 mt-3">
                <Result label="Preço sugerido" value={formatMoney(calc.precoSugerido)} highlight />
                <Result label="Preço mínimo (sem lucro)" value={formatMoney(calc.precoMinimo)} />
                <Result label="Markup" value={`${calc.markup.toFixed(2)}x`} />
                <Result label="Lucro por unidade" value={formatMoney(calc.lucroUnidade)} />
                <Result label="Custo + rateio" value={formatMoney(calc.baseComRateio)} />
                <Result label="Margem do preço atual" value={`${calc.margemAtual.toFixed(1)}%`} tone={calc.margemAtual < 0 ? "danger" : undefined} />
              </div>
            )}

            {Number(form.preco_atual ?? 0) > 0 && Number(form.preco_atual ?? 0) < calc.precoMinimo && (
              <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                ⚠️ Preço atual ({formatMoney(Number(form.preco_atual))}) está abaixo do preço mínimo ({formatMoney(calc.precoMinimo)}) — você está vendendo no prejuízo.
              </div>
            )}
          </Section>

          <Section title="Observações">
            <Textarea
              rows={3}
              value={form.observacoes ?? ""}
              onChange={(e) => set("observacoes", e.target.value)}
              placeholder="Anotações sobre fornecedores, sazonalidade, política comercial..."
            />
          </Section>

          {form.product_id && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={applyToProduct}
                onChange={(e) => setApplyToProduct(e.target.checked)}
              />
              Aplicar preço sugerido ao produto vinculado
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            <Save className="size-4" />{saving ? "Salvando..." : "Salvar precificação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4">
      <h3 className="font-display font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number | undefined; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type="number" min="0" step="0.01" value={value ?? 0} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function Result({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: "danger" }) {
  const cls = tone === "danger" ? "text-destructive" : "";
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "bg-primary/10 border-primary/40" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display font-bold ${highlight ? "text-xl" : "text-lg"} ${cls}`}>{value}</div>
    </div>
  );
}
