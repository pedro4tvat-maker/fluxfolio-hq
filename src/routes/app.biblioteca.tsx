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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Pencil, Copy, Archive, Trash2, Search, BookOpen, Send, FileText, History,
} from "lucide-react";

export const Route = createFileRoute("/app/biblioteca")({ component: BibliotecaPage });

const sb = supabase as any;

const CATEGORIES = [
  { v: "diagnosticos", l: "Diagnósticos" },
  { v: "relatorios", l: "Relatórios" },
  { v: "planos_acao", l: "Planos de ação" },
  { v: "precificacao", l: "Precificação" },
  { v: "dre", l: "DRE gerencial" },
  { v: "fluxo_caixa", l: "Fluxo de caixa" },
  { v: "atas", l: "Reuniões e atas" },
  { v: "propostas", l: "Propostas comerciais" },
  { v: "contratos", l: "Contratos" },
  { v: "checklists", l: "Checklists" },
  { v: "mensagens", l: "Mensagens para clientes" },
  { v: "cobranca", l: "Cobrança de pendências" },
  { v: "onboarding", l: "Onboarding" },
  { v: "encerramento", l: "Encerramento / renovação" },
  { v: "outros", l: "Outros" },
] as const;

const TYPES = [
  { v: "documento", l: "Documento" },
  { v: "relatorio", l: "Relatório" },
  { v: "checklist", l: "Checklist" },
  { v: "mensagem", l: "Mensagem" },
  { v: "ata", l: "Ata" },
  { v: "proposta", l: "Proposta" },
  { v: "contrato", l: "Contrato" },
  { v: "plano_acao", l: "Plano de ação" },
  { v: "diagnostico", l: "Diagnóstico" },
  { v: "outro", l: "Outro" },
] as const;

const STATUSES = [
  { v: "ativo", l: "Ativo", color: "bg-emerald-600 text-white" },
  { v: "rascunho", l: "Rascunho", color: "bg-muted text-foreground" },
  { v: "arquivado", l: "Arquivado", color: "bg-muted text-muted-foreground" },
] as const;

const VISIBILITIES = [
  { v: "privado", l: "Privado do consultor" },
  { v: "compartilhavel", l: "Compartilhável com cliente" },
  { v: "padrao", l: "Modelo padrão da consultoria" },
] as const;

const DYNAMIC_FIELDS = [
  "{{nome_empresa}}", "{{cnpj_empresa}}", "{{nome_responsavel}}",
  "{{nome_consultor}}", "{{nome_consultoria}}", "{{periodo_relatorio}}",
  "{{data_reuniao}}", "{{resultado_mes}}", "{{saldo_atual}}",
  "{{lucro_liquido}}", "{{margem_liquida}}", "{{proximos_passos}}",
];

const INITIAL_TEMPLATES = [
  { title: "Modelo de Diagnóstico Inicial", category: "diagnosticos", template_type: "diagnostico",
    description: "Avaliação inicial da saúde financeira do cliente.",
    content: `# Diagnóstico Inicial — {{nome_empresa}}\n\nConsultor: {{nome_consultor}} ({{nome_consultoria}})\nResponsável: {{nome_responsavel}}\nData: {{data_reuniao}}\n\n## 1. Situação atual\n- \n\n## 2. Pontos fortes\n- \n\n## 3. Pontos fracos\n- \n\n## 4. Recomendações iniciais\n- \n\n## 5. Próximos passos\n{{proximos_passos}}` },
  { title: "Modelo de Relatório Executivo Mensal", category: "relatorios", template_type: "relatorio",
    description: "Relatório executivo mensal para apresentação ao cliente.",
    content: `# Relatório Executivo — {{nome_empresa}}\nPeríodo: {{periodo_relatorio}}\n\n## Resumo Financeiro\n- Saldo atual: {{saldo_atual}}\n- Lucro líquido: {{lucro_liquido}}\n- Margem líquida: {{margem_liquida}}\n\n## Destaques\n- \n\n## Pontos de atenção\n- \n\n## Próximos passos\n{{proximos_passos}}` },
  { title: "Modelo de Plano de Ação", category: "planos_acao", template_type: "plano_acao",
    description: "Estrutura padrão para plano de ação.",
    content: `# Plano de Ação — {{nome_empresa}}\n\n| # | Ação | Responsável | Prazo | Status |\n|---|------|-------------|-------|--------|\n| 1 |      |             |       |        |\n| 2 |      |             |       |        |\n| 3 |      |             |       |        |` },
  { title: "Modelo de Ata de Reunião", category: "atas", template_type: "ata",
    description: "Ata padrão de reunião de acompanhamento.",
    content: `# Ata de Reunião — {{nome_empresa}}\nData: {{data_reuniao}}\nParticipantes: \n\n## Pauta\n- \n\n## Decisões\n- \n\n## Tarefas\n- \n\n## Próxima reunião\n` },
  { title: "Modelo de Checklist de Onboarding", category: "onboarding", template_type: "checklist",
    description: "Checklist de início de consultoria.",
    content: `# Checklist de Onboarding — {{nome_empresa}}\n\n- [ ] Contrato assinado\n- [ ] Acesso aos dados financeiros\n- [ ] Cadastro de contas\n- [ ] Cadastro de categorias\n- [ ] Diagnóstico inicial agendado\n- [ ] Reunião de kickoff` },
  { title: "Modelo de Checklist de Documentos", category: "checklists", template_type: "checklist",
    description: "Documentos a solicitar ao cliente.",
    content: `# Checklist de Documentos — {{nome_empresa}}\n\n- [ ] Extratos bancários (últimos 3 meses)\n- [ ] Contas a pagar em aberto\n- [ ] Contas a receber em aberto\n- [ ] Notas fiscais de vendas\n- [ ] Folha de pagamento\n- [ ] Contrato social` },
  { title: "Modelo de Mensagem para Cobrar Pendência", category: "cobranca", template_type: "mensagem",
    description: "Mensagem padrão para cobrança de pendências do cliente.",
    content: `Olá {{nome_responsavel}},\n\nTudo bem? Estamos finalizando o acompanhamento de {{nome_empresa}} referente a {{periodo_relatorio}} e ainda faltam algumas informações.\n\nPode nos enviar até {{data_reuniao}}? Qualquer dúvida estamos à disposição.\n\nAbraço,\n{{nome_consultor}} — {{nome_consultoria}}` },
  { title: "Modelo de Proposta Comercial", category: "propostas", template_type: "proposta",
    description: "Proposta padrão de consultoria.",
    content: `# Proposta Comercial — {{nome_empresa}}\n\nApresentado por: {{nome_consultoria}}\nConsultor responsável: {{nome_consultor}}\n\n## Escopo\n- \n\n## Entregáveis\n- \n\n## Investimento\n- \n\n## Prazo\n- ` },
  { title: "Modelo de Contrato de Consultoria", category: "contratos", template_type: "contrato",
    description: "Contrato padrão de consultoria financeira.",
    content: `# Contrato de Prestação de Serviços de Consultoria\n\nCONTRATANTE: {{nome_empresa}} — CNPJ {{cnpj_empresa}}\nCONTRATADA: {{nome_consultoria}}\n\n## Objeto\n...\n\n## Prazo\n...\n\n## Valor\n...\n\n## Obrigações\n...` },
  { title: "Modelo de Relatório de Precificação", category: "precificacao", template_type: "relatorio",
    description: "Relatório de análise de precificação.",
    content: `# Relatório de Precificação — {{nome_empresa}}\nPeríodo: {{periodo_relatorio}}\n\n## Produtos/Serviços analisados\n- \n\n## Margem atual x sugerida\n- \n\n## Recomendações\n- ` },
  { title: "Modelo de Relatório de DRE Gerencial", category: "dre", template_type: "relatorio",
    description: "DRE gerencial mensal.",
    content: `# DRE Gerencial — {{nome_empresa}}\nPeríodo: {{periodo_relatorio}}\n\n## Receita Bruta\n...\n## (-) Deduções\n...\n## (=) Receita Líquida\n...\n## (-) CPV/CSV\n...\n## (=) Lucro Bruto\n...\n## (-) Despesas Operacionais\n...\n## (=) Lucro Líquido: {{lucro_liquido}}\nMargem: {{margem_liquida}}` },
  { title: "Modelo de Encerramento / Renovação de Contrato", category: "encerramento", template_type: "documento",
    description: "Comunicação de encerramento ou renovação.",
    content: `# Encerramento / Renovação — {{nome_empresa}}\n\nPrezado(a) {{nome_responsavel}},\n\nApós o período de {{periodo_relatorio}}, apresentamos abaixo os resultados consolidados e os próximos passos sugeridos:\n\n- Resultados: \n- Próximos passos: {{proximos_passos}}\n\nAtenciosamente,\n{{nome_consultor}} — {{nome_consultoria}}` },
];

type Tpl = {
  id: string; consultant_id: string; title: string; category: string;
  template_type: string; description: string | null; content: string | null;
  tags: string[]; status: string; visibility: string; file_url: string | null;
  is_default: boolean; usage_count: number; created_at: string; updated_at: string;
};

function applyDynamic(content: string, ctx: Record<string, string>) {
  let out = content || "";
  Object.entries(ctx).forEach(([k, v]) => {
    out = out.split(`{{${k}}}`).join(v || `{{${k}}}`);
  });
  return out;
}

function BibliotecaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Tpl> | null>(null);
  const [useOpen, setUseOpen] = useState<Tpl | null>(null);
  const [versionsOpen, setVersionsOpen] = useState<Tpl | null>(null);

  const { data: consultant } = useQuery({
    queryKey: ["lib-consultant", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await sb.from("consultants")
        .select("id, consultancy_name, responsible_name")
        .eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["lib-templates", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data, error } = await sb.from("consultant_library_templates")
        .select("*").eq("consultant_id", consultant!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Tpl[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["lib-companies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await sb.from("companies")
        .select("id, nome, cnpj, responsavel").order("nome");
      return data || [];
    },
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!consultant?.id) return;
      const rows = INITIAL_TEMPLATES.map((t) => ({
        ...t, consultant_id: consultant.id, created_by: user?.id,
        is_default: true, status: "ativo", visibility: "privado",
      }));
      const { error } = await sb.from("consultant_library_templates").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-templates"] });
      toast.success("Modelos iniciais criados");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<Tpl>) => {
      if (!consultant?.id) throw new Error("Consultor não encontrado");
      if (payload.id) {
        // snapshot previous version
        const current = templates.find((t) => t.id === payload.id);
        if (current && current.content !== payload.content) {
          await sb.from("consultant_library_template_versions").insert({
            template_id: payload.id, content_snapshot: current.content,
            changed_by: user?.id, change_note: "Edição do conteúdo",
          });
        }
        const { error } = await sb.from("consultant_library_templates")
          .update({
            title: payload.title, category: payload.category,
            template_type: payload.template_type, description: payload.description,
            content: payload.content, tags: payload.tags || [],
            status: payload.status, visibility: payload.visibility,
            file_url: payload.file_url,
          }).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("consultant_library_templates").insert({
          consultant_id: consultant.id, created_by: user?.id,
          title: payload.title || "Novo modelo",
          category: payload.category || "outros",
          template_type: payload.template_type || "documento",
          description: payload.description, content: payload.content,
          tags: payload.tags || [], status: payload.status || "ativo",
          visibility: payload.visibility || "privado",
          file_url: payload.file_url,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-templates"] });
      setEditorOpen(false); setEditing(null);
      toast.success("Modelo salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (tpl: Tpl) => {
      const { error } = await sb.from("consultant_library_templates").insert({
        consultant_id: tpl.consultant_id, created_by: user?.id,
        title: `${tpl.title} (cópia)`, category: tpl.category,
        template_type: tpl.template_type, description: tpl.description,
        content: tpl.content, tags: tpl.tags, status: "rascunho",
        visibility: tpl.visibility,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-templates"] });
      toast.success("Modelo duplicado");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (tpl: Tpl) => {
      const next = tpl.status === "arquivado" ? "ativo" : "arquivado";
      const { error } = await sb.from("consultant_library_templates")
        .update({ status: next }).eq("id", tpl.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lib-templates"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("consultant_library_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-templates"] });
      toast.success("Modelo removido");
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => {
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterType !== "all" && t.template_type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (q && !`${t.title} ${t.description || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, filterCategory, filterType, filterStatus]);

  const byCategory = useMemo(() => {
    const map = new Map<string, Tpl[]>();
    filtered.forEach((t) => {
      const arr = map.get(t.category) || [];
      arr.push(t);
      map.set(t.category, arr);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Biblioteca do Consultor
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelos prontos para acelerar a entrega aos clientes.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
              Criar modelos iniciais
            </Button>
          )}
          <Button onClick={() => { setEditing({ status: "ativo", visibility: "privado", template_type: "documento", category: "outros", tags: [] }); setEditorOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo modelo
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar título, descrição, tag..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              {TYPES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          Nenhum modelo encontrado. Crie um novo ou gere os modelos iniciais.
        </CardContent></Card>
      ) : (
        CATEGORIES.filter((c) => byCategory.has(c.v)).map((c) => (
          <div key={c.v} className="space-y-2">
            <h2 className="text-lg font-semibold">{c.l}</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {(byCategory.get(c.v) || []).map((t) => {
                const st = STATUSES.find((s) => s.v === t.status);
                return (
                  <Card key={t.id} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        {st && <Badge className={st.color}>{st.l}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{TYPES.find((x) => x.v === t.template_type)?.l} · {VISIBILITIES.find((v) => v.v === t.visibility)?.l}</p>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col gap-2">
                      {t.description && <p className="text-sm line-clamp-3">{t.description}</p>}
                      {t.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {t.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-auto">
                        Usado {t.usage_count || 0}x · atualizado em {new Date(t.updated_at).toLocaleDateString()}
                      </div>
                      <div className="flex flex-wrap gap-1 pt-2">
                        <Button size="sm" onClick={() => setUseOpen(t)}><Send className="h-3 w-3 mr-1" /> Usar</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(t); setEditorOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => duplicateMutation.mutate(t)}><Copy className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setVersionsOpen(t)}><History className="h-3 w-3" /></Button>
                        <Button size="sm" variant="outline" onClick={() => archiveMutation.mutate(t)}><Archive className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover modelo?")) deleteMutation.mutate(t.id); }}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      <TemplateEditor
        open={editorOpen}
        onOpenChange={(o) => { setEditorOpen(o); if (!o) setEditing(null); }}
        value={editing}
        onChange={setEditing}
        onSave={() => editing && saveMutation.mutate(editing)}
        saving={saveMutation.isPending}
      />

      <UseTemplateDialog
        template={useOpen}
        companies={companies}
        consultant={consultant}
        userId={user?.id}
        onClose={() => setUseOpen(null)}
      />

      <VersionsDialog template={versionsOpen} onClose={() => setVersionsOpen(null)} />
    </div>
  );
}

function TemplateEditor({ open, onOpenChange, value, onChange, onSave, saving }: any) {
  const insertField = (field: string) => {
    onChange({ ...value, content: `${value?.content || ""}${field}` });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{value?.id ? "Editar modelo" : "Novo modelo"}</DialogTitle>
          <DialogDescription>Use campos dinâmicos para personalizar ao aplicar.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={value?.title || ""} onChange={(e) => onChange({ ...value, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Categoria</Label>
              <Select value={value?.category || "outros"} onValueChange={(v) => onChange({ ...value, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={value?.template_type || "documento"} onValueChange={(v) => onChange({ ...value, template_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={value?.status || "ativo"} onValueChange={(v) => onChange({ ...value, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Visibilidade</Label>
              <Select value={value?.visibility || "privado"} onValueChange={(v) => onChange({ ...value, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{VISIBILITIES.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={value?.description || ""} onChange={(e) => onChange({ ...value, description: e.target.value })} />
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input
              value={(value?.tags || []).join(", ")}
              onChange={(e) => onChange({ ...value, tags: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
            />
          </div>
          <div>
            <Label>URL de arquivo anexo (opcional)</Label>
            <Input value={value?.file_url || ""} onChange={(e) => onChange({ ...value, file_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Conteúdo</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {DYNAMIC_FIELDS.map((f) => (
                <Button key={f} type="button" size="sm" variant="outline" className="h-6 text-xs" onClick={() => insertField(f)}>{f}</Button>
              ))}
            </div>
            <Textarea rows={14} className="font-mono text-sm" value={value?.content || ""} onChange={(e) => onChange({ ...value, content: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSave} disabled={saving || !value?.title}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UseTemplateDialog({ template, companies, consultant, userId, onClose }: any) {
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState<string>("");
  const [period, setPeriod] = useState<string>("");
  const [relatedModule, setRelatedModule] = useState<string>("");
  const [shareClient, setShareClient] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  useMemo(() => {
    if (template) { setTitle(template.title); setPreview(template.content || ""); setCompanyId(""); setPeriod(""); setRelatedModule(""); setShareClient(false); }
  }, [template?.id]);

  const company = companies.find((c: any) => c.id === companyId);

  const apply = () => {
    if (!template) return "";
    const ctx: Record<string, string> = {
      nome_empresa: company?.nome || "",
      cnpj_empresa: company?.cnpj || "",
      nome_responsavel: company?.responsavel || "",
      nome_consultor: consultant?.responsible_name || "",
      nome_consultoria: consultant?.consultancy_name || "",
      periodo_relatorio: period,
      data_reuniao: new Date().toLocaleDateString(),
    };
    return applyDynamic(template.content || "", ctx);
  };

  const handleGenerate = () => setPreview(apply());

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!template || !consultant?.id) return;
      const { error } = await sb.from("consultant_library_template_usage").insert({
        template_id: template.id, consultant_id: consultant.id,
        company_id: companyId || null, related_module: relatedModule || null,
        period: period || null, generated_title: title || template.title,
        generated_content: preview, status: "rascunho",
        shared_with_client: shareClient, created_by: userId,
      });
      if (error) throw error;
      await sb.from("consultant_library_templates")
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq("id", template.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lib-templates"] });
      toast.success("Modelo aplicado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usar modelo: {template?.title}</DialogTitle>
          <DialogDescription>Selecione a empresa e gere uma cópia editável.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Empresa cliente</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecionar empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Período</Label>
              <Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Ex: Outubro/2025" />
            </div>
            <div>
              <Label>Módulo relacionado</Label>
              <Select value={relatedModule} onValueChange={setRelatedModule}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="diagnostico">Diagnóstico</SelectItem>
                  <SelectItem value="plano_acao">Plano de ação</SelectItem>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                  <SelectItem value="ata">Ata</SelectItem>
                  <SelectItem value="pendencia">Pendência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <input id="share" type="checkbox" checked={shareClient} onChange={(e) => setShareClient(e.target.checked)} />
              <Label htmlFor="share">Compartilhar com cliente</Label>
            </div>
          </div>
          <div>
            <Label>Título gerado</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button variant="outline" onClick={handleGenerate} type="button">
            <FileText className="h-4 w-4 mr-1" /> Aplicar campos dinâmicos
          </Button>
          <div>
            <Label>Conteúdo (editável)</Label>
            <Textarea rows={14} className="font-mono text-sm" value={preview} onChange={(e) => setPreview(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !title}>Salvar cópia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionsDialog({ template, onClose }: any) {
  const { data: versions = [] } = useQuery({
    queryKey: ["lib-versions", template?.id],
    enabled: !!template?.id,
    queryFn: async () => {
      const { data } = await sb.from("consultant_library_template_versions")
        .select("*").eq("template_id", template!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });
  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de versões</DialogTitle>
          <DialogDescription>{template?.title}</DialogDescription>
        </DialogHeader>
        {versions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma versão anterior registrada.</p>
        ) : (
          <div className="space-y-3">
            {versions.map((v: any) => (
              <Card key={v.id}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    {new Date(v.created_at).toLocaleString()} · {v.change_note || "Atualização"}
                  </p>
                  <pre className="text-xs whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{v.content_snapshot}</pre>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
