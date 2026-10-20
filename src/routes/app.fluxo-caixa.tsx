import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowDownCircle, ArrowUpCircle, BarChart3, Download, Filter, List, Search, Building2 } from "lucide-react";
import { toast } from "sonner";
import { sugerirCategoria, type Historico, type Sugestao } from "@/lib/sugestao-categoria";
import { FluxoGraficos } from "@/components/FluxoGraficos";
import { FluxoListaCompacta } from "@/components/FluxoListaCompacta";

export const Route = createFileRoute("/app/fluxo-caixa")({
  // ?novo=entrada|saida abre a janela de lançamento direto (atalho do dashboard)
  validateSearch: (s: Record<string, unknown>): { novo?: "entrada" | "saida" } => ({
    novo: s.novo === "entrada" || s.novo === "saida" ? s.novo : undefined,
  }),
  component: FluxoCaixa,
});

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
  const [novoTipo, setNovoTipo] = useState<"entrada" | "saida">("entrada");
  const [visao, setVisao] = useState<"lista" | "grafico">("grafico");

  // Atalhos: E = nova entrada, S = nova saída (fora de campos de texto e sem janela aberta)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (document.querySelector('[role="dialog"]')) return;
      const k = e.key.toLowerCase();
      if (k === "e" || k === "s") {
        e.preventDefault();
        setNovoTipo(k === "e" ? "entrada" : "saida");
        setOpenNew(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const { novo } = Route.useSearch();
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (!novo) return;
    setNovoTipo(novo);
    setOpenNew(true);
    navigate({ search: {}, replace: true });
  }, [novo, navigate]);
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
      const { data } = await supabase.from("categories").select("id, nome, tipo").eq("company_id", selected).is("deleted_at", null).order("nome");
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
      const { data } = await supabase.from("cost_centers").select("id, nome").eq("company_id", selected).is("deleted_at", null).order("nome");
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
      const { error } = await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", id);
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
          <Button variant="outline" onClick={() => { setNovoTipo("entrada"); setOpenNew(true); }} title="Atalho: tecla E">
            <ArrowUpCircle className="size-4 text-success" /> Entrada <kbd className="ml-1 hidden md:inline text-[10px] text-muted-foreground border rounded px-1">E</kbd>
          </Button>
          <Button variant="outline" onClick={() => { setNovoTipo("saida"); setOpenNew(true); }} title="Atalho: tecla S">
            <ArrowDownCircle className="size-4 text-destructive" /> Saída <kbd className="ml-1 hidden md:inline text-[10px] text-muted-foreground border rounded px-1">S</kbd>
          </Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            {openNew && <TransactionDialog
              key={novoTipo}
              tipoInicial={novoTipo}
              companyId={selected!}
              categorias={categorias}
              contas={contas}
              costCenters={costCenters}
              onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); }}
              onSavedKeepOpen={() => { qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); }}
            />}
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

      {/* Resumo do período */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-7 sm:py-6 grid gap-5 md:grid-cols-[1.1fr_2fr] md:items-center">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Saldo do período</div>
          <div className={`font-display font-bold text-3xl sm:text-4xl mt-1 tabular-nums ${totals.saldo < 0 ? "text-destructive" : "text-success"}`}>{formatMoney(totals.saldo)}</div>
          <div className="text-xs text-muted-foreground mt-1">{totals.count} lançamento(s) no filtro</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {([
            ["Entradas", totals.entradas, "bg-success", "text-success", ArrowUpCircle],
            ["Saídas", totals.saidas, "bg-destructive", "text-destructive", ArrowDownCircle],
          ] as const).map(([rotulo, valor, barra, cor, Icone]) => {
            const maior = Math.max(totals.entradas, totals.saidas, 1);
            return (
              <div key={rotulo} className="rounded-2xl bg-background/70 px-4 py-3">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${cor}`}><Icone className="size-3.5" /> {rotulo}</div>
                <div className="font-display font-semibold text-xl tabular-nums mt-0.5">{formatMoney(valor)}</div>
                <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${barra}`} style={{ width: `${(valor / maior) * 100}%`, opacity: 0.75 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Busca, filtros e forma de visualizar */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar lançamento pela descrição..."
              className="pl-10 h-11 rounded-full bg-card border shadow-sm"
            />
          </div>
          <div className="inline-flex rounded-full bg-muted p-1 self-start lg:self-auto" role="tablist" aria-label="Forma de visualizar">
            {([["grafico", "Gráfico", BarChart3], ["lista", "Lista", List]] as const).map(([v, r, Icone]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={visao === v}
                onClick={() => setVisao(v)}
                className={`px-3.5 h-9 rounded-full text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${visao === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icone className="size-4" /> {r}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {([["mes", "Mês atual"], ["mes_passado", "Mês passado"], ["30d", "Últimos 30 dias"], ["tudo", "Tudo"]] as const).map(([v, r]) => (
            <button
              key={v}
              type="button"
              onClick={() => setPeriod(v)}
              className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${period === v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
            >
              {r}
            </button>
          ))}
          <span className="hidden sm:block w-px h-5 bg-border mx-1" />
          {([["todos", "Todos"], ["entrada", "Entradas"], ["saida", "Saídas"]] as const).map(([v, r]) => (
            <button
              key={v}
              type="button"
              onClick={() => setTipo(v)}
              className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${tipo === v ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"}`}
            >
              {r}
            </button>
          ))}
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="h-8 w-[190px] rounded-full text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {(tipo !== "todos" || categoria !== "todas" || search) && (
            <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={() => { setTipo("todos"); setCategoria("todas"); setSearch(""); }}>
              <Filter className="size-3.5" /> Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Lançamentos: gráfico ou lista */}
      {visao === "grafico" ? (
        <FluxoGraficos lancamentos={filtered} categorias={categorias} />
      ) : (
        <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
          <FluxoListaCompacta
            itens={filtered}
            carregando={isLoading}
            categorias={categorias}
            contas={contas}
            onEditar={setEditingTx}
            onExcluir={setConfirmDelete}
          />
        </section>
      )}

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

    </div>
  );
}

function TransactionDialog({
  tx, tipoInicial, companyId, categorias, contas, costCenters, onDone, onSavedKeepOpen,
}: {
  tx?: Tx;
  tipoInicial?: "entrada" | "saida";
  onSavedKeepOpen?: () => void;
  companyId: string;
  categorias: { id: string; nome: string; tipo: string }[];
  contas: { id: string; nome: string }[];
  costCenters: { id: string; nome: string }[];
  onDone: () => void;
}) {
  const [tipo, setTipo] = useState<"entrada" | "saida">(tx?.tipo ?? tipoInicial ?? "entrada");
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
  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const categoriaManual = useRef(!!tx?.categoria_id); // usuário escolheu a categoria? então não sobrescreve
  const valorRef = useRef<HTMLInputElement>(null);

  // Histórico da empresa para sugerir categoria pela descrição (só em lançamento novo)
  const { data: historico } = useQuery({
    queryKey: ["fluxo-historico-categorias", companyId],
    enabled: !!companyId && !tx,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("descricao, tipo, categoria_id, conta_id, centro_custo_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .not("categoria_id", "is", null)
        .order("data", { ascending: false })
        .limit(800);
      return (data ?? []) as Historico[];
    },
  });

  useEffect(() => {
    if (tx || !historico) return;
    const t = setTimeout(() => {
      const s = sugerirCategoria(descricao, tipo, historico);
      setSugestao(s);
      if (s && !categoriaManual.current && categorias.some((c) => c.id === s.categoria_id && c.tipo === tipo)) {
        setCategoriaId(s.categoria_id);
        if (!contaId && s.conta_id) setContaId(s.conta_id);
        if (!centroCustoId && s.centro_custo_id) setCentroCustoId(s.centro_custo_id);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descricao, tipo, historico]);

  // Últimas vendas da empresa (para vincular OS na descrição)
  const { data: ultimasVendas } = useQuery({
    queryKey: ["fluxo-vendas-recentes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, data, descricao, valor, os_code")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .eq("tipo", "entrada")
        .or("descricao.ilike.Venda%,descricao.ilike.OS %,os_code.not.is.null")
        .order("data", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });


  const catFiltered = categorias.filter((c) => c.tipo === tipo);

  const submit = async (continuar = false) => {
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
      if (continuar) {
        // Mantém data, tipo, conta, forma, status e centro de custo para o próximo
        setCategoriaId(""); categoriaManual.current = false; setSugestao(null);
        onSavedKeepOpen?.();
        setTimeout(() => valorRef.current?.focus(), 50);
        return;
      }
    }
    onDone();
  };

  return (
    <DialogContent
      className="max-w-lg max-h-[90vh] overflow-y-auto"
      onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !saving) { e.preventDefault(); submit(false); } }}
      onOpenAutoFocus={(e) => { if (!tx) { e.preventDefault(); setTimeout(() => valorRef.current?.focus(), 30); } }}
    >
      <DialogHeader>
        <DialogTitle>{tx ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant={tipo === "entrada" ? "default" : "outline"} onClick={() => { setTipo("entrada"); setCategoriaId(""); categoriaManual.current = false; }}>
            <ArrowUpCircle className="size-4" /> Entrada
          </Button>
          <Button type="button" variant={tipo === "saida" ? "default" : "outline"} onClick={() => { setTipo("saida"); setCategoriaId(""); categoriaManual.current = false; }}>
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
            <Input ref={valorRef} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
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
            <Select value={categoriaId} onValueChange={(v) => { categoriaManual.current = true; setCategoriaId(v); }}>
              <SelectTrigger><SelectValue placeholder={catFiltered.length ? "Selecionar" : "Nenhuma cadastrada"} /></SelectTrigger>
              <SelectContent>
                {catFiltered.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            {!tx && sugestao && categoriaId === sugestao.categoria_id && !categoriaManual.current && (
              <p className="mt-1 text-[11px] text-muted-foreground truncate" title={sugestao.exemplo}>
                Sugerida pelo histórico (“{sugestao.exemplo}”)
              </p>
            )}
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
      <DialogFooter className="gap-2 sm:gap-2 items-center">
        <span className="hidden sm:inline text-[11px] text-muted-foreground mr-auto">Ctrl + Enter para salvar</span>
        {!tx && (
          <Button variant="outline" onClick={() => submit(true)} disabled={saving}>Salvar e lançar outro</Button>
        )}
        <Button onClick={() => submit(false)} disabled={saving}>{saving ? "Salvando..." : tx ? "Atualizar lançamento" : "Salvar lançamento"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
