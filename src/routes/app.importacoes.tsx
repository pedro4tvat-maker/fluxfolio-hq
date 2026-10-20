import { createFileRoute, redirect } from "@tanstack/react-router";

// A antiga Central de Importação saiu do sistema; a conciliação de extrato agora fica no Fluxo de caixa.
export const Route = createFileRoute("/app/importacoes")({
  beforeLoad: () => {
    throw redirect({ to: "/app/fluxo-caixa", search: { conciliar: true } });
  },
});
