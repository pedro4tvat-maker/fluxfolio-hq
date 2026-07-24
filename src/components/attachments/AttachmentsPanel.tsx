import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { downloadFileFromUrl, reserveDownloadTarget } from "@/lib/download-file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Paperclip, Download, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED = ".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const DOC_TYPES = [
  "Comprovante de pagamento",
  "Nota fiscal",
  "Contrato",
  "Boleto",
  "Recibo",
  "Extrato",
  "Documento do cliente",
  "Documento da empresa",
  "Outros",
];

type Attachment = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  document_type: string | null;
  description: string | null;
  created_at: string;
};

export function AttachmentsPanel({
  companyId,
  module,
  recordId,
  branchId,
  compact = false,
}: {
  companyId?: string | null;
  module: string;
  recordId?: string | null;
  branchId?: string | null;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("Outros");
  const [desc, setDesc] = useState("");

  const scopeId = companyId ?? user?.id ?? null;
  const queryKey = ["attachments", scopeId, module, recordId ?? null];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    enabled: !!scopeId,
    queryFn: async () => {
      let q = supabase
        .from("attachments")
        .select("*")
        .eq("related_module", module)
        .is("deleted_at", null).order("created_at", { ascending: false });
      if (companyId) q = q.eq("company_id", companyId);
      else q = q.is("company_id", null).eq("uploaded_by", user!.id);
      if (recordId) q = q.eq("related_record_id", recordId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Attachment[];
    },
  });


  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SIZE) { toast.error("Arquivo maior que 20MB"); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      if (!scopeId) { toast.error("Faça login para anexar arquivos"); setUploading(false); return; }
      const path = `${scopeId}/${module}/${recordId ?? "geral"}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("attachments").insert({
        company_id: companyId ?? null,
        branch_id: branchId ?? null,
        related_module: module,
        related_record_id: recordId ?? null,
        file_name: file.name,
        file_path: path,
        file_type: file.type || null,
        file_size: file.size,
        document_type: docType,
        description: desc.trim() || null,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Arquivo anexado");
      setDesc("");
      qc.invalidateQueries({ queryKey });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  }

  async function download(a: Attachment) {
    const target = reserveDownloadTarget(a.file_name);
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(a.file_path, 300, { download: a.file_name });
    if (error || !data?.signedUrl) { target.popup?.close(); toast.error(error?.message ?? "Não foi possível gerar o link"); return; }
    await downloadFileFromUrl(data.signedUrl, a.file_name, target);
  }

  async function remove(a: Attachment) {
    if (!confirm(`Excluir ${a.file_name}?`)) return;
    const { error: sErr } = await supabase.storage.from("attachments").remove([a.file_path]);
    if (sErr) { toast.error(sErr.message); return; }
    const { error } = await supabase.from("attachments").update({ deleted_at: new Date().toISOString() }).eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Anexo removido");
    qc.invalidateQueries({ queryKey });
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="grid gap-2 md:grid-cols-[180px_1fr_auto] items-end">
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Boleto de janeiro" />
          </div>
          <label className="cursor-pointer">
            <input type="file" accept={ACCEPTED} className="hidden" onChange={onPickFile} disabled={uploading} />
            <span className="inline-flex h-9 items-center justify-center gap-2 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              <Upload className="size-4" />{uploading ? "Enviando..." : "Anexar"}
            </span>
          </label>
        </div>
      )}
      {compact && (
        <label className="cursor-pointer inline-block">
          <input type="file" accept={ACCEPTED} className="hidden" onChange={onPickFile} disabled={uploading} />
          <span className="inline-flex h-8 items-center justify-center gap-2 px-3 rounded-md border text-xs font-medium hover:bg-accent">
            <Paperclip className="size-3" />{uploading ? "Enviando..." : "Anexar arquivo"}
          </span>
        </label>
      )}

      <div className="border rounded-xl divide-y">
        {isLoading ? (
          <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">Nenhum arquivo anexado.</div>
        ) : items.map((a) => (
          <div key={a.id} className="p-3 flex items-center gap-3 text-sm">
            <Paperclip className="size-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {a.document_type ?? "—"}
                {a.description ? ` · ${a.description}` : ""}
                {a.file_size ? ` · ${formatBytes(a.file_size)}` : ""}
                {` · ${new Date(a.created_at).toLocaleDateString("pt-BR")}`}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => download(a)} title="Baixar"><Download className="size-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => remove(a)} title="Excluir"><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
