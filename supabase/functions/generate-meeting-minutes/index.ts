// Edge function: generate-meeting-minutes
// Uses Lovable AI Gateway to turn raw notes into a structured meeting minute.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    } = body ?? {};

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI não configurada", status: "no_api_key" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um assistente especializado em atas de reunião para consultoria financeira empresarial. Sua função é transformar um relato livre, informal e possivelmente incompleto em uma ata profissional, clara, organizada e editável.

REGRAS OBRIGATÓRIAS:
1. NUNCA copie o relato bruto. Interprete, organize e reescreva em linguagem formal, objetiva e consultiva.
2. Preencha TODAS as 10 seções da ata. Nenhuma pode ficar vazia ou conter apenas hífen.
3. Quando faltar informação, use frases completas como "Não informado", "A definir", "Nenhuma decisão formal adicional foi registrada nesta reunião" ou "Não foram identificadas pendências específicas além dos próximos passos descritos".
4. JAMAIS escreva linhas-modelo como "Decisão — Responsável — Prazo" ou "Pendência — Responsável — Prazo — Status". Escreva os dados reais.
5. Não invente valores, nomes, datas ou decisões que não estejam no relato.
6. Identifique no relato: temas (vira pauta), combinações (viram decisões), necessidades futuras (viram pendências/próximos passos) e compromissos (viram plano de ação).
7. Use Markdown puro. Tom profissional, pronto para compartilhar com o cliente.`;

    const userPrompt = `DADOS RECEBIDOS:
Empresa: ${company_name || "Não informado"}
CNPJ: ${company_cnpj || "Não informado"}
Data da reunião: ${meeting_date || "Não informado"}
Horário: ${meeting_time || "Não informado"}
Tipo de reunião: ${meeting_type || "Não informado"}
Participantes: ${Array.isArray(participants) && participants.length ? participants.join(", ") : "Não informado"}
Consultor responsável: ${consultant_name || "Não informado"}
Próxima reunião: ${next_meeting_date || "A definir"}
Anexos/Documentos: ${attachments_summary || "Nenhum"}

RELATO LIVRE DO CONSULTOR:
${raw_notes}

Gere a ata EXATAMENTE neste formato, em Markdown, preenchendo todas as 10 seções:

# ATA DE REUNIÃO — CONSULTORIA FINANCEIRA
## [Título profissional inferido do relato]

## 1. Identificação da reunião
- **Empresa:** ${company_name || "Não informado"}
- **CNPJ:** ${company_cnpj || "Não informado"}
- **Data:** ${meeting_date || "Não informado"}
- **Horário:** ${meeting_time || "Não informado"}
- **Tipo de reunião:** ${meeting_type || "Não informado"}
- **Participantes:** ${Array.isArray(participants) && participants.length ? participants.join(", ") : "Não informado"}
- **Consultor responsável:** ${consultant_name || "Não informado"}

## 2. Objetivo da reunião
(Um parágrafo profissional explicando o propósito principal da reunião, inferido do relato.)

## 3. Pauta tratada
(Liste de 3 a 8 itens da pauta identificados no relato, em bullets.)

## 4. Resumo executivo
(1 a 3 parágrafos profissionais destacando contexto, assuntos principais e direcionamento. NÃO copie o relato bruto — reescreva em linguagem executiva.)

## 5. Pontos discutidos
(Tópicos detalhados, cada um com **Título** em negrito seguido de descrição reescrita formalmente.)

## 6. Decisões tomadas
(Para cada decisão use o formato:
- **Decisão:** [descrição]
  - **Responsável:** [nome ou "A definir"]
  - **Prazo:** [data ou "A definir"]

Se não houver decisões: "Nenhuma decisão formal adicional foi registrada nesta reunião.")

## 7. Pendências identificadas
(Para cada pendência use:
- **Pendência:** [descrição]
  - **Responsável:** [nome ou "A definir"]
  - **Prazo:** [data ou "A definir"]
  - **Status:** Pendente

Se não houver: "Não foram identificadas pendências específicas além dos próximos passos descritos.")

## 8. Plano de ação e próximos passos
(Para cada ação:
- **Ação:** [descrição]
  - **Responsável:** [nome ou "A definir"]
  - **Data prevista:** [data ou "A definir"]
  - **Observação:** [contexto curto ou "—"])

## 9. Encaminhamentos para o SISTEMAFP PJ
(Indique quais módulos do sistema deverão ser usados/atualizados a partir desta reunião: fluxo de caixa, estoque, vendas, precificação, DRE, relatórios, BPO, documentos, plano de ação, etc.)

## 10. Observações finais
(Fechamento profissional, objetivo, adequado para ata formal compartilhada com o cliente.)`;

    const fetchAI = async () => {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      });
      return aiResp;
    };

    let aiResp = await fetchAI();
    
    if (!aiResp.ok) {
       const errorText = await aiResp.text();
       console.error("AI Gateway Error:", aiResp.status, errorText);
       const friendly = aiResp.status === 402
         ? "Créditos de IA esgotados. Adicione saldo em Settings → Workspace → Plans & Credits."
         : aiResp.status === 429
           ? "Limite de requisições atingido. Aguarde alguns instantes e tente novamente."
           : "Erro ao gerar ata com IA.";
       return new Response(
         JSON.stringify({ error: friendly, status: aiResp.status, content: null }),
         { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
       );
    }

    const json = await aiResp.json();
    let content = json?.choices?.[0]?.message?.content ?? "";

    // Security check to avoid returning empty or placeholder content
    const placeholders = [
      "Decisão — Responsável — Prazo",
      "Pendência — Responsável — Prazo",
      "Ação — Responsável — Data prevista"
    ];

    if (placeholders.some(p => content.includes(p))) {
      // One retry with a more forceful prompt if placeholders are detected
      const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
            { role: "assistant", content: content },
            { role: "user", content: "Você incluiu placeholders de exemplo (como 'Decisão — Responsável — Prazo'). Por favor, refaça a ata removendo essas linhas e preenchendo os dados reais ou indicando 'Nenhum' ou 'A definir'." }
          ],
          temperature: 0.1,
        }),
      });
      
      if (retryResp.ok) {
        const retryJson = await retryResp.json();
        content = retryJson?.choices?.[0]?.message?.content ?? content;
      }
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