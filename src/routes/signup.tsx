import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Briefcase, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Criar conta — SISTEMAFP PJ" }] }),
  component: SignupPage,
});

function passwordStrength(p: string): { score: number; label: string; color: string } {
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
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "client_manager" && !companyName.trim()) {
      toast.error("Informe o nome da sua empresa");
      return;
    }
    if (strength.score < 2) {
      toast.error("Use uma senha mais forte (mínimo 8 caracteres).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: name,
          role: kind,
          company_name: kind === "client_manager" ? companyName.trim() : null,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      return;
    }
    toast.success("Conta criada! Você já pode entrar.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-6 bg-card p-8 rounded-2xl shadow-card border">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary grid place-items-center text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="font-display font-semibold">SISTEMAFP PJ</span>
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">Criar conta</h2>
          <p className="text-sm text-muted-foreground mt-1">Escolha o tipo da sua conta para começar.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setKind("client_manager")}
            className={`p-3 rounded-xl border text-left transition ${kind === "client_manager" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <Building2 className="size-5 mb-1" />
            <div className="font-medium text-sm">Sou Cliente</div>
            <div className="text-xs text-muted-foreground">Gerencio a minha própria empresa.</div>
          </button>
          <button
            type="button"
            onClick={() => setKind("consultant")}
            className={`p-3 rounded-xl border text-left transition ${kind === "consultant" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}
          >
            <Briefcase className="size-5 mb-1" />
            <div className="font-medium text-sm">Sou Consultor</div>
            <div className="text-xs text-muted-foreground">Acompanho várias empresas-cliente.</div>
          </button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        {kind === "client_manager" && (
          <div className="space-y-2">
            <Label htmlFor="company">Nome da sua empresa</Label>
            <Input id="company" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Padaria Pão Quente" />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
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
        <Button type="submit" disabled={loading} className="w-full">{loading ? "Criando..." : "Criar conta"}</Button>
        <div className="text-sm text-center text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary font-medium hover:underline">Entrar</Link>
        </div>
      </form>
    </div>
  );
}
