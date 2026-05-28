import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/centro-custos")({
  component: () => <ComingSoon title="Centro de Custos" desc="Cadastro e movimentação por centro de custo. Em construção." />,
});
