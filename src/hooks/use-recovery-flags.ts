import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "./use-selected-company";

export type RecoveryToolsMode = "auto" | "show" | "hide";

const MODE_KEY = (companyId: string) => `sfp:recovery_tools:${companyId}`;
const MODE_EVENT = "sfp:recovery_tools_changed";

export function getRecoveryToolsMode(companyId: string | null): RecoveryToolsMode {
  if (typeof window === "undefined" || !companyId) return "auto";
  const v = localStorage.getItem(MODE_KEY(companyId));
  return v === "show" || v === "hide" ? v : "auto";
}

export function setRecoveryToolsMode(companyId: string, mode: RecoveryToolsMode) {
  localStorage.setItem(MODE_KEY(companyId), mode);
  window.dispatchEvent(new CustomEvent(MODE_EVENT));
}

/**
 * Retorna sinalizações que indicam se as telas de recuperação
 * (Reconstrução de Vendas / Correção de OS) devem aparecer.
 * Modo híbrido: detecção automática de pendências + preferência
 * manual por empresa (auto / sempre visível / sempre oculto).
 */
export function useRecoveryFlags() {
  const { selected } = useSelectedCompany();

  const [mode, setModeState] = useState<RecoveryToolsMode>(() => getRecoveryToolsMode(selected));

  useEffect(() => {
    setModeState(getRecoveryToolsMode(selected));
    const sync = () => setModeState(getRecoveryToolsMode(selected));
    window.addEventListener(MODE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(MODE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [selected]);

  const { data } = useQuery({
    queryKey: ["recovery-flags", selected],
    enabled: !!selected,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const companyId = selected!;
      const [txPend, recPend, recovery, renumber, needsReview] = await Promise.all([
        (supabase.from("transactions") as any).select("id", { count: "exact", head: true })
          .eq("company_id", companyId).eq("status", "pendente_revisao_manual").is("deleted_at", null),
        (supabase.from("receivables") as any).select("id", { count: "exact", head: true })
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
        pendingReconstruction,
        pendingOsFix,
        autoReconstrucao: pendingReconstruction > 0,
        autoCorrecaoOs: pendingOsFix > 0 || pendingReconstruction > 0,
      };
    },
  });

  const autoReconstrucao = !!data?.autoReconstrucao;
  const autoCorrecaoOs = !!data?.autoCorrecaoOs;
  const pendingCount = (data?.pendingReconstruction ?? 0) + (data?.pendingOsFix ?? 0);

  const apply = (auto: boolean) => (mode === "show" ? true : mode === "hide" ? false : auto);

  return {
    showReconstrucao: apply(autoReconstrucao),
    showCorrecaoOs: apply(autoCorrecaoOs),
    mode,
    setMode: (m: RecoveryToolsMode) => {
      if (!selected) return;
      setRecoveryToolsMode(selected, m);
      setModeState(m);
    },
    hasPending: pendingCount > 0,
    pendingCount,
    pendingReconstruction: data?.pendingReconstruction ?? 0,
    pendingOsFix: data?.pendingOsFix ?? 0,
  };
}
