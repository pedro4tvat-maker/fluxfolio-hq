import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
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

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const strength = useMemo(() => passwordStrength(password), [password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (strength.score < 2) {
      toast.error("Use uma senha mais forte (mínimo 8 caracteres).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/login`, data: { full_name: name } },
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
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6 bg-card p-8 rounded-2xl shadow-card border">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-primary grid place-items-center text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <span className="font-display font-semibold">SISTEMAFP PJ</span>
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">Criar conta</h2>
          <p className="text-sm text-muted-foreground mt-1">A primeira conta criada será o consultor administrador.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
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
