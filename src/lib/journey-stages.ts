import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_JOURNEY_STAGES = [
  { v: "novo_cliente", l: "Novo cliente" },
  { v: "diagnostico_inicial", l: "Diagnóstico inicial" },
  { v: "organizacao_financeira", l: "Organização financeira" },
  { v: "fluxo_caixa", l: "Fluxo de caixa" },
  { v: "contas_pagar_receber", l: "Contas a pagar e receber" },
  { v: "precificacao_margem", l: "Precificação e margem" },
  { v: "orcamento_metas", l: "Orçamento e metas" },
  { v: "dre_relatorios", l: "DRE e relatórios" },
  { v: "plano_acao", l: "Plano de ação" },
  { v: "acompanhamento_mensal", l: "Acompanhamento mensal" },
  { v: "renovacao", l: "Renovação" },
  { v: "encerrado", l: "Encerrado" },
] as const;

const sb = supabase as any;

export type JourneyStage = { v: string; l: string };

export async function loadStagesForConsultant(consultantId: string): Promise<JourneyStage[]> {
  const { data } = await sb
    .from("consultancy_journey_stages")
    .select("stage_key, label, position")
    .eq("consultant_id", consultantId)
    .order("position", { ascending: true });
  if (!data || data.length === 0) return [...DEFAULT_JOURNEY_STAGES];
  return data.map((r: any) => ({ v: r.stage_key, l: r.label }));
}

/**
 * Advance the company stage only if the target is further along than the current.
 * Logs to consultancy_stage_history when it moves.
 */
export async function maybeAdvanceStage(opts: {
  companyId: string;
  consultantId: string;
  targetStage: string;
  userId: string;
  note?: string;
}) {
  const { companyId, consultantId, targetStage, userId, note } = opts;
  const stages = await loadStagesForConsultant(consultantId);
  const order = stages.map((s) => s.v);
  // Fallback to defaults if target is unknown to this consultant
  const orderResolved = order.includes(targetStage) ? order : DEFAULT_JOURNEY_STAGES.map((s) => s.v);

  const { data: comp } = await sb
    .from("companies")
    .select("consultancy_stage")
    .eq("id", companyId)
    .maybeSingle();
  const current = comp?.consultancy_stage ?? "novo_cliente";
  const curIdx = orderResolved.indexOf(current);
  const newIdx = orderResolved.indexOf(targetStage);
  if (newIdx < 0 || newIdx <= curIdx) return false;

  const { error } = await sb.from("companies").update({ consultancy_stage: targetStage }).eq("id", companyId);
  if (error) return false;
  await sb.from("consultancy_stage_history").insert({
    consultant_id: consultantId,
    company_id: companyId,
    previous_stage: current,
    new_stage: targetStage,
    changed_by: userId,
    notes: note ?? "Atualizado automaticamente",
  });
  return true;
}
