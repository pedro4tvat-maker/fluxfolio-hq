import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil } from "lucide-react";
import { ContactForm, labelTipo, labelStatus } from "./app.crm";
import { AttachmentsPanel } from "@/components/attachments/AttachmentsPanel";
import { formatMoney } from "@/lib/format";

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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/crm"><Button variant="ghost" size="icon"><ArrowLeft className="size-4" /></Button></Link>
          <div>
            <h1 className="text-2xl font-display font-bold">{contact.name}</h1>
            <p className="text-sm text-muted-foreground">
              {labelTipo(contact.tipo)} · {labelStatus(contact.status)}
            </p>
          </div>
        </div>
        <Button onClick={() => setEditOpen(true)}><Pencil className="size-4" /> Editar</Button>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="receivables">Contas a Receber ({receivables.length})</TabsTrigger>
          <TabsTrigger value="anexos">Anexos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="bg-card border rounded-2xl p-4 grid gap-3 md:grid-cols-2">
          <Field label="CPF/CNPJ" value={contact.cpf_cnpj} />
          <Field label="E-mail" value={contact.email} />
          <Field label="Telefone" value={contact.phone} />
          <Field label="WhatsApp" value={contact.whatsapp} />
          <Field label="Cidade/UF" value={[contact.city, contact.state].filter(Boolean).join("/") || null} />
          <Field label="Endereço" value={contact.address} />
          <Field label="Origem do lead" value={contact.lead_source} />
          <Field label="Responsável" value={contact.responsible} />
          <div className="md:col-span-2">
            <Field label="Observações" value={contact.notes} />
          </div>
        </TabsContent>

        <TabsContent value="receivables" className="bg-card border rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Descrição</th>
                <th className="px-4 py-2 font-medium">Vencimento</th>
                <th className="px-4 py-2 font-medium">Valor</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {receivables.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhuma venda vinculada ainda.</td></tr>
              ) : receivables.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2">{r.descricao}</td>
                  <td className="px-4 py-2">{new Date(r.vencimento).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2">{formatMoney(Number(r.valor))}</td>
                  <td className="px-4 py-2 capitalize">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="anexos">
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}
