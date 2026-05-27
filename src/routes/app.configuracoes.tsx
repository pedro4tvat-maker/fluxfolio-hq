import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/app/configuracoes")({ component: () => <ComingSoon title="Configurações" desc="Dados da empresa, categorias, centros de custo, contas financeiras, usuários e permissões." /> });
