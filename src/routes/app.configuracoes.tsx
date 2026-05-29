import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Plus, Pencil, Trash2, Power, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskCNPJ, maskCEP, maskPhone, isValidCNPJ, BR_STATES } from "@/lib/cnpj";
import { CompanySwitcher } from "@/components/company-switcher";

export const Route = createFileRoute("/app/configuracoes")({ component: ConfiguracoesPage });

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
          <div className="bg-card border rounded-2xl p-6 shadow-card text-sm text-muted-foreground space-y-2">
            <p><strong className="text-foreground">Categorias</strong>, <strong className="text-foreground">Centros de custo</strong> e <strong className="text-foreground">Contas financeiras</strong> são gerenciadas dentro dos próprios módulos onde são utilizadas (Fluxo de Caixa, Centro de Custos, etc.).</p>
            <p>Em breve esta área terá uma visão consolidada de todas essas estruturas em um único lugar.</p>
          </div>
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
