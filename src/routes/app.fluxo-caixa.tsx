import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { CompanySwitcher } from "@/components/company-switcher";
import { formatMoney, formatDate, monthRange, downloadCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownCircle, ArrowUpCircle, Download, Filter, PlusCircle, Search, Trash2, Pencil, Lock, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";

export const Route = createFileRoute("/app/fluxo-caixa")({ component: FluxoCaixa });

const FORMAS = ["Dinheiro", "Pix", "Transferência bancária", "Boleto", "Cartão de débito", "Cartão de crédito", "Outro"];

type Tx = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  status: "previsto" | "realizado" | "cancelado";
  forma_pagamento: string | null;
  categoria_id: string | null;
  conta_id: string | null;
  centro_custo_id: string | null;
  payable_id: string | null;
  receivable_id: string | null;
  observacoes: string | null;
};

function FluxoCaixa() {
  const { companies, selected, isLoading: companiesLoading } = useSelectedCompany();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<"mes" | "mes_passado" | "30d" | "tudo">("mes");
  const [tipo, setTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [categoria, setCategoria] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [editingTx, setEditingTx] = useState<Tx | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Tx | null>(null);

  const range = useMemo(() => {
    const today = new Date();
    if (period === "mes") return monthRange(today);
    if (period === "mes_passado") return monthRange(new Date(today.getFullYear(), today.getMonth() - 1, 15));
    if (period === "30d") {
      const start = new Date(today); start.setDate(start.getDate() - 30);
      return { start: start.toISOString().slice(0, 10), end: today.toISOString().slice(0, 10) };
    }
    return { start: "1900-01-01", end: "2999-12-31" };
  }, [period]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categories", selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase.from("categories").select("id, nome, tipo").eq("company_id", selected).order("nome");
      return data ?? [];
    },
    enabled: !!selected,
  });

  const { data: contas = [] } = useQuery({
    queryKey: ["accounts", selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase.from("financial_accounts").select("id, nome").eq("company_id", selected).eq("ativo", true).order("nome");
      return data ?? [];
    },
    enabled: !!selected,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost_centers", selected],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase.from("cost_centers").select("id, nome").eq("company_id", selected).order("nome");
      return data ?? [];
    },
    enabled: !!selected,
  });

  const { data: tx = [], isLoading } = useQuery({
    queryKey: ["transactions", selected, range.start, range.end],
    queryFn: async (): Promise<Tx[]> => {
      if (!selected) return [];
      const { data, error } = await supabase
        .from("transactions").select("*")
        .eq("company_id", selected)
        .is("deleted_at", null)
        .gte("data", range.start).lte("data", range.end)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tx[];
    },
    enabled: !!selected,
  });

  const filtered = useMemo(() => {
    return tx.filter((t) => {
      if (tipo !== "todos" && t.tipo !== tipo) return false;
      if (categoria !== "todas" && t.categoria_id !== categoria) return false;
      if (search && !t.descricao.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tx, tipo, categoria, search]);

  const totals = useMemo(() => {
    const entradas = filtered.filter((t) => t.tipo === "entrada" && t.status === "realizado").reduce((s, t) => s + Number(t.valor), 0);
    const saidas = filtered.filter((t) => t.tipo === "saida" && t.status === "realizado").reduce((s, t) => s + Number(t.valor), 0);
    return { entradas, saidas, saldo: entradas - saidas, count: filtered.length };
  }, [filtered]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento excluído");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard-companies"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error("Erro ao excluir", { description: e.message }),
  });

  const handleExport = () => {
    if (!filtered.length) return toast.info("Sem dados para exportar");
    const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
    const contaMap = new Map(contas.map((c) => [c.id, c.nome]));
    downloadCSV(`fluxo-caixa-${range.start}-a-${range.end}.csv`, filtered.map((t) => ({
      Data: formatDate(t.data),
      Tipo: t.tipo === "entrada" ? "Entrada" : "Saída",
      Descrição: t.descricao,
      Categoria: t.categoria_id ? catMap.get(t.categoria_id) ?? "" : "",
      Conta: t.conta_id ? contaMap.get(t.conta_id) ?? "" : "",
      "Forma de pagamento": t.forma_pagamento ?? "",
      Status: t.status,
      Valor: Number(t.valor).toFixed(2),
    })));
  };

  if (companiesLoading) {
    return <div className="text-muted-foreground p-10 text-center">Carregando dados da empresa...</div>;
  }

  if (!companies.length) {
    return (
      <div className="max-w-2xl mx-auto bg-card border rounded-2xl p-10 text-center shadow-card">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h2 className="font-display font-semibold mt-4">Nenhuma empresa disponível</h2>
        <p className="text-sm text-muted-foreground mt-1">Cadastre uma empresa em Empresas para começar a lançar movimentações.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Fluxo de caixa</h1>
          <p className="text-muted-foreground text-sm mt-1">Lançamentos de entradas e saídas da empresa.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CompanySwitcher />
          <Button variant="outline" onClick={handleExport}><Download className="size-4" /> Exportar CSV</Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><PlusCircle className="size-4" /> Novo lançamento</Button>
            </DialogTrigger>
            <TransactionDialog
              companyId={selected!}
              categorias={categorias}
              contas={contas}
              costCenters={costCenters}
              onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); }}
            />
          </Dialog>
          <Dialog open={!!editingTx} onOpenChange={(o) => !o && setEditingTx(null)}>
            {editingTx && (
              <TransactionDialog
                key={editingTx.id}
                tx={editingTx}
                companyId={selected!}
                categorias={categorias}
                contas={contas}
                costCenters={costCenters}
                onDone={() => { setEditingTx(null); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); }}
              />
            )}
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 text-success text-sm font-medium"><ArrowUpCircle className="size-4" /> Entradas</div>
          <div className="font-display font-bold text-2xl mt-2">{formatMoney(totals.entradas)}</div>
        </div>
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="flex items-center gap-2 text-destructive text-sm font-medium"><ArrowDownCircle className="size-4" /> Saídas</div>
          <div className="font-display font-bold text-2xl mt-2">{formatMoney(totals.saidas)}</div>
        </div>
        <div className="bg-card border rounded-2xl p-5 shadow-card">
          <div className="text-muted-foreground text-sm font-medium">Saldo do período</div>
          <div className={`font-display font-bold text-2xl mt-2 ${totals.saldo < 0 ? "text-destructive" : "text-success"}`}>{formatMoney(totals.saldo)}</div>
          <div className="text-xs text-muted-foreground mt-1">{totals.count} lançamento(s)</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border rounded-2xl p-4 shadow-card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Descrição..." className="pl-9" />
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Período</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mes">Mês atual</SelectItem>
              <SelectItem value="mes_passado">Mês passado</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="tudo">Todo o histórico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Categoria</Label>
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(tipo !== "todos" || categoria !== "todas" || search) && (
          <Button variant="ghost" onClick={() => { setTipo("todos"); setCategoria("todas"); setSearch(""); }}>
            <Filter className="size-4" /> Limpar
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum lançamento encontrado neste período.</TableCell></TableRow>
              ) : filtered.map((t) => {
                const cat = categorias.find((c) => c.id === t.categoria_id);
                const conta = contas.find((c) => c.id === t.conta_id);
                const isAuto = !!(t.payable_id || t.receivable_id);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(t.data)}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {t.descricao}
                        {isAuto && <span title="Gerado por Contas a Pagar/Receber"><Lock className="size-3 text-muted-foreground" /></span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cat?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{conta?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{t.forma_pagamento ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        t.status === "realizado" ? "bg-success/10 text-success border-success/20" :
                        t.status === "previsto" ? "bg-warning/10 text-warning-foreground border-warning/30" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>{t.status}</span>
                    </TableCell>
                    <TableCell className={`text-right font-display font-semibold whitespace-nowrap ${t.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {t.tipo === "entrada" ? "+" : "−"} {formatMoney(t.valor)}
                      {!t.categoria_id && t.tipo === "saida" && <div className="text-[9px] text-amber-600 font-bold uppercase animate-pulse">Sem Categoria</div>}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          disabled={isAuto}
                          title={isAuto ? "Lançamento automático. Edite em Contas a Pagar/Receber." : "Editar"}
                          onClick={() => setEditingTx(t)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          disabled={isAuto}
                          title={isAuto ? "Lançamento automático. Edite em Contas a Pagar/Receber." : "Excluir"}
                          onClick={() => setConfirmDelete(t)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lançamento "{confirmDelete?.descricao}" será removido do fluxo de caixa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && delMut.mutate(confirmDelete.id)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selected && (
        <section className="space-y-2">
          <h2 className="font-display font-semibold">Documentos do fluxo de caixa</h2>
          <div className="bg-card border rounded-2xl p-4 shadow-card">
            <AttachmentsPanel companyId={selected} module="cash_flow" />
          </div>
        </section>
      )}
    </div>
  );
}

function TransactionDialog({
  tx, companyId, categorias, contas, costCenters, onDone,
}: {
  tx?: Tx;
  companyId: string;
  categorias: { id: string; nome: string; tipo: string }[];
  contas: { id: string; nome: string }[];
  costCenters: { id: string; nome: string }[];
  onDone: () => void;
}) {
  const [tipo, setTipo] = useState<"entrada" | "saida">(tx?.tipo ?? "entrada");
  const [data, setData] = useState(tx?.data ?? new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState(tx?.descricao ?? "");
  const [valor, setValor] = useState(tx ? String(tx.valor).replace(".", ",") : "");
  const [categoriaId, setCategoriaId] = useState<string>(tx?.categoria_id ?? "");
  const [contaId, setContaId] = useState<string>(tx?.conta_id ?? "");
  const [centroCustoId, setCentroCustoId] = useState<string>(tx?.centro_custo_id ?? "");
  const [forma, setForma] = useState<string>(tx?.forma_pagamento ?? "");
  const [status, setStatus] = useState<"realizado" | "previsto">(tx?.status === "cancelado" ? "realizado" : (tx?.status as any) ?? "realizado");
  const [observacoes, setObservacoes] = useState(tx?.observacoes ?? "");
  const [saving, setSaving] = useState(false);
  const [descMode, setDescMode] = useState<"livre" | "os">("livre");

  // Últimas vendas da empresa (para vincular OS na descrição)
  const { data: ultimasVendas } = useQuery({
    queryKey: ["fluxo-vendas-recentes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, data, descricao, valor, os_code")
        .eq("company_id", companyId)
        .eq("tipo", "entrada")
        .or("descricao.ilike.Venda%,descricao.ilike.OS %,os_code.not.is.null")
        .order("data", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });


  const catFiltered = categorias.filter((c) => c.tipo === tipo);

  const submit = async () => {
    const v = Number(valor.replace(",", "."));
    if (!descricao.trim()) return toast.error("Informe uma descrição");
    if (!v || v <= 0) return toast.error("Informe um valor válido");
    setSaving(true);
    if (tx) {
      const { error } = await supabase.from("transactions").update({
        data, tipo, descricao: descricao.trim(), valor: v, status,
        categoria_id: categoriaId || null,
        conta_id: contaId || null,
        centro_custo_id: centroCustoId || null,
        forma_pagamento: forma || null,
        observacoes: observacoes.trim() || null,
      }).eq("id", tx.id);
      setSaving(false);
      if (error) return toast.error("Erro ao atualizar", { description: error.message });
      toast.success("Lançamento atualizado");
    } else {
      const { error } = await supabase.from("transactions").insert({
        company_id: companyId,
        data, tipo, descricao: descricao.trim(), valor: v, status,
        categoria_id: categoriaId || null,
        conta_id: contaId || null,
        centro_custo_id: centroCustoId || null,
        forma_pagamento: forma || null,
        observacoes: observacoes.trim() || null,
      });
      setSaving(false);
      if (error) return toast.error("Erro ao salvar", { description: error.message });
      toast.success("Lançamento criado");
      setDescricao(""); setValor(""); setObservacoes("");
    }
    onDone();
  };

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{tx ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={tipo === "entrada" ? "default" : "outline"} onClick={() => { setTipo("entrada"); setCategoriaId(""); }}>
            <ArrowUpCircle className="size-4" /> Entrada
          </Button>
          <Button type="button" variant={tipo === "saida" ? "default" : "outline"} onClick={() => { setTipo("saida"); setCategoriaId(""); }}>
            <ArrowDownCircle className="size-4" /> Saída
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
        </div>

        <div>
          <Label>Descrição</Label>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant={descMode === "livre" ? "default" : "outline"} onClick={() => setDescMode("livre")}>
              Texto livre
            </Button>
            <Button type="button" size="sm" variant={descMode === "os" ? "default" : "outline"} onClick={() => setDescMode("os")}>
              Vincular OS de venda
            </Button>
          </div>
          {descMode === "livre" ? (
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Venda do dia" />
          ) : (
            <Select
              onValueChange={(id) => {
                const v = ultimasVendas?.find((x) => x.id === id);
                if (v) {
                  const os = (v as { os_code?: string | null }).os_code ?? v.id.slice(0, 8).toUpperCase();
                  setDescricao(`OS ${os}`);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={ultimasVendas?.length ? "Selecione uma venda" : "Nenhuma venda registrada"} />
              </SelectTrigger>
              <SelectContent>
                {(ultimasVendas ?? []).map((v) => {
                  const os = (v as { os_code?: string | null }).os_code ?? v.id.slice(0, 8).toUpperCase();
                  return (
                    <SelectItem key={v.id} value={v.id}>
                      {formatDate(v.data)} · OS {os} · {formatMoney(Number(v.valor))}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
          {descMode === "os" && descricao && (
            <p className="mt-1 text-xs text-muted-foreground truncate">→ {descricao}</p>
          )}
        </div>


        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger><SelectValue placeholder={catFiltered.length ? "Selecionar" : "Nenhuma cadastrada"} /></SelectTrigger>
              <SelectContent>
                {catFiltered.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Conta</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger><SelectValue placeholder={contas.length ? "Selecionar" : "Nenhuma cadastrada"} /></SelectTrigger>
              <SelectContent>
                {contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={setForma}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>
                {FORMAS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realizado">Realizado</SelectItem>
                <SelectItem value="previsto">Previsto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Centro de custo</Label>
          <Select value={centroCustoId} onValueChange={setCentroCustoId}>
            <SelectTrigger><SelectValue placeholder={costCenters.length ? "Selecionar" : "Nenhum cadastrado"} /></SelectTrigger>
            <SelectContent>
              {costCenters.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Observações</Label>
          <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : tx ? "Atualizar lançamento" : "Salvar lançamento"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
