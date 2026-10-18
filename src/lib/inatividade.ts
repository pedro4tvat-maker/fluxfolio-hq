import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Saída automática por inatividade: se o sistema ficar LIMITE_MS sem uso (em todas as
// abas), a sessão é encerrada e o próximo acesso pede login de novo.

export const LIMITE_MINUTOS = 30;
const LIMITE_MS = LIMITE_MINUTOS * 60 * 1000;
const CHAVE = "sfp:ultima_atividade";

function ler(): number | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

let ultimaGravacao = 0;
export function registrarAtividade(forcar = false) {
  const agora = Date.now();
  if (!forcar && agora - ultimaGravacao < 15_000) return; // grava no máximo a cada 15 s
  ultimaGravacao = agora;
  try {
    localStorage.setItem(CHAVE, String(agora));
  } catch {
    /* navegador sem armazenamento: segue sem o controle */
  }
}

/** Encerra a sessão se o último uso foi há mais que o limite. Retorna true se encerrou. */
export async function encerrarSeInativo(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const ultima = ler();
  if (ultima === null) {
    // Primeira vez com o controle ligado: começa a contar a partir de agora.
    registrarAtividade(true);
    return false;
  }
  if (Date.now() - ultima > LIMITE_MS) {
    await supabase.auth.signOut();
    try { localStorage.removeItem("sfp:selected_company"); } catch { /* ok */ }
    return true;
  }
  return false;
}

/** Usado dentro do sistema: conta a atividade e confere a inatividade a cada minuto. */
export function useInatividade(aoEncerrar: () => void) {
  useEffect(() => {
    const marcar = () => registrarAtividade();
    const eventos = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    eventos.forEach((e) => window.addEventListener(e, marcar, { passive: true }));
    registrarAtividade(true);
    const t = setInterval(async () => {
      if (await encerrarSeInativo()) aoEncerrar();
    }, 60_000);
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, marcar));
      clearInterval(t);
    };
  }, [aoEncerrar]);
}
