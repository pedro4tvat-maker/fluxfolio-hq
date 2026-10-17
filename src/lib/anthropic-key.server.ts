import process from "node:process";

// Na Cloudflare, segredos do Worker nem sempre aparecem em process.env; o Nitro
// guarda os bindings da requisição em globalThis.__env__. Lê dos dois lugares.
export function getAnthropicKey(): string | undefined {
  const cfEnv = (globalThis as { __env__?: Record<string, unknown> }).__env__;
  const fromCf = typeof cfEnv?.ANTHROPIC_API_KEY === "string" ? cfEnv.ANTHROPIC_API_KEY : undefined;
  const key = (process.env.ANTHROPIC_API_KEY || fromCf || "").trim();
  return key || undefined;
}
