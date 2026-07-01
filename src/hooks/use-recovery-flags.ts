import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "./use-selected-company";

/**
 * Retorna sinalizações que indicam se as telas de recuperação
 * (Reconstrução de Vendas / Correção de OS) fazem sentido para
 * a empresa atualmente selecionada. Usuários que nunca tiveram
 * problemas de dados não devem ver essas páginas.
 */
export function useRecoveryFlags() {
  const { selected } = useSelectedCompany();

  const { data } = useQuery({
    queryKey: ["recovery-flags", selected],
    enabled: !!selected,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const companyId = selected!;
      const [txPend, recPend, recovery, renumber, needsReview] = await Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true })
          .eq("company_id", companyId).eq("status", "pendente_revisao_manual").is("deleted_at", null),
        supabase.from("receivables").select("id", { count: "exact", head: true })
          .eq("company_id", companyId).eq("status", "pendente_revisao_manual").is("deleted_at", null),
        supabase.from("sales_recovery_log").select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase.from("os_renumbering_log").select("id", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase.from("sale_items").select("id", { count: "exact", head: true })
          .eq("company_id", companyId).eq("needs_review", true),
      ]);

      const pendingReconstruction =
        (txPend.count ?? 0) + (recPend.count ?? 0) + (recovery.count ?? 0) + (needsReview.count ?? 0);
      const pendingOsFix = renumber.count ?? 0;

      return {
        showReconstrucao: pendingReconstruction > 0,
        showCorrecaoOs: pendingOsFix > 0 || pendingReconstruction > 0,
      };
    },
  });

  return {
    showReconstrucao: !!data?.showReconstrucao,
    showCorrecaoOs: !!data?.showCorrecaoOs,
  };
}
