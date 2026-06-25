import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logoAsset from "@/assets/sistemafp-logo.png.asset.json";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — SISTEMAFP PJ" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível entrar", { description: error.message });
      return;
    }
    toast.success("Bem-vindo de volta!");
    navigate({ to: "/app", replace: true });
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Por favor, informe seu e-mail");
      return;
    }
    setResetLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setResetLoading(false);
    if (error) {
      toast.error("Erro ao enviar e-mail de recuperação", { description: error.message });
      return;
    }
    toast.success("E-mail de recuperação enviado!", {
      description: "Verifique sua caixa de entrada para redefinir a senha.",
    });
    setShowReset(false);
  };


  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-12 bg-secondary text-foreground border-r border-border">
        <div className="flex items-center gap-3">
          <img src={logoAsset.url} alt="SistemaFP PJ" className="h-12 w-auto object-contain" />
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold">Finanças em Propósito</p>
          <h1 className="text-3xl font-display font-bold leading-tight text-foreground">
            Gestão financeira com clareza, <br /> rotina e propósito.
          </h1>
          <p className="text-foreground/70 max-w-md">
            Organize o financeiro, acompanhe resultados e transforme dados em decisões com o SistemaFP PJ.
          </p>
        </div>
        <p className="text-xs text-foreground/50">
          © {new Date().getFullYear()} SistemaFP PJ — por Finanças em Propósito
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={showReset ? onResetPassword : onSubmit} className="w-full max-w-sm space-y-6">
          <div className="md:hidden flex items-center gap-2">
            <img src={logoAsset.url} alt="SISTEMAFP PJ" className="h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">
              {showReset ? "Recuperar senha" : "Acessar sua conta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {showReset ? "Informe seu e-mail para receber as instruções." : "Entre com seu e-mail e senha."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
          </div>

          {!showReset && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <Input id="password" type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
                <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" aria-label="Mostrar senha">
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button type="submit" disabled={loading || resetLoading} className="w-full">
              {showReset ? (resetLoading ? "Enviando..." : "Enviar link de recuperação") : (loading ? "Entrando..." : "Entrar")}
            </Button>
            
            {showReset && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowReset(false)}
                className="w-full"
              >
                Voltar para o login
              </Button>
            )}
          </div>

          <div className="text-sm text-center text-muted-foreground">
            Ainda não tem conta? <Link to="/signup" className="text-primary font-medium hover:underline">Criar conta</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
