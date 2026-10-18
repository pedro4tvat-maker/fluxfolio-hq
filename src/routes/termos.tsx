import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { TERMOS } from "@/lib/legal";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — SISTEMAFP PJ" }] }),
  component: () => <LegalPage titulo="Termos de Uso" secoes={TERMOS} />,
});
