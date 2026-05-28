import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const KEY = "sfp:selected_company";

export type CompanyLite = { id: string; nome: string };

export function useSelectedCompany() {
  const { user, loading: authLoading } = useAuth();
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["companies-lite", user?.id],
    enabled: !!user && !authLoading,
    queryFn: async (): Promise<CompanyLite[]> => {
      const { data, error } = await supabase
        .from("company_members")
        .select("company_id, companies(id, nome)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((item) => ({
        id: item.company_id,
        nome: item.companies?.nome ?? item.company_id,
      }));
    },
  });

  const [selected, setSelected] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(KEY);
  });

  useEffect(() => {
    if (!companies || companies.length === 0) return;
    if (!selected || !companies.find((c) => c.id === selected)) {
      const fallback = companies[0].id;
      setSelected(fallback);
      localStorage.setItem(KEY, fallback);
    }
  }, [companies, selected]);

  const select = (id: string) => {
    setSelected(id);
    localStorage.setItem(KEY, id);
  };

  return {
    companies: companies ?? [],
    selected,
    select,
    isLoading: companiesLoading || authLoading,
  };
}
