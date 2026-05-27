import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/contas-receber")({ component: () => <ComingSoon title="Contas a receber" desc="Valores a receber. Ao marcar como recebido, gera entrada automática no fluxo de caixa." /> });
