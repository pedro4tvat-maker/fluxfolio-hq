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

    const systemPrompt = `Você é um especialista em atas de reunião para consultoria financeira empresarial. Sua função é transformar relatos livres em atas profissionais e estruturadas.

REGRAS CRÍTICAS DE FORMATO:
1. JAMAIS repita as linhas de exemplo (placeholders) como "Decisão — Responsável — Prazo" ou "Pendência — Responsável — Prazo".
2. Se houver uma decisão, escreva diretamente a decisão, o responsável e o prazo.
3. Se NÃO houver informações para uma seção, use frases completas como "Nenhuma decisão formal foi registrada" em vez de deixar placeholders vazios ou apenas hífen.
4. Use Markdown puro.
5. Não invente dados. Se não souber o responsável, use "A definir".
6. Mantenha um tom altamente profissional e executivo.`;

    const userPrompt = `DADOS DA REUNIÃO:
Empresa: ${company_name || "Não informado"}
CNPJ: ${company_cnpj || "Não informado"}
Data: ${meeting_date || "Não informado"}
Horário: ${meeting_time || "Não informado"}
Tipo: ${meeting_type || "A definir"}
Participantes: ${Array.isArray(participants) ? participants.join(", ") : (participants || "Não informado")}
Consultor: ${consultant_name || "Não informado"}
Próxima reunião: ${next_meeting_date || "Não informado"}
Anexos: ${attachments_summary || "Nenhum"}

RELATO LIVRE:
${raw_notes}

ESTRUTURA DA ATA (SIGA RIGOROSAMENTE):

# ATA DE REUNIÃO — CONSULTORIA FINANCEIRA

## 1. Identificação
(Liste os dados básicos: Empresa, Data, Horário, Participantes, Consultor)

## 2. Objetivo da Reunião
(Um parágrafo descrevendo o propósito do encontro)

## 3. Pauta e Pontos Discutidos
(Organize o relato em tópicos claros e profissionais, agrupando assuntos correlatos)

## 4. Decisões Tomadas
(Liste cada decisão. Exemplo: "Decisão: Compra de software / Responsável: João / Prazo: 30 dias". NÃO use a linha "Decisão — Responsável — Prazo")

## 5. Pendências e Próximos Passos
(Liste ações futuras. Exemplo: "Ação: Revisar fluxo de caixa / Responsável: Consultor / Prazo: Próxima reunião")

## 6. Encaminhamentos SISTEMAFP PJ
(Sugestões de quais módulos do sistema devem ser usados ou alimentados)

## 7. Observações Finais
(Fechamento profissional)`;

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
       return new Response(JSON.stringify({ error: "Erro na IA", status: aiResp.status }), {
         status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
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