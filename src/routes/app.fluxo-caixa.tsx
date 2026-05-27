import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/fluxo-caixa")({ component: () => <ComingSoon title="Fluxo de caixa" desc="Lançamentos de entradas e saídas." /> });
