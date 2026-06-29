import { createFileRoute } from "@tanstack/react-router";
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Sparkles, Pencil, Copy, Trash2, FileDown, Share2, NotebookPen,
  CheckCircle2, ListPlus, Inbox, Filter,
} from "lucide-react";

export const Route = createFileRoute("/app/atas")({ component: AtasPage });

const sb = supabase as any;

const MEETING_TYPES = [
  { v: "reuniao_inicial", l: "Reunião inicial" },
  { v: "diagnostico", l: "Diagnóstico" },
  { v: "acompanhamento_semanal", l: "Acompanhamento semanal" },
  { v: "acompanhamento_mensal", l: "Acompanhamento mensal" },
  { v: "apresentacao_relatorio", l: "Apresentação de relatório" },
  { v: "precificacao", l: "Precificação" },
  { v: "plano_acao", l: "Plano de ação" },
  { v: "renovacao", l: "Renovação" },
  { v: "encerramento", l: "Encerramento" },
  { v: "outro", l: "Outro" },
] as const;

const STATUSES = [
  { v: "rascunho", l: "Rascunho", color: "bg-muted text-foreground" },
  { v: "gerada_ia", l: "Gerada por IA", color: "bg-purple-500 text-white" },
  { v: "em_revisao", l: "Em revisão", color: "bg-amber-500 text-white" },
  { v: "finalizada", l: "Finalizada", color: "bg-emerald-600 text-white" },
  { v: "compartilhada", l: "Compartilhada", color: "bg-blue-500 text-white" },
  { v: "arquivada", l: "Arquivada", color: "bg-muted text-muted-foreground" },
] as const;

type Minute = {
  id: string;
  consultant_id: string;
  company_id: string;
  branch_id: string | null;
  agenda_activity_id: string | null;
  title: string;
  meeting_type: string;
  meeting_date: string;
  meeting_time: string | null;
  participants: string[];
  agenda_text: string | null;
  raw_notes: string | null;
  generated_content: string | null;
  final_content: string | null;
  status: string;
  ai_generated: boolean;
  shared_with_client: boolean;
  created_at: string;
  finalized_at: string | null;
};

const defaultTemplate = (empresa: string) => `# Ata de Reunião — ${empresa}

## 1. Dados da reunião
- Empresa:
- Data:
- Horário:
- Tipo:
- Participantes:
- Consultor responsável:

## 2. Pauta
-

## 3. Resumo da reunião


## 4. Pontos discutidos
-

## 5. Decisões tomadas
- Decisão — Responsável — Prazo

## 6. Pendências
- Pendência — Responsável — Prazo — Status

## 7. Próximos passos
- Ação — Responsável — Data prevista

## 8. Observações finais
-
`;

function statusBadge(s: string) {
  const def = STATUSES.find((x) => x.v === s) ?? STATUSES[0];
  return <Badge className={def.color}>{def.l}</Badge>;
}

function AtasPage() {
  const { user, isConsultant } = useAuth();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Minute | null>(null);
  const [filters, setFilters] = useState({ company: "all", status: "all", type: "all", q: "", shared: "all" });

  const { data: consultant } = useQuery({
    queryKey: ["consultant-me", user?.id],
    enabled: !!user && isConsultant,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id, consultancy_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["atas-companies", user?.id, isConsultant, consultant?.id],
    enabled: !!user,
    queryFn: async () => {
      if (isConsultant && consultant?.id) {
        // First try to get companies from links
        const { data: links } = await sb
          .from("consultant_company_links")
          .select("company:companies(id, nome, cnpj)")
          .eq("consultant_id", consultant.id)
          .eq("status", "approved");
        
        const linkedCompanies = (links ?? []).map((r: any) => r.company).filter(Boolean);

        // Also get companies where consultant_id is directly set
        const { data: directCompanies } = await sb
          .from("companies")
          .select("id, nome, cnpj")
          .eq("consultant_id", consultant.id);

        // Merge and remove duplicates
        const allCompanies = [...linkedCompanies, ...(directCompanies ?? [])];
        const uniqueCompanies = Array.from(new Map(allCompanies.map(item => [item.id, item])).values());
        
        return uniqueCompanies;
      }
      const { data } = await sb.from("company_members").select("companies(id, nome, cnpj)").eq("user_id", user!.id);
      return (data ?? []).map((r: any) => r.companies).filter(Boolean);
    },
  });

  const { data: minutes = [], isLoading } = useQuery<Minute[]>({
    queryKey: ["meeting-minutes", user?.id, isConsultant, consultant?.id],
    enabled: !!user && (!isConsultant || !!consultant?.id),
    queryFn: async () => {
      let q = sb.from("meeting_minutes").select("*").order("meeting_date", { ascending: false });
      if (isConsultant && consultant?.id) q = q.eq("consultant_id", consultant.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Minute[];
    },
  });

  const filtered = useMemo(() => {
    return minutes.filter((m) => {
      if (filters.company !== "all" && m.company_id !== filters.company) return false;
      if (filters.status !== "all" && m.status !== filters.status) return false;
      if (filters.type !== "all" && m.meeting_type !== filters.type) return false;
      if (filters.shared === "yes" && !m.shared_with_client) return false;
      if (filters.shared === "no" && m.shared_with_client) return false;
      if (filters.q) {
        const s = filters.q.toLowerCase();
        if (!m.title.toLowerCase().includes(s) && !(m.raw_notes ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [minutes, filters]);

  const companyName = (id: string) => companies.find((c: any) => c.id === id)?.nome ?? "—";

  const delMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("meeting_minutes").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ata excluída");
      qc.invalidateQueries({ queryKey: ["meeting-minutes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const duplicate = useMutation({
    mutationFn: async (m: Minute) => {
      const { id, created_at, finalized_at, ...rest } = m;
      void id; void created_at; void finalized_at;
      const { error } = await sb.from("meeting_minutes").insert({
        ...rest,
        title: m.title + " (cópia)",
        status: "rascunho",
        shared_with_client: false,
        ai_generated: false,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ata duplicada");
      qc.invalidateQueries({ queryKey: ["meeting-minutes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const shareToggle = useMutation({
    mutationFn: async (m: Minute) => {
      const newShared = !m.shared_with_client;
      const status = newShared ? "compartilhada" : (m.status === "compartilhada" ? "finalizada" : m.status);
      const { error } = await sb.from("meeting_minutes").update({ shared_with_client: newShared, status }).eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meeting-minutes"] });
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  if (!isConsultant) {
    // Client view: only shared, read-only
    const shared = minutes.filter((m) => m.shared_with_client);
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold flex items-center gap-2"><NotebookPen className="size-6" /> Atas de Reunião</h1>
            <p className="text-sm text-muted-foreground">Atas compartilhadas pelo seu consultor.</p>
          </div>
        </header>
        {shared.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground"><Inbox className="size-8 mx-auto mb-2" />Nenhuma ata compartilhada ainda.</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {shared.map((m) => (
              <Card key={m.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{m.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{m.meeting_date} · {MEETING_TYPES.find((t) => t.v === m.meeting_type)?.l}</p>
                  </div>
                  {statusBadge(m.status)}
                </CardHeader>
                <CardContent>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded-md">{m.final_content || m.generated_content || "(Sem conteúdo)"}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold flex items-center gap-2"><NotebookPen className="size-6" /> Atas de Reunião</h1>
          <p className="text-sm text-muted-foreground">Registre, gere com IA e compartilhe atas profissionais com seus clientes.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="size-4" /> Nova Ata
        </Button>
      </header>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Filter className="size-4" /> Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label className="text-xs">Empresa</Label>
            <Select value={filters.company} onValueChange={(v) => setFilters((f) => ({ ...f, company: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={filters.status} onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MEETING_TYPES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Compartilhada</Label>
            <Select value={filters.shared} onValueChange={(v) => setFilters((f) => ({ ...f, shared: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Busca</Label>
            <Input value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} placeholder="Título ou relato..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Inbox className="size-8 mx-auto mb-2" /> Nenhuma ata encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compart.</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.title}</TableCell>
                    <TableCell>{companyName(m.company_id)}</TableCell>
                    <TableCell>{m.meeting_date}</TableCell>
                    <TableCell className="text-xs">{MEETING_TYPES.find((t) => t.v === m.meeting_type)?.l}</TableCell>
                    <TableCell>{statusBadge(m.status)}</TableCell>
                    <TableCell>
                      <Checkbox checked={m.shared_with_client} onCheckedChange={() => shareToggle.mutate(m)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpenForm(true); }} title="Editar"><Pencil className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => duplicate.mutate(m)} title="Duplicar"><Copy className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => exportPdf(m, companyName(m.company_id))} title="Exportar"><FileDown className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => shareToggle.mutate(m)} title="Compartilhar"><Share2 className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir esta ata?")) delMutation.mutate(m.id); }} title="Excluir"><Trash2 className="size-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {openForm && consultant?.id && (
        <MinuteFormDialog
          open={openForm}
          onClose={() => { setOpenForm(false); setEditing(null); }}
          editing={editing}
          companies={companies}
          consultantId={consultant.id}
          consultantName={consultant.consultancy_name}
          userId={user!.id}
        />
      )}
    </div>
  );
}

function MinuteFormDialog({
  open, onClose, editing, companies, consultantId, consultantName, userId,
}: {
  open: boolean; onClose: () => void; editing: Minute | null;
  companies: any[]; consultantId: string; consultantName?: string; userId: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => editing ?? {
    title: "",
    company_id: companies[0]?.id ?? "",
    branch_id: null,
    meeting_type: "acompanhamento_mensal",
    meeting_date: new Date().toISOString().slice(0, 10),
    meeting_time: "",
    participants: [] as string[],
    agenda_text: "",
    raw_notes: "",
    next_meeting_date: "",
    attachments_summary: "",
    generated_content: "",
    final_content: "",
    status: "rascunho",
    shared_with_client: false,
    ai_generated: false,
  } as any);
  const [participantInput, setParticipantInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showTaskGen, setShowTaskGen] = useState(false);

  const save = useMutation({
    mutationFn: async (finalize?: boolean) => {
      const payload: any = {
        consultant_id: consultantId,
        company_id: form.company_id,
        branch_id: form.branch_id || null,
        title: form.title || `Ata — ${new Date(form.meeting_date).toLocaleDateString("pt-BR")}`,
        meeting_type: form.meeting_type,
        meeting_date: form.meeting_date,
        meeting_time: form.meeting_time || null,
        participants: form.participants ?? [],
        agenda_text: form.agenda_text || null,
        raw_notes: form.raw_notes || null,
        next_meeting_date: form.next_meeting_date || null,
        attachments_summary: form.attachments_summary || null,
        generated_content: form.generated_content || null,
        final_content: form.final_content || null,
        ai_generated: form.ai_generated,
        shared_with_client: form.shared_with_client,
        status: finalize ? (form.shared_with_client ? "compartilhada" : "finalizada") : form.status,
        finalized_at: finalize ? new Date().toISOString() : (editing?.finalized_at ?? null),
        created_by: userId,
      };
      if (editing?.id) {
        const { error } = await sb.from("meeting_minutes").update(payload).eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await sb.from("meeting_minutes").insert(payload).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: () => {
      toast.success("Ata salva");
      qc.invalidateQueries({ queryKey: ["meeting-minutes"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const generateAI = async () => {
    if (!form.raw_notes?.trim()) {
      toast.error("Escreva o relato da reunião primeiro.");
      return;
    }
    setGenerating(true);
    try {
      const company = companies.find((c: any) => c.id === form.company_id);
      const companyName = company?.nome ?? "";
      const { data, error } = await supabase.functions.invoke("generate-meeting-minutes", {
        body: {
          company_name: companyName,
          company_cnpj: company?.cnpj || "Não informado",
          meeting_date: form.meeting_date,
          meeting_time: form.meeting_time,
          meeting_type: MEETING_TYPES.find(t => t.v === form.meeting_type)?.l || form.meeting_type,
          participants: form.participants,
          raw_notes: form.raw_notes,
          consultant_name: consultantName || "Não informado",
          next_meeting_date: form.next_meeting_date,
          attachments_summary: form.attachments_summary,
        },
      });

      if (error) {
        toast.error("Erro de comunicação com a IA. Tente novamente.");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      if (!data?.content) {
        toast.error("A IA retornou um conteúdo vazio. Tente reformular seu relato.");
        return;
      }

      // Final validation on client side for placeholders
      const placeholders = [
        "Decisão — Responsável — Prazo",
        "Pendência — Responsável — Prazo — Status",
        "Ação — Responsável — Data prevista"
      ];
      
      const hasPlaceholders = placeholders.some(p => data.content.includes(p));
      if (hasPlaceholders) {
        toast.warning("A ata gerada parece conter placeholders não preenchidos. Por favor, revise e ajuste manualmente.");
      } else {
        toast.success("Ata gerada por IA com sucesso! Revise antes de finalizar.");
      }

      setForm((f: any) => ({
        ...f, 
        generated_content: data.content, 
        final_content: data.content,
        status: "gerada_ia", 
        ai_generated: true,
      }));
    } catch (e: any) {
      toast.error("Erro técnico na geração da ata.");
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const addParticipant = () => {
    const v = participantInput.trim();
    if (!v) return;
    setForm((f: any) => ({ ...f, participants: [...(f.participants ?? []), v] }));
    setParticipantInput("");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <NotebookPen className="size-5" /> {editing ? "Editar Ata" : "Nova Ata"}
            </DialogTitle>
            <DialogDescription>Registre a reunião e use a IA para estruturar a ata. Você pode editar tudo antes de finalizar.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Acompanhamento mensal — maio" />
            </div>
            <div>
              <Label>Empresa cliente *</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de reunião</Label>
              <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
            </div>
            <div>
              <Label>Horário</Label>
              <Input type="time" value={form.meeting_time ?? ""} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })} />
            </div>
            <div>
              <Label>Próxima reunião (opcional)</Label>
              <Input type="date" value={form.next_meeting_date ?? ""} onChange={(e) => setForm({ ...form, next_meeting_date: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Resumo de anexos/documentos (opcional)</Label>
              <Input value={form.attachments_summary ?? ""} onChange={(e) => setForm({ ...form, attachments_summary: e.target.value })} placeholder="Ex: Planilha de custos, Relatório de vendas..." />
            </div>
            <div className="md:col-span-2">
              <Label>Participantes</Label>
              <div className="flex gap-2">
                <Input
                  value={participantInput}
                  onChange={(e) => setParticipantInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addParticipant(); } }}
                  placeholder="Nome e tecle Enter"
                />
                <Button type="button" variant="outline" onClick={addParticipant}>Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(form.participants ?? []).map((p: string, i: number) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setForm((f: any) => ({ ...f, participants: f.participants.filter((_: any, j: number) => j !== i) }))}>
                    {p} ✕
                  </Badge>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Label>Pauta (opcional)</Label>
              <Textarea value={form.agenda_text ?? ""} onChange={(e) => setForm({ ...form, agenda_text: e.target.value })} rows={2} placeholder="O que será tratado nesta reunião..." />
            </div>
            <div className="md:col-span-2">
              <Label>Relato da reunião (anotações livres) *</Label>
              <Textarea
                value={form.raw_notes ?? ""}
                onChange={(e) => setForm({ ...form, raw_notes: e.target.value })}
                rows={6}
                placeholder="Escreva livremente o que foi tratado, decisões, pendências, prazos. A IA usará esse texto para estruturar a ata."
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button type="button" onClick={generateAI} disabled={generating || !form.company_id}>
                <Sparkles className="size-4" /> {generating ? "Gerando..." : "Gerar Ata com IA"}
              </Button>
              <span className="text-xs text-muted-foreground">A ata gerada é totalmente editável antes de finalizar.</span>
            </div>

            <div className="md:col-span-2">
              <Label>Conteúdo da ata (editável)</Label>
              <Textarea
                value={form.final_content ?? form.generated_content ?? ""}
                onChange={(e) => setForm({ ...form, final_content: e.target.value })}
                rows={14}
                className="font-mono text-xs"
                placeholder="A ata aparecerá aqui após a geração. Você pode escrever do zero também."
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Checkbox
                id="share"
                checked={form.shared_with_client}
                onCheckedChange={(v) => setForm({ ...form, shared_with_client: !!v })}
              />
              <Label htmlFor="share" className="cursor-pointer">Compartilhar com o cliente</Label>
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            {editing?.id && (
              <Button variant="outline" onClick={() => setShowTaskGen(true)}>
                <ListPlus className="size-4" /> Gerar atividades
              </Button>
            )}
            <Button variant="secondary" onClick={() => save.mutate(false)} disabled={save.isPending}>
              Salvar rascunho
            </Button>
            <Button onClick={() => save.mutate(true)} disabled={save.isPending}>
              <CheckCircle2 className="size-4" /> Finalizar ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showTaskGen && editing?.id && (
        <TaskGeneratorDialog
          minute={{ ...editing, ...form } as Minute}
          consultantId={consultantId}
          onClose={() => setShowTaskGen(false)}
        />
      )}
    </>
  );
}

function TaskGeneratorDialog({ minute, consultantId, onClose }: {
  minute: Minute; consultantId: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tasks, setTasks] = useState<Array<{ title: string; due_date: string; responsible_name: string; target: "agenda" | "plano_acao" | "pendencia_cliente" }>>([
    { title: "", due_date: "", responsible_name: "", target: "agenda" },
  ]);

  const generate = useMutation({
    mutationFn: async () => {
      const valid = tasks.filter((t) => t.title.trim());
      for (const t of valid) {
        if (t.target === "agenda") {
          await sb.from("consultancy_activities").insert({
            consultant_id: consultantId,
            company_id: minute.company_id,
            title: t.title,
            activity_type: "tarefa_interna",
            activity_date: t.due_date || minute.meeting_date,
            due_date: t.due_date || null,
            responsible_name: t.responsible_name || null,
            related_module: "ata_reuniao",
            related_record_id: minute.id,
          });
        } else if (t.target === "plano_acao") {
          await sb.from("action_plans").insert({
            consultant_id: consultantId,
            company_id: minute.company_id,
            title: t.title,
            responsible_type: "consultor",
            responsible_name: t.responsible_name || null,
            due_date: t.due_date || null,
            related_module: "ata_reuniao",
            related_record_id: minute.id,
            origin: "analise_consultor",
          });
        } else {
          await sb.from("client_pending_items").insert({
            consultant_id: consultantId,
            company_id: minute.company_id,
            title: t.title,
            responsible_name: t.responsible_name || null,
            due_date: t.due_date || null,
            related_module: "ata_reuniao",
            related_record_id: minute.id,
            allow_client_view: true,
          });
        }
        await sb.from("meeting_minutes_tasks").insert({
          meeting_minutes_id: minute.id,
          title: t.title,
          due_date: t.due_date || null,
          responsible_name: t.responsible_name || null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Atividades criadas");
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["pendings"] });
      qc.invalidateQueries({ queryKey: ["action-plans"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar atividades a partir da ata</DialogTitle>
          <DialogDescription>Adicione tarefas, pendências ou itens de plano de ação extraídos da reunião.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {tasks.map((t, i) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border rounded-md p-3">
              <div className="md:col-span-5">
                <Label className="text-xs">Tarefa</Label>
                <Input value={t.title} onChange={(e) => setTasks((arr) => arr.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
              </div>
              <div className="md:col-span-3">
                <Label className="text-xs">Responsável</Label>
                <Input value={t.responsible_name} onChange={(e) => setTasks((arr) => arr.map((x, j) => j === i ? { ...x, responsible_name: e.target.value } : x))} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Prazo</Label>
                <Input type="date" value={t.due_date} onChange={(e) => setTasks((arr) => arr.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Destino</Label>
                <Select value={t.target} onValueChange={(v: any) => setTasks((arr) => arr.map((x, j) => j === i ? { ...x, target: v } : x))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agenda">Agenda</SelectItem>
                    <SelectItem value="plano_acao">Plano de Ação</SelectItem>
                    <SelectItem value="pendencia_cliente">Pendência cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setTasks((arr) => [...arr, { title: "", due_date: "", responsible_name: "", target: "agenda" }])}>
            <Plus className="size-4" /> Adicionar
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>Criar atividades</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exportPdf(m: Minute, companyName: string) {
  // Simple printable view (fallback PDF: prints to PDF via browser)
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${m.title}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a}
h1{font-size:20px;margin-bottom:4px}.meta{color:#666;font-size:13px;margin-bottom:24px}
pre{white-space:pre-wrap;font-family:inherit;font-size:14px;line-height:1.6}
hr{border:none;border-top:1px solid #e5e5e5;margin:24px 0}</style></head>
<body>
<h1>${m.title}</h1>
<div class="meta">Empresa: ${companyName} · Data: ${m.meeting_date}${m.meeting_time ? " · " + m.meeting_time : ""}</div>
<hr/>
<pre>${(m.final_content || m.generated_content || "").replace(/</g, "&lt;")}</pre>
<hr/>
<div class="meta">Emitido em ${new Date().toLocaleString("pt-BR")}</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
  else toast.error("Permita pop-ups para exportar PDF");
}
