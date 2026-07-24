import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { downloadFileFromUrl, reserveDownloadTarget } from "@/lib/download-file";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { Download, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/documentos")({ component: DocumentosPage });

const MODULES = [
  { key: "all", label: "Todos os módulos" },
  { key: "company", label: "Empresa" },
  { key: "branch", label: "Filial" },
  { key: "cashflow", label: "Fluxo de Caixa" },
  { key: "payable", label: "Contas a Pagar" },
  { key: "receivable", label: "Contas a Receber" },
  { key: "sale", label: "Vendas" },
  { key: "product", label: "Produtos" },
  { key: "stock", label: "Estoque" },
  { key: "pricing", label: "Precificação" },
  { key: "crm_contact", label: "CRM / Clientes" },
  { key: "report", label: "Relatórios" },
  { key: "import", label: "Importações" },
  { key: "other", label: "Outros" },
];

function DocumentosPage() {
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["all-attachments", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("company_id", selected!)
        .is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((a) => {
      if (moduleFilter !== "all" && a.related_module !== moduleFilter) return false;
      if (!q) return true;
      return (
        a.file_name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q) ||
        (a.document_type ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, moduleFilter]);

  async function download(filePath: string, fileName: string) {
    const target = reserveDownloadTarget(fileName);
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(filePath, 300, { download: fileName });
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Não foi possível gerar o link"); return; }
    await downloadFileFromUrl(data.signedUrl, fileName, target);
  }

  async function remove(id: string, filePath: string, name: string) {
    if (!confirm(`Excluir ${name}?`)) return;
    await supabase.storage.from("attachments").remove([filePath]);
    const { error } = await supabase.from("attachments").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["all-attachments", selected] }); }
  }

  if (!selected) return <div className="text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Documentos e Anexos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visão consolidada de todos os arquivos anexados nos módulos desta empresa.
        </p>
      </div>

      <div className="bg-card border rounded-2xl p-4 space-y-4">
        <h2 className="text-base font-display font-semibold">Anexar arquivo geral</h2>
        <AttachmentsPanel companyId={selected} module="other" />
      </div>

      <div className="bg-card border rounded-2xl p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar por nome, descrição ou tipo" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MODULES.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Arquivo</th>
                <th className="px-4 py-2 font-medium">Módulo</th>
                <th className="px-4 py-2 font-medium">Tipo</th>
                <th className="px-4 py-2 font-medium">Descrição</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Nenhum arquivo encontrado.</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{a.file_name}</td>
                  <td className="px-4 py-2 text-xs">{MODULES.find((m) => m.key === a.related_module)?.label ?? a.related_module}</td>
                  <td className="px-4 py-2 text-xs">{a.document_type ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{a.description ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{new Date(a.created_at).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => download(a.file_path, a.file_name)} title="Baixar"><Download className="size-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(a.id, a.file_path, a.file_name)} title="Excluir"><Trash2 className="size-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
