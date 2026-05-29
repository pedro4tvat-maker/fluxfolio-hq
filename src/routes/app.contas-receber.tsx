import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { formatDate, formatMoney, downloadCSV } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Search, PlusCircle, Download, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/contas-receber")({ component: ContasAReceber });

const FORMAS = ["Dinheiro", "Pix", "Transferência bancária", "Boleto", "Cartão de débito", "Cartão de crédito", "Outro"];

type Receivable = {
  id: string; descricao: string; cliente: string | null; valor: number;
  vencimento: string; data_recebimento: string | null; status: string;
  categoria_id: string | null; conta_id: string | null; centro_custo_id: string | null;
  forma_recebimento: string | null;
};

function ContasAReceber() {
  const { companies, selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"todos" | "em_aberto" | "vencido" | "recebido">("todos");
  const [periodo, setPeriodo] = useState<"todos" | "7d" | "30d" | "vencidos">("todos");
  const [categoria, setCategoria] = useState("todas");
  const [centro, setCentro] = useState("todos");
  const [openNew, setOpenNew] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categories", selected], enabled: !!selected,
    queryFn: async () => (await supabase.from("categories").select("id,nome,tipo").eq("company_id", selected!).order("nome")).data ?? [],
  });
  const { data: contas = [] } = useQuery({
    queryKey: ["accounts", selected], enabled: !!selected,
    queryFn: async () => (await supabase.from("financial_accounts").select("id,nome").eq("company_id", selected!).order("nome")).data ?? [],
  });
  const { data: centros = [] } = useQuery({
    queryKey: ["centers", selected], enabled: !!selected,
    queryFn: async () => (await supabase.from("cost_centers").select("id,nome").eq("company_id", selected!).order("nome")).data ?? [],
  });

  const { data = [], isLoading } = useQuery<Receivable[]>({
    queryKey: ["receivables", selected], enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("receivables")
        .select("id,descricao,cliente,valor,vencimento,data_recebimento,status,categoria_id,conta_id,centro_custo_id,forma_recebimento")
        .eq("company_id", selected!).order("vencimento");
      if (error) throw error;
      return (data ?? []) as Receivable[];
    },
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(); in30.setDate(in30.getDate() + 30);
    const s7 = in7.toISOString().slice(0, 10);
    const s30 = in30.toISOString().slice(0, 10);
    return data.filter((p) => {
      if (query && !`${p.descricao} ${p.cliente ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (status !== "todos" && p.status !== status) return false;
      if (categoria !== "todas" && p.categoria_id !== categoria) return false;
      if (centro !== "todos" && p.centro_custo_id !== centro) return false;
      if (periodo === "7d" && (p.vencimento < today || p.vencimento > s7)) return false;
      if (periodo === "30d" && (p.vencimento < today || p.vencimento > s30)) return false;
      if (periodo === "vencidos" && !(p.status !== "recebido" && p.vencimento < today)) return false;
      return true;
    });
  }, [data, query, status, categoria, centro, periodo]);

  const totals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const aberto = filtered.filter((p) => p.status !== "recebido").reduce((s, p) => s + Number(p.valor), 0);
    const vencido = filtered.filter((p) => p.status !== "recebido" && p.vencimento < today).reduce((s, p) => s + Number(p.valor), 0);
    const recebido = filtered.filter((p) => p.status === "recebido").reduce((s, p) => s + Number(p.valor), 0);
    return { aberto, vencido, recebido };
  }, [filtered]);

  const markReceived = useMutation({
    mutationFn: async (p: Receivable) => {
      const { error } = await supabase.from("receivables").update({
        status: "recebido", data_recebimento: new Date().toISOString().slice(0, 10),
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marcado como recebido (entrada lançada no caixa)");
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("receivables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["receivables"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = () => {
    if (!filtered.length) return toast.info("Sem dados para exportar");
    const catMap = new Map(categorias.map((c) => [c.id, c.nome]));
    downloadCSV(`contas-a-receber.csv`, filtered.map((p) => ({
      Vencimento: formatDate(p.vencimento),
      Descrição: p.descricao,
      Cliente: p.cliente ?? "",
      Categoria: p.categoria_id ? catMap.get(p.categoria_id) ?? "" : "",
      Forma: p.forma_recebimento ?? "",
      Status: p.status,
      Valor: Number(p.valor).toFixed(2),
    })));
  };

  if (!companies.length) {
    return (
      <div className="max-w-2xl mx-auto bg-card border rounded-2xl p-10 text-center shadow-card">
        <Building2 className="size-12 mx-auto text-muted-foreground/40" />
        <h2 className="font-display font-semibold mt-4">Nenhuma empresa disponível</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Contas a receber</h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe recebimentos, baixe-os e gere entradas automáticas no caixa.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="size-4" /> Exportar CSV</Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><PlusCircle className="size-4" /> Novo recebimento</Button></DialogTrigger>
            <NewReceivableDialog companyId={selected!} categorias={categorias.filter((c) => c.tipo === "entrada")} contas={contas} centros={centros} onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["receivables"] }); }} />
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card label="Total em aberto" value={formatMoney(totals.aberto)} />
        <Card label="Vencidos" value={formatMoney(totals.vencido)} tone="destructive" />
        <Card label="Recebidos no filtro" value={formatMoney(totals.recebido)} tone="success" />
      </div>

      <div className="bg-card border rounded-2xl p-4 shadow-card grid gap-3 md:grid-cols-5">
        <div className="md:col-span-2">
          <Label className="text-xs text-muted-foreground">Buscar</Label>
          <div className="relative">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Descrição ou cliente..." />
          </div>
        </div>
        <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as typeof status)} options={[["todos", "Todos"], ["em_aberto", "Em aberto"], ["vencido", "Vencidos"], ["recebido", "Recebidos"]]} />
        <FilterSelect label="Período" value={periodo} onChange={(v) => setPeriodo(v as typeof periodo)} options={[["todos", "Todos"], ["7d", "Próximos 7 dias"], ["30d", "Próximos 30 dias"], ["vencidos", "Apenas vencidos"]]} />
        <FilterSelect label="Centro" value={centro} onChange={setCentro} options={[["todos", "Todos"], ...centros.map((c) => [c.id, c.nome] as [string, string])]} />
        <FilterSelect label="Categoria" value={categoria} onChange={setCategoria} options={[["todas", "Todas"], ...categorias.filter((c) => c.tipo === "entrada").map((c) => [c.id, c.nome] as [string, string])]} />
      </div>

      <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Forma</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum recebimento encontrado.</TableCell></TableRow>
              ) : filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.vencimento)}</TableCell>
                  <TableCell className="font-medium">{p.descricao}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.cliente ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.forma_recebimento ?? "—"}</TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      p.status === "recebido" ? "bg-success/10 text-success border-success/20" :
                      p.status === "vencido" ? "bg-destructive/10 text-destructive border-destructive/20" :
                      "bg-warning/10 text-warning-foreground border-warning/30"
                    }`}>{p.status.replace("_", " ")}</span>
                  </TableCell>
                  <TableCell className="text-right font-display font-semibold">{formatMoney(Number(p.valor))}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {p.status !== "recebido" && (
                      <Button size="sm" variant="outline" onClick={() => markReceived.mutate(p)}>
                        <CheckCircle2 className="size-4" /> Receber
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(p.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "destructive" | "success" }) {
  const cls = tone === "destructive" ? "text-destructive" : tone === "success" ? "text-success" : "";
  return (
    <div className="bg-card border rounded-2xl p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display font-bold text-2xl mt-2 ${cls}`}>{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function NewReceivableDialog({ companyId, categorias, contas, centros, onDone }: {
  companyId: string;
  categorias: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  centros: { id: string; nome: string }[];
  onDone: () => void;
}) {
  const [f, setF] = useState({
    descricao: "", cliente: "", valor: "",
    vencimento: new Date().toISOString().slice(0, 10),
    categoria_id: "", conta_id: "", centro_custo_id: "", forma_recebimento: "",
  });
  const [saving, setSaving] = useState(false);
  async function save() {
    const v = Number(f.valor.replace(",", "."));
    if (!f.descricao.trim()) return toast.error("Informe descrição");
    if (!v || v <= 0) return toast.error("Informe valor válido");
    setSaving(true);
    const { error } = await supabase.from("receivables").insert({
      company_id: companyId, descricao: f.descricao.trim(), cliente: f.cliente || null,
      valor: v, vencimento: f.vencimento,
      categoria_id: f.categoria_id || null, conta_id: f.conta_id || null,
      centro_custo_id: f.centro_custo_id || null, forma_recebimento: f.forma_recebimento || null,
      status: "em_aberto",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Recebimento criado");
    onDone();
  }
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Novo recebimento</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Descrição</Label><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
        <div><Label>Cliente</Label><Input value={f.cliente} onChange={(e) => setF({ ...f, cliente: e.target.value })} /></div>
        <div><Label>Valor</Label><Input value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></div>
        <div><Label>Vencimento</Label><Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></div>
        <div><Label>Forma</Label>
          <Select value={f.forma_recebimento} onValueChange={(v) => setF({ ...f, forma_recebimento: v })}>
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
