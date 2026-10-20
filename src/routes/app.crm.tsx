import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { FiltroBotao } from "@/components/FiltroBotao";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Pencil, Trash2, UserCheck, MessageCircle, Mail, MapPin, UserX, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/crm")({ component: CRMPage });

const TIPOS = ["lead", "cliente", "fornecedor", "parceiro", "outro"] as const;
const STATUSES = ["novo", "em_atendimento", "ativo", "inativo", "perdido"] as const;

type Contact = {
  id: string;
  company_id: string;
  name: string;
  tipo: string;
  cpf_cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  lead_source: string | null;
  status: string;
  responsible: string | null;
  notes: string | null;
  created_at: string;
};

function CRMPage() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Contact | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("*")
        .eq("company_id", selected!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (tipoFilter !== "all" && c.tipo !== tipoFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.cpf_cnpj ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [contacts, search, tipoFilter, statusFilter]);

  function openCreate() { setEditing(null); setOpenForm(true); }
  function openEdit(c: Contact) { setEditing(c); setOpenForm(true); }

  async function inativar(c: Contact) {
    const { error } = await supabase
      .from("crm_contacts")
      .update({ status: "inativo" })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Contato inativado"); qc.invalidateQueries({ queryKey: ["crm", selected] }); }
  }

  async function excluir(c: Contact) {
    if (!confirm(`Excluir ${c.name}?`)) return;
    const { error } = await supabase.from("crm_contacts").update({ deleted_at: new Date().toISOString() }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["crm", selected] }); }
  }

  async function transformarEmCliente(c: Contact) {
    const { error } = await supabase
      .from("crm_contacts")
      .update({ tipo: "cliente", status: "ativo" })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Lead convertido em cliente"); qc.invalidateQueries({ queryKey: ["crm", selected] }); }
  }

  if (!selected) {
    return <div className="text-muted-foreground">Selecione uma empresa para acessar o CRM.</div>;
  }

  const contagem = (t: string) => contacts.filter((c) => c.tipo === t).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Seus clientes, leads, fornecedores e parceiros num lugar só.
          </p>
        </div>
        <Button className="rounded-full h-11 px-5 shadow-sm" onClick={openCreate}><Plus className="size-4" /> Novo contato</Button>
      </div>

      {/* Resumo por tipo (clique para filtrar) */}
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-7 sm:py-6 grid gap-5 lg:grid-cols-[1fr_2fr] lg:items-center">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Contatos cadastrados</div>
          <div className="font-display font-bold text-3xl sm:text-4xl mt-1 tabular-nums">{contacts.length}</div>
          <div className="text-xs text-muted-foreground mt-1">{contacts.filter((c) => c.status === "ativo").length} ativo(s)</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {(["cliente", "lead", "fornecedor", "parceiro"] as const).map((t) => {
            const ativo = tipoFilter === t;
            return (
              <button key={t} type="button" onClick={() => setTipoFilter(ativo ? "all" : t)}
                className={`text-left rounded-2xl px-3.5 py-3 transition-colors ${ativo ? "bg-background shadow-sm ring-1 ring-primary/30" : "bg-background/60 hover:bg-background"}`}>
                <div className="text-[11px] font-medium text-muted-foreground">{labelTipo(t)}s</div>
                <div className="font-display font-bold text-2xl tabular-nums mt-0.5">{contagem(t)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Busca e filtros */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-10 h-11 rounded-full bg-card border shadow-sm" placeholder="Buscar por nome, CPF/CNPJ, e-mail ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <FiltroBotao
          grupos={[
            { titulo: "Tipo", valor: tipoFilter, padrao: "all", onChange: setTipoFilter,
              opcoes: [["all", "Todos"], ...TIPOS.map((t) => [t, labelTipo(t)] as [string, string])] },
            { titulo: "Situação", valor: statusFilter, padrao: "all", onChange: setStatusFilter,
              opcoes: [["all", "Todas"], ...STATUSES.map((st) => [st, labelStatus(st)] as [string, string])] },
          ]}
        />
      </div>

      {/* Lista */}
      <section className="bg-card rounded-3xl shadow-card p-2 sm:p-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <Users className="size-10 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground mt-2">Nenhum contato encontrado.</p>
          </div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const zap = linkWhatsApp(c.whatsapp || c.phone);
              const local = [c.city, c.state].filter(Boolean).join("/");
              return (
                <li key={c.id} className="group flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/60 transition-colors">
                  <Link to="/app/crm/$id" params={{ id: c.id }} className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`size-10 shrink-0 rounded-full grid place-items-center text-sm font-semibold ${c.status === "inativo" || c.status === "perdido" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                      {iniciais(c.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{c.name}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-px text-[10px] font-medium text-muted-foreground">{labelTipo(c.tipo)}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-3">
                        {c.phone && <span>{c.phone}</span>}
                        {c.email && <span className="hidden sm:inline-flex items-center gap-1 truncate"><Mail className="size-3" /> {c.email}</span>}
                        {local && <span className="hidden md:inline-flex items-center gap-1"><MapPin className="size-3" /> {local}</span>}
                        {!c.phone && !c.email && !local && <span>Sem contato cadastrado</span>}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {zap && (
                      <a href={zap} target="_blank" rel="noopener noreferrer" title="Conversar no WhatsApp" className="size-8 grid place-items-center rounded-full hover:bg-background text-success">
                        <MessageCircle className="size-4" />
                      </a>
                    )}
                    {c.tipo === "lead" && (
                      <button type="button" onClick={() => transformarEmCliente(c)} title="Converter em cliente" className="size-8 grid place-items-center rounded-full hover:bg-background text-primary">
                        <UserCheck className="size-4" />
                      </button>
                    )}
                    <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button type="button" onClick={() => openEdit(c)} title="Editar" className="size-8 grid place-items-center rounded-full hover:bg-background"><Pencil className="size-3.5" /></button>
                      {c.status !== "inativo" && (
                        <button type="button" onClick={() => inativar(c)} title="Inativar" className="size-8 grid place-items-center rounded-full hover:bg-background"><UserX className="size-3.5" /></button>
                      )}
                      <button type="button" onClick={() => excluir(c)} title="Excluir" className="size-8 grid place-items-center rounded-full hover:bg-background text-destructive"><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ContactForm
        open={openForm}
        onOpenChange={setOpenForm}
        editing={editing}
        companyId={selected}
        onSaved={() => qc.invalidateQueries({ queryKey: ["crm", selected] })}
      />
    </div>
  );
}

export function iniciais(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

// Link do WhatsApp a partir do telefone (assume Brasil quando vier sem o 55)
export function linkWhatsApp(tel: string | null | undefined) {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return `https://wa.me/${d.length <= 11 ? "55" + d : d}`;
}

export function ContactForm({
  open, onOpenChange, editing, companyId, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Contact | null;
  companyId: string;
  onSaved: (created?: Contact) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Contact>>({});

  // Resetar form quando abre
  useMemo(() => {
    if (open) {
      setForm(editing ?? { tipo: "cliente", status: "novo" });
    }
  }, [open, editing]);

  function set<K extends keyof Contact>(k: K, v: Contact[K] | string | null) {
    setForm((p) => ({ ...p, [k]: v as Contact[K] }));
  }

  async function save() {
    if (!form.name || !form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      tipo: form.tipo ?? "cliente",
      cpf_cnpj: form.cpf_cnpj?.trim() || null,
      phone: form.phone?.trim() || null,
      whatsapp: form.whatsapp?.trim() || null,
      email: form.email?.trim() || null,
      city: form.city?.trim() || null,
      state: form.state?.trim() || null,
      address: form.address?.trim() || null,
      lead_source: form.lead_source?.trim() || null,
      status: form.status ?? "novo",
      responsible: form.responsible?.trim() || null,
      notes: form.notes?.trim() || null,
    };
    if (editing?.id) {
      const { error } = await supabase.from("crm_contacts").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Contato atualizado");
      onOpenChange(false);
      onSaved();
    } else {
      const { data, error } = await supabase.from("crm_contacts").insert(payload).select().single();
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Contato cadastrado");
      onOpenChange(false);
      onSaved(data as Contact);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Label>Nome *</Label>
            <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={form.tipo ?? "cliente"} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{labelTipo(t)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={form.status ?? "novo"} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{labelStatus(s)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>CPF/CNPJ</Label>
            <Input value={form.cpf_cnpj ?? ""} onChange={(e) => set("cpf_cnpj", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Telefone</Label>
            <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>WhatsApp</Label>
            <Input value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cidade</Label>
            <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} maxLength={2} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Endereço</Label>
            <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Origem do lead</Label>
            <Input value={form.lead_source ?? ""} onChange={(e) => set("lead_source", e.target.value)} placeholder="Indicação, site, Instagram..." />
          </div>
          <div className="space-y-1">
            <Label>Responsável</Label>
            <Input value={form.responsible ?? ""} onChange={(e) => set("responsible", e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function labelTipo(t: string) {
  return ({ lead: "Lead", cliente: "Cliente", fornecedor: "Fornecedor", parceiro: "Parceiro", outro: "Outro" }[t] ?? t);
}
export function labelStatus(s: string) {
  return ({ novo: "Novo", em_atendimento: "Em atendimento", ativo: "Ativo", inativo: "Inativo", perdido: "Perdido" }[s] ?? s);
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    novo: "bg-primary/10 text-primary",
    em_atendimento: "bg-warning/15 text-warning-foreground",
    ativo: "bg-success/12 text-success",
    inativo: "bg-muted text-muted-foreground",
    perdido: "bg-destructive/10 text-destructive",
  };
  return <span className={`shrink-0 inline-block text-[10px] font-medium px-2 py-px rounded-full ${map[status] ?? ""}`}>{labelStatus(status)}</span>;
}
