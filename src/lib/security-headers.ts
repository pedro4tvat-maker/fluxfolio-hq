// Cabeçalhos de segurança aplicados a todas as respostas do servidor.

const SUPABASE = "https://lzqwuffiiebpfzoqtzuo.supabase.co";
const SUPABASE_WS = "wss://lzqwuffiiebpfzoqtzuo.supabase.co";

// Política de conteúdo: de onde o site pode carregar scripts, estilos, imagens e conexões.
// Modo bloqueante: o navegador recusa qualquer recurso fora desta lista.
// Cloudflare: Turnstile (captcha) e Web Analytics (cloudflareinsights).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${SUPABASE}`,
  `connect-src 'self' ${SUPABASE} ${SUPABASE_WS} https://cloudflareinsights.com`,
  "frame-src 'self' blob: https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const HEADERS: Record<string, string> = {
  // Só HTTPS, por 1 ano, inclusive subdomínios
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Ninguém pode exibir o sistema dentro de outro site (clickjacking)
  "X-Frame-Options": "DENY",
  // O navegador não "adivinha" tipos de arquivo
  "X-Content-Type-Options": "nosniff",
  // Não vaza o endereço completo das páginas para outros sites
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Bloqueia acesso a câmera, microfone, localização etc.
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy": CSP,
};

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
