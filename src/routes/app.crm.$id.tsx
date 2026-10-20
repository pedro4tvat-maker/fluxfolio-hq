import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { ContactForm, labelTipo, StatusBadge, iniciais, linkWhatsApp } from "./app.crm";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/app/crm/$id")({ component: ContactProfile });

function ContactProfile() {
  const { id } = useParams({ from: "/app/crm/$id" });
  const { selected } = useSelectedCompany();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["crm-contact", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_contacts").select("*").eq("id", id).is("deleted_at", null).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: receivables = [] } = useQuery({
    queryKey: ["crm-receivables", id],
    enabled: !!contact,
    queryFn: async () => {
      const { data } = await supabase
        .from("receivables")
        .select("id, descricao, valor, vencimento, data_recebimento, status")
        .eq("crm_contact_id", id)
        .is("deleted_at", null)
        .order("vencimento", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading || !contact) return <div className="text-muted-foreground">Carregando...</div>;

  const zap = linkWhatsApp(contact.whatsapp || contact.phone);
  const hoje = new Date().toISOString().slice(0, 10);
  const recebido = receivables.filter((r) => r.status === "recebido").reduce((t, r) => t + Number(r.valor), 0);
  const aberto = receivables.filter((r) => r.status !== "recebido").reduce((t, r) => t + Number(r.valor), 0);
  const atrasado = receivables.filter((r) => r.status !== "recebido" && r.vencimento < hoje).reduce((t, r) => t + Number(r.valor), 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <Link to="/app/crm" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Voltar ao CRM
      </Link>

      <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-7 sm:py-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="size-14 shrink-0 rounded-full bg-primary text-primary-foreground grid place-items-center text-lg font-semibold">{iniciais(contact.name)}</span>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-display font-bold truncate">{contact.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="rounded-full bg-background/80 px-2 py-px text-[11px] font-medium">{labelTipo(contact.tipo)}</span>
                <StatusBadge status={contact.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {zap && (
              <Button asChild variant="outline" className="rounded-full bg-background">
                <a href={zap} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4 text-success" /> WhatsApp</a>
              </Button>
            )}
            {contact.email && (
              <Button asChild variant="outline" className="rounded-full bg-background">
                <a href={`mailto:${contact.email}`}><Mail className="size-4" /> E-mail</a>
              </Button>
            )}
            <Button className="rounded-full" onClick={() => setEditOpen(true)}><Pencil className="size-4" /> Editar</Button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {([["Já recebido", recebido, "text-success"], ["Em aberto", aberto, "text-foreground"], ["Em atraso", atrasado, atrasado > 0 ? "text-destructive" : "text-muted-foreground"]] as const).map(([r, v, cor]) => (
            <div key={r} className="rounded-2xl bg-background/70 px-3.5 py-3">
              <div className={`text-[11px] font-medium ${cor}`}>{r}</div>
              <div className="font-display font-semibold text-sm sm:text-lg tabular-nums truncate">{formatMoney(v)}</div>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="h-auto rounded-full bg-muted p-1">
          <TabsTrigger value="dados" className="rounded-full px-4 h-9 data-[state=active]:shadow-sm">Dados</TabsTrigger>
          <TabsTrigger value="receivables" className="rounded-full px-4 h-9 data-[state=active]:shadow-sm">Compras ({receivables.length})</TabsTrigger>
          <TabsTrigger value="anexos" className="rounded-full px-4 h-9 data-[state=active]:shadow-sm">Anexos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-5 bg-card rounded-3xl shadow-card p-5 sm:p-6 grid gap-5 sm:grid-cols-2">
          <Field icon={Phone} label="Telefone" value={contact.phone} />
          <Field icon={MessageCircle} label="WhatsApp" value={contact.whatsapp} />
          <Field icon={Mail} label="E-mail" value={contact.email} />
          <Field label="CPF/CNPJ" value={contact.cpf_cnpj} />
          <Field icon={MapPin} label="Cidade/UF" value={[contact.city, contact.state].filter(Boolean).join("/") || null} />
          <Field label="Endereço" value={contact.address} />
          <Field label="Origem do lead" value={contact.lead_source} />
          <Field label="Responsável" value={contact.responsible} />
          <div className="sm:col-span-2">
            <Field label="Observações" value={contact.notes} />
          </div>
        </TabsContent>

        <TabsContent value="receivables" className="mt-5 bg-card rounded-3xl shadow-card p-2 sm:p-3">
          {receivables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Nenhuma venda vinculada ainda.</p>
          ) : (
            <ul>
              {receivables.map((r) => {
                const feito = r.status === "recebido";
                const atras = !feito && r.vencimento < hoje;
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-2xl px-3 py-3 hover:bg-muted/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{(r.descricao || "Venda").replace(/\s*@[\d.,]+(?:\|c[\d.,]+)?/g, "")}</div>
                      <div className="text-xs text-muted-foreground">vence {formatDate(r.vencimento)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-px text-[10px] font-medium ${feito ? "bg-success/12 text-success" : atras ? "bg-destructive/10 text-destructive" : "bg-warning/15 text-warning-foreground"}`}>
                      {feito ? "Recebido" : atras ? "Atrasado" : "Em aberto"}
                    </span>
                    <div className="text-sm font-display font-semibold tabular-nums w-28 text-right">{formatMoney(Number(r.valor))}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="anexos" className="mt-5">
          {selected && (
            <AttachmentsPanel companyId={selected} module="crm_contact" recordId={id} />
          )}
        </TabsContent>
      </Tabs>

      {selected && (
        <ContactForm
          open={editOpen}
          onOpenChange={setEditOpen}
          editing={contact}
          companyId={selected}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["crm-contact", id] });
            qc.invalidateQueries({ queryKey: ["crm", selected] });
          }}
        />
      )}
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">{Icon && <Icon className="size-3.5" />}{label}</div>
      <div className="text-sm mt-0.5">{value || "—"}</div>
    </div>
  );
}
