import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Pencil, Trash2, UserCheck } from "lucide-react";
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
    const { error } = await supabase.from("crm_contacts").delete().eq("id", c.id);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre e acompanhe clientes, leads e parceiros comerciais.
          </p>
        </div>
        <Button onClick={openCreate}><Plus className="size-4" /> Novo contato</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, CPF/CNPJ, email ou telefone" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t} value={t}>{labelTipo(t)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{labelStatus(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">CPF/CNPJ</th>
              <th className="px-4 py-2 font-medium">Contato</th>
              <th className="px-4 py-2 font-medium">Cidade/UF</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum contato encontrado.</td></tr>
            ) : filtered.map((c) => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2">
                  <Link to="/app/crm/$id" params={{ id: c.id }} className="font-medium hover:underline">{c.name}</Link>
                </td>
                <td className="px-4 py-2">{labelTipo(c.tipo)}</td>
                <td className="px-4 py-2 font-mono text-xs">{c.cpf_cnpj ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  {c.phone && <div>{c.phone}</div>}
                  {c.email && <div className="text-muted-foreground">{c.email}</div>}
                </td>
                <td className="px-4 py-2 text-xs">{[c.city, c.state].filter(Boolean).join("/") || "—"}</td>
                <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {c.tipo === "lead" && (
                    <Button variant="ghost" size="sm" onClick={() => transformarEmCliente(c)} title="Converter em cliente">
                      <UserCheck className="size-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="Editar"><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => inativar(c)} title="Inativar">Inativar</Button>
                  <Button variant="ghost" size="sm" onClick={() => excluir(c)} title="Excluir"><Trash2 className="size-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    novo: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    em_atendimento: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    ativo: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    inativo: "bg-muted text-muted-foreground border-muted",
    perdido: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full border ${map[status] ?? ""}`}>{labelStatus(status)}</span>;
}
