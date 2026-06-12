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

    const systemPrompt = `Você é um especialista em atas de reunião para consultoria financeira empresarial. Sua função é transformar relatos livres, informais e incompletos em atas profissionais, completas, claras e editáveis.

Você não deve copiar o relato bruto. Você deve interpretar, organizar, reescrever e preencher todas as seções possíveis da ata.

A ata será usada por um consultor financeiro para documentar reuniões com clientes empresariais.

Regras obrigatórias:
* Não deixar seções vazias.
* Não usar apenas hífen.
* Não usar placeholders genéricos como “Decisão — Responsável — Prazo”.
* Se uma informação não foi fornecida, usar “Não informado” ou “A definir”.
* Não inventar fatos, valores, pessoas ou prazos.
* Pode inferir objetivo, pauta, pontos discutidos, pendências e próximos passos com base no relato.
* Usar linguagem formal, consultiva e profissional.
* Gerar uma ata pronta para revisão e compartilhamento.
* Retornar somente o conteúdo da ata em markdown.`;

    const userPrompt = `Dados da reunião:

Empresa: ${company_name || "Não informado"}
CNPJ: ${company_cnpj || "Não informado"}
Data: ${meeting_date || "Não informado"}
Horário: ${meeting_time || "Não informado"}
Tipo de reunião: ${meeting_type || "A definir"}
Participantes: ${Array.isArray(participants) ? participants.join(", ") : (participants || "Não informado")}
Consultor responsável: ${consultant_name || "Não informado"}
Próxima reunião prevista: ${next_meeting_date || "Não informado"}
Documentos/Anexos: ${attachments_summary || "Nenhum informado"}

Relato livre da reunião:
${raw_notes}

Com base nos dados acima, gere uma ata profissional no seguinte formato:

# ATA DE REUNIÃO — CONSULTORIA FINANCEIRA

## 1. Identificação da reunião
* Empresa:
* CNPJ:
* Data:
* Horário:
* Tipo de reunião:
* Participantes:
* Consultor responsável:

## 2. Objetivo da reunião
Escreva um parágrafo profissional explicando o objetivo da reunião.

## 3. Pauta tratada
Liste de 3 a 8 itens de pauta identificados a partir do relato.

## 4. Resumo executivo
Escreva de 1 a 3 parágrafos profissionais resumindo a reunião.

## 5. Pontos discutidos
Organize os pontos discutidos em subtópicos com título e explicação.

## 6. Decisões tomadas
Liste as decisões identificadas. Cada decisão deve conter:
* Decisão:
* Responsável:
* Prazo:

Se não houver decisões explícitas, escreva:
“Não foram registradas decisões formais adicionais nesta reunião.”

## 7. Pendências identificadas
Liste as pendências identificadas. Cada pendência deve conter:
* Pendência:
* Responsável:
* Prazo:
* Status:

Se não houver pendências explícitas, escreva:
“Não foram identificadas pendências específicas além dos próximos passos descritos.”

## 8. Plano de ação e próximos passos
Liste ações práticas decorrentes da reunião. Cada ação deve conter:
* Ação:
* Responsável:
* Data prevista:
* Observação:

## 9. Encaminhamentos para o SISTEMAFP PJ
Explique quais módulos do sistema devem ser atualizados ou utilizados a partir da reunião.

## 10. Observações finais
Escreva um fechamento profissional.`;

    const fetchAI = async () => {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp",
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

    // Validation
    const placeholders = [
      "Decisão — Responsável — Prazo",
      "Pendência — Responsável — Prazo — Status",
      "Ação — Responsável — Data prevista",
      "## 2. Pauta\n-",
      "## 4. Pontos discutidos\n-",
      "## 8. Observações finais\n-"
    ];

    const hasPlaceholders = placeholders.some(p => content.includes(p));
    
    if (hasPlaceholders) {
      console.log("Placeholders detected, retrying...");
      aiResp = await fetchAI();
      if (aiResp.ok) {
        const json2 = await aiResp.json();
        content = json2?.choices?.[0]?.message?.content ?? content;
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