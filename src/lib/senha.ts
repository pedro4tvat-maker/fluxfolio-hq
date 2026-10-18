// Regras de senha do sistema. As mesmas regras estão configuradas no Supabase
// (Auth → Sign In / Providers → Email): mínimo de 8 caracteres, com letras e números.

export const REGRA_SENHA = "Mínimo de 8 caracteres, com letras e números.";

export function validarSenha(p: string): string | null {
  if (p.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(p)) return "A senha precisa ter pelo menos uma letra.";
  if (!/[0-9]/.test(p)) return "A senha precisa ter pelo menos um número.";
  return null;
}

export function forcaSenha(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  const map = [
    { label: "Muito fraca", color: "bg-destructive" },
    { label: "Fraca", color: "bg-destructive" },
    { label: "Média", color: "bg-warning" },
    { label: "Forte", color: "bg-success" },
    { label: "Muito forte", color: "bg-success" },
  ];
  return { score: s, ...map[s] };
}

// Traduz as mensagens de erro de senha que o Supabase devolve em inglês.
export function traduzErroSenha(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("should be different")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("at least") || m.includes("characters")) return `Senha fraca. ${REGRA_SENHA}`;
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked")) return "Essa senha é muito fácil ou já apareceu em vazamentos. Escolha outra.";
  if (m.includes("session") || m.includes("jwt") || m.includes("expired")) return "O link expirou. Peça um novo em \"Esqueci minha senha\".";
  return msg;
}
