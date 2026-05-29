import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Briefcase, Building2, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { maskCNPJ, maskCEP, maskPhone, isValidCNPJ, BR_STATES } from "@/lib/cnpj";

export const Route = createFileRoute("/signup")({
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

function SignupPage() {
  const navigate = useNavigate();
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

  // company
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

  const totalSteps = kind === "client_manager" ? 3 : 1;

  const validateStep1 = () => {
    if (!name.trim()) return "Informe o nome do responsável";
    if (!email.trim()) return "Informe o e-mail";
    if (kind === "client_manager" && !phone.trim()) return "Informe o telefone";
    return null;
  };
  const validateStep2 = () => {
    if (!c_nome.trim()) return "Informe a razão social/nome da empresa";
    if (!c_fantasia.trim()) return "Informe o nome fantasia";
    if (!isValidCNPJ(c_cnpj)) return "CNPJ inválido. Use o formato 00.000.000/0000-00";
    if (!c_segmento.trim()) return "Informe o segmento";
    if (!c_cidade.trim()) return "Informe a cidade";
    if (!c_estado) return "Informe o estado (UF)";
    return null;
  };
  const validateStep3 = () => {
    if (strength.score < 2) return "Use uma senha mais forte (mínimo 8 caracteres, com letras e números)";
    if (password !== confirm) return "As senhas não coincidem";
    return null;
  };

  const next = () => {
    const err = step === 1 ? validateStep1() : step === 2 ? validateStep2() : validateStep3();
    if (err) { toast.error(err); return; }
    if (step < totalSteps) setStep(step + 1);
  };

  const submit = async () => {
    const e1 = validateStep1(); if (e1) { setStep(1); toast.error(e1); return; }
    if (kind === "client_manager") {
      const e2 = validateStep2(); if (e2) { setStep(2); toast.error(e2); return; }
    }
    const e3 = validateStep3(); if (e3) { setStep(totalSteps); toast.error(e3); return; }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: name,
          role: kind,
          user_phone: phone,
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
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      return;
    }
    toast.success("Empresa cadastrada com sucesso! Faça login para começar.");
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
          <p className="text-sm text-muted-foreground mt-1">
            {kind === "client_manager" ? `Etapa ${step} de ${totalSteps}` : "Cadastro de consultor"}
          </p>
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

        {kind === "client_manager" && (
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`size-7 rounded-full grid place-items-center text-xs font-medium ${s < step ? "bg-success text-success-foreground" : s === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {s < step ? <Check className="size-3" /> : s}
                </div>
                {s < 3 && <div className={`h-0.5 flex-1 ${s < step ? "bg-success" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dados do responsável</div>
            <Field label="Nome completo" required value={name} onChange={setName} />
            <Field label="E-mail" type="email" required value={email} onChange={setEmail} />
            {kind === "client_manager" && (
              <Field label="Telefone" required value={phone} onChange={(v) => setPhone(maskPhone(v))} placeholder="(11) 99999-9999" />
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
