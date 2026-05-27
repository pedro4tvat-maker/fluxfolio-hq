import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/contas-pagar")({ component: () => <ComingSoon title="Contas a pagar" desc="Obrigações futuras e vencidas. Ao marcar como paga, gera lançamento automático no fluxo de caixa." /> });
