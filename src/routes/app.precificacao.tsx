import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/precificacao")({ component: PrecificacaoPage });

function PrecificacaoPage() {
  const { selected } = useSelectedCompany();
  const [productId, setProductId] = useState<string>("");
  const [custo, setCusto] = useState("0");
  const [impostos, setImpostos] = useState("8");
  const [taxas, setTaxas] = useState("3");
  const [despesas, setDespesas] = useState("10");
  const [margem, setMargem] = useState("30");
  const [saving, setSaving] = useState(false);

  const { data: products, refetch } = useQuery({
    queryKey: ["products-pri", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, nome, custo_unitario, preco_venda")
        .eq("company_id", selected!)
        .order("nome");
      return data ?? [];
    },
  });

  function selectProduct(id: string) {
    setProductId(id);
    const p = products?.find((x) => x.id === id);
    if (p) setCusto(String(p.custo_unitario ?? 0));
  }

  const c = Number(custo) || 0;
  const totalPct = (Number(impostos) || 0) + (Number(taxas) || 0) + (Number(despesas) || 0) + (Number(margem) || 0);
  const precoSugerido = totalPct >= 100 ? 0 : c / (1 - totalPct / 100);
  const lucro = precoSugerido - c - precoSugerido * ((Number(impostos) || 0) + (Number(taxas) || 0) + (Number(despesas) || 0)) / 100;
  const margemReal = precoSugerido > 0 ? (lucro / precoSugerido) * 100 : 0;

  const produtoAtual = products?.find((p) => p.id === productId);

  async function aplicarPreco() {
    if (!productId || precoSugerido <= 0) return;
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ preco_venda: Number(precoSugerido.toFixed(2)), custo_unitario: c })
      .eq("id", productId);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Preço atualizado");
      refetch();
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-display font-bold">Precificação e Margem</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calcule o preço de venda sugerido considerando custo, impostos, taxas, despesas e margem desejada.
        </p>
      </div>

      <div className="bg-card border rounded-2xl p-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label>Produto (opcional)</Label>
          <Select value={productId || "none"} onValueChange={(v) => selectProduct(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione um produto ou calcule manualmente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Cálculo manual</SelectItem>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome} (atual: {formatMoney(Number(p.preco_venda))})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Field label="Custo unitário (R$)" value={custo} onChange={setCusto} />
        <Field label="Impostos (%)" value={impostos} onChange={setImpostos} />
        <Field label="Taxas de cartão/plataforma (%)" value={taxas} onChange={setTaxas} />
        <Field label="Despesas operacionais (%)" value={despesas} onChange={setDespesas} />
        <Field label="Margem de lucro desejada (%)" value={margem} onChange={setMargem} />
      </div>

      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <h2 className="text-lg font-display font-semibold">Resultado</h2>
        {totalPct >= 100 ? (
          <p className="text-destructive text-sm">Soma de impostos + taxas + despesas + margem ≥ 100%. Reduza algum valor.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <Result label="Preço sugerido" value={formatMoney(precoSugerido)} highlight />
            <Result label="Lucro estimado por unidade" value={formatMoney(lucro)} />
            <Result label="Margem real" value={`${margemReal.toFixed(1)}%`} />
          </div>
        )}
        {produtoAtual && (
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm text-muted-foreground">
              Preço atual cadastrado: <span className="font-medium text-foreground">{formatMoney(Number(produtoAtual.preco_venda))}</span>
            </div>
            <Button onClick={aplicarPreco} disabled={saving || precoSugerido <= 0}>
              {saving ? "Aplicando..." : "Aplicar ao produto"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Result({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? "bg-primary/10 border-primary/40" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display font-bold ${highlight ? "text-2xl" : "text-xl"}`}>{value}</div>
    </div>
  );
}
