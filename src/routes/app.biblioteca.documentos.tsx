import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FiltroBotao } from "@/components/FiltroBotao";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Search, Building2, Share2, PenLine } from "lucide-react";
import { DOCUMENT_TYPES, DOCUMENT_TYPES_MAP, DOCUMENT_CATEGORIES, STATUS_OPTIONS } from "@/lib/document-types";

export const Route = createFileRoute("/app/biblioteca/documentos")({ component: DocumentosGeradosPage });

const sb = supabase as any;

function DocumentosGeradosPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("__all");
  const [status, setStatus] = useState<string>("__all");

  const { data: consultant } = useQuery({
    queryKey: ["consultant-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: docs } = useQuery({
    queryKey: ["gen-docs-list", consultant?.id, type, status],
    enabled: !!consultant?.id,
    queryFn: async () => {
      let q = sb
        .from("generated_documents")
        .select("id, title, document_type, status, shared_with_client, signature_status, updated_at, companies(nome)")
        .eq("consultant_id", consultant!.id)
        .order("updated_at", { ascending: false });
      if (type !== "__all") q = q.eq("document_type", type);
      if (status !== "__all") q = q.eq("status", status);
      const { data } = await q;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return docs ?? [];
    return (docs ?? []).filter((d: any) =>
      d.title?.toLowerCase().includes(s) || d.companies?.nome?.toLowerCase().includes(s)
    );
  }, [docs, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos Gerados</h1>
          <p className="text-sm text-muted-foreground">Documentos criados a partir dos modelos para empresas clientes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/app/biblioteca">Modelos</Link></Button>
          <Button asChild><Link to="/app/biblioteca/criar"><Plus className="size-4" /> Criar Documento</Link></Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título ou empresa..." className="pl-10 h-11 rounded-full bg-card border shadow-sm" />
        </div>
        <FiltroBotao
          grupos={[
            { titulo: "Tipo de documento", valor: type, padrao: "__all", onChange: setType, formato: "lista",
              opcoes: [["__all", "Todos os tipos"], ...DOCUMENT_TYPES.map((d) => [d.key, d.label] as [string, string])] },
            { titulo: "Status", valor: status, padrao: "__all", onChange: setStatus,
              opcoes: [["__all", "Todos"], ...STATUS_OPTIONS.map((o) => [o.v, o.l] as [string, string])] },
          ]}
        />
      </div>

      <div className="grid gap-2">
        {filtered.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum documento ainda. Clique em "Criar Documento".</CardContent></Card>
        )}
        {filtered.map((d: any) => {
          const def = DOCUMENT_TYPES_MAP[d.document_type];
          const st = STATUS_OPTIONS.find((s) => s.v === d.status);
          return (
            <button
              key={d.id}
              onClick={() => navigate({ to: "/app/biblioteca/documento/$id", params: { id: d.id } })}
              className="text-left bg-card rounded-3xl shadow-card p-4 hover:bg-accent transition-colors flex items-center gap-4"
            >
              <FileText className="size-5 text-primary" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{d.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Badge variant="outline" className="text-xs">{def?.label ?? d.document_type}</Badge>
                  {d.companies?.nome && <span className="flex items-center gap-1"><Building2 className="size-3" />{d.companies.nome}</span>}
                  <span>· {new Date(d.updated_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              {d.shared_with_client && <Badge variant="secondary"><Share2 className="size-3 mr-1" />Compartilhado</Badge>}
              <Badge>{st?.l ?? d.status}</Badge>
              <PenLine className="size-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
