import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, FileText, Building2, Sparkles } from "lucide-react";
import {
  DOCUMENT_TYPES, DOCUMENT_TYPES_MAP, applyDynamicFields,
} from "@/lib/document-types";
import { DocumentFormField } from "@/components/documents/DocumentFormField";

export const Route = createFileRoute("/app/biblioteca/criar")({ component: CriarDocumentoPage });

const sb = supabase as any;

function CriarDocumentoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [docKey, setDocKey] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [formData, setFormData] = useState<Record<string, any>>({});

  const def = useMemo(() => (docKey ? DOCUMENT_TYPES_MAP[docKey] : null), [docKey]);

  const { data: consultant } = useQuery({
    queryKey: ["consultant-self", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await sb.from("consultants").select("id, consultancy_name, responsible_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["consultant-companies", consultant?.id],
    enabled: !!consultant?.id,
    queryFn: async () => {
      const { data } = await sb
        .from("consultant_company_links")
        .select("company_id, companies(id, nome, cnpj, responsavel, cidade, estado)")
        .eq("consultant_id", consultant!.id)
        .eq("status", "approved");
      return (data ?? []).map((r: any) => r.companies).filter(Boolean);
    },
  });

  const company = useMemo(() => companies?.find((c: any) => c.id === companyId), [companies, companyId]);

  const setField = (k: string, v: any) => setFormData((p) => ({ ...p, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      if (!def || !consultant?.id) throw new Error("Configuração incompleta");
      const ctx = {
        empresa: company ? { nome: company.nome, cnpj: company.cnpj, responsavel: company.responsavel, cidade: company.cidade, estado: company.estado } : undefined,
        consultor: { nome: consultant?.responsible_name, consultoria: consultant?.consultancy_name },
        hoje: new Date().toLocaleDateString("pt-BR"),
      };
      const generated = def.render(formData, ctx);
      const finalContent = applyDynamicFields(generated, ctx);
      const payload = {
        consultant_id: consultant.id,
        company_id: companyId || null,
        document_type: def.key,
        title: title || `${def.label} — ${company?.nome ?? "sem empresa"}`,
        form_data: formData,
        generated_content: generated,
        final_content: finalContent,
        status: "gerado",
        created_by: user?.id,
      };
      const { data, error } = await sb.from("generated_documents").insert(payload).select("id").single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Documento gerado");
      navigate({ to: "/app/biblioteca/documento/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao gerar"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Criar Documento</h1>
          <p className="text-sm text-muted-foreground">Gerador de documentos profissionais</p>
        </div>
        <Button variant="outline" onClick={() => navigate({ to: "/app/biblioteca" })}>
          <ArrowLeft className="size-4" /> Voltar à Biblioteca
        </Button>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, l: "Tipo" },
          { n: 2, l: "Empresa" },
          { n: 3, l: "Conteúdo" },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            <div className={`size-7 rounded-full grid place-items-center text-xs font-medium ${step >= (s.n as 1 | 2 | 3) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s.n}</div>
            <span className={step >= (s.n as 1 | 2 | 3) ? "" : "text-muted-foreground"}>{s.l}</span>
            {i < 2 && <ArrowRight className="size-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DOCUMENT_TYPES.map((d) => (
            <button
              key={d.key}
              onClick={() => { setDocKey(d.key); setStep(2); }}
              className={`text-left rounded-xl border p-4 hover:bg-accent transition-colors ${docKey === d.key ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText className="size-4 text-primary" />
                <div className="font-medium">{d.label}</div>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">{d.description}</div>
              <Badge variant="outline" className="mt-3 text-xs">{d.category}</Badge>
            </button>
          ))}
        </div>
      )}

      {step === 2 && def && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="size-4" /> Selecionar empresa cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Empresa cliente {def.key.startsWith("proposta") ? "(opcional para prospects)" : ""}</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título do documento</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`${def.label} — ${company?.nome ?? "..."}`} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="size-4" /> Voltar</Button>
              <Button onClick={() => setStep(3)} disabled={!companyId && def.key !== "proposta_comercial" && def.key !== "outro"}>
                Continuar <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && def && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> {def.label}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {def.sections.map((section) => (
              <div key={section.title} className="space-y-3">
                <h3 className="text-sm font-semibold border-b pb-1">{section.title}</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {section.fields.map((f) => (
                    <div key={f.key} className={f.type === "textarea" || f.type === "table" ? "sm:col-span-2" : ""}>
                      <DocumentFormField field={f} value={formData[f.key]} onChange={(v) => setField(f.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="size-4" /> Voltar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending}>
                {create.isPending ? "Gerando..." : "Gerar Documento"} <Sparkles className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
