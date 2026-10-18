import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Captcha da Cloudflare (Turnstile). No modo "Managed" quase sempre passa sozinho,
// sem o usuário precisar clicar. O token gerado é enviado ao Supabase no login,
// cadastro e recuperação de senha (Auth → Attack Protection → Captcha).

// Chave pública do widget "SISTEMAFP login" (válida para sistemafp.com.br).
// Em desenvolvimento usa a chave de teste da Cloudflare, que sempre aprova.
const SITE_KEY = import.meta.env.DEV ? "1x00000000000000000000AA" : "0x4AAAAAAFZ2psi5mdOyMHC_";
// Liga/desliga o captcha no site. Deve acompanhar a configuração do Supabase
// (Auth → Attack Protection → Captcha, provedor "Turnstile by Cloudflare" — NÃO hCaptcha).
export const CAPTCHA_ATIVO = true;

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error("turnstile")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string | null) => void }>(
  function Turnstile({ onToken }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (!CAPTCHA_ATIVO) return;
        onTokenRef.current(null);
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      },
    }));

    useEffect(() => {
      if (!CAPTCHA_ATIVO) {
        onTokenRef.current("desligado");
        return;
      }
      let cancelado = false;
      loadScript()
        .then(() => {
          if (cancelado || !box.current || !window.turnstile) return;
          widgetId.current = window.turnstile.render(box.current, {
            sitekey: SITE_KEY,
            language: "pt-br",
            theme: "light",
            callback: (t: string) => onTokenRef.current(t),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
          });
        })
        .catch(() => onTokenRef.current(null));
      return () => {
        cancelado = true;
        if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      };
    }, []);

    if (!CAPTCHA_ATIVO) return null;
    return <div ref={box} className="min-h-[65px]" />;
  },
);
