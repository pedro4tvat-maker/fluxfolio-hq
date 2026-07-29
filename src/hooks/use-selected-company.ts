import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

const KEY = "sfp:selected_company";

export type CompanyLite = { id: string; nome: string };

export function useSelectedCompany() {
  const { user, isConsultant, loading: authLoading } = useAuth();
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["companies-lite", user?.id, isConsultant],
    enabled: !!user && !authLoading,
    queryFn: async (): Promise<CompanyLite[]> => {
      const map = new Map<string, CompanyLite>();

      // Empresas visíveis diretamente (RLS já limita a dono / consultor vinculado)
      const { data: direct, error: directError } = await supabase
        .from("companies")
        .select("id, nome")
        .order("nome");
      if (directError && directError.code !== "42501") throw directError;
      for (const c of direct ?? []) map.set(c.id, c);

      // Empresas em que o usuário é membro
      const { data: memberships } = await supabase
        .from("company_members")
        .select("company_id, companies(id, nome)")
        .eq("user_id", user!.id);
      for (const item of memberships ?? []) {
        if (!map.has(item.company_id)) {
          map.set(item.company_id, {
            id: item.company_id,
            nome: item.companies?.nome ?? item.company_id,
          });
        }
      }

      return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
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
