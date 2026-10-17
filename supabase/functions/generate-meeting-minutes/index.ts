// Edge function: generate-meeting-minutes
// Uses Claude (Anthropic API) to turn raw notes into a structured meeting minute.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.135.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      company_name,
      company_cnpj,
      meeting_date,
      meeting_time,
      meeting_type,
      participants,
      consultant_name,
      raw_notes,
      next_meeting_date,
      attachments_summary,
      agenda_text,
      previous_action_plan,
    } = body ?? {};

    if (!Deno.env.get("ANTHROPIC_API_KEY")) {
      return new Response(
        JSON.stringify({ error: "AI não configurada", status: "no_api_key" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const fmtDate = (d?: string) => {
      const m = typeof d === "string" ? d.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
      return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || "Não informado");
    };
    const fmtTime = (t?: string) => (typeof t === "string" && t ? t.slice(0, 5) : "");
    const lista = Array.isArray(participants) && participants.length ? participants.join(", ") : "Não informado";

    // Mesmo modelo de ata do gerador oficial (gerar_ata.py): 9 seções. O cabeçalho
    // (logo, nº da ata, empresa, CNPJ) e as assinaturas são desenhados no PDF.
    const systemPrompt = `Você redige atas de reunião de consultoria financeira empresarial. Transforma um relato livre, informal e às vezes incompleto do consultor numa ata formal, objetiva e pronta para o cliente assinar.

Regras:
- Reescreva o relato em linguagem formal e consultiva; nunca copie trechos informais.
- Não invente nomes, valores, datas, decisões ou responsáveis que não estejam nos dados.
- Quando uma informação não existir, omita o campo ou escreva a frase sem ela. Nunca escreva "Não informado", "A definir", "Indefinido" ou equivalentes.
- Siga exatamente o formato pedido: as 9 seções, nesta ordem, com os mesmos títulos, tabelas e listas. Nada antes da seção 1 e nada depois da seção 9.
- Use datas no formato DD/MM/AAAA.
- Responda só com a ata em Markdown, sem comentários.`;

    const userPrompt = `DADOS DA REUNIÃO
Empresa: ${company_name || "Não informado"}
CNPJ: ${company_cnpj || "Não informado"}
Data: ${fmtDate(meeting_date)}
Horário: ${fmtTime(meeting_time) || "Não informado"}
Tipo de reunião: ${meeting_type || "Não informado"}
Participantes informados: ${lista}
Consultor responsável (redator da ata): ${consultant_name || "Não informado"}
Pauta informada: ${agenda_text || "Não informada (deduza do relato)"}
Próxima reunião: ${next_meeting_date ? fmtDate(next_meeting_date) : "A definir"}
Anexos/documentos: ${attachments_summary || "Nenhum"}

PLANO DE AÇÃO DA ATA ANTERIOR DESTA EMPRESA (para a seção 7):
${previous_action_plan || "Nenhuma ata anterior: esta é a primeira reunião registrada."}

RELATO LIVRE DO CONSULTOR:
${raw_notes}

FORMATO OBRIGATÓRIO (substitua o que está entre colchetes; mantenha títulos e marcações). A ata deve ler como um documento corrido: prefira parágrafos bem escritos; a única tabela é o plano de ação.

## 1. Identificação da reunião
- **Data:** ${fmtDate(meeting_date)}
- **Horário:** ${fmtTime(meeting_time)}
- **Modalidade:** [Presencial ou Online (ferramenta), deduzido do relato; se não der para saber, omita esta linha]
- **Tipo:** ${meeting_type || ""}

## 2. Participantes
- **[Nome do consultor responsável]** — Consultor Financeiro ([organização do consultor])
- **[Nome]** — [Função] ([Organização]) [se a função ou a organização não forem conhecidas, escreva só o nome]

**Ausentes:** [quem foi citado como ausente, ou "Não houve ausências."]

**Redação da ata:** ${consultant_name || ""}

## 3. Pauta
1. [item da pauta]
2. [item da pauta]

## 4. Assuntos discutidos
> [Síntese da reunião em 2 a 3 frases: o contexto, o principal ponto de atenção e o encaminhamento geral.]

### 4.1 [Título do assunto]
[Um a dois parágrafos formais e completos sobre o que foi apresentado, analisado e concluído neste assunto. Destaque em **negrito** números ou fatos-chave citados no relato.]

### 4.2 [Título do assunto]
[...]

## 5. Decisões tomadas
1. [Decisão escrita como frase completa, citando em negrito quem ficou responsável, ex.: **Carlos (Gerente)** passará a ser responsável por:]
   - [detalhe da decisão, quando houver]
[Se não houve decisão formal: "Nenhuma decisão formal foi registrada nesta reunião."]

## 6. Plano de ação
| Nº | Ação | Responsável | Prazo | Status |
|---|---|---|---|---|
| 1 | [ação concreta] | [nome, ou vazio se não houver] | [DD/MM/AAAA, ou vazio se não houver] | Pendente |

## 7. Pendências da reunião anterior
[Se houver ata anterior, uma linha por ação do plano anterior, no formato abaixo, com o status que o relato indicar: Concluída, Em andamento, Pendente ou Não mencionada.]
- [Status] [Ação] — [Responsável]
[Se não houver ata anterior: "Não se aplica: esta foi a primeira reunião registrada."]

## 8. Próxima reunião
${next_meeting_date ? `A próxima reunião está prevista para **${fmtDate(next_meeting_date)}**[, às **horário**, se informado no relato], com a seguinte pauta:` : "A data da próxima reunião será combinada entre as partes. Pauta prevista:"}
1. [item previsto para a próxima reunião]

## 9. Encerramento
Nada mais havendo a tratar, a reunião foi encerrada e a presente ata foi lavrada por ${consultant_name || "[consultor]"}, para ciência e concordância dos participantes.`;

    const client = new Anthropic();

    // fallbacks "default": se o modelo recusar, a API refaz a chamada no modelo
    // reserva recomendado pela Anthropic.
    const generate = async (prompt: string) => {
      const response = await client.beta.messages.create({
        model: "claude-opus-5-5",
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      });
      if (response.stop_reason === "refusal") return null;
      return response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();
    };

    let content: string | null;
    try {
      content = await generate(userPrompt);
    } catch (err) {
      console.error("Anthropic API error:", err);
      const friendly = err instanceof Anthropic.RateLimitError
        ? "Limite de requisições atingido. Aguarde alguns instantes e tente novamente."
        : err instanceof Anthropic.AuthenticationError
          ? "Chave da IA inválida. Verifique ANTHROPIC_API_KEY nos secrets do Supabase."
          : "Erro ao gerar ata com IA.";
      const status = err instanceof Anthropic.APIError ? err.status : 500;
      return new Response(
        JSON.stringify({ error: friendly, status, content: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (content === null) {
      return new Response(
        JSON.stringify({ error: "A IA não conseguiu gerar a ata para este relato.", status: "refusal", content: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Security check to avoid returning empty or placeholder content
    const placeholders = ["[ação concreta]", "[Título do assunto]", "[item da pauta]", "[nome]"];

    if (placeholders.some(p => content!.includes(p))) {
      // One retry with a more forceful instruction if placeholders are detected
      const retry = await generate(
        userPrompt +
          "\n\nIMPORTANTE: não deixe textos entre colchetes do modelo. " +
          "Substitua todos pelos dados reais ou remova o trecho.",
      ).catch(() => null);
      if (retry) content = retry;
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});