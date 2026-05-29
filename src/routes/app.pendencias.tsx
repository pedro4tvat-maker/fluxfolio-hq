import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Filter, Trash2, CheckCircle2, MessageSquare, CalendarPlus,
  AlertTriangle, Clock, Send, Inbox,
} from "lucide-react";

export const Route = createFileRoute("/app/pendencias")({ component: PendenciasPage });

const sb = supabase as any;

export const PENDING_TYPES = [
  { v: "documento", l: "Documento" },
  { v: "extrato_bancario", l: "Extrato bancário" },
  { v: "comprovante", l: "Comprovante" },
  { v: "nota_fiscal", l: "Nota fiscal" },
  { v: "info_financeira", l: "Informação financeira" },
  { v: "revisao_dados", l: "Revisão de dados" },
  { v: "aprovacao_relatorio", l: "Aprovação de relatório" },
  { v: "atualizacao_estoque", l: "Atualização de estoque" },
  { v: "cadastro_produtos", l: "Cadastro de produtos" },
  { v: "validacao_precificacao", l: "Validação de precificação" },
  { v: "contas_pagar", l: "Contas a pagar" },
  { v: "contas_receber", l: "Contas a receber" },
  { v: "vendas", l: "Vendas" },
  { v: "outro", l: "Outro" },
] as const;

const STATUSES = [
  { v: "pendente", l: "Pendente", color: "bg-muted text-foreground" },
  { v: "enviado_cliente", l: "Enviado pelo cliente", color: "bg-blue-500 text-white" },
  { v: "em_analise", l: "Em análise", color: "bg-purple-500 text-white" },
  { v: "resolvido", l: "Resolvido", color: "bg-emerald-600 text-white" },
  { v: "atrasado", l: "Atrasado", color: "bg-destructive text-destructive-foreground" },
  { v: "cancelado", l: "Cancelado", color: "bg-muted text-muted-foreground" },
] as const;

const PRIORITIES = [
  { v: "baixa", l: "Baixa", color: "bg-muted text-muted-foreground" },
  { v: "media", l: "Média", color: "bg-blue-500 text-white" },
  { v: "alta", l: "Alta", color: "bg-orange-500 text-white" },
  { v: "urgente", l: "Urgente", color: "bg-destructive text-destructive-foreground" },
] as const;

type Pending = {
  id: string; consultant_id: string; company_id: string; branch_id: string | null;
  title: string; description: string | null; pending_type: string;
  responsible_user_id: string | null; responsible_name: string | null;
  request_date: string; due_date: string | null; priority: string; status: string;
  notes: string | null; related_module: string | null; related_record_id: string | null;
  allow_client_view: boolean; resolved_at: string | null; created_at: string;
};

function statusBadge(s: string) {
  const def = STATUSES.find((x) => x.v === s) ?? STATUSES[0];
  return <Badge className={def.color}>{def.l}</Badge>;
}
function priorityBadge(p: string) {
  const def = PRIORITIES.find((x) => x.v === p) ?? PRIORITIES[1];
  return <Badge className={def.color}>{def.l}</Badge>;
}

function PendenciasPage() {
  const { user, isConsultant } = useAuth();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Pending | null>(null);
  const [showResponses, setShowResponses] = useState<Pending | null>(null);
  const [filters, setFilters] = useState({
    company: "all", type: "all", status: "all", priority: "all", overdue: false,
  });

  const { data: consultant } = useQuery({
    queryKey: ["consultant-me", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id, consultancy_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["pendencias-companies", user?.id, isConsultant, consultant?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isConsultant && consultant?.id) {
        const { data } = await sb
          .from("consultant_company_links")
          .select("company:companies(id, nome, cnpj)")
          .eq("consultant_id", consultant.id)
          .eq("status", "approved");
        return (data ?? []).map((r: any) => r.company).filter(Boolean);
      }
      const { data } = await sb.from("company_members").select("companies(id, nome, cnpj)").eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.companies).filter(Boolean);
    },
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["pendings", user?.id, isConsultant, consultant?.id],
    enabled: !!user && (!isConsultant || !!consultant?.id),
    queryFn: async () => {
      let q = sb.from("client_pending_items").select("*").order("created_at", { ascending: false });
      if (isConsultant && consultant?.id) q = q.eq("consultant_id", consultant.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Pending[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const enriched = useMemo(() => items.map((it) => {
    const overdue = it.due_date && it.due_date < today && !["resolvido", "cancelado"].includes(it.status);
    return { ...it, _overdue: overdue };
  }), [items, today]);

  const filtered = useMemo(() => enriched.filter((it) => {
    if (filters.company !== "all" && it.company_id !== filters.company) return false;
    if (filters.type !== "all" && it.pending_type !== filters.type) return false;
    if (filters.status !== "all" && it.status !== filters.status) return false;
    if (filters.priority !== "all" && it.priority !== filters.priority) return false;
    if (filters.overdue && !it._overdue) return false;
    return true;
  }), [enriched, filters]);

  const kpis = useMemo(() => {
    const open = enriched.filter((i) => !["resolvido", "cancelado"].includes(i.status));
    const overdue = enriched.filter((i) => i._overdue);
    const sent = enriched.filter((i) => i.status === "enviado_cliente");
    const resolvedMonth = enriched.filter((i) => i.status === "resolvido" && (i.resolved_at ?? "") >= monthStart);
    const critical = new Set(enriched.filter((i) => i.priority === "urgente" && !["resolvido", "cancelado"].includes(i.status)).map((i) => i.company_id));
    return { open: open.length, overdue: overdue.length, sent: sent.length, resolvedMonth: resolvedMonth.length, critical: critical.size };
  }, [enriched, monthStart]);

  const upsertMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!isConsultant) throw new Error("Apenas consultor pode criar pendências.");
      if (!consultant?.id) throw new Error("Perfil de consultoria não encontrado.");
      const base = { ...payload, consultant_id: consultant.id };
      if (editing) {
        const { error } = await sb.from("client_pending_items").update(base).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("client_pending_items").insert(base);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendings"] });
      toast.success(editing ? "Pendência atualizada" : "Pendência criada");
      setShowDialog(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status };
      if (status === "resolvido") update.resolved_at = new Date().toISOString();
      const { error } = await sb.from("client_pending_items").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pendings"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("client_pending_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pendings"] }); toast.success("Excluída"); },
  });

  const addToAgenda = useMutation({
    mutationFn: async (it: Pending) => {
      if (!consultant?.id) throw new Error("Sem consultor");
      const { error } = await sb.from("consultancy_activities").insert({
        consultant_id: consultant.id,
        company_id: it.company_id,
        branch_id: it.branch_id,
        title: `Cobrar: ${it.title}`,
        activity_type: "tarefa_interna",
        activity_date: it.due_date ?? today,
        due_date: it.due_date,
        priority: it.priority,
        description: it.description,
        related_module: "pendencia",
        related_record_id: it.id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Atividade criada na Agenda"),
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold">{isConsultant ? "Central de Pendências" : "Minhas Pendências"}</h1>
          <p className="text-sm text-muted-foreground">Acompanhe o que cada cliente precisa enviar, fazer ou revisar.</p>
        </div>
        {isConsultant && (
          <Button onClick={() => { setEditing(null); setShowDialog(true); }}><Plus className="size-4" /> Nova Pendência</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Pendências abertas" value={kpis.open} icon={Inbox} />
        <KpiCard label="Atrasadas" value={kpis.overdue} icon={AlertTriangle} tone="destructive" />
        <KpiCard label="Enviadas pelo cliente" value={kpis.sent} icon={Send} tone="primary" />
        <KpiCard label="Resolvidas no mês" value={kpis.resolvedMonth} icon={CheckCircle2} tone="success" />
        <KpiCard label="Clientes críticos" value={kpis.critical} icon={Clock} tone="warning" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="size-4" /> Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <Select value={filters.company} onValueChange={(v) => setFilters((f) => ({ ...f, company: v }))}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {PENDING_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.priority} onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {PRIORITIES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm px-2">
            <Checkbox checked={filters.overdue} onCheckedChange={(v) => setFilters((f) => ({ ...f, overdue: !!v }))} />
            Apenas atrasadas
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhuma pendência encontrada.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase">
                <tr>
                  <th className="text-left p-3">Pendência</th>
                  <th className="text-left p-3">Empresa</th>
                  <th className="text-left p-3">Tipo</th>
                  <th className="text-left p-3">Responsável</th>
                  <th className="text-left p-3">Prazo</th>
                  <th className="text-left p-3">Prioridade</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => {
                  const company = companies?.find((c: any) => c.id === it.company_id);
                  const typeL = PENDING_TYPES.find((t) => t.v === it.pending_type)?.l ?? it.pending_type;
                  return (
                    <tr key={it.id} className={`border-t ${it._overdue ? "bg-destructive/5" : ""}`}>
                      <td className="p-3">
                        <div className="font-medium">{it.title}</div>
                        {it.description && <div className="text-xs text-muted-foreground line-clamp-1">{it.description}</div>}
                      </td>
                      <td className="p-3">{company?.nome ?? "—"}</td>
                      <td className="p-3 text-xs">{typeL}</td>
                      <td className="p-3 text-xs">{it.responsible_name ?? "—"}</td>
                      <td className="p-3 text-xs">{it.due_date ?? "—"}</td>
                      <td className="p-3">{priorityBadge(it.priority)}</td>
                      <td className="p-3">{statusBadge(it.status)}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setShowResponses(it)}><MessageSquare className="size-4" /></Button>
                        {isConsultant && (
                          <>
                            <Select value={it.status} onValueChange={(v) => statusMutation.mutate({ id: it.id, status: v })}>
                              <SelectTrigger className="inline-flex h-8 w-auto ml-1 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="ghost" title="Adicionar à Agenda" onClick={() => addToAgenda.mutate(it)}><CalendarPlus className="size-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(it); setShowDialog(true); }}>Editar</Button>
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir?")) deleteMutation.mutate(it.id); }}><Trash2 className="size-4 text-destructive" /></Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {showDialog && (
        <PendingDialog
          open={showDialog}
          editing={editing}
          companies={companies ?? []}
          onClose={() => { setShowDialog(false); setEditing(null); }}
          onSave={(p) => upsertMutation.mutate(p)}
        />
      )}

      {showResponses && (
        <ResponsesDialog
          pending={showResponses}
          isConsultant={isConsultant}
          userId={user?.id ?? ""}
          onClose={() => setShowResponses(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: any; tone?: string }) {
  const toneCls = tone === "destructive" ? "text-destructive" : tone === "success" ? "text-emerald-600" : tone === "warning" ? "text-orange-500" : tone === "primary" ? "text-primary" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-display font-bold ${toneCls}`}>{value}</div>
        </div>
        <Icon className={`size-6 ${toneCls}`} />
      </CardContent>
    </Card>
  );
}

function PendingDialog({ open, editing, companies, onClose, onSave }: {
  open: boolean; editing: Pending | null; companies: any[]; onClose: () => void; onSave: (p: any) => void;
}) {
  const [form, setForm] = useState<any>(() => editing ?? {
    title: "", description: "", company_id: companies[0]?.id ?? "",
    pending_type: "documento", responsible_name: "", request_date: new Date().toISOString().slice(0, 10),
    due_date: "", priority: "media", status: "pendente", notes: "", allow_client_view: true,
    related_module: null, related_record_id: null,
  });
  const submit = () => {
    if (!form.title || !form.company_id) { toast.error("Título e empresa são obrigatórios"); return; }
    onSave({
      ...form,
      due_date: form.due_date || null,
      branch_id: form.branch_id || null,
    });
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Editar pendência" : "Nova pendência"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="col-span-2"><Label>Descrição</Label><Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <Label>Empresa *</Label>
            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={form.pending_type} onValueChange={(v) => setForm({ ...form, pending_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PENDING_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Responsável</Label><Input value={form.responsible_name ?? ""} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} /></div>
          <div><Label>Solicitação</Label><Input type="date" value={form.request_date} onChange={(e) => setForm({ ...form, request_date: e.target.value })} /></div>
          <div><Label>Prazo</Label><Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
          <div>
            <Label>Prioridade</Label>
            <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Observações</Label><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox checked={form.allow_client_view} onCheckedChange={(v) => setForm({ ...form, allow_client_view: !!v })} />
            Visível para o cliente
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResponsesDialog({ pending, isConsultant, userId, onClose }: {
  pending: Pending; isConsultant: boolean; userId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const { data: responses = [] } = useQuery({
    queryKey: ["pending-responses", pending.id],
    queryFn: async () => {
      const { data } = await sb.from("client_pending_responses").select("*").eq("pending_item_id", pending.id).order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const sendResp = useMutation({
    mutationFn: async () => {
      if (!text.trim() && !file) throw new Error("Escreva uma resposta ou anexe um arquivo.");
      let attachmentPath: string | null = null;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error("Arquivo maior que 20MB.");
        setUploading(true);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${pending.company_id}/pendencias/${pending.id}/${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
          contentType: file.type || undefined, upsert: false,
        });
        setUploading(false);
        if (upErr) throw upErr;
        attachmentPath = path;
      }
      const { error } = await sb.from("client_pending_responses").insert({
        pending_item_id: pending.id, user_id: userId, response_text: text || null,
        attachment_url: attachmentPath,
      });
      if (error) throw error;
      if (!isConsultant && pending.status === "pendente") {
        await sb.from("client_pending_items").update({ status: "enviado_cliente" }).eq("id", pending.id);
      }
    },
    onSuccess: () => {
      setText(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["pending-responses", pending.id] });
      qc.invalidateQueries({ queryKey: ["pendings"] });
      toast.success("Resposta enviada");
    },
    onError: (e: any) => { setUploading(false); toast.error(e.message ?? "Erro"); },
  });

  async function openAttachment(value: string) {
    // Legacy values may be full URLs; treat those as-is.
    if (/^https?:\/\//i.test(value)) { window.open(value, "_blank"); return; }
    const { data, error } = await supabase.storage.from("attachments").createSignedUrl(value, 300);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{pending.title}</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-72 overflow-y-auto">
          {responses.length === 0 && <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>}
          {responses.map((r: any) => (
            <div key={r.id} className="border rounded p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
              {r.response_text && <div>{r.response_text}</div>}
              {r.attachment_url && (
                <button onClick={() => openAttachment(r.attachment_url)} className="text-primary underline text-xs mt-1">
                  Ver anexo
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2 border-t pt-3">
          <Textarea placeholder="Escrever resposta…" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs"
            />
            {file && (
              <Button size="sm" variant="ghost" onClick={() => setFile(null)} type="button">Limpar</Button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
            <Button onClick={() => sendResp.mutate()} disabled={uploading || sendResp.isPending}>
              <Send className="size-4" /> {uploading ? "Enviando..." : "Enviar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

