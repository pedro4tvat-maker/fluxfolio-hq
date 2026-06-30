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

/**
 * Conjunto profissional/consultivo de fases usado pelo template padrão
 * "Consultoria Financeira PJ — 4 semanas".
 */
export const PROFESSIONAL_JOURNEY_PHASES: ProfessionalPhase[] = [
  { key: "entrada_cliente", name: "Entrada do Cliente", objective: "Receber o cliente e iniciar o relacionamento da consultoria.", duration: 3, checklist: ["Confirmar contrato assinado", "Coletar dados cadastrais", "Agendar reunião de boas-vindas"] },
  { key: "onboarding", name: "Onboarding", objective: "Preparar a empresa para iniciar a consultoria.", duration: 5, checklist: ["Confirmar dados da empresa", "Confirmar responsável financeiro", "Configurar acesso do cliente", "Solicitar documentos iniciais", "Cadastrar contas financeiras", "Cadastrar categorias padrão", "Agendar reunião inicial"] },
  { key: "diagnostico_inicial", name: "Diagnóstico Inicial", objective: "Avaliar a situação financeira atual da empresa.", duration: 7, checklist: ["Aplicar diagnóstico financeiro", "Avaliar fluxo de caixa", "Avaliar contas a pagar", "Avaliar contas a receber", "Avaliar estoque", "Avaliar precificação", "Avaliar endividamento", "Gerar score inicial"] },
  { key: "coleta_dados", name: "Coleta de Dados", objective: "Reunir extratos, lançamentos e documentos.", duration: 5, checklist: ["Solicitar extratos bancários", "Solicitar relatórios atuais", "Solicitar planilhas existentes", "Confirmar acessos"] },
  { key: "organizacao_financeira", name: "Organização Financeira", objective: "Organizar a base financeira da empresa.", duration: 7, checklist: ["Importar extrato bancário", "Classificar lançamentos", "Organizar categorias", "Separar PF e PJ", "Validar saldo inicial", "Revisar contas financeiras"] },
  { key: "fluxo_caixa", name: "Fluxo de Caixa", objective: "Implantar o controle diário de caixa.", duration: 7, checklist: ["Configurar fluxo de caixa", "Validar lançamentos do mês", "Apresentar fluxo ao cliente"] },
  { key: "contas_pagar_receber", name: "Contas a Pagar e Receber", objective: "Organizar contas em aberto e recebíveis.", duration: 5, checklist: ["Cadastrar contas a pagar", "Cadastrar contas a receber", "Revisar vencimentos"] },
  { key: "precificacao_margem", name: "Precificação e Margem", objective: "Avaliar margem e revisar preços.", duration: 7, checklist: ["Levantar produtos/serviços principais", "Identificar custos diretos", "Identificar despesas variáveis", "Calcular margem atual", "Calcular preço sugerido", "Identificar produtos com margem ruim"] },
  { key: "orcamento_metas", name: "Orçamento e Metas", objective: "Definir orçamento por categoria e metas.", duration: 5, checklist: ["Criar orçamento mensal", "Definir metas de receita", "Definir limites de despesa"] },
  { key: "dre_gerencial", name: "DRE Gerencial", objective: "Estruturar a DRE para a tomada de decisão.", duration: 5, checklist: ["Configurar DRE", "Validar resultado do mês", "Revisar classificações"] },
  { key: "kpis_indicadores", name: "KPIs e Indicadores", objective: "Definir indicadores que serão acompanhados.", duration: 3, checklist: ["Selecionar KPIs", "Configurar metas", "Apresentar painel ao cliente"] },
  { key: "relatorio_executivo", name: "Relatório Executivo", objective: "Entregar o relatório mensal estratégico.", duration: 3, checklist: ["Gerar DRE gerencial", "Gerar fluxo de caixa", "Analisar contas a pagar e receber", "Analisar KPIs", "Analisar orçamento", "Escrever diagnóstico do consultor", "Criar recomendações", "Criar plano de ação"] },
  { key: "plano_acao", name: "Plano de Ação", objective: "Definir ações estratégicas com responsáveis e prazos.", duration: 5, checklist: ["Criar ações no Plano de Ação", "Definir responsáveis", "Definir prazos", "Compartilhar com o cliente"] },
  { key: "acompanhamento_mensal", name: "Acompanhamento Mensal", objective: "Manter rotina mensal de revisão e evolução.", duration: 30, checklist: ["Atualizar dados", "Gerar relatório mensal", "Reunir com cliente", "Revisar indicadores", "Atualizar plano de ação"] },
  { key: "renovacao_encerramento", name: "Renovação ou Encerramento", objective: "Avaliar continuidade ou encerrar contrato.", duration: 5, checklist: ["Reunião de avaliação", "Proposta de renovação", "Encerrar acessos se aplicável"] },
];

export type ProfessionalPhase = {
  key: string;
  name: string;
  objective: string;
  duration: number;
  checklist: string[];
};

const sb = supabase as any;

export type JourneyStage = { v: string; l: string };

export async function loadStagesForConsultant(consultantId: string): Promise<JourneyStage[]> {
  const { data } = await sb
    .from("consultancy_journey_stages")
    .select("stage_key, label, position")
    .eq("consultant_id", consultantId)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (!data || data.length === 0) return [...DEFAULT_JOURNEY_STAGES];
  return data.map((r: any) => ({ v: r.stage_key, l: r.label }));
}

/**
 * Advance the company stage only if the target is further along than the current.
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

/**
 * Aplica um conjunto de fases (template ou padrão profissional) a uma empresa,
 * criando company_journeys, company_journey_phases e checklists vinculados.
 */
export async function applyJourneyToCompany(opts: {
  consultantId: string;
  companyId: string;
  phases: ProfessionalPhase[];
  templateId?: string | null;
  startDate?: string;
  allowClientView?: boolean;
}) {
  const start = opts.startDate ?? new Date().toISOString().slice(0, 10);

  const { data: j, error } = await sb.from("company_journeys").insert({
    consultant_id: opts.consultantId,
    company_id: opts.companyId,
    template_id: opts.templateId ?? null,
    start_date: start,
    status: "em_andamento",
    allow_client_view: opts.allowClientView ?? false,
  }).select("id").single();
  if (error || !j) throw error ?? new Error("Falha ao criar jornada");

  let cursor = new Date(start);
  const phaseRows = opts.phases.map((p, i) => {
    const dueDate = new Date(cursor);
    dueDate.setDate(dueDate.getDate() + (p.duration ?? 7));
    const row = {
      journey_id: j.id,
      phase_order: i,
      phase_key: p.key,
      phase_name: p.name,
      objective: p.objective,
      status: i === 0 ? "em_andamento" : "nao_iniciada",
      start_date: i === 0 ? start : null,
      due_date: dueDate.toISOString().slice(0, 10),
    };
    cursor = dueDate;
    return row;
  });

  const { data: createdPhases, error: pe } = await sb
    .from("company_journey_phases")
    .insert(phaseRows)
    .select("id, phase_key");
  if (pe || !createdPhases) throw pe ?? new Error("Falha ao criar fases");

  const checklistRows: any[] = [];
  for (const phase of opts.phases) {
    const created = createdPhases.find((c: any) => c.phase_key === phase.key);
    if (!created) continue;
    phase.checklist.forEach((title, idx) => {
      checklistRows.push({
        journey_phase_id: created.id,
        title,
        responsible_type: "consultor",
        status: "pendente",
        position: idx,
      });
    });
  }
  if (checklistRows.length > 0) {
    await sb.from("company_journey_checklist").insert(checklistRows);
  }
  return j.id as string;
}
