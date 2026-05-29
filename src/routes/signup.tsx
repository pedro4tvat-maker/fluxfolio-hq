import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Wallet, Briefcase, Building2, ArrowLeft, ArrowRight, Check, Search, X, BadgeCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskCNPJ, maskCEP, maskPhone, isValidCNPJ, maskCPF, isValidCPF, BR_STATES } from "@/lib/cnpj";

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>) => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
  head: () => ({ meta: [{ title: "Criar conta — SISTEMAFP PJ" }] }),
  component: SignupPage,
});

function passwordStrength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  const map = [
    { label: "Muito fraca", color: "bg-destructive" },
    { label: "Fraca", color: "bg-destructive" },
    { label: "Média", color: "bg-warning" },
    { label: "Forte", color: "bg-success" },
    { label: "Muito forte", color: "bg-success" },
  ];
  return { score: s, ...map[s] };
}

type AccountKind = "client_manager" | "consultant";

type ConsultantHit = {
  id: string;
  consultancy_name: string;
  responsible_name: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  invite_code: string;
};

function SignupPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/signup" });
  const [kind, setKind] = useState<AccountKind>("client_manager");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // user
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const strength = useMemo(() => passwordStrength(password), [password]);

  // company (cliente)
  const [personType, setPersonType] = useState<"pj" | "pf">("pj");
  const [c_nome, setCNome] = useState("");
  const [c_fantasia, setCFantasia] = useState("");
  const [c_cnpj, setCCnpj] = useState("");
  const [c_segmento, setCSegmento] = useState("");
  const [c_cidade, setCCidade] = useState("");
  const [c_estado, setCEstado] = useState("");
  const [c_ie, setCIe] = useState("");
  const [c_endereco, setCEndereco] = useState("");
  const [c_bairro, setCBairro] = useState("");
  const [c_cep, setCCep] = useState("");
  const [c_telefone, setCTelefone] = useState("");
  const [c_email, setCEmail] = useState("");

  // consultoria (consultor)
  const [consultancyName, setConsultancyName] = useState("");
  const [consultancyCnpj, setConsultancyCnpj] = useState("");
  const [consultancyCity, setConsultancyCity] = useState("");
  const [consultancyState, setConsultancyState] = useState("");

  // vínculo (cliente)
  const [linkMode, setLinkMode] = useState<"code" | "search" | "none">("code");
  const [inviteCode, setInviteCode] = useState(search.invite ?? "");
  const [foundByCode, setFoundByCode] = useState<ConsultantHit | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<ConsultantHit[]>([]);
  const [selectedConsultant, setSelectedConsultant] = useState<ConsultantHit | null>(null);
  const [searching, setSearching] = useState(false);

  // Pré-validar invite vindo da URL
  useEffect(() => {
    if (!search.invite) return;
    setLinkMode("code");
    (async () => {
      const { data } = await supabase.rpc("find_consultant_by_code", { _code: search.invite!.trim() });
      if (data && data.length > 0) setFoundByCode({ ...(data[0] as any), email: null, invite_code: search.invite!.trim().toUpperCase() });
    })();
  }, [search.invite]);

  const totalSteps = kind === "client_manager" ? 4 : 2;

  const validateStep1 = () => {
    if (!name.trim()) return "Informe o nome do responsável";
    if (!email.trim()) return "Informe o e-mail";
    if (kind === "client_manager" && !phone.trim()) return "Informe o telefone";
    return null;
  };
  const validateStep2 = () => {
    if (kind === "consultant") {
      if (!consultancyName.trim()) return "Informe o nome da consultoria";
      return null;
    }
    if (!c_nome.trim()) return "Informe a razão social/nome da empresa";
    if (!c_fantasia.trim()) return "Informe o nome fantasia";
    if (!isValidCNPJ(c_cnpj)) return "CNPJ inválido. Use o formato 00.000.000/0000-00";
    if (!c_segmento.trim()) return "Informe o segmento";
    if (!c_cidade.trim()) return "Informe a cidade";
    if (!c_estado) return "Informe o estado (UF)";
    return null;
  };
  const validateStep3 = () => {
    // Etapa de vínculo só existe para client_manager
    if (linkMode === "code" && inviteCode.trim() && !foundByCode) {
      return "Verifique o código informado ou escolha 'Não tenho consultor agora'";
    }
    if (linkMode === "search" && !selectedConsultant) {
      return "Selecione um consultor ou escolha 'Não tenho consultor agora'";
    }
    return null;
  };
  const validatePwd = () => {
    if (strength.score < 2) return "Use uma senha mais forte (mínimo 8 caracteres, com letras e números)";
    if (password !== confirm) return "As senhas não coincidem";
    return null;
  };

  const verifyCode = async () => {
    const code = inviteCode.trim();
    if (!code) { setFoundByCode(null); return; }
    const { data, error } = await supabase.rpc("find_consultant_by_code", { _code: code });
    if (error || !data || data.length === 0) {
      setFoundByCode(null);
      toast.error("Código de convite não encontrado");
      return;
    }
    const c = data[0] as any;
    setFoundByCode({ id: c.id, consultancy_name: c.consultancy_name, responsible_name: c.responsible_name, email: null, city: c.city, state: c.state, invite_code: code.toUpperCase() });
    toast.success(`Consultor encontrado: ${c.consultancy_name}`);
  };

  const runSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    const { data, error } = await supabase.rpc("search_consultants", { _q: searchQ.trim() });
    setSearching(false);
    if (error) { toast.error("Erro ao pesquisar"); return; }
    setSearchHits((data ?? []) as ConsultantHit[]);
  };

  const next = () => {
    let err: string | null = null;
    if (step === 1) err = validateStep1();
    else if (step === 2) err = validateStep2();
    else if (step === 3 && kind === "client_manager") err = validateStep3();
    if (err) { toast.error(err); return; }
    if (step < totalSteps) setStep(step + 1);
  };

  const submit = async () => {
    const e1 = validateStep1(); if (e1) { setStep(1); toast.error(e1); return; }
    const e2 = validateStep2(); if (e2) { setStep(2); toast.error(e2); return; }
    if (kind === "client_manager") {
      const e3 = validateStep3(); if (e3) { setStep(3); toast.error(e3); return; }
    }
    const ep = validatePwd(); if (ep) { setStep(totalSteps); toast.error(ep); return; }

    setLoading(true);
    const linkPayload: Record<string, string> = {};
    if (kind === "client_manager") {
      if (linkMode === "code" && foundByCode) linkPayload.consultant_invite_code = inviteCode.trim().toUpperCase();
      else if (linkMode === "search" && selectedConsultant) linkPayload.consultant_id = selectedConsultant.id;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: name,
          role: kind,
          user_phone: phone,
          // empresa (cliente)
          company_name: kind === "client_manager" ? c_nome.trim() : null,
          company_trade_name: c_fantasia.trim(),
          company_cnpj: c_cnpj.replace(/\D/g, ""),
          company_ie: c_ie.trim(),
          company_segment: c_segmento.trim(),
          company_city: c_cidade.trim(),
          company_state: c_estado,
          company_address: c_endereco.trim(),
          company_district: c_bairro.trim(),
          company_zip: c_cep.replace(/\D/g, ""),
          company_phone: c_telefone.trim() || phone,
          company_email: c_email.trim() || email,
          // consultoria
          consultancy_name: kind === "consultant" ? consultancyName.trim() : null,
          consultancy_cnpj: consultancyCnpj.replace(/\D/g, ""),
          consultancy_city: consultancyCity.trim(),
          consultancy_state: consultancyState,
          // vínculo
          ...linkPayload,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      return;
    }
    const linkedMsg = kind === "client_manager" && linkMode === "code" && foundByCode
      ? " Você já foi vinculado ao consultor."
      : kind === "client_manager" && linkMode === "search" && selectedConsultant
      ? " Solicitação de vínculo enviada ao consultor."
      : "";
    toast.success(`Conta criada com sucesso!${linkedMsg} Faça login para começar.`);
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-xl bg-card p-8 rounded-2xl shadow-card border space-y-6">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary grid place-items-center text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="font-display font-semibold">SISTEMAFP PJ</span>
        </div>

        <div>
          <h2 className="text-2xl font-display font-bold">Criar conta</h2>
          <p className="text-sm text-muted-foreground mt-1">Etapa {step} de {totalSteps}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => { setKind("client_manager"); setStep(1); }}
            className={`p-3 rounded-xl border text-left transition ${kind === "client_manager" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <Building2 className="size-5 mb-1" />
            <div className="font-medium text-sm">Sou Cliente</div>
            <div className="text-xs text-muted-foreground">Gerencio minha empresa.</div>
          </button>
          <button
            type="button"
            onClick={() => { setKind("consultant"); setStep(1); }}
            className={`p-3 rounded-xl border text-left transition ${kind === "consultant" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <Briefcase className="size-5 mb-1" />
            <div className="font-medium text-sm">Sou Consultor</div>
            <div className="text-xs text-muted-foreground">Acompanho várias empresas-cliente.</div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const s = i + 1;
            return (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`size-7 rounded-full grid place-items-center text-xs font-medium ${s < step ? "bg-success text-success-foreground" : s === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {s < step ? <Check className="size-3" /> : s}
                </div>
                {s < totalSteps && <div className={`h-0.5 flex-1 ${s < step ? "bg-success" : "bg-muted"}`} />}
              </div>
            );
          })}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados do responsável</div>
            <Field label="Nome completo" required value={name} onChange={setName} />
            <Field label="E-mail" type="email" required value={email} onChange={setEmail} />
            {kind === "client_manager" && (
              <Field label="Telefone" required value={phone} onChange={(v) => setPhone(maskPhone(v))} placeholder="(11) 99999-9999" />
            )}
            {kind === "consultant" && (
              <Field label="Telefone" value={phone} onChange={(v) => setPhone(maskPhone(v))} placeholder="(11) 99999-9999" />
            )}
          </div>
        )}

        {step === 2 && kind === "client_manager" && (
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados da empresa principal (Matriz)</div>
            <Field label="Razão social" required value={c_nome} onChange={setCNome} />
            <Field label="Nome fantasia" required value={c_fantasia} onChange={setCFantasia} />
            <Field label="CNPJ" required value={c_cnpj} onChange={(v) => setCCnpj(maskCNPJ(v))} placeholder="00.000.000/0000-00" />
            <Field label="Segmento de atuação" required value={c_segmento} onChange={setCSegmento} placeholder="Ex.: Comércio, Serviços, Indústria" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Field label="Cidade" required value={c_cidade} onChange={setCCidade} /></div>
              <div>
                <Label className="text-sm">UF<span className="text-destructive ml-1">*</span></Label>
                <Select value={c_estado} onValueChange={setCEstado}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <details className="rounded-lg border bg-muted/30 px-3 py-2">
              <summary className="text-sm font-medium cursor-pointer">Dados complementares (opcional)</summary>
              <div className="mt-3 space-y-3">
                <Field label="Inscrição estadual" value={c_ie} onChange={setCIe} />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2"><Field label="Endereço" value={c_endereco} onChange={setCEndereco} /></div>
                  <Field label="CEP" value={c_cep} onChange={(v) => setCCep(maskCEP(v))} placeholder="00000-000" />
                </div>
                <Field label="Bairro" value={c_bairro} onChange={setCBairro} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Telefone da empresa" value={c_telefone} onChange={(v) => setCTelefone(maskPhone(v))} />
                  <Field label="E-mail da empresa" type="email" value={c_email} onChange={setCEmail} />
                </div>
              </div>
            </details>
          </div>
        )}

        {step === 2 && kind === "consultant" && (
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados da sua consultoria</div>
            <Field label="Nome da consultoria" required value={consultancyName} onChange={setConsultancyName} placeholder="Ex.: PJ Pro Consultoria" />
            <Field label="CNPJ da consultoria (opcional)" value={consultancyCnpj} onChange={(v) => setConsultancyCnpj(maskCNPJ(v))} placeholder="00.000.000/0000-00" />
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Field label="Cidade" value={consultancyCity} onChange={setConsultancyCity} /></div>
              <div>
                <Label className="text-sm">UF</Label>
                <Select value={consultancyState} onValueChange={setConsultancyState}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{BR_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="rounded-lg border bg-primary/5 p-3 text-xs">
              <BadgeCheck className="size-4 inline mr-1 text-primary" />
              Você receberá um <strong>código único de convite</strong> assim que entrar — basta compartilhá-lo com seus clientes.
            </div>
          </div>
        )}

        {step === 3 && kind === "client_manager" && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vincular a um consultor</div>
              <p className="text-xs text-muted-foreground mt-1">
                Se seu consultor já tem cadastro no SISTEMAFP, vincule-se agora para que ele acompanhe seus dados.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <ModeBtn active={linkMode === "code"} label="Código de convite" onClick={() => setLinkMode("code")} />
              <ModeBtn active={linkMode === "search"} label="Buscar consultor" onClick={() => setLinkMode("search")} />
              <ModeBtn active={linkMode === "none"} label="Não tenho consultor" onClick={() => setLinkMode("none")} />
            </div>

            {linkMode === "code" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Código (ex.: FP-PEDRO-A1B2C)</Label>
                  <div className="flex gap-2">
                    <Input value={inviteCode} onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setFoundByCode(null); }} placeholder="FP-XXXX-YYYYY" />
                    <Button type="button" variant="outline" onClick={verifyCode}><Search className="size-4" /> Verificar</Button>
                  </div>
                </div>
                {foundByCode && (
                  <div className="rounded-lg border bg-success/5 border-success/30 p-3 flex items-center gap-3">
                    <UserCheck className="size-5 text-success" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{foundByCode.consultancy_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {foundByCode.responsible_name}{foundByCode.city ? ` · ${foundByCode.city}/${foundByCode.state}` : ""}
                      </div>
                      <div className="text-[10px] text-success mt-1">Vínculo será aprovado automaticamente ao criar a conta.</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {linkMode === "search" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Buscar por nome, e-mail ou empresa de consultoria</Label>
                  <div className="flex gap-2">
                    <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} placeholder="Ex.: Pedro Silva ou pedro@..." />
                    <Button type="button" variant="outline" onClick={runSearch} disabled={searching}><Search className="size-4" /> Buscar</Button>
                  </div>
                </div>
                {selectedConsultant && (
                  <div className="rounded-lg border bg-primary/5 border-primary/30 p-3 flex items-center gap-3">
                    <UserCheck className="size-5 text-primary" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{selectedConsultant.consultancy_name}</div>
                      <div className="text-xs text-muted-foreground">{selectedConsultant.responsible_name}</div>
                      <div className="text-[10px] text-primary mt-1">Solicitação de vínculo será enviada ao consultor para aprovação.</div>
                    </div>
                    <Button type="button" size="icon" variant="ghost" onClick={() => setSelectedConsultant(null)}><X className="size-4" /></Button>
                  </div>
                )}
                {!selectedConsultant && searchHits.length > 0 && (
                  <div className="rounded-lg border divide-y max-h-60 overflow-y-auto">
                    {searchHits.map((h) => (
                      <button key={h.id} type="button" onClick={() => setSelectedConsultant(h)} className="w-full text-left p-3 hover:bg-muted/40 transition">
                        <div className="font-medium text-sm">{h.consultancy_name}</div>
                        <div className="text-xs text-muted-foreground">{h.responsible_name}{h.city ? ` · ${h.city}/${h.state}` : ""}</div>
                      </button>
                    ))}
                  </div>
                )}
                {!selectedConsultant && searchHits.length === 0 && searchQ && !searching && (
                  <p className="text-xs text-muted-foreground">Nenhum resultado. Tente outro termo ou use o código de convite.</p>
                )}
              </div>
            )}

            {linkMode === "none" && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                Você poderá vincular um consultor a qualquer momento em <strong>Configurações da Empresa → Consultor</strong>.
              </div>
            )}
          </div>
        )}

        {(step === totalSteps) && (
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Criar acesso</div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha<span className="text-destructive ml-1">*</span></Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              {password && (
                <div className="space-y-1">
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${strength.color} transition-all`} style={{ width: `${(strength.score / 4) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Força: {strength.label}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha<span className="text-destructive ml-1">*</span></Label>
              <Input id="confirm" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {step > 1 ? (
            <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={loading}>
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          ) : <div />}
          {step < totalSteps ? (
            <Button type="button" onClick={next}>Continuar <ArrowRight className="size-4" /></Button>
          ) : (
            <Button type="button" onClick={submit} disabled={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          )}
        </div>

        <div className="text-sm text-center text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg border text-xs font-medium transition ${active ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-muted/40"}`}
    >
      {label}
    </button>
  );
}

function Field({
  label, value, onChange, type = "text", required, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="text-destructive ml-1">*</span>}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
