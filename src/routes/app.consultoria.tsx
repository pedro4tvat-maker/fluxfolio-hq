import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Link2, Check, X, BadgeCheck, Building2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { maskCNPJ, maskPhone, BR_STATES } from "@/lib/cnpj";

export const Route = createFileRoute("/app/consultoria")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: ConsultoriaPage,
});

function ConsultoriaPage() {
  const { isConsultant, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!isConsultant) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center max-w-xl mx-auto">
        <h2 className="font-display font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">Esta área é exclusiva para consultores.</p>
      </div>
    );
  }
  return <Inner />;
}

function Inner() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Minha Consultoria</h1>
        <p className="text-muted-foreground text-sm">Dados da sua empresa de consultoria e vínculo com clientes.</p>
      </div>
      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">Perfil & Código</TabsTrigger>
          <TabsTrigger value="solicitacoes">Solicitações de vínculo</TabsTrigger>
          <TabsTrigger value="clientes">Empresas vinculadas</TabsTrigger>
        </TabsList>
        <TabsContent value="perfil" className="mt-6"><PerfilTab /></TabsContent>
        <TabsContent value="solicitacoes" className="mt-6"><SolicitacoesTab /></TabsContent>
        <TabsContent value="clientes" className="mt-6"><ClientesVinculadosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function PerfilTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-consultancy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data && !form) setForm({ ...data, consultancy_cnpj: data.consultancy_cnpj ? maskCNPJ(data.consultancy_cnpj) : "", phone: data.phone ? maskPhone(data.phone) : "" }); }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("consultants").update({
        consultancy_name: form.consultancy_name,
        consultancy_cnpj: form.consultancy_cnpj ? form.consultancy_cnpj.replace(/\D/g, "") : null,
        responsible_name: form.responsible_name,
        email: form.email,
        phone: form.phone,
        city: form.city,
        state: form.state,
      }).eq("id", data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados atualizados"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  const inviteUrl = `${window.location.origin}/signup?invite=${data!.invite_code}`;
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copiado!`); };

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-2xl p-6 shadow-card">
        <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> Código de convite</h3>
        <p className="text-sm text-muted-foreground mb-4">Compartilhe com seus clientes — quem usar o código será vinculado automaticamente como aprovado.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Código</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={data!.invite_code} className="font-mono font-semibold text-base" />
              <Button variant="outline" onClick={() => copy(data!.invite_code, "Código")}><Copy className="size-4" /></Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Link de convite</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={inviteUrl} className="text-xs" />
              <Button variant="outline" onClick={() => copy(inviteUrl, "Link")}><Link2 className="size-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <h3 className="font-display font-semibold">Dados da consultoria</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="Nome da consultoria" required value={form.consultancy_name ?? ""} onChange={(v) => setForm({ ...form, consultancy_name: v })} />
          <FormField label="CNPJ" value={form.consultancy_cnpj ?? ""} onChange={(v) => setForm({ ...form, consultancy_cnpj: maskCNPJ(v) })} />
          <FormField label="Responsável" value={form.responsible_name ?? ""} onChange={(v) => setForm({ ...form, responsible_name: v })} />
          <FormField label="E-mail" type="email" value={form.email ?? ""} onChange={(v) => setForm({ ...form, email: v })} />
          <FormField label="Telefone" value={form.phone ?? ""} onChange={(v) => setForm({ ...form, phone: maskPhone(v) })} />
          <FormField label="Cidade" value={form.city ?? ""} onChange={(v) => setForm({ ...form, city: v })} />
          <div>
            <Label className="text-sm">UF</Label>
            <Select value={form.state ?? ""} onValueChange={(v) => setForm({ ...form, state: v })}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar alterações</Button>
        </div>
      </div>
    </div>
  );
}

function SolicitacoesTab() {
  const qc = useQueryClient();
  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["link-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_company_links")
        .select("id, status, created_at, companies(id, nome, nome_fantasia, cnpj, responsavel, cidade, estado, segmento)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const respond = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const patch: any = { status, responded_at: new Date().toISOString() };
      if (status === "approved") patch.linked_at = new Date().toISOString();
      const { error } = await supabase.from("consultant_company_links").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.status === "approved" ? "Vínculo aprovado!" : "Solicitação recusada.");
      qc.invalidateQueries({ queryKey: ["link-requests"] });
      qc.invalidateQueries({ queryKey: ["dashboard-companies"] });
      qc.invalidateQueries({ queryKey: ["companies-list"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {isLoading ? <div className="text-muted-foreground text-sm">Carregando...</div> :
        pending.length === 0 ? (
          <div className="bg-card border rounded-2xl p-10 text-center">
            <BadgeCheck className="size-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-muted-foreground text-sm">Nenhuma solicitação pendente.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Solicitada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.companies?.nome_fantasia || r.companies?.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{r.companies?.cnpj ? maskCNPJ(r.companies.cnpj) : "—"}</TableCell>
                    <TableCell className="text-sm">{r.companies?.responsavel || "—"}</TableCell>
                    <TableCell className="text-sm">{r.companies?.cidade ? `${r.companies.cidade}/${r.companies.estado}` : "—"}</TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => respond.mutate({ id: r.id, status: "rejected" })} disabled={respond.isPending}>
                        <X className="size-4" /> Recusar
                      </Button>
                      <Button size="sm" onClick={() => respond.mutate({ id: r.id, status: "approved" })} disabled={respond.isPending}>
                        <Check className="size-4" /> Aprovar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )
      }
    </div>
  );
}

function ClientesVinculadosTab() {
  const qc = useQueryClient();
  const { data: links = [], isLoading } = useQuery({
    queryKey: ["my-linked-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_company_links")
        .select("id, status, linked_at, companies(id, nome, nome_fantasia, cnpj, responsavel, cidade, estado, segmento, ativo)")
        .in("status", ["approved", "inactive"])
        .order("linked_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const setInactive = useMutation({
    mutationFn: async ({ companyId, linkId }: { companyId: string; linkId: string }) => {
      await supabase.from("companies").update({ ativo: false }).eq("id", companyId);
      await supabase.from("consultant_company_links").update({ status: "inactive" }).eq("id", linkId);
    },
    onSuccess: () => { toast.success("Empresa inativada"); qc.invalidateQueries({ queryKey: ["my-linked-companies"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: async ({ companyId, linkId }: { companyId: string; linkId: string }) => {
      await supabase.from("companies").update({ ativo: true }).eq("id", companyId);
      await supabase.from("consultant_company_links").update({ status: "approved" }).eq("id", linkId);
    },
    onSuccess: () => { toast.success("Empresa reativada"); qc.invalidateQueries({ queryKey: ["my-linked-companies"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); },
  });

  const remove = useMutation({
    mutationFn: async ({ companyId }: { companyId: string }) => {
      const { error } = await supabase.from("companies").delete().eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Empresa excluída"); qc.invalidateQueries({ queryKey: ["my-linked-companies"] }); qc.invalidateQueries({ queryKey: ["dashboard-companies"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const confirmDelete = (companyId: string, name: string) => {
    const v = window.prompt(`Esta ação é irreversível. Digite EXCLUIR para apagar "${name}" e todos os dados associados:`);
    if (v?.trim().toUpperCase() === "EXCLUIR") remove.mutate({ companyId });
    else if (v) toast.error("Confirmação incorreta. Nada foi excluído.");
  };

  return (
    <div className="space-y-4">
      {isLoading ? <div className="text-muted-foreground text-sm">Carregando...</div> :
        links.length === 0 ? (
          <div className="bg-card border rounded-2xl p-10 text-center">
            <Building2 className="size-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-muted-foreground text-sm">Nenhuma empresa vinculada ainda.</p>
          </div>
        ) : (
          <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((l: any) => {
                  const c = l.companies;
                  if (!c) return null;
                  const inativo = l.status === "inactive" || c.ativo === false;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{c.nome_fantasia || c.nome}<div className="text-xs text-muted-foreground">{c.responsavel || "—"}</div></TableCell>
                      <TableCell className="font-mono text-xs">{c.cnpj ? maskCNPJ(c.cnpj) : "—"}</TableCell>
                      <TableCell className="text-sm">{c.cidade ? `${c.cidade}/${c.estado}` : "—"}</TableCell>
                      <TableCell className="text-sm">{c.segmento || "—"}</TableCell>
                      <TableCell>{inativo ? <Badge variant="secondary">Inativa</Badge> : <Badge variant="default">Ativa</Badge>}</TableCell>
                      <TableCell className="text-right space-x-1">
                        {inativo ? (
                          <Button size="sm" variant="outline" onClick={() => reactivate.mutate({ companyId: c.id, linkId: l.id })}>Reativar</Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => {
                            if (confirm(`Inativar "${c.nome_fantasia || c.nome}"? Os dados serão preservados mas ela sairá da lista de ativas.`))
                              setInactive.mutate({ companyId: c.id, linkId: l.id });
                          }}>Inativar</Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirmDelete(c.id, c.nome_fantasia || c.nome)}>
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )
      }
    </div>
  );
}

function FormField({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

export const _icons = { Mail, Phone, MapPin };
