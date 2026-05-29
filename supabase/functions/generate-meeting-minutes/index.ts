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

    const systemPrompt = `Você é um assistente de consultoria financeira que escreve atas de reunião profissionais em português do Brasil.
Transforme as anotações livres do consultor em uma ata estruturada, clara, objetiva e formal.
Use Markdown. Mantenha tudo em português. Não invente informações que não estão nas anotações.`;

    const defaultTemplate = `# Ata de Reunião — {{empresa}}

## 1. Dados da reunião
- Empresa: {{empresa}}
- Data: {{data}}
- Horário: {{horario}}
- Tipo: {{tipo}}
- Participantes: {{participantes}}

## 2. Pauta
{{pauta}}

## 3. Resumo da reunião
(escreva um resumo organizado)

## 4. Pontos discutidos
- ...

## 5. Decisões tomadas
- Decisão — Responsável — Prazo

## 6. Pendências
- Pendência — Responsável — Prazo — Status

## 7. Próximos passos
- Ação — Responsável — Data prevista

## 8. Observações finais
- ...`;

    const userPrompt = `Empresa: ${company_name ?? "—"}
Data: ${meeting_date ?? "—"}
Horário: ${meeting_time ?? "—"}
Tipo de reunião: ${meeting_type ?? "—"}
Participantes: ${Array.isArray(participants) ? participants.join(", ") : (participants ?? "—")}

PAUTA:
${agenda_text ?? "—"}

ANOTAÇÕES LIVRES DO CONSULTOR:
${raw_notes ?? "—"}

MODELO A SEGUIR (preencha cada seção com base nas anotações):
${template || defaultTemplate}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
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
