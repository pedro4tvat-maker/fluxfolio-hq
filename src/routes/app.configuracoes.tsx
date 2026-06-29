import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, Power, Check, BadgeCheck, Copy, Link2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskCNPJ, maskCEP, maskPhone, isValidCNPJ, BR_STATES } from "@/lib/cnpj";
import { CompanySwitcher } from "@/components/company-switcher";

export const Route = createFileRoute("/app/configuracoes")({ component: ConfiguracoesRouter });

function ConfiguracoesRouter() {
  const { isConsultant, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground text-sm">Carregando...</div>;
  if (isConsultant) return <ConsultantSettingsPage />;
  return <ConfiguracoesPage />;
}

function ConsultantSettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-consultancy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultants").select("*").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => {
    if (data && !form) setForm({
      ...data,
      consultancy_cnpj: data.consultancy_cnpj ? maskCNPJ(data.consultancy_cnpj) : "",
      phone: data.phone ? maskPhone(data.phone) : "",
    });
  }, [data, form]);

  const save = useMutation({
    mutationFn: async () => {
      if (form.consultancy_cnpj && !isValidCNPJ(form.consultancy_cnpj)) throw new Error("CNPJ inválido");
      const { error } = await supabase.from("consultants").update({
        consultancy_name: form.consultancy_name,
        consultancy_cnpj: form.consultancy_cnpj ? form.consultancy_cnpj.replace(/\D/g, "") : null,
        responsible_name: form.responsible_name || null,
        email: form.email || null,
        phone: form.phone || null,
        city: form.city || null,
        state: form.state || null,
      }).eq("id", data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dados atualizados"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const code = `FP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const { error } = await supabase.from("consultants").update({ invite_code: code }).eq("id", data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Novo código gerado"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  if (isLoading || !form) return <div className="text-muted-foreground text-sm">Carregando...</div>;
  if (!data) return <div className="text-muted-foreground text-sm">Perfil de consultoria não encontrado.</div>;

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/signup?invite=${data.invite_code}` : "";
  const copy = (text: string, label: string) => { navigator.clipboard.writeText(text); toast.success(`${label} copiado!`); };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Configurações</h1>
        <p className="text-muted-foreground text-sm">Dados da sua consultoria, código de convite e acesso.</p>
      </div>

      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="font-display font-semibold flex items-center gap-2"><BadgeCheck className="size-4 text-primary" /> Código de convite</h3>
          <Button variant="outline" size="sm" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>Gerar novo código</Button>
        </div>
        <p className="text-sm text-muted-foreground">Compartilhe este código ou link com seus clientes para que eles se vinculem à sua consultoria.</p>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Código</Label>
            <div className="flex gap-2 mt-1">
              <Input readOnly value={data.invite_code} className="font-mono font-semibold" />
              <Button variant="outline" onClick={() => copy(data.invite_code, "Código")}><Copy className="size-4" /></Button>
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
          <FormField label="CNPJ" value={form.consultancy_cnpj ?? ""} onChange={(v) => setForm({ ...form, consultancy_cnpj: maskCNPJ(v) })} placeholder="00.000.000/0000-00" />
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
        <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar alterações"}</Button></div>
      </div>

      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-3">
        <h3 className="font-display font-semibold">Acesso da conta</h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">E-mail de login:</span> <strong>{user?.email}</strong></div>
          <div><span className="text-muted-foreground">ID da consultoria:</span> <span className="font-mono text-xs">{data.id}</span></div>
          <div><span className="text-muted-foreground">Status:</span> <span className={data.is_active ? "text-emerald-600 font-medium" : "text-rose-600 font-medium"}>{data.is_active ? "Ativa" : "Inativa"}</span></div>
          <div><span className="text-muted-foreground">Criada em:</span> {new Date(data.created_at).toLocaleDateString("pt-BR")}</div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => supabase.auth.resetPasswordForEmail(user?.email ?? "").then(() => toast.success("E-mail de redefinição enviado"))}>Redefinir senha</Button>
          <Button variant="outline" className="text-destructive" onClick={logout}><LogOut className="size-4" /> Encerrar sessão</Button>
        </div>
      </div>
    </div>
  );
}

function ConfiguracoesPage() {
  const { selected: companyId } = useSelectedCompany();

  if (!companyId) {
    return <div className="text-muted-foreground">Selecione uma empresa para configurar.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Configurações da empresa</h1>
          <p className="text-muted-foreground text-sm">Gerencie dados cadastrais, filiais e estruturas auxiliares.</p>
        </div>
        <CompanySwitcher />
      </div>

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Dados da empresa</TabsTrigger>
          <TabsTrigger value="filiais">Filiais</TabsTrigger>
          <TabsTrigger value="consultor">Consultor</TabsTrigger>
          <TabsTrigger value="extras">Estruturas auxiliares</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-6">
          <CompanyForm companyId={companyId} />
        </TabsContent>

        <TabsContent value="filiais" className="mt-6">
          <BranchesSection companyId={companyId} />
        </TabsContent>

        <TabsContent value="consultor" className="mt-6">
          <ConsultantLinkSection companyId={companyId} />
        </TabsContent>

        <TabsContent value="extras" className="mt-6">
          <ExtrasSection companyId={companyId} />
        </TabsContent>

      </Tabs>
    </div>
  );
}

function ConsultantLinkSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [code, setCode] = useState("");
  const { data: link, isLoading } = useQuery({
    queryKey: ["company-consultant-link", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultant_company_links")
        .select("id, status, consultant_id, created_at, consultants(consultancy_name, responsible_name, email, city, state, invite_code)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: results, refetch: doSearch, isFetching } = useQuery({
    queryKey: ["search-consultants", search],
    enabled: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_consultants", { _q: search });
      if (error) throw error;
      return data ?? [];
    },
  });

  const requestByCode = async () => {
    if (!code.trim()) return;
    const { data, error } = await supabase.rpc("find_consultant_by_code", { _code: code.trim() });
    if (error) { toast.error(error.message); return; }
    const c = (data ?? [])[0];
    if (!c) { toast.error("Código inválido ou consultor inativo"); return; }
    await createLink(c.id, "approved");
  };

  const createLink = async (consultantId: string, status: "pending" | "approved" = "pending") => {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = { consultant_id: consultantId, company_id: companyId, status, requested_by: u.user?.id };
    if (status === "approved") { payload.linked_at = new Date().toISOString(); payload.responded_at = new Date().toISOString(); }
    const { error } = await supabase.from("consultant_company_links").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "Consultor vinculado!" : "Solicitação enviada");
    qc.invalidateQueries({ queryKey: ["company-consultant-link", companyId] });
  };

  const removeLink = async () => {
    if (!link) return;
    if (!confirm("Remover o vínculo com o consultor atual?")) return;
    const { error } = await supabase.from("consultant_company_links").delete().eq("id", link.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Vínculo removido");
    qc.invalidateQueries({ queryKey: ["company-consultant-link", companyId] });
  };

  if (isLoading) return <div className="text-muted-foreground text-sm">Carregando...</div>;

  if (link && link.status === "approved") {
    const c: any = link.consultants;
    return (
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-semibold">Consultor vinculado</h3>
            <p className="text-sm text-muted-foreground">Esta empresa é acompanhada pela consultoria abaixo.</p>
          </div>
          <Button variant="outline" className="text-destructive" onClick={removeLink}>Remover vínculo</Button>
        </div>
        <div className="border-t pt-4 grid sm:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Consultoria:</span> <strong>{c?.consultancy_name}</strong></div>
          <div><span className="text-muted-foreground">Responsável:</span> {c?.responsible_name ?? "—"}</div>
          <div><span className="text-muted-foreground">E-mail:</span> {c?.email ?? "—"}</div>
          <div><span className="text-muted-foreground">Cidade/UF:</span> {[c?.city, c?.state].filter(Boolean).join(" / ") || "—"}</div>
        </div>
      </div>
    );
  }

  if (link && link.status === "pending") {
    const c: any = link.consultants;
    return (
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-warning/10 text-warning-foreground border border-warning/30">Aguardando aprovação</span>
        </div>
        <p className="text-sm">Você solicitou vínculo com <strong>{c?.consultancy_name}</strong>. Aguarde a aprovação do consultor.</p>
        <Button variant="outline" className="text-destructive w-fit" onClick={removeLink}>Cancelar solicitação</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <div>
          <h3 className="font-display font-semibold">Vincular consultor</h3>
          <p className="text-sm text-muted-foreground">Sua empresa ainda não está vinculada a um consultor. Use o código de convite ou busque pelo nome.</p>
        </div>

        <div className="space-y-2">
          <Label>Código de convite</Label>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FP-XXXX-YYYYY" className="font-mono" />
            <Button onClick={requestByCode} disabled={!code.trim()}>Vincular</Button>
          </div>
          <p className="text-xs text-muted-foreground">Vínculo automático ao usar um código válido.</p>
        </div>

        <div className="border-t pt-4 space-y-2">
          <Label>Buscar consultor</Label>
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome da consultoria, responsável ou e-mail" />
            <Button variant="outline" onClick={() => doSearch()} disabled={!search.trim() || isFetching}>Buscar</Button>
          </div>
          {results && results.length > 0 && (
            <div className="border rounded-lg divide-y mt-2">
              {results.map((r: any) => (
                <div key={r.id} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.consultancy_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.responsible_name} {r.city && `· ${r.city}/${r.state}`}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => createLink(r.id, "pending")}>Solicitar vínculo</Button>
                </div>
              ))}
            </div>
          )}
          {results && results.length === 0 && search && (
            <p className="text-xs text-muted-foreground">Nenhum consultor encontrado.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Company form ----------

function CompanyForm({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>(null);
  const { data } = useQuery({
    queryKey: ["company-detail", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => { if (data) setForm({ ...data, cnpj: data.cnpj ? maskCNPJ(data.cnpj) : "", cep: data.cep ? maskCEP(data.cep) : "", telefone: data.telefone ? maskPhone(data.telefone) : "" }); }, [data]);

  if (!form) return <div className="text-muted-foreground text-sm">Carregando…</div>;

  const set = (k: string, v: any) => setForm({ ...form, [k]: v });

  const save = async () => {
    if (form.cnpj && !isValidCNPJ(form.cnpj)) { toast.error("CNPJ inválido"); return; }
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      nome: form.nome,
      nome_fantasia: form.nome_fantasia || null,
      cnpj: form.cnpj ? form.cnpj.replace(/\D/g, "") : null,
      inscricao_estadual: form.inscricao_estadual || null,
      segmento: form.segmento || null,
      responsavel: form.responsavel || null,
      cidade: form.cidade || null,
      estado: form.estado || null,
      endereco: form.endereco || null,
      bairro: form.bairro || null,
      cep: form.cep ? form.cep.replace(/\D/g, "") : null,
      telefone: form.telefone || null,
      email: form.email || null,
    }).eq("id", companyId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar", { description: error.message }); return; }
    toast.success("Dados da empresa atualizados");
    qc.invalidateQueries({ queryKey: ["company-detail", companyId] });
    qc.invalidateQueries({ queryKey: ["companies-lite"] });
  };

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <FormField label="Razão social" value={form.nome ?? ""} onChange={(v) => set("nome", v)} required />
        <FormField label="Nome fantasia" value={form.nome_fantasia ?? ""} onChange={(v) => set("nome_fantasia", v)} />
        <FormField label="CNPJ" value={form.cnpj ?? ""} onChange={(v) => set("cnpj", maskCNPJ(v))} placeholder="00.000.000/0000-00" />
        <FormField label="Inscrição estadual" value={form.inscricao_estadual ?? ""} onChange={(v) => set("inscricao_estadual", v)} />
        <FormField label="Segmento" value={form.segmento ?? ""} onChange={(v) => set("segmento", v)} />
        <FormField label="Responsável" value={form.responsavel ?? ""} onChange={(v) => set("responsavel", v)} />
        <FormField label="Telefone" value={form.telefone ?? ""} onChange={(v) => set("telefone", maskPhone(v))} />
        <FormField label="E-mail" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} />
        <FormField label="Endereço" value={form.endereco ?? ""} onChange={(v) => set("endereco", v)} />
        <FormField label="Bairro" value={form.bairro ?? ""} onChange={(v) => set("bairro", v)} />
        <FormField label="Cidade" value={form.cidade ?? ""} onChange={(v) => set("cidade", v)} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm">UF</Label>
            <Select value={form.estado ?? ""} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FormField label="CEP" value={form.cep ?? ""} onChange={(v) => set("cep", maskCEP(v))} placeholder="00000-000" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
      </div>
    </div>
  );
}

// ---------- Branches ----------

type Branch = {
  id: string;
  company_id: string;
  nome: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string | null;
  responsavel: string | null;
  is_main_branch: boolean;
  ativa: boolean;
};

function BranchesSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Branch | null>(null);
  const [open, setOpen] = useState(false);

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches-full", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .eq("company_id", companyId)
        .order("is_main_branch", { ascending: false })
        .order("created_at");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (b: Branch) => { setEditing(b); setOpen(true); };

  const toggleActive = async (b: Branch) => {
    if (b.is_main_branch) { toast.error("A matriz não pode ser desativada"); return; }
    const { error } = await supabase.from("branches").update({ ativa: !b.ativa }).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["branches-full", companyId] });
    qc.invalidateQueries({ queryKey: ["branches", companyId] });
  };

  const remove = async (b: Branch) => {
    if (b.is_main_branch) { toast.error("A matriz não pode ser excluída"); return; }
    if (!confirm(`Excluir a filial "${b.nome}"? Os dados vinculados serão mantidos sem unidade.`)) return;
    const { error } = await supabase.from("branches").delete().eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["branches-full", companyId] });
    qc.invalidateQueries({ queryKey: ["branches", companyId] });
    toast.success("Filial excluída");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold">Filiais</h2>
          <p className="text-sm text-muted-foreground">A matriz é criada automaticamente. Adicione novas unidades quando necessário.</p>
        </div>
        <Button onClick={openNew}><Plus className="size-4" /> Nova filial</Button>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm">Carregando filiais…</div>
      ) : (
        <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="text-left p-3">Unidade</th>
                <th className="text-left p-3">CNPJ</th>
                <th className="text-left p-3">Cidade/UF</th>
                <th className="text-left p-3">Responsável</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {b.is_main_branch ? "Matriz" : b.nome}
                          {b.is_main_branch && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">PRINCIPAL</span>}
                        </div>
                        {b.nome_fantasia && <div className="text-xs text-muted-foreground">{b.nome_fantasia}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{b.cnpj ? maskCNPJ(b.cnpj) : "—"}</td>
                  <td className="p-3">{[b.cidade, b.estado].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="p-3">{b.responsavel || "—"}</td>
                  <td className="p-3">
                    {b.ativa ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success"><Check className="size-3" /> Ativa</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inativa</span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)} title="Editar"><Pencil className="size-4" /></Button>
                    {!b.is_main_branch && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(b)} title={b.ativa ? "Desativar" : "Ativar"}><Power className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(b)} title="Excluir"><Trash2 className="size-4 text-destructive" /></Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma filial cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <BranchDialog open={open} onOpenChange={setOpen} companyId={companyId} branch={editing} onSaved={() => {
        qc.invalidateQueries({ queryKey: ["branches-full", companyId] });
        qc.invalidateQueries({ queryKey: ["branches", companyId] });
      }} />
    </div>
  );
}

function BranchDialog({ open, onOpenChange, companyId, branch, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; companyId: string; branch: Branch | null; onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(branch ? {
      ...branch,
      cnpj: branch.cnpj ? maskCNPJ(branch.cnpj) : "",
      telefone: branch.telefone ? maskPhone(branch.telefone) : "",
    } : { nome: "", cnpj: "", cidade: "", estado: "", endereco: "", telefone: "", email: "", responsavel: "", nome_fantasia: "", ativa: true });
  }, [open, branch]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nome?.trim()) { toast.error("Informe o nome da filial"); return; }
    if (!form.cnpj || !isValidCNPJ(form.cnpj)) { toast.error("CNPJ da filial é obrigatório e deve ser válido"); return; }
    setSaving(true);
    const payload = {
      company_id: companyId,
      nome: form.nome.trim(),
      nome_fantasia: form.nome_fantasia?.trim() || null,
      cnpj: form.cnpj.replace(/\D/g, ""),
      cidade: form.cidade?.trim() || null,
      estado: form.estado || null,
      endereco: form.endereco?.trim() || null,
      telefone: form.telefone || null,
      email: form.email?.trim() || null,
      responsavel: form.responsavel?.trim() || null,
      ativa: form.ativa ?? true,
    };
    const res = branch
      ? await supabase.from("branches").update(payload).eq("id", branch.id)
      : await supabase.from("branches").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(branch ? "Filial atualizada" : "Filial cadastrada");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{branch ? (branch.is_main_branch ? "Editar matriz" : "Editar filial") : "Nova filial"}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField label="Nome da filial" required value={form.nome ?? ""} onChange={(v) => set("nome", v)} />
          <FormField label="Nome fantasia" value={form.nome_fantasia ?? ""} onChange={(v) => set("nome_fantasia", v)} />
          <FormField label="CNPJ" required value={form.cnpj ?? ""} onChange={(v) => set("cnpj", maskCNPJ(v))} placeholder="00.000.000/0000-00" />
          <FormField label="Responsável" value={form.responsavel ?? ""} onChange={(v) => set("responsavel", v)} />
          <FormField label="Cidade" value={form.cidade ?? ""} onChange={(v) => set("cidade", v)} />
          <div>
            <Label className="text-sm">UF</Label>
            <Select value={form.estado ?? ""} onValueChange={(v) => set("estado", v)}>
              <SelectTrigger className="mt-2"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <FormField label="Endereço" value={form.endereco ?? ""} onChange={(v) => set("endereco", v)} />
          <FormField label="Telefone" value={form.telefone ?? ""} onChange={(v) => set("telefone", maskPhone(v))} />
          <FormField label="E-mail" type="email" value={form.email ?? ""} onChange={(v) => set("email", v)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label, value, onChange, type = "text", required, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function ExtrasSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories-full", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: costCenters, isLoading: ccLoading } = useQuery({
    queryKey: ["cost-centers-full", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null).order("nome");
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      // @ts-ignore - dynamic field names for database types
      const { error } = await supabase.from("categories").update({ [field]: value }).eq("id", id).is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classificação atualizada");
      qc.invalidateQueries({ queryKey: ["categories-full", companyId] });
      qc.invalidateQueries({ queryKey: ["report-data"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Categoria: criar / excluir
  const [catNome, setCatNome] = useState("");
  const [catTipo, setCatTipo] = useState<"entrada" | "saida">("saida");
  const createCategory = useMutation({
    mutationFn: async () => {
      if (!catNome.trim()) throw new Error("Informe o nome da categoria");
      const { error } = await supabase.from("categories").insert({ company_id: companyId, nome: catNome.trim(), tipo: catTipo }).is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria criada");
      setCatNome("");
      qc.invalidateQueries({ queryKey: ["categories-full", companyId] });
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria excluída");
      qc.invalidateQueries({ queryKey: ["categories-full", companyId] });
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Centro de custo: criar / excluir
  const [ccNome, setCcNome] = useState("");
  const [ccKpi, setCcKpi] = useState("");
  const createCC = useMutation({
    mutationFn: async () => {
      if (!ccNome.trim()) throw new Error("Informe o nome do centro de custo");
      const { error } = await supabase.from("cost_centers").insert({ company_id: companyId, nome: ccNome.trim(), kpi_classification: ccKpi || null }).is("deleted_at", null);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Centro de custo criado");
      setCcNome(""); setCcKpi("");
      qc.invalidateQueries({ queryKey: ["cost-centers-full", companyId] });
      qc.invalidateQueries({ queryKey: ["cost-centers", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteCC = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_centers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Centro de custo excluído");
      qc.invalidateQueries({ queryKey: ["cost-centers-full", companyId] });
      qc.invalidateQueries({ queryKey: ["cost-centers", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || ccLoading) return <div className="text-sm text-muted-foreground">Carregando...</div>;

  const kpiOptions = ["Receita Bruta","Impostos","Custos Variáveis","Custos Fixos","Despesas Operacionais","Despesas Financeiras"];

  return (
    <div className="space-y-6">
      {/* Categorias */}
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <div>
          <h3 className="font-display font-semibold">Categorias do fluxo de caixa</h3>
          <p className="text-sm text-muted-foreground mt-1">Adicione novas categorias e configure como cada uma alimenta a DRE.</p>
        </div>

        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da categoria</Label>
            <Input value={catNome} onChange={(e) => setCatNome(e.target.value)} placeholder="Ex.: Vendas online" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={catTipo} onValueChange={(v) => setCatTipo(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada">Entrada</SelectItem>
                <SelectItem value="saida">Saída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => createCategory.mutate()} disabled={createCategory.isPending}>
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 px-3 font-medium">Categoria</th>
                <th className="py-2 px-3 font-medium">Tipo</th>
                <th className="py-2 px-3 font-medium text-center">Variável (CMV)</th>
                <th className="py-2 px-3 font-medium text-center">Fixo</th>
                <th className="py-2 px-3 font-medium text-center">Dedução/Imp.</th>
                <th className="py-2 px-3 font-medium text-center">Financeira</th>
                <th className="py-2 px-3 font-medium text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {categories?.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-3 font-medium">{c.nome}</td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${c.tipo === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {c.tipo}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input type="checkbox" checked={!!c.is_variable_cost} onChange={(e) => toggle.mutate({ id: c.id, field: "is_variable_cost", value: e.target.checked })} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input type="checkbox" checked={!!c.is_fixed_cost} onChange={(e) => toggle.mutate({ id: c.id, field: "is_fixed_cost", value: e.target.checked })} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input type="checkbox" checked={!!c.is_deduction} onChange={(e) => toggle.mutate({ id: c.id, field: "is_deduction", value: e.target.checked })} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <input type="checkbox" checked={!!c.is_financial_expense} onChange={(e) => toggle.mutate({ id: c.id, field: "is_financial_expense", value: e.target.checked })} />
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Excluir categoria "${c.nome}"? Lançamentos vinculados ficarão sem categoria.`)) deleteCategory.mutate(c.id); }}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Centros de custo */}
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <div>
          <h3 className="font-display font-semibold">Centros de custo</h3>
          <p className="text-sm text-muted-foreground mt-1">Adicione centros de custo para atrelar aos lançamentos do fluxo de caixa.</p>
        </div>

        <div className="grid sm:grid-cols-[1fr_220px_auto] gap-2 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do centro de custo</Label>
            <Input value={ccNome} onChange={(e) => setCcNome(e.target.value)} placeholder="Ex.: Marketing" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Classificação KPI (opcional)</Label>
            <Select value={ccKpi} onValueChange={setCcKpi}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {kpiOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => createCC.mutate()} disabled={createCC.isPending}>
            <Plus className="size-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                <th className="py-2 px-3 font-medium">Centro de custo</th>
                <th className="py-2 px-3 font-medium">Classificação KPI</th>
                <th className="py-2 px-3 font-medium text-center w-10"></th>
              </tr>
            </thead>
            <tbody>
              {costCenters?.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-3 font-medium">{c.nome}</td>
                  <td className="py-3 px-3 text-muted-foreground">{c.kpi_classification ?? "—"}</td>
                  <td className="py-3 px-3 text-center">
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Excluir centro de custo "${c.nome}"? Lançamentos vinculados ficarão sem centro de custo.`)) deleteCC.mutate(c.id); }}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {(!costCenters || costCenters.length === 0) && (
                <tr><td colSpan={3} className="py-6 text-center text-muted-foreground text-sm">Nenhum centro de custo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

