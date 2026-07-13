import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  empresa: z.string(),
  periodo: z.string(),
  kpis: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  serieMensal: z.array(z.record(z.string(), z.union([z.number(), z.string()]))).max(36),
  topProdutos: z.array(z.record(z.string(), z.union([z.number(), z.string()]))).max(20),
  destaques: z.array(z.string()).max(50),
  inconsistencias: z.number(),
});

export const generateExecutiveAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY não configurada");

    const payload = {
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Você é um consultor financeiro sênior. Analise APENAS os números fornecidos, sem inventar valores ou fatos não presentes nos dados. " +
            "Responda em português do Brasil, formato Markdown, com estas seções nesta ordem: " +
            "## Resumo executivo\n## Pontos positivos\n## Pontos de atenção\n## Recomendações\n## Próximas ações\n" +
            "Cada seção deve ser objetiva (3 a 6 bullets). Nunca cite números que não estejam nos dados.",
        },
        {
          role: "user",
          content:
            `Empresa: ${data.empresa}\nPeríodo analisado: ${data.periodo}\n\n` +
            `Indicadores do período:\n${JSON.stringify(data.kpis, null, 2)}\n\n` +
            `Série mensal:\n${JSON.stringify(data.serieMensal, null, 2)}\n\n` +
            `Top produtos:\n${JSON.stringify(data.topProdutos, null, 2)}\n\n` +
            `Destaques automáticos:\n- ${data.destaques.join("\n- ")}\n\n` +
            `Inconsistências detectadas: ${data.inconsistencias}\n\n` +
            `Escreva a análise consultiva profissional.`,
        },
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em alguns segundos.");
    if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos em Configurações.");
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Erro na IA (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content ?? "";
    return { analysis: String(content) };
  });
