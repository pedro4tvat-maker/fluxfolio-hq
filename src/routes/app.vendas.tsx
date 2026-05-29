import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/vendas")({ component: VendasPage });

function VendasPage() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cliente: "",
    product_id: "",
    quantidade: "1",
    preco_unitario: "",
    forma: "vista" as "vista" | "prazo",
    forma_pagamento: "Pix",
    vencimento: new Date().toISOString().slice(0, 10),
  });

  const { data: products } = useQuery({
    queryKey: ["products-sel", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, nome, preco_venda, quantidade")
        .eq("company_id", selected!)
        .order("nome");
      return data ?? [];
    },
  });

  const { data: account } = useQuery({
    queryKey: ["account-default", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("financial_accounts")
        .select("id")
        .eq("company_id", selected!)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: vendas, isLoading } = useQuery({
    queryKey: ["vendas-list", selected],
    enabled: !!selected,
    queryFn: async () => {
      const [tx, rec] = await Promise.all([
        supabase
          .from("transactions")
          .select("id, descricao, valor, data, status, forma_pagamento")
          .eq("company_id", selected!)
          .eq("tipo", "entrada")
          .order("data", { ascending: false })
          .limit(50),
        supabase
          .from("receivables")
          .select("id, descricao, cliente, valor, vencimento, status")
          .eq("company_id", selected!)
          .order("vencimento", { ascending: false })
          .limit(50),
      ]);
      return { tx: tx.data ?? [], rec: rec.data ?? [] };
    },
  });

  const total = (Number(form.quantidade) || 0) * (Number(form.preco_unitario) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const qtd = Number(form.quantidade);
    const preco = Number(form.preco_unitario);
    if (!qtd || !preco) {
      toast.error("Informe quantidade e preço");
      return;
    }
    setSaving(true);
    try {
      const descricao = `Venda${form.cliente ? ` - ${form.cliente}` : ""}${form.product_id ? ` (${products?.find(p => p.id === form.product_id)?.nome ?? ""})` : ""}`;
      const valor = qtd * preco;

      // baixa de estoque
      if (form.product_id) {
        const { error: smErr } = await supabase.from("stock_movements").insert({
          company_id: selected,
          product_id: form.product_id,
          tipo: "saida",
          quantidade: qtd,
          motivo: "Venda",
        });
        if (smErr) throw smErr;
      }

      if (form.forma === "vista") {
        const { error } = await supabase.from("transactions").insert({
          company_id: selected,
          tipo: "entrada",
          descricao,
          valor,
          conta_id: account?.id,
          forma_pagamento: form.forma_pagamento,
          status: "realizado",
          data: new Date().toISOString().slice(0, 10),
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("receivables").insert({
          company_id: selected,
          descricao,
          cliente: form.cliente || null,
          valor,
          vencimento: form.vencimento,
          forma_recebimento: form.forma_pagamento,
          conta_id: account?.id,
          status: "em_aberto",
        });
        if (error) throw error;
      }

      toast.success("Venda registrada");
      setOpen(false);
      setForm({ ...form, cliente: "", product_id: "", quantidade: "1", preco_unitario: "" });
      qc.invalidateQueries({ queryKey: ["vendas-list"] });
      qc.invalidateQueries({ queryKey: ["products-sel"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function onPickProduct(id: string) {
    const p = products?.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      product_id: id,
      preco_unitario: p ? String(p.preco_venda ?? "") : f.preco_unitario,
    }));
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Fluxo de Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registre vendas com baixa automática de estoque e geração de entrada no caixa ou conta a receber.
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Nova venda"}</Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Cliente</Label>
            <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Opcional" />
          </div>
          <div className="space-y-1">
            <Label>Produto</Label>
            <Select value={form.product_id || "none"} onValueChange={(v) => onPickProduct(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sem produto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem produto (serviço)</SelectItem>
                {products?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — estoque: {Number(p.quantidade)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Quantidade</Label>
            <Input type="number" min="0" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Preço unitário</Label>
            <Input type="number" min="0" step="0.01" value={form.preco_unitario} onChange={(e) => setForm({ ...form, preco_unitario: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Forma</Label>
            <Select value={form.forma} onValueChange={(v: "vista" | "prazo") => setForm({ ...form, forma: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vista">À vista (entra no caixa)</SelectItem>
                <SelectItem value="prazo">A prazo (gera a receber)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{form.forma === "vista" ? "Forma de pagamento" : "Forma de recebimento"}</Label>
            <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Pix", "Dinheiro", "Cartão de crédito", "Cartão de débito", "Boleto", "Transferência bancária"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {form.forma === "prazo" && (
            <div className="space-y-1">
              <Label>Vencimento</Label>
              <Input type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} />
            </div>
          )}
          <div className="md:col-span-2 flex items-center justify-between border-t pt-3">
            <div className="text-sm">Total: <span className="font-display font-bold text-lg">{formatMoney(total)}</span></div>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Registrar venda"}</Button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-display font-semibold">Vendas recentes (à vista)</h2>
        <div className="bg-card border rounded-2xl p-4">
          {isLoading ? (
            <div className="text-muted-foreground">Carregando...</div>
          ) : vendas?.tx.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma venda à vista registrada.</div>
          ) : (
            <div className="space-y-2">
              {vendas?.tx.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{row.descricao}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(row.data)} • {row.forma_pagamento ?? "—"}</p>
                  </div>
                  <div className="font-display font-semibold text-success">{formatMoney(Number(row.valor))}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-display font-semibold">Vendas a prazo (contas a receber)</h2>
        <div className="bg-card border rounded-2xl p-4">
          {vendas?.rec.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma venda a prazo.</div>
          ) : (
            <div className="space-y-2">
              {vendas?.rec.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{row.descricao}</p>
                    <p className="text-xs text-muted-foreground">{row.cliente ?? "—"} • venc. {formatDate(row.vencimento)} • {row.status}</p>
                  </div>
                  <div className="font-display font-semibold">{formatMoney(Number(row.valor))}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
