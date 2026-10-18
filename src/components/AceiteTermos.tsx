import { useState } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LEGAL_VERSAO } from "@/lib/legal";

// Pede o aceite dos Termos de Uso e da Política de Privacidade a quem ainda não
// aceitou a versão vigente (contas antigas ou quando a versão dos textos muda).
export function precisaAceitarTermos(user: User | null) {
  return !!user && (user.user_metadata as Record<string, unknown> | undefined)?.accepted_terms_version !== LEGAL_VERSAO;
}

export function AceiteTermos({ onSair }: { onSair: () => void }) {
  const [marcado, setMarcado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const aceitar = async () => {
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({
      data: { accepted_terms_version: LEGAL_VERSAO, accepted_terms_at: new Date().toISOString() },
    });
    setSalvando(false);
    if (error) toast.error("Não foi possível registrar o aceite. Tente novamente.");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="aceite-titulo">
      <div className="w-full max-w-md bg-card rounded-2xl border shadow-xl p-6 space-y-4">
        <h2 id="aceite-titulo" className="text-xl font-display font-bold">Atualizamos nossos termos</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para continuar usando o SISTEMAFP PJ, leia e aceite os Termos de Uso e a Política de Privacidade.
          Eles explicam como o sistema funciona e como cuidamos dos dados da sua empresa.
        </p>
        <div className="flex flex-col gap-1.5 text-sm">
          <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Ler os Termos de Uso</a>
          <a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Ler a Política de Privacidade</a>
        </div>
        <label className="flex items-start gap-2.5 text-sm cursor-pointer">
          <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} className="mt-0.5 size-4 accent-primary shrink-0" />
          <span>Li e aceito os Termos de Uso e a Política de Privacidade.</span>
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onSair} disabled={salvando}>Sair</Button>
          <Button onClick={aceitar} disabled={!marcado || salvando}>{salvando ? "Salvando..." : "Aceitar e continuar"}</Button>
        </div>
      </div>
    </div>
  );
}
