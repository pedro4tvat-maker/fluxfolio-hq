import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/estoque")({ component: () => <ComingSoon title="Estoque" desc="Controle básico de produtos, entradas e saídas com alertas de estoque mínimo." /> });
