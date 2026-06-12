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
      meeting_date,
      meeting_time,
      meeting_type,
      participants,
      agenda_text,
      raw_notes,
      template,
    } = body ?? {};

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI não configurada", fallback: true }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um assistente especializado em atas de reunião para consultoria financeira empresarial. Sua função é transformar um relato livre, informal e possivelmente incompleto em uma ata profissional, clara, organizada e editável.

Não copie o relato bruto. Interprete, organize e redija de forma formal.

Preencha todas as seções da ata com base nas informações disponíveis. Se alguma informação não estiver disponível, use ‘Não informado’ ou ‘A definir’, conforme o caso.

A ata deve ter linguagem profissional, objetiva e adequada para ser compartilhada com o cliente.`;

    const userPrompt = `DADOS RECEBIDOS:
Empresa: ${company_name ?? "Não informado"}
Data da reunião: ${meeting_date ?? "Não informado"}
Horário: ${meeting_time ?? "Não informado"}
Tipo de reunião: ${meeting_type ?? "Não informado"}
Participantes: ${Array.isArray(participants) ? participants.join(", ") : (participants ?? "Não informado")}
Consultor responsável: ${body.consultant_name ?? "Não informado"}
Pauta inicial: ${agenda_text ?? "Não informado"}
Relato livre: ${raw_notes ?? "Não informado"}

Gere a ata no seguinte formato Markdown:

# ATA DE REUNIÃO — CONSULTORIA FINANCEIRA

## 1. Identificação da reunião
* Empresa:
* CNPJ: (se não informado, use 'Não informado')
* Data:
* Horário:
* Tipo de reunião:
* Participantes:
* Consultor responsável:

## 2. Objetivo da reunião
Redija um parágrafo explicando o objetivo principal da reunião com base no relato.

## 3. Pauta tratada
Liste de 3 a 8 itens de pauta identificados no relato.

## 4. Resumo executivo
Redija um resumo profissional da reunião em 1 a 3 parágrafos, destacando o contexto, os assuntos principais e o direcionamento definido.

## 5. Pontos discutidos
Organize os pontos discutidos em tópicos detalhados. Cada tópico deve ter título e descrição.

## 6. Decisões tomadas
Liste as decisões identificadas. Para cada decisão, informar:
* Decisão:
* Responsável:
* Prazo:
(Se responsável ou prazo não forem informados, usar “A definir”)

## 7. Pendências identificadas
Liste as pendências que precisam ser resolvidas. Para cada pendência, informar:
* Pendência:
* Responsável:
* Prazo:
* Status: (Padrão: Pendente)

## 8. Plano de ação e próximos passos
Liste as próximas ações práticas. Para cada ação, informar:
* Ação:
* Responsável:
* Data prevista:
* Observação:

## 9. Encaminhamentos para o SISTEMAFP PJ
Informe quais módulos ou processos do sistema deverão ser utilizados ou atualizados a partir da reunião (ex: fluxo de caixa, estoque, vendas, precificação, relatórios, BPO, documentos ou plano de ação).

## 10. Observações finais
Redija um fechamento profissional, objetivo e adequado para ata.

REGRAS CRÍTICAS:
* Não deixar campos vazios.
* Não usar apenas hífen.
* Não repetir o relato bruto.
* Não inventar informações sensíveis ou fatos não mencionados.
* Usar linguagem formal e consultiva.
* Se uma seção não tiver informações, use textos como: "Não foram registradas decisões formais adicionais nesta reunião." ou "Não foram identificadas pendências específicas além dos próximos passos descritos."`;

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

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido, tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar ata" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const content = json?.choices?.[0]?.message?.content ?? "";

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
