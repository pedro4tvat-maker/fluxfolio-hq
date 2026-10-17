import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { describeAnthropicKey, getAnthropicKey } from "@/lib/anthropic-key.server";

const inputSchema = z.object({
  empresa: z.string(),
  periodo: z.string(),
  kpis: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  serieMensal: z.array(z.record(z.string(), z.union([z.number(), z.string()]))).max(36),
  topProdutos: z.array(z.record(z.string(), z.union([z.number(), z.string()]))).max(20),
  destaques: z.array(z.string()).max(50),
  inconsistencias: z.number(),
});

const SYSTEM_PROMPT =
  "Você é um consultor financeiro sênior. Analise APENAS os números fornecidos, sem inventar valores ou fatos não presentes nos dados. " +
  "Responda em português do Brasil, formato Markdown, com estas seções nesta ordem: " +
  "## Resumo executivo\n## Pontos positivos\n## Pontos de atenção\n## Recomendações\n## Próximas ações\n" +
  "Cada seção deve ser objetiva (3 a 6 bullets). Nunca cite números que não estejam nos dados.";

export const generateExecutiveAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = getAnthropicKey();
    if (!apiKey) throw new Error(`ANTHROPIC_API_KEY não configurada (${describeAnthropicKey()})`);
    const client = new Anthropic({ apiKey });

    const userPrompt =
      `Empresa: ${data.empresa}\nPeríodo analisado: ${data.periodo}\n\n` +
      `Indicadores do período:\n${JSON.stringify(data.kpis, null, 2)}\n\n` +
      `Série mensal:\n${JSON.stringify(data.serieMensal, null, 2)}\n\n` +
      `Top produtos:\n${JSON.stringify(data.topProdutos, null, 2)}\n\n` +
      `Destaques automáticos:\n- ${data.destaques.join("\n- ")}\n\n` +
      `Inconsistências detectadas: ${data.inconsistencias}\n\n` +
      `Escreva a análise consultiva profissional.`;

    try {
      // fallbacks "default": se o modelo recusar a resposta, a própria API refaz
      // a chamada no modelo reserva recomendado pela Anthropic.
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("A IA não conseguiu gerar a análise para estes dados. Tente novamente.");
      }
      const analysis = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { analysis };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
      }
      if (error instanceof Anthropic.AuthenticationError) {
        throw new Error("Chave da IA inválida. Verifique ANTHROPIC_API_KEY.");
      }
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Erro na IA (${error.status ?? "?"}): ${error.message.slice(0, 200)}`);
      }
      throw error;
    }
  });
