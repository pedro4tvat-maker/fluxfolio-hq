import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { PRIVACIDADE } from "@/lib/legal";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — SISTEMAFP PJ" }] }),
  component: () => <LegalPage titulo="Política de Privacidade" secoes={PRIVACIDADE} />,
});
