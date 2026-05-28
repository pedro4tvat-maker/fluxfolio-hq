import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/vendas")({
  component: () => <ComingSoon title="Fluxo de Vendas" desc="Registro de vendas com integração ao fluxo de caixa, contas a receber e estoque. Em construção." />,
});
