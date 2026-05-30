import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check, UserPlus, X, Plus, Trash2, FileText, TrendingUp, Download } from "lucide-react";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { ContactForm } from "./app.crm";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/app/vendas")({ component: VendasPage });

type CrmContact = {
  id: string;
  name: string;
  tipo: string;
  cpf_cnpj: string | null;
  email: string | null;
  phone: string | null;
};

type SaleItem = {
  product_id: string;
  nome: string;
  quantidade: string;
  preco_unitario: string;
  custo_unitario: string; // custo desta venda (pode sobrescrever o cadastrado)
  custo_padrao: string;   // custo cadastrado no produto (referência)
};

type CompanyData = {
  nome: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
};

function VendasPage() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [contactDialog, setContactDialog] = useState(false);
  const [cliente, setCliente] = useState<CrmContact | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const sevenAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(sevenAgo);
  const [reportTo, setReportTo] = useState(today);
  const [form, setForm] = useState({
    forma: "vista" as "vista" | "prazo",
    forma_pagamento: "Pix",
    data_venda: new Date().toISOString().slice(0, 10),
    vencimento: new Date().toISOString().slice(0, 10),
    observacoes: "",
  });

  const { data: company } = useQuery({
    queryKey: ["company-os", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("nome, nome_fantasia, cnpj, documento, telefone, email, endereco, bairro, cidade, estado, cep")
        .eq("id", selected!)
        .maybeSingle();
      return data as CompanyData | null;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["crm-sel", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("id, name, tipo, cpf_cnpj, email, phone")
        .eq("company_id", selected!)
        .in("tipo", ["cliente", "lead"])
        .order("name");
      return (data ?? []) as CrmContact[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-sel", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, nome, preco_venda, quantidade, custo_unitario")
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
          .select("id, descricao, valor, data, status, forma_pagamento, crm_contact_id")
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

  const total = items.reduce(
    (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.preco_unitario) || 0),
    0,
  );

  const totalCusto = items.reduce(
    (acc, it) => acc + (Number(it.quantidade) || 0) * (Number(it.custo_unitario) || 0),
    0,
  );

  const lucro = total - totalCusto;
  const margemPct = total > 0 ? (lucro / total) * 100 : 0;

  const filteredContacts = useMemo(() => contacts, [contacts]);

  function addProduct(productId: string) {
    const p = products?.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.product_id === productId);
      if (existing) {
        return prev.map((it) =>
          it.product_id === productId
            ? { ...it, quantidade: String((Number(it.quantidade) || 0) + 1) }
            : it,
        );
      }
      return [
        ...prev,
        {
          product_id: p.id,
          nome: p.nome,
          quantidade: "1",
          preco_unitario: String(p.preco_venda ?? ""),
          custo_unitario: String(p.custo_unitario ?? ""),
          custo_padrao: String(p.custo_unitario ?? ""),
        },
      ];
    });
    setProductPickerOpen(false);
  }

  function addServiceLine() {
    setItems((prev) => [
      ...prev,
      { product_id: "", nome: "Serviço", quantidade: "1", preco_unitario: "", custo_unitario: "", custo_padrao: "" },
    ]);
  }

  function updateItem(idx: number, patch: Partial<SaleItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setCliente(null);
    setItems([]);
    setForm({
      forma: "vista",
      forma_pagamento: "Pix",
      data_venda: new Date().toISOString().slice(0, 10),
      vencimento: new Date().toISOString().slice(0, 10),
      observacoes: "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (items.length === 0) {
      toast.error("Adicione pelo menos um item");
      return;
    }
    for (const it of items) {
      if (!it.nome.trim()) {
        toast.error("Informe o nome do item");
        return;
      }
      if (!(Number(it.quantidade) > 0) || !(Number(it.preco_unitario) > 0)) {
        toast.error(`Informe quantidade e preço para "${it.nome}"`);
        return;
      }
    }
    setSaving(true);
    try {
      const valor = total;
      const partes = items.map((it) => `${it.quantidade}x ${it.nome}`).join(", ");
      const descricao = `Venda${cliente?.name ? ` - ${cliente.name}` : ""} (${partes})`;

      for (const it of items) {
        if (it.product_id) {
          const custoVenda = Number(it.custo_unitario);
          const { error: smErr } = await supabase.from("stock_movements").insert({
            company_id: selected,
            product_id: it.product_id,
            tipo: "saida",
            quantidade: Number(it.quantidade),
            custo_unitario: Number.isFinite(custoVenda) && custoVenda > 0 ? custoVenda : null,
            motivo: "Venda",
          });
          if (smErr) throw smErr;
        }
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
          data: form.data_venda,
          crm_contact_id: cliente?.id ?? null,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("receivables").insert({
          company_id: selected,
          descricao,
          cliente: cliente?.name ?? null,
          crm_contact_id: cliente?.id ?? null,
          valor,
          vencimento: form.vencimento,
          forma_recebimento: form.forma_pagamento,
          conta_id: account?.id,
          status: "em_aberto",
        });
        if (error) throw error;
      }

      toast.success("Venda registrada");
      generateOrderHTML({ openPrint: true });
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["vendas-list"] });
      qc.invalidateQueries({ queryKey: ["products-sel"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  function generateOrderHTML({ openPrint }: { openPrint: boolean }) {
    const orderNumber = `OS-${Date.now().toString().slice(-8)}`;
    const empresaDoc = company?.cnpj ?? company?.documento ?? "";
    const empresaEnd = [company?.endereco, company?.bairro, company?.cidade, company?.estado, company?.cep]
      .filter(Boolean)
      .join(", ");
    const linhas = items
      .map(
        (it) => `
        <tr>
          <td>${escapeHtml(it.nome)}</td>
          <td style="text-align:center">${Number(it.quantidade)}</td>
          <td style="text-align:right">${formatMoney(Number(it.preco_unitario))}</td>
          <td style="text-align:right">${formatMoney(Number(it.quantidade) * Number(it.preco_unitario))}</td>
        </tr>`,
      )
      .join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${orderNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color:#111; margin: 32px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .muted { color:#666; font-size: 12px; }
  .row { display:flex; justify-content:space-between; gap:16px; margin-top: 16px; }
  .card { border:1px solid #ddd; border-radius:8px; padding:12px; flex:1; }
  table { width:100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
  th { background: #f7f7f7; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  .totals { margin-top: 12px; text-align: right; font-size: 14px; }
  .totals .grand { font-size: 20px; font-weight: 700; margin-top: 6px; }
  .footer { margin-top: 32px; font-size: 11px; color:#666; text-align:center; }
  .signs { display:flex; gap:24px; margin-top: 48px; }
  .sign { flex:1; border-top:1px solid #333; padding-top:6px; text-align:center; font-size:12px; }
  @media print { body { margin: 16mm; } .noprint { display:none; } }
</style></head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div>
      <h1>${escapeHtml(company?.nome_fantasia || company?.nome || "")}</h1>
      <div class="muted">${escapeHtml(company?.nome || "")}</div>
      <div class="muted">${empresaDoc ? "CNPJ/CPF: " + escapeHtml(empresaDoc) : ""}</div>
      <div class="muted">${escapeHtml(empresaEnd)}</div>
      <div class="muted">${escapeHtml(company?.telefone || "")} ${company?.email ? "· " + escapeHtml(company.email) : ""}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888">Ordem de Serviço / Venda</div>
      <div style="font-size:20px; font-weight:700">${orderNumber}</div>
      <div class="muted">Data: ${formatDate(form.data_venda)}</div>
    </div>
  </div>

  <div class="row">
    <div class="card">
      <div style="font-size:11px; text-transform:uppercase; color:#888">Cliente</div>
      <div style="font-weight:600; margin-top:4px">${escapeHtml(cliente?.name || "Consumidor")}</div>
      <div class="muted">${escapeHtml(cliente?.cpf_cnpj || "")}</div>
      <div class="muted">${escapeHtml(cliente?.email || "")} ${cliente?.phone ? "· " + escapeHtml(cliente.phone) : ""}</div>
    </div>
    <div class="card">
      <div style="font-size:11px; text-transform:uppercase; color:#888">Pagamento</div>
      <div style="margin-top:4px"><b>Forma:</b> ${escapeHtml(form.forma_pagamento)}</div>
      <div><b>Condição:</b> ${form.forma === "vista" ? "À vista" : "A prazo"}</div>
      ${form.forma === "prazo" ? `<div><b>Vencimento:</b> ${formatDate(form.vencimento)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead><tr><th>Descrição</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço Un.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="totals">
    <div class="grand">TOTAL: ${formatMoney(total)}</div>
  </div>

  ${form.observacoes ? `<div class="card" style="margin-top:16px"><b>Observações:</b><br/>${escapeHtml(form.observacoes)}</div>` : ""}

  <div class="signs">
    <div class="sign">Empresa</div>
    <div class="sign">Cliente</div>
  </div>

  <div class="footer">Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
  <div class="noprint" style="margin-top:16px; text-align:center">
    <button onclick="window.print()" style="padding:8px 16px; cursor:pointer">Imprimir / Salvar PDF</button>
  </div>
</body></html>`;

    if (openPrint) {
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      } else {
        toast.error("Pop-up bloqueado. Permita pop-ups para gerar a OS.");
      }
    }
    return html;
  }

  function printPastSaleOS(row: {
    id: string;
    descricao: string | null;
    valor: number | string | null;
    data?: string | null;
    vencimento?: string | null;
    forma_pagamento?: string | null;
    cliente?: string | null;
  }, tipo: "vista" | "prazo") {
    const orderNumber = `OS-${String(row.id).slice(0, 8).toUpperCase()}`;
    const empresaDoc = company?.cnpj ?? company?.documento ?? "";
    const empresaEnd = [company?.endereco, company?.bairro, company?.cidade, company?.estado, company?.cep]
      .filter(Boolean)
      .join(", ");
    const dataRef = tipo === "vista" ? row.data : row.vencimento;
    const valor = Number(row.valor) || 0;
    const desc = row.descricao || "Venda";
    // descricao salva no formato: "Venda - Cliente (2x Item A, 1x Item B)"
    const matchItens = desc.match(/\(([^)]+)\)\s*$/);
    const matchCliente = desc.match(/Venda\s*-\s*([^(]+?)\s*\(/);
    const clienteNome = row.cliente || (matchCliente ? matchCliente[1].trim() : "Consumidor");
    const itensTxt = matchItens ? matchItens[1] : desc;
    const itensArr = itensTxt.split(",").map((s) => s.trim()).filter(Boolean);
    const linhas = itensArr
      .map((it) => `<tr><td>${escapeHtml(it)}</td></tr>`)
      .join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${orderNumber}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color:#111; margin: 32px; }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .muted { color:#666; font-size: 12px; }
  .row { display:flex; justify-content:space-between; gap:16px; margin-top: 16px; }
  .card { border:1px solid #ddd; border-radius:8px; padding:12px; flex:1; }
  table { width:100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
  th { background: #f7f7f7; font-size: 12px; text-transform: uppercase; letter-spacing: .5px; }
  .totals { margin-top: 12px; text-align: right; font-size: 14px; }
  .totals .grand { font-size: 20px; font-weight: 700; margin-top: 6px; }
  .footer { margin-top: 32px; font-size: 11px; color:#666; text-align:center; }
  .signs { display:flex; gap:24px; margin-top: 48px; }
  .sign { flex:1; border-top:1px solid #333; padding-top:6px; text-align:center; font-size:12px; }
  @media print { body { margin: 16mm; } .noprint { display:none; } }
</style></head>
<body>
  <div style="display:flex; justify-content:space-between; align-items:flex-start;">
    <div>
      <h1>${escapeHtml(company?.nome_fantasia || company?.nome || "")}</h1>
      <div class="muted">${escapeHtml(company?.nome || "")}</div>
      <div class="muted">${empresaDoc ? "CNPJ/CPF: " + escapeHtml(empresaDoc) : ""}</div>
      <div class="muted">${escapeHtml(empresaEnd)}</div>
      <div class="muted">${escapeHtml(company?.telefone || "")} ${company?.email ? "· " + escapeHtml(company.email) : ""}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888">Ordem de Serviço / Venda</div>
      <div style="font-size:20px; font-weight:700">${orderNumber}</div>
      <div class="muted">Data: ${dataRef ? formatDate(dataRef) : "—"}</div>
    </div>
  </div>

  <div class="row">
    <div class="card">
      <div style="font-size:11px; text-transform:uppercase; color:#888">Cliente</div>
      <div style="font-weight:600; margin-top:4px">${escapeHtml(clienteNome)}</div>
    </div>
    <div class="card">
      <div style="font-size:11px; text-transform:uppercase; color:#888">Pagamento</div>
      <div style="margin-top:4px"><b>Forma:</b> ${escapeHtml(row.forma_pagamento || "—")}</div>
      <div><b>Condição:</b> ${tipo === "vista" ? "À vista" : "A prazo"}</div>
      ${tipo === "prazo" && row.vencimento ? `<div><b>Vencimento:</b> ${formatDate(row.vencimento)}</div>` : ""}
    </div>
  </div>

  <table>
    <thead><tr><th>Descrição</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <div class="totals">
    <div class="grand">TOTAL: ${formatMoney(valor)}</div>
  </div>

  <div class="signs">
    <div class="sign">Empresa</div>
    <div class="sign">Cliente</div>
  </div>

  <div class="footer">Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
  <div class="noprint" style="margin-top:16px; text-align:center">
    <button onclick="window.print()" style="padding:8px 16px; cursor:pointer">Imprimir / Salvar PDF</button>
  </div>
</body></html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    } else {
      toast.error("Pop-up bloqueado. Permita pop-ups para gerar a OS.");
  }

  type ParsedItem = { nome: string; qtd: number; preco: number; custo: number; subtotal: number; custoTotal: number; margem: number };
  function parseSaleItems(descricao: string | null, valorTotal: number): ParsedItem[] {
    const desc = descricao || "";
    const matchItens = desc.match(/\(([^)]+)\)\s*$/);
    const itensTxt = matchItens ? matchItens[1] : "";
    const partes = itensTxt.split(",").map((s) => s.trim()).filter(Boolean);
    const parsed: ParsedItem[] = partes.map((p) => {
      const m = p.match(/^(\d+(?:[.,]\d+)?)x\s+(.+)$/i);
      const qtd = m ? Number(m[1].replace(",", ".")) : 1;
      const nome = m ? m[2].trim() : p;
      const prod = products?.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
      const preco = Number(prod?.preco_venda ?? 0);
      const custo = Number(prod?.custo_unitario ?? 0);
      const subtotal = qtd * preco;
      const custoTotal = qtd * custo;
      return { nome, qtd, preco, custo, subtotal, custoTotal, margem: subtotal - custoTotal };
    });
    // Se nada foi parseado, cria linha única usando o valor total
    if (parsed.length === 0) {
      return [{ nome: desc || "Venda", qtd: 1, preco: valorTotal, custo: 0, subtotal: valorTotal, custoTotal: 0, margem: valorTotal }];
    }
    // Ajusta preço proporcionalmente se total parseado divergir do valor real
    const totalParsed = parsed.reduce((a, b) => a + b.subtotal, 0);
    if (totalParsed > 0 && Math.abs(totalParsed - valorTotal) > 0.5) {
      const factor = valorTotal / totalParsed;
      return parsed.map((it) => {
        const subtotal = it.subtotal * factor;
        return { ...it, preco: it.preco * factor, subtotal, margem: subtotal - it.custoTotal };
      });
    }
    return parsed;
  }

  function buildSaleMarginRows(row: {
    id: string; descricao: string | null; valor: number | string | null;
    data?: string | null; vencimento?: string | null;
    forma_pagamento?: string | null; cliente?: string | null;
  }, tipo: "vista" | "prazo") {
    const valor = Number(row.valor) || 0;
    const itens = parseSaleItems(row.descricao, valor);
    const totalReceita = itens.reduce((a, b) => a + b.subtotal, 0);
    const totalCusto = itens.reduce((a, b) => a + b.custoTotal, 0);
    const margem = totalReceita - totalCusto;
    const dataRef = tipo === "vista" ? row.data : row.vencimento;
    const descLimpa = (row.descricao || "").replace(/\s*\([^)]*\)\s*$/, "");
    const matchCliente = descLimpa.match(/Venda\s*-\s*(.+)$/);
    const cliente = row.cliente || (matchCliente ? matchCliente[1].trim() : "Consumidor");
    return { itens, totalReceita, totalCusto, margem, dataRef, cliente, tipo };
  }

  function openHtmlWindow(html: string) {
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    else { toast.error("Pop-up bloqueado. Permita pop-ups para gerar o relatório."); }
  }

  const reportStyles = `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color:#111; margin: 32px; }
    h1 { margin: 0 0 4px; font-size: 22px; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    .muted { color:#666; font-size: 12px; }
    .row { display:flex; justify-content:space-between; gap:16px; margin-top: 16px; flex-wrap: wrap; }
    .card { border:1px solid #ddd; border-radius:8px; padding:12px; flex:1; min-width: 180px; }
    .stat { font-size: 11px; text-transform: uppercase; letter-spacing:.5px; color:#888; }
    .stat-val { font-size: 18px; font-weight: 700; margin-top: 2px; }
    table { width:100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
    th { background: #f7f7f7; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
    .num { text-align: right; }
    .center { text-align: center; }
    .pos { color: #15803d; font-weight: 600; }
    .neg { color: #b91c1c; font-weight: 600; }
    .sale-block { margin-top: 20px; border:1px solid #e5e5e5; border-radius:8px; padding:12px; page-break-inside: avoid; }
    .footer { margin-top: 32px; font-size: 11px; color:#666; text-align:center; }
    @media print { body { margin: 16mm; } .noprint { display:none; } }
  `;

  function printSaleMarginReport(row: {
    id: string; descricao: string | null; valor: number | string | null;
    data?: string | null; vencimento?: string | null;
    forma_pagamento?: string | null; cliente?: string | null;
  }, tipo: "vista" | "prazo") {
    const { itens, totalReceita, totalCusto, margem, dataRef, cliente } = buildSaleMarginRows(row, tipo);
    const margemPct = totalReceita > 0 ? (margem / totalReceita) * 100 : 0;
    const empresa = company?.nome_fantasia || company?.nome || "";
    const reportNumber = `REL-MG-${String(row.id).slice(0, 8).toUpperCase()}`;
    const linhas = itens.map((it) => `
      <tr>
        <td>${escapeHtml(it.nome)}</td>
        <td class="center">${it.qtd}</td>
        <td class="num">${formatMoney(it.preco)}</td>
        <td class="num">${formatMoney(it.custo)}</td>
        <td class="num">${formatMoney(it.subtotal)}</td>
        <td class="num">${formatMoney(it.custoTotal)}</td>
        <td class="num ${it.margem >= 0 ? "pos" : "neg"}">${formatMoney(it.margem)}</td>
      </tr>`).join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${reportNumber}</title><style>${reportStyles}</style></head><body>
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h1>${escapeHtml(empresa)}</h1>
          <div class="muted">Relatório de Margem da Venda</div>
        </div>
        <div style="text-align:right">
          <div class="stat">Documento</div>
          <div style="font-size:18px; font-weight:700">${reportNumber}</div>
          <div class="muted">${dataRef ? formatDate(dataRef) : "—"}</div>
        </div>
      </div>
      <div class="row">
        <div class="card"><div class="stat">Cliente</div><div style="font-weight:600">${escapeHtml(cliente)}</div></div>
        <div class="card"><div class="stat">Pagamento</div><div style="font-weight:600">${escapeHtml(row.forma_pagamento || "—")} (${tipo === "vista" ? "À vista" : "A prazo"})</div></div>
      </div>
      <div class="row">
        <div class="card"><div class="stat">Receita</div><div class="stat-val">${formatMoney(totalReceita)}</div></div>
        <div class="card"><div class="stat">Custo direto</div><div class="stat-val">${formatMoney(totalCusto)}</div></div>
        <div class="card"><div class="stat">Margem</div><div class="stat-val ${margem >= 0 ? "pos" : "neg"}">${formatMoney(margem)} (${margemPct.toFixed(1)}%)</div></div>
      </div>
      <h2>Itens vendidos</h2>
      <table>
        <thead><tr><th>Produto</th><th class="center">Qtd</th><th class="num">Preço un.</th><th class="num">Custo un.</th><th class="num">Receita</th><th class="num">Custo</th><th class="num">Margem</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      <div class="footer">Custos baseados no cadastro atual do produto. Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
      <div class="noprint" style="margin-top:16px; text-align:center"><button onclick="window.print()" style="padding:8px 16px; cursor:pointer">Imprimir / Salvar PDF</button></div>
    </body></html>`;
    openHtmlWindow(html);
  }

  function printPeriodMarginReport() {
    if (!vendas) { toast.error("Dados ainda carregando"); return; }
    const from = reportFrom;
    const to = reportTo;
    const inRange = (d: string | null | undefined) => {
      if (!d) return false;
      const s = String(d).slice(0, 10);
      return s >= from && s <= to;
    };
    const vistaRows = vendas.tx
      .filter((r) => inRange(r.data))
      .map((r) => buildSaleMarginRows(r, "vista"));
    const prazoRows = vendas.rec
      .filter((r) => inRange(r.vencimento))
      .map((r) => buildSaleMarginRows({ ...r, data: null, forma_pagamento: null }, "prazo"));
    const all = [...vistaRows, ...prazoRows];
    if (all.length === 0) { toast.error("Nenhuma venda no período selecionado"); return; }
    const totalReceita = all.reduce((a, b) => a + b.totalReceita, 0);
    const totalCusto = all.reduce((a, b) => a + b.totalCusto, 0);
    const totalMargem = totalReceita - totalCusto;
    const margemPct = totalReceita > 0 ? (totalMargem / totalReceita) * 100 : 0;
    const empresa = company?.nome_fantasia || company?.nome || "";

    const blocks = all.map((s, idx) => {
      const pct = s.totalReceita > 0 ? (s.margem / s.totalReceita) * 100 : 0;
      const linhas = s.itens.map((it) => `
        <tr>
          <td>${escapeHtml(it.nome)}</td>
          <td class="center">${it.qtd}</td>
          <td class="num">${formatMoney(it.preco)}</td>
          <td class="num">${formatMoney(it.custo)}</td>
          <td class="num">${formatMoney(it.subtotal)}</td>
          <td class="num">${formatMoney(it.custoTotal)}</td>
          <td class="num ${it.margem >= 0 ? "pos" : "neg"}">${formatMoney(it.margem)}</td>
        </tr>`).join("");
      return `<div class="sale-block">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px">
          <div><b>#${idx + 1} · ${escapeHtml(s.cliente)}</b> <span class="muted">(${s.tipo === "vista" ? "à vista" : "a prazo"})</span></div>
          <div class="muted">${s.dataRef ? formatDate(s.dataRef) : "—"}</div>
        </div>
        <table>
          <thead><tr><th>Produto</th><th class="center">Qtd</th><th class="num">Preço un.</th><th class="num">Custo un.</th><th class="num">Receita</th><th class="num">Custo</th><th class="num">Margem</th></tr></thead>
          <tbody>${linhas}</tbody>
          <tfoot><tr>
            <td colspan="4" class="num"><b>Totais</b></td>
            <td class="num"><b>${formatMoney(s.totalReceita)}</b></td>
            <td class="num"><b>${formatMoney(s.totalCusto)}</b></td>
            <td class="num ${s.margem >= 0 ? "pos" : "neg"}"><b>${formatMoney(s.margem)} (${pct.toFixed(1)}%)</b></td>
          </tr></tfoot>
        </table>
      </div>`;
    }).join("");

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>Relatório de Fluxo + Margem</title><style>${reportStyles}</style></head><body>
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h1>${escapeHtml(empresa)}</h1>
          <div class="muted">Fluxo de Vendas + Margem por Venda</div>
        </div>
        <div style="text-align:right">
          <div class="stat">Período</div>
          <div style="font-size:16px; font-weight:700">${formatDate(from)} — ${formatDate(to)}</div>
          <div class="muted">${all.length} venda(s)</div>
        </div>
      </div>
      <div class="row">
        <div class="card"><div class="stat">Faturamento</div><div class="stat-val">${formatMoney(totalReceita)}</div></div>
        <div class="card"><div class="stat">Custos diretos</div><div class="stat-val">${formatMoney(totalCusto)}</div></div>
        <div class="card"><div class="stat">Margem do período</div><div class="stat-val ${totalMargem >= 0 ? "pos" : "neg"}">${formatMoney(totalMargem)} (${margemPct.toFixed(1)}%)</div></div>
      </div>
      <h2>Detalhamento por venda</h2>
      ${blocks}
      <div class="footer">Custos baseados no cadastro atual de cada produto. Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
      <div class="noprint" style="margin-top:16px; text-align:center"><button onclick="window.print()" style="padding:8px 16px; cursor:pointer">Imprimir / Salvar PDF</button></div>
    </body></html>`;
    openHtmlWindow(html);
  }

  }



  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Fluxo de Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registre vendas com múltiplos itens, gere ordem de serviço imprimível e dê baixa automática no estoque.
          </p>
        </div>
        <Button onClick={() => setOpen((v) => !v)}>{open ? "Fechar" : "Nova venda"}</Button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="bg-card border rounded-2xl p-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Cliente (CRM)</Label>
            <div className="flex gap-2">
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" role="combobox" className="flex-1 justify-between font-normal">
                    {cliente
                      ? <span className="truncate">{cliente.name}{cliente.cpf_cnpj ? ` · ${cliente.cpf_cnpj}` : ""}</span>
                      : <span className="text-muted-foreground">Selecionar cliente do CRM (opcional)</span>}
                    <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar por nome, CPF/CNPJ, email..." />
                    <CommandList>
                      <CommandEmpty>Nenhum contato. Cadastre um novo cliente.</CommandEmpty>
                      <CommandGroup>
                        {filteredContacts.map((c) => (
                          <CommandItem key={c.id} value={`${c.name} ${c.cpf_cnpj ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`}
                            onSelect={() => { setCliente(c); setPickerOpen(false); }}>
                            <Check className={cn("mr-2 size-4", cliente?.id === c.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{c.name}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {c.cpf_cnpj ?? ""}{c.cpf_cnpj && c.email ? " · " : ""}{c.email ?? ""}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {cliente && (
                <Button type="button" variant="ghost" size="icon" onClick={() => setCliente(null)} title="Limpar">
                  <X className="size-4" />
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setContactDialog(true)}>
                <UserPlus className="size-4" /> Novo
              </Button>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Itens da venda</Label>
              <div className="flex gap-2">
                <Popover open={productPickerOpen} onOpenChange={setProductPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm">
                      <Plus className="size-4" /> Adicionar produto
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[320px]" align="end">
                    <Command>
                      <CommandInput placeholder="Buscar produto..." />
                      <CommandList>
                        <CommandEmpty>Nenhum produto.</CommandEmpty>
                        <CommandGroup>
                          {products?.map((p) => (
                            <CommandItem key={p.id} value={p.nome} onSelect={() => addProduct(p.id)}>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{p.nome}</div>
                                <div className="text-xs text-muted-foreground">
                                  Estoque: {Number(p.quantidade)} · {formatMoney(Number(p.preco_venda ?? 0))}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button type="button" variant="outline" size="sm" onClick={addServiceLine}>
                  <Plus className="size-4" /> Serviço avulso
                </Button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed rounded-lg p-6 text-center">
                Adicione produtos do estoque ou um serviço avulso para iniciar a venda.
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {items.map((it, idx) => {
                  const qtd = Number(it.quantidade) || 0;
                  const preco = Number(it.preco_unitario) || 0;
                  const custo = Number(it.custo_unitario) || 0;
                  const subtotal = qtd * preco;
                  const margem = qtd * (preco - custo);
                  const margemPct = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
                  const custoAlterado = it.product_id && it.custo_padrao && Number(it.custo_padrao) !== custo;
                  return (
                    <div key={idx} className="p-3 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-5">
                          <Label className="text-xs text-muted-foreground">Descrição</Label>
                          <Input value={it.nome} onChange={(e) => updateItem(idx, { nome: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">Qtd</Label>
                          <Input type="number" min="0" step="1" className="text-center"
                            value={it.quantidade}
                            onChange={(e) => updateItem(idx, { quantidade: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">Preço un.</Label>
                          <Input type="number" min="0" step="0.01" className="text-right"
                            value={it.preco_unitario}
                            onChange={(e) => updateItem(idx, { preco_unitario: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs text-muted-foreground">
                            Custo un. {it.product_id && it.custo_padrao ? `(padrão ${formatMoney(Number(it.custo_padrao))})` : ""}
                          </Label>
                          <Input type="number" min="0" step="0.01" className="text-right"
                            placeholder="Opcional"
                            value={it.custo_unitario}
                            onChange={(e) => updateItem(idx, { custo_unitario: e.target.value })} />
                        </div>
                        <div className="col-span-1 flex justify-end pt-5">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground pl-1">
                        <div className="flex gap-3">
                          <span>Subtotal: <b className="text-foreground">{formatMoney(subtotal)}</b></span>
                          {custo > 0 && (
                            <span>
                              Margem: <b className={margem >= 0 ? "text-success" : "text-destructive"}>
                                {formatMoney(margem)} ({margemPct.toFixed(1)}%)
                              </b>
                            </span>
                          )}
                        </div>
                        {custoAlterado && (
                          <span className="text-warning">Custo desta venda difere do cadastro (não altera o produto)</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label>Data da venda</Label>
            <Input type="date" value={form.data_venda} onChange={(e) => setForm({ ...form, data_venda: e.target.value })} />
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
          <div className="space-y-1 md:col-span-2">
            <Label>Observações</Label>
            <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Opcional (aparece na OS)" />
          </div>

          <div className="md:col-span-2 flex items-center justify-between border-t pt-3 gap-3 flex-wrap">
            <div className="text-sm">Total: <span className="font-display font-bold text-lg">{formatMoney(total)}</span></div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={items.length === 0} onClick={() => generateOrderHTML({ openPrint: true })}>
                <FileText className="size-4" /> Pré-visualizar OS
              </Button>
              <Button type="submit" disabled={saving || items.length === 0}>
                {saving ? "Salvando..." : "Registrar venda e gerar OS"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {selected && (
        <ContactForm
          open={contactDialog}
          onOpenChange={setContactDialog}
          editing={null}
          companyId={selected}
          onSaved={(created) => {
            qc.invalidateQueries({ queryKey: ["crm-sel", selected] });
            qc.invalidateQueries({ queryKey: ["crm", selected] });
            if (created) setCliente({
              id: created.id, name: created.name, tipo: created.tipo,
              cpf_cnpj: created.cpf_cnpj, email: created.email, phone: created.phone,
            });
          }}
        />
      )}

      <section className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-semibold flex items-center gap-2"><TrendingUp className="size-5" /> Relatório do período</h2>
            <p className="text-xs text-muted-foreground">Faturamento, custos diretos e margem de cada venda no intervalo escolhido.</p>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="h-9" />
            </div>
            <Button type="button" onClick={printPeriodMarginReport}>
              <Download className="size-4" /> Exportar Fluxo + Margem
            </Button>
          </div>
        </div>
      </section>

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
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.descricao}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(row.data)} • {row.forma_pagamento ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="font-display font-semibold text-success">{formatMoney(Number(row.valor))}</div>
                    <Button type="button" variant="outline" size="sm" onClick={() => printPastSaleOS(row, "vista")}>
                      <FileText className="size-4" /> Baixar OS
                    </Button>
                  </div>
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
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.descricao}</p>
                    <p className="text-xs text-muted-foreground">{row.cliente ?? "—"} • venc. {formatDate(row.vencimento)} • {row.status}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="font-display font-semibold">{formatMoney(Number(row.valor))}</div>
                    <Button type="button" variant="outline" size="sm" onClick={() => printPastSaleOS(row, "prazo")}>
                      <FileText className="size-4" /> Baixar OS
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      

      {selected && (
        <section className="space-y-3">
          <h2 className="text-lg font-display font-semibold">Documentos da área comercial</h2>
          <div className="bg-card border rounded-2xl p-4">
            <AttachmentsPanel companyId={selected} module="sales" />
          </div>
        </section>
      )}
    </div>
  );
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

