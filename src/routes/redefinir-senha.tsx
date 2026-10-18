import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REGRA_SENHA, forcaSenha, traduzErroSenha, validarSenha } from "@/lib/senha";
import { registrarAtividade } from "@/lib/inatividade";
import logoAsset from "@/assets/sistemafp-pj-logo.png";

// Destino do link "Esqueci minha senha": o link do e-mail abre uma sessão de
// recuperação, e aqui o usuário escolhe a senha nova.
export const Route = createFileRoute("/redefinir-senha")({
  head: () => ({ meta: [{ title: "Criar nova senha — SISTEMAFP PJ" }] }),
  component: RedefinirSenha,
});

function RedefinirSenha() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<"verificando" | "pronto" | "invalido">("verificando");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const forca = useMemo(() => forcaSenha(senha), [senha]);

  useEffect(() => {
    let ativo = true;
    const { data } = supabase.auth.onAuthStateChange((evento, sessao) => {
      if (!ativo) return;
      if (evento === "PASSWORD_RECOVERY" || (sessao && evento === "SIGNED_IN")) setEstado("pronto");
    });
    supabase.auth.getSession().then(({ data: d }) => {
      if (ativo && d.session) setEstado("pronto");
    });
    // Se o link não abrir uma sessão em alguns segundos, ele é inválido ou expirou.
    const t = setTimeout(() => {
      if (!ativo) return;
      supabase.auth.getSession().then(({ data: d }) => {
        if (ativo && !d.session) setEstado((e) => (e === "verificando" ? "invalido" : e));
      });
    }, 4000);
    return () => {
      ativo = false;
      clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const erro = validarSenha(senha);
    if (erro) return toast.error(erro);
    if (senha !== confirmacao) return toast.error("As duas senhas não são iguais.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return toast.error("Não foi possível salvar a senha", { description: traduzErroSenha(error.message) });
    registrarAtividade(true);
    toast.success("Senha alterada! Você já está conectado.");
    navigate({ to: "/app", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-6">
        <img src={logoAsset} alt="SISTEMAFP PJ" className="h-20 w-auto object-contain" />

        {estado === "verificando" && <p className="text-muted-foreground">Conferindo o link de recuperação...</p>}

        {estado === "invalido" && (
          <div className="space-y-4">
            <h1 className="text-2xl font-display font-bold">Link inválido ou expirado</h1>
            <p className="text-muted-foreground">
              Os links de recuperação valem por pouco tempo e só podem ser usados uma vez. Peça um novo na tela de login,
              em "Esqueci minha senha".
            </p>
            <Button asChild className="w-full"><Link to="/login">Voltar para o login</Link></Button>
          </div>
        )}

        {estado === "pronto" && (
          <form onSubmit={salvar} className="space-y-5">
            <div>
              <h1 className="text-2xl font-display font-bold">Criar nova senha</h1>
              <p className="text-sm text-muted-foreground mt-1">{REGRA_SENHA}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <div className="relative">
                <Input id="senha" type={mostrar ? "text" : "password"} autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
                <button type="button" onClick={() => setMostrar((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1" aria-label="Mostrar senha">
                  {mostrar ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {senha && (
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${forca.color} transition-all`} style={{ width: `${(forca.score / 4) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Força: {forca.label}</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmacao">Repita a nova senha</Label>
              <Input id="confirmacao" type={mostrar ? "text" : "password"} autoComplete="new-password" required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>{salvando ? "Salvando..." : "Salvar nova senha"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
