import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedCompany } from "./use-selected-company";

const KEY = "sfp:selected_branch";
export const ALL_BRANCHES = "__all__";

export type BranchLite = {
  id: string;
  nome: string;
  is_main_branch: boolean;
  ativa: boolean;
};

export function useBranches() {
  const { selected: companyId } = useSelectedCompany();
  const q = useQuery({
    queryKey: ["branches", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<BranchLite[]> => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, nome, is_main_branch, ativa")
        .eq("company_id", companyId!)
        .order("is_main_branch", { ascending: false })
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
  return { branches: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

/**
 * Selected branch filter. Value can be:
 *  - ALL_BRANCHES — consolidated (all units)
 *  - branch id — a specific branch / matriz
 */
export function useSelectedBranch() {
  const { selected: companyId } = useSelectedCompany();
  const { branches } = useBranches();
  const [selected, setSelected] = useState<string>(ALL_BRANCHES);

  useEffect(() => {
    if (!companyId) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(`${KEY}:${companyId}`) : null;
    if (stored && (stored === ALL_BRANCHES || branches.some((b) => b.id === stored))) {
      setSelected(stored);
    } else {
      setSelected(ALL_BRANCHES);
    }
  }, [companyId, branches]);

  const select = (v: string) => {
    setSelected(v);
    if (companyId && typeof window !== "undefined") localStorage.setItem(`${KEY}:${companyId}`, v);
  };

  const isAll = selected === ALL_BRANCHES;
  const branchId = isAll ? null : selected;
  const matriz = branches.find((b) => b.is_main_branch) ?? null;

  return { branches, selected, select, isAll, branchId, matriz };
}
