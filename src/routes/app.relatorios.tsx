import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/relatorios")({ component: () => <ComingSoon title="Relatórios" desc="Relatórios mensais, fluxo de caixa, contas, orçamento e estoque com exportação CSV/PDF." /> });
