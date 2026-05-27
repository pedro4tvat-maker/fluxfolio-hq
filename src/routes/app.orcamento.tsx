import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/orcamento")({ component: () => <ComingSoon title="Orçamento" desc="Limites mensais por categoria com acompanhamento de orçado × realizado." /> });
