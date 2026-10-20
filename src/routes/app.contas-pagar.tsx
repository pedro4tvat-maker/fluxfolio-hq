import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney, downloadCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Search, PlusCircle, Download, CheckCircle2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contas-pagar")({ component: ContasAPagar });

const FORMAS = ["Dinheiro", "Pix", "Transferência bancária", "Boleto", "Cartão de débito", "Cartão de crédito", "Outro"];

type Payable = {
  id: string; descricao: string; fornecedor: string | null; valor: number;
  vencimento: string; data_pagamento: string | null; status: string;
  categoria_id: string | null; conta_id: string | null; centro_custo_id: string | null;
  forma_pagamento: string | null;
};

function ContasAPagar() {
  const { companies, selected, isLoading: companiesLoading } = useSelectedCompany();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | "em_aberto" | "vencido" | "pago">("todos");
  const [periodo, setPeriodo] = useState<"todos" | "7d" | "30d" | "vencidos">("todos");
  const [categoria, setCategoria] = useState("todas");
  const [centro, setCentro] = useState("todos");
  const [openNew, setOpenNew] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categories", selected], enabled: !!selected,
    queryFn: async () => (await supabase.from("categories").select("id,nome,tipo").eq("company_id", selected!).is("deleted_at", null).order("nome")).data ?? [],
  });
  const { data: contas = [] } = useQuery({
    queryKey: ["accounts", selected], enabled: !!selected,
    queryFn: async () => (await supabase.from("financial_accounts").select("id,nome").eq("company_id", selected!).order("nome")).data ?? [],
  });
  const { data: centros = [] } = useQuery({
    queryKey: ["centers", selected], enabled: !!selected,
    queryFn: async () => (await supabase.from("cost_centers").select("id,nome").eq("company_id", selected!).is("deleted_at", null).order("nome")).data ?? [],
  });

  const { data = [], isLoading } = useQuery<Payable[]>({
    queryKey: ["payables", selected], enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("payables")
        .select("id,descricao,fornecedor,valor,vencimento,data_pagamento,status,categoria_id,conta_id,centro_custo_id,forma_pagamento")
        .eq("company_id", selected!).is("deleted_at", null).order("vencimento");
      if (error) throw error;
      return (data ?? []) as Payable[];
    },
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const s7 = in7.toISOString().slice(0, 10);
    const s30 = in30.toISOString().slice(0, 10);
    return data.filter((p) => {
      if (query && !`${p.descricao} ${p.fornecedor ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (status !== "todos" && p.status !== status) return false;
      if (categoria !== "todas" && p.categoria_id !== categoria) return false;
      if (centro !== "todos" && p.centro_custo_id !== centro) return false;
      if (periodo === "7d" && (p.vencimento < today || p.vencimento > s7)) return false;
      if (periodo === "30d" && (p.vencimento < today || p.vencimento > s30)) return false;
      if (periodo === "vencidos" && !(p.status !== "pago" && p.vencimento < today)) return false;
      return true;
    });
  }, [data, query, status, categoria, centro, periodo]);

  const resumo = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const s7 = in7.toISOString().slice(0, 10);
    const mes = today.slice(0, 7);
    const abertas = data.filter((p) => p.status !== "pago");
    const vencidas = abertas.filter((p) => p.vencimento < today);
    const semana = abertas.filter((p) => p.vencimento >= today && p.vencimento <= s7);
    const feitasMes = data.filter((p) => p.status === "pago" && (p.data_pagamento ?? "").slice(0, 7) === mes);
    const soma = (l: Payable[]) => l.reduce((t, p) => t + Number(p.valor), 0);
    return {
      aberto: soma(abertas), qtdAberto: abertas.length,
      vencido: soma(vencidas), qtdVencido: vencidas.length,
      semana: soma(semana), qtdSemana: semana.length,
      feitoMes: soma(feitasMes),
    };
  }, [data]);

  const markPaid = useMutation({
    mutationFn: async (p: Payable) => {
      const { error } = await supabase.from("payables").update({
        status: "pago",
        data_pagamento: new Date().toISOString().slice(0, 10),
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conta marcada como paga (saída lançada no caixa)");
      qc.invalidateQueries({ queryKey: ["payables"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revert = useMutation({
    mutationFn: async (p: Payable) => {
      const { error } = await supabase.from("payables").update({
        status: "em_aberto", data_pagamento: null,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pagamento estornado");
      qc.invalidateQueries({ queryKey: ["payables"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payables").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["payables"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = () => {
    if (!filtered.length) return toast.info("Sem dados para exportar");
    const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
    downloadCSV(`contas-a-pagar.csv`, filtered.map((p) => ({
      Vencimento: formatDate(p.vencimento),
      Descrição: p.descricao,
      Fornecedor: p.fornecedor ?? "",
      Categoria: p.categoria_id ? catMap.get(p.categoria_id) ?? "" : "",
      Forma: p.forma_pagamento ?? "",
      Status: p.status,
      Valor: Number(p.valor).toFixed(2),
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
      </div>
    );
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const catNome = new Map(categorias.map((c) => [c.id, c.nome]));
  const filtrosAtivos = query || status !== "todos" || periodo !== "todos" || categoria !== "todas" || centro !== "todos";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Contas a pagar</h1>
          <p className="text-muted-foreground text-sm mt-1">Veja o que vence, pague com um clique e a saída já entra no caixa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="rounded-full h-11 text-muted-foreground" onClick={handleExport}><Download className="size-4" /> Exportar</Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button className="rounded-full h-11 px-5 shadow-sm"><PlusCircle className="size-4" /> Nova conta</Button></DialogTrigger>
            <NewPayableDialog companyId={selected!} categorias={categorias.filter((c) => c.tipo === "saida")} contas={contas} centros={centros} onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["payables"] }); }} />
          </Dialog>
        </div>
      </div>

      {/* Resumo */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-7 sm:py-6 grid gap-5 lg:grid-cols-[1fr_1.7fr] lg:items-center">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total a pagar</div>
          <div className="font-display font-bold text-3xl sm:text-4xl mt-1 tabular-nums">{formatMoney(resumo.aberto)}</div>
          <div className="text-xs text-muted-foreground mt-1">{resumo.qtdAberto} conta(s) em aberto</div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {([
            ["vencidos", "Vencidas", resumo.vencido, `${resumo.qtdVencido} em atraso`, resumo.qtdVencido > 0 ? "text-destructive" : "text-muted-foreground"],
            ["7d", "Próximos 7 dias", resumo.semana, `${resumo.qtdSemana} a vencer`, "text-foreground"],
            ["feitos", "Pagas", resumo.feitoMes, "neste mês", "text-success"],
          ] as const).map(([v, rotulo, valor, dica, cor]) => {
            const ativo = v === "feitos" ? status === "pago" : periodo === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  if (v === "feitos") { setPeriodo("todos"); setStatus(ativo ? "todos" : "pago"); }
                  else { setStatus("todos"); setPeriodo(ativo ? "todos" : v); }
                }}
                className={`text-left rounded-2xl px-3.5 py-3 transition-colors min-w-0 ${ativo ? "bg-background shadow-sm ring-1 ring-primary/30" : "bg-background/60 hover:bg-background"}`}
              >
                <div className={`text-[11px] font-medium ${cor}`}>{rotulo}</div>
                <div className="font-display font-semibold text-sm sm:text-lg tabular-nums truncate">{formatMoney(valor)}</div>
                <div className="text-[10px] text-muted-foreground truncate">{dica}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Busca e filtros */}
      <div className="space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-10 h-11 rounded-full bg-card border shadow-sm" placeholder="Buscar por descrição ou fornecedor..." />
          </div>
          <div className="inline-flex rounded-full bg-muted p-1 self-start lg:self-auto">
            {([["todos", "Todas"], ["em_aberto", "Em aberto"], ["pago", "Pagas"]] as const).map(([v, r]) => (
              <button key={v} type="button" onClick={() => setStatus(v)}
                className={`px-4 h-9 rounded-full text-sm font-medium transition-colors ${status === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([["todos", "Qualquer data"], ["vencidos", "Só vencidas"], ["7d", "Próximos 7 dias"], ["30d", "Próximos 30 dias"]] as const).map(([v, r]) => (
            <button key={v} type="button" onClick={() => setPeriodo(v)}
              className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${periodo === v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
              {r}
            </button>
          ))}
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="h-8 w-[180px] rounded-full text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {categorias.filter((c) => c.tipo === "saida").map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {centros.length > 0 && (
            <Select value={centro} onValueChange={setCentro}>
              <SelectTrigger className="h-8 w-[180px] rounded-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os centros de custo</SelectItem>
                {centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {filtrosAtivos && (
            <button type="button" className="h-8 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setQuery(""); setStatus("todos"); setPeriodo("todos"); setCategoria("todas"); setCentro("todos"); }}>
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Lista */}
      <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma conta encontrada.</p>
        ) : (
          <ul>
            {filtered.map((p) => {
              const feito = p.status === "pago";
              const atrasado = !feito && p.vencimento < hoje;
              const dias = Math.round((new Date(p.vencimento + "T12:00:00").getTime() - new Date(hoje + "T12:00:00").getTime()) / 86400000);
              const [, m, d] = p.vencimento.split("-");
              const situacao = feito ? "Paga" : atrasado ? (dias === -1 ? "Venceu ontem" : `Atrasada ${-dias} dias`) : dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`;
              const corSituacao = feito ? "bg-success/12 text-success" : atrasado ? "bg-destructive/10 text-destructive" : dias <= 3 ? "bg-warning/15 text-warning-foreground" : "bg-muted text-muted-foreground";
              const detalhe = [p.fornecedor, p.categoria_id ? catNome.get(p.categoria_id) : null, p.forma_pagamento].filter(Boolean).join(" · ");
              return (
                <li key={p.id} className="group flex items-center gap-3 sm:gap-4 rounded-2xl px-3 py-3 hover:bg-muted/60 transition-colors">
                  <div className={`w-12 shrink-0 rounded-2xl py-1.5 text-center ${feito ? "bg-success/10 text-success" : atrasado ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                    <div className="font-display font-bold text-lg leading-none tabular-nums">{d}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-0.5">{MESES[Number(m) - 1]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-medium text-sm truncate ${feito ? "text-muted-foreground" : ""}`}>{p.descricao}</span>
                      <span className={`shrink-0 rounded-full px-2 py-px text-[10px] font-medium ${corSituacao}`}>{situacao}</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {detalhe || "—"}
                      {!p.centro_custo_id && centros.length > 0 && <span className="text-warning-foreground"> · sem centro de custo</span>}
                    </div>
                  </div>
                  <div className={`text-sm sm:text-base font-display font-semibold tabular-nums whitespace-nowrap ${feito ? "text-muted-foreground" : ""}`}>
                    {formatMoney(Number(p.valor))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!feito ? (
                      <Button size="sm" className="rounded-full h-8 px-3" onClick={() => markPaid.mutate(p)}>
                        <CheckCircle2 className="size-3.5" /> Pagar
                      </Button>
                    ) : (
                      <button type="button" title="Estornar" className="size-8 grid place-items-center rounded-full hover:bg-background sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                        onClick={() => confirm("Estornar este pagamento?") && revert.mutate(p)}>
                        <Undo2 className="size-3.5" />
                      </button>
                    )}
                    <button type="button" title="Excluir" className="size-8 grid place-items-center rounded-full hover:bg-background text-destructive sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                      onClick={() => confirm("Excluir este lançamento?") && del.mutate(p.id)}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewPayableDialog({ companyId, categorias, contas, centros, onDone }: {
  companyId: string;
  categorias: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
  onDone: () => void;
}) {
  const [f, setF] = useState({
    descricao: "", fornecedor: "", valor: "",
    vencimento: new Date().toISOString().slice(0, 10),
    categoria_id: "", conta_id: "", centro_custo_id: "", forma_pagamento: "",
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    const v = Number(f.valor.replace(",", "."));
    if (!f.descricao.trim()) return toast.error("Informe descrição");
    if (!v || v <= 0) return toast.error("Informe valor válido");
    setSaving(true);
    const { error } = await supabase.from("payables").insert({
      company_id: companyId, descricao: f.descricao.trim(), fornecedor: f.fornecedor || null,
      valor: v, vencimento: f.vencimento,
      categoria_id: f.categoria_id || null, conta_id: f.conta_id || null,
      centro_custo_id: f.centro_custo_id || null, forma_pagamento: f.forma_pagamento || null,
      status: "em_aberto",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada");
    onDone();
  }
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Descrição</Label><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
        <div><Label>Fornecedor</Label><Input value={f.fornecedor} onChange={(e) => setF({ ...f, fornecedor: e.target.value })} /></div>
        <div><Label>Valor</Label><CurrencyInput value={f.valor} onChange={(v) => setF({ ...f, valor: v })} /></div>
        <div><Label>Vencimento</Label><Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></div>
        <div><Label>Forma</Label>
          <Select value={f.forma_pagamento} onValueChange={(v) => setF({ ...f, forma_pagamento: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{FORMAS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Categoria</Label>
          <Select value={f.categoria_id} onValueChange={(v) => setF({ ...f, categoria_id: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Conta</Label>
          <Select value={f.conta_id} onValueChange={(v) => setF({ ...f, conta_id: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{contas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Centro de custo</Label>
          <Select value={f.centro_custo_id} onValueChange={(v) => setF({ ...f, centro_custo_id: v })}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{centros.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex justify-end pt-2"><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></div>
      </div>
    </DialogContent>
  );
}
