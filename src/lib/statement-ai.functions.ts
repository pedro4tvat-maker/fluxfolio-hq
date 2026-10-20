import { createServerFn } from "@tanstack/react-start";
import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { getAnthropicKey } from "@/lib/anthropic-key.server";

// Lê extrato bancário enviado como foto (JPG/PNG/WEBP) ou PDF (inclusive escaneado)
// e devolve as transações em linhas, no mesmo formato que o assistente de importação usa.

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"] as const;

const inputSchema = z.object({
  mediaType: z.enum(MEDIA_TYPES),
  // base64 sem o prefixo data:; ~7 MB de texto ≈ 5 MB de arquivo
  data: z.string().min(1).max(7_000_000),
});

const outputSchema = {
  type: "object",
  properties: {
    legivel: { type: "boolean" },
    observacao: { type: "string" },
    transacoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          data: { type: "string" },
          descricao: { type: "string" },
          valor: { type: "number" },
          documento: { type: "string" },
        },
        required: ["data", "descricao", "valor", "documento"],
        additionalProperties: false,
      },
    },
  },
  required: ["legivel", "observacao", "transacoes"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `Você extrai transações de extratos bancários brasileiros (prints do aplicativo do banco, fotos de papel ou PDFs).

Regras:
- Liste cada movimentação do extrato, na ordem em que aparece. Ignore linhas de saldo (saldo anterior, saldo do dia, saldo final), totais e cabeçalhos.
- data: no formato AAAA-MM-DD. Se o ano não aparecer, use o ano mais provável pelo contexto do extrato.
- descricao: o histórico como está no extrato (ex.: "PIX ENVIADO JOAO DA SILVA", "TARIFA PACOTE").
- valor: número em reais com ponto decimal. Saídas (débitos, pagamentos, PIX enviado, tarifas) NEGATIVAS; entradas (créditos, PIX recebido, depósitos) POSITIVAS. Use o sinal, a letra D/C, a cor ou a coluna do extrato para decidir.
- documento: número do documento ou identificador da transação, se houver; senão "".
- Não invente transações nem valores. Se uma parte estiver ilegível, deixe-a de fora e explique em observacao.
- legivel: false se a imagem não for um extrato bancário ou estiver ilegível demais para extrair qualquer movimentação.
- observacao: uma frase curta em português para quem vai conferir (ex.: "2 linhas do fim da foto estavam cortadas"); "" se não houver nada a observar.`;

export const extractStatementFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = getAnthropicKey();
    if (!apiKey) throw new Error("A IA ainda não foi configurada no servidor (ANTHROPIC_API_KEY).");
    const client = new Anthropic({ apiKey });

    const arquivo: Anthropic.Beta.BetaContentBlockParam =
      data.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: data.data } }
        : { type: "image", source: { type: "base64", media_type: data.mediaType, data: data.data } };

    try {
      // fallbacks "default": se o modelo recusar, a própria API refaz no modelo reserva recomendado.
      const response = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium", format: jsonSchemaOutputFormat(outputSchema) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [arquivo, { type: "text", text: "Extraia as movimentações deste extrato." }],
          },
        ],
      });

      if (response.stop_reason === "refusal") {
        throw new Error("A IA não conseguiu ler este arquivo. Tente outra foto ou o arquivo do banco (OFX/Excel).");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("O extrato é longo demais para ler de uma vez. Envie por partes (ex.: uma página ou um mês por vez).");
      }
      const out = response.parsed_output;
      if (!out) throw new Error("Não foi possível interpretar a leitura do extrato. Tente novamente.");
      return out;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new Error("Muitas leituras ao mesmo tempo. Aguarde um minuto e tente de novo.");
      }
      if (error instanceof Anthropic.BadRequestError) {
        throw new Error("O arquivo não pôde ser lido pela IA (formato ou tamanho). Tente uma foto mais leve ou outro formato.");
      }
      if (error instanceof Anthropic.APIError) {
        throw new Error("O serviço de IA está indisponível no momento. Tente novamente em instantes.");
      }
      throw error;
    }
  });
