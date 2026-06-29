import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Download, ShieldCheck, RefreshCw, Database } from "lucide-react";

export const Route = createFileRoute("/app/backups")({ component: BackupsPage });

const TABLES = [
  "transactions", "receivables", "sale_items", "stock_movements",
  "products", "crm_contacts", "companies", "company_members", "consultants",
];

function BackupsPage() {
  const { user } = useAuth();
  const { selected: selectedCompanyId } = useSelectedCompany();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["backup_logs", selectedCompanyId],
    queryFn: async () => {
      let q = supabase.from("backup_logs").select("*, companies(nome)").order("created_at", { ascending: false }).limit(50);
      if (selectedCompanyId) q = q.eq("company_id", selectedCompanyId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const generate = useMutation({
    mutationFn: async () => {
      setRunning(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada");
      const { data, error } = await supabase.functions.invoke("generate-weekly-backup", {
        body: { company_id: selectedCompanyId ?? null },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      const total = data?.results?.length ?? 0;
      toast.success(`Backup gerado: ${total} empresa(s) processada(s)`);
      qc.invalidateQueries({ queryKey: ["backup_logs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao gerar backup"),
    onSettled: () => setRunning(false),
  });

  async function downloadFile(companyId: string, date: string, table: string) {
    const path = `${companyId}/${date}/${table}.csv`;
    const { data, error } = await supabase.storage.from("system-backups").createSignedUrl(path, 60);
    if (error) {
      toast.error(`Arquivo não disponível: ${error.message}`);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Backups do Sistema
            </h1>
            <p className="text-sm text-muted-foreground">
              Bucket privado <code>system-backups</code> · {selectedCompanyId ? "Empresa selecionada" : "Todas as empresas acessíveis"}
            </p>
          </div>
        </div>
        <Button onClick={() => generate.mutate()} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Gerando..." : "Gerar backup agora"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Tabelas exportadas em cada backup
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TABLES.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de backups</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Arquivos</TableHead>
                <TableHead>Linhas</TableHead>
                <TableHead>Concluído</TableHead>
                <TableHead>Arquivos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableRow><TableCell colSpan={7}>Carregando...</TableCell></TableRow>}
              {!isLoading && logs.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-muted-foreground">
                  Nenhum backup ainda. Clique em "Gerar backup agora".
                </TableCell></TableRow>
              )}
              {logs.map((l: any) => {
                const tables: any[] = Array.isArray(l.tables_exported) ? l.tables_exported : [];
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.backup_date}</TableCell>
                    <TableCell>{l.companies?.nome ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "completed" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                        {l.status}
                      </Badge>
                      {l.error_message && <div className="text-xs text-red-600 mt-1">{l.error_message}</div>}
                    </TableCell>
                    <TableCell>{l.total_files}</TableCell>
                    <TableCell>{l.total_rows}</TableCell>
                    <TableCell>{l.completed_at ? new Date(l.completed_at).toLocaleString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {tables.filter((t) => t.ok && t.path).map((t) => (
                          <Button key={t.table} size="sm" variant="outline"
                            onClick={() => downloadFile(l.company_id, l.backup_date, t.table)}>
                            <Download className="h-3 w-3 mr-1" />{t.table}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
