import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/precificacao")({
  component: () => <ComingSoon title="Precificação e Margem" desc="Cálculo de preço sugerido, custo, impostos, taxas e margem. Em construção." />,
});
