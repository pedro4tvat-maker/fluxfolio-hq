import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const KEY = "sfp:selected_company";

export type CompanyLite = { id: string; nome: string };

export function useCompanies() {
  return useQuery({
    queryKey: ["companies-lite"],
    queryFn: async (): Promise<CompanyLite[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSelectedCompany() {
  const { data: companies, isLoading } = useCompanies();
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

  return { companies: companies ?? [], selected, select, isLoading };
}
