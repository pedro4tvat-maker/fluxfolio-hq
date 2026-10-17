import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getAnthropicKey } from "@/lib/anthropic-key.server";

const inputSchema = z.object({
  empresa: z.string(),
  periodo: z.string(),
  kpis: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  serieMensal: z.array(z.record(z.string(), z.union([z.number(), z.string()]))).max(36),
  topProdutos: z.array(z.record(z.string(), z.union([z.number(), z.string()]))).max(20),
  destaques: z.array(z.string()).max(50),
  inconsistencias: z.number(),
});

const SYSTEM_PROMPT = `Você é um consultor financeiro que explica os números para donos de pequenas empresas que não têm formação em finanças. Escreva como numa conversa franca com o empresário: frases curtas, palavras do dia a dia, tom próximo e respeitoso.

Regras de conteúdo:
- Use APENAS os números fornecidos. Nunca invente valores, causas ou fatos.
- Evite jargão. Quando precisar de um termo técnico (margem, inadimplência, ticket médio, custo fixo), explique em poucas palavras o que ele significa na prática. Ex.: "inadimplência (clientes que ainda não pagaram o que devem)".
- Sempre diga o que o número significa para o negócio e o que fazer com ele.
- Valores em reais no formato R$ 1.234,56; datas e meses por extenso quando ajudar (ex.: "em outubro").
- Se os dados parecerem incompletos ou estranhos, diga isso de forma simples e sugira conferir os lançamentos, sem acusar ninguém.

Formato (o sistema transforma os símbolos em títulos e listas, o leitor não vê os símbolos):
## Resumo
Um parágrafo curto (3 a 4 frases) com a situação geral.
## O que está indo bem
- 2 a 4 itens
## O que merece atenção
- 2 a 5 itens
## O que recomendamos
- 3 a 5 itens, cada um começando com uma ação clara
## Próximos passos
- 3 a 5 itens com prazo simples (esta semana, nos próximos 15 dias, este mês)

Use **negrito** só para o valor ou a ideia mais importante de cada item, no máximo uma vez por item. Não use tabelas, emojis nem outros títulos.`;

export const generateExecutiveAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = getAnthropicKey();
    if (!apiKey) throw new Error("A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).");
    const client = new Anthropic({ apiKey });

    const userPrompt =
      `Empresa: ${data.empresa}\nPeríodo analisado: ${data.periodo}\n\n` +
      `Indicadores do período:\n${JSON.stringify(data.kpis, null, 2)}\n\n` +
      `Série mensal:\n${JSON.stringify(data.serieMensal, null, 2)}\n\n` +
      `Top produtos:\n${JSON.stringify(data.topProdutos, null, 2)}\n\n` +
      `Destaques automáticos:\n- ${data.destaques.join("\n- ")}\n\n` +
      `Inconsistências detectadas: ${data.inconsistencias}\n\n` +
      `Escreva a análise para o dono da empresa, em linguagem simples.`;

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
