import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft, Save, FileDown, Share2, PenLine, Copy as CopyIcon,
  Archive, CheckCircle2, History as HistoryIcon, Send,
} from "lucide-react";
import {
  DOCUMENT_TYPES_MAP, STATUS_OPTIONS, SIGNATURE_STATUS_OPTIONS,
  applyDynamicFields,
} from "@/lib/document-types";

export const Route = createFileRoute("/app/biblioteca/documento/$id")({ component: DocumentoPage });

const sb = supabase as any;

function DocumentoPage() {
  const { id } = useParams({ from: "/app/biblioteca/documento/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("rascunho");
  const [sigStatus, setSigStatus] = useState("nao_enviado");
  const [shared, setShared] = useState(false);

  const { data: doc, isLoading } = useQuery({
    queryKey: ["gen-doc", id],
    queryFn: async () => {
      const { data, error } = await sb
        .from("generated_documents")
        .select("*, companies(id, nome, cnpj, responsavel, cidade, estado), consultants(id, consultancy_name, responsible_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!doc) return;
    setContent(doc.final_content ?? doc.generated_content ?? "");
    setTitle(doc.title ?? "");
    setStatus(doc.status ?? "rascunho");
    setSigStatus(doc.signature_status ?? "nao_enviado");
    setShared(!!doc.shared_with_client);
  }, [doc]);

  const def = doc ? DOCUMENT_TYPES_MAP[doc.document_type] : null;

  const { data: versions } = useQuery({
    queryKey: ["gen-doc-versions", id],
    queryFn: async () => {
      const { data } = await sb
        .from("generated_document_versions")
        .select("id, change_note, created_at")
        .eq("document_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (opts: { snapshot?: boolean; note?: string }) => {
      const updates: any = { title, final_content: content, status, signature_status: sigStatus, shared_with_client: shared };
      if (status === "finalizado") updates.finalized_at = new Date().toISOString();
      const { error } = await sb.from("generated_documents").update(updates).eq("id", id);
      if (error) throw error;
      if (opts.snapshot) {
        await sb.from("generated_document_versions").insert({
          document_id: id, content_snapshot: content,
          form_data_snapshot: doc?.form_data, changed_by: user?.id,
          change_note: opts.note ?? "Versão salva",
        });
      }
    },
    onSuccess: () => {
      toast.success("Documento salvo");
      qc.invalidateQueries({ queryKey: ["gen-doc", id] });
      qc.invalidateQueries({ queryKey: ["gen-doc-versions", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      if (!def || !doc) return;
      const ctx = {
        empresa: doc.companies ? { nome: doc.companies.nome, cnpj: doc.companies.cnpj, responsavel: doc.companies.responsavel, cidade: doc.companies.cidade, estado: doc.companies.estado } : undefined,
        consultor: { nome: doc.consultants?.responsible_name, consultoria: doc.consultants?.consultancy_name },
        hoje: new Date().toLocaleDateString("pt-BR"),
      };
      const generated = def.render(doc.form_data ?? {}, ctx);
      const finalContent = applyDynamicFields(generated, ctx);
      setContent(finalContent);
      toast.info("Conteúdo regenerado a partir dos dados. Salve para aplicar.");
    },
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      if (!doc) return;
      const { data, error } = await sb.from("generated_documents").insert({
        consultant_id: doc.consultant_id, company_id: doc.company_id,
        document_type: doc.document_type, title: `${doc.title} (cópia)`,
        form_data: doc.form_data, generated_content: doc.generated_content,
        final_content: content, status: "rascunho", created_by: user?.id,
      }).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (newId) => { toast.success("Documento duplicado"); navigate({ to: "/app/biblioteca/documento/$id", params: { id: newId! } }); },
    onError: (e: any) => toast.error(e.message),
  });

  const exportPdf = () => {
    // Lightweight: open print window with content as plain text
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Inter,system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6;white-space:pre-wrap} h1,h2,h3{margin-top:1.5em} table{border-collapse:collapse;width:100%;margin:1em 0} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left} @media print{body{margin:0}}</style>
      </head><body>${escapeHtml(content)}<script>window.onload=()=>window.print()</script></body></html>`);
    w.document.close();
  };

  const sendSignature = () => {
    setSigStatus("enviado");
    toast.info("Integração de assinatura ainda não configurada. Exporte o PDF para assinatura externa.");
    save.mutate({});
  };

  if (isLoading || !doc) return <div className="p-6 text-muted-foreground">Carregando documento...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/app/biblioteca" })}><ArrowLeft className="size-4" /></Button>
          <div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold h-9 w-[420px] max-w-full" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Badge variant="outline">{def?.label}</Badge>
              {doc.companies && <span>{doc.companies.nome}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => regenerate.mutate()}><PenLine className="size-4" /> Regenerar</Button>
          <Button variant="outline" size="sm" onClick={() => duplicate.mutate()}><CopyIcon className="size-4" /> Duplicar</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileDown className="size-4" /> Exportar PDF</Button>
          <Button variant="outline" size="sm" onClick={() => { setStatus("compartilhado"); setShared(true); save.mutate({}); }}><Share2 className="size-4" /> Compartilhar</Button>
          <Button variant="outline" size="sm" onClick={sendSignature}><Send className="size-4" /> Enviar p/ assinatura</Button>
          <Button size="sm" onClick={() => save.mutate({ snapshot: true, note: "Salvo manualmente" })}><Save className="size-4" /> Salvar</Button>
        </div>
      </div>

      <Tabs defaultValue="editor">
        <TabsList>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="dados">Dados originais</TabsTrigger>
          <TabsTrigger value="config">Status & compartilhamento</TabsTrigger>
          <TabsTrigger value="historico"><HistoryIcon className="size-3.5 mr-1" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="editor">
          <Card>
            <CardContent className="pt-6">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-sm min-h-[600px] leading-relaxed"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Edite livremente. O documento usa Markdown leve — títulos com #, listas com - e tabelas com |.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados">
          <Card>
            <CardHeader><CardTitle>Dados do formulário</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/40 rounded p-3 overflow-auto max-h-[500px]">{JSON.stringify(doc.form_data, null, 2)}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config">
          <Card>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status de assinatura</Label>
                <Select value={sigStatus} onValueChange={setSigStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SIGNATURE_STATUS_OPTIONS.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} id="shared" />
                <Label htmlFor="shared">Compartilhar com cliente</Label>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => { setStatus("arquivado"); save.mutate({}); }}><Archive className="size-4" /> Arquivar</Button>
                <Button variant="outline" size="sm" onClick={() => { setStatus("finalizado"); save.mutate({}); }}><CheckCircle2 className="size-4" /> Finalizar</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="pt-6">
              {(versions ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma versão salva.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {versions!.map((vrs: any) => (
                    <li key={vrs.id} className="flex items-center justify-between border-b pb-2">
                      <span>{vrs.change_note}</span>
                      <span className="text-xs text-muted-foreground">{new Date(vrs.created_at).toLocaleString("pt-BR")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
