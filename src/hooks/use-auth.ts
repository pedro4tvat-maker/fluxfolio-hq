import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "consultant" | "client_manager" | "operator";

export interface AppAuth {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isConsultant: boolean;
}

const ROLE_SLUGS = ["consultant", "client_manager", "operator"] as const;

type RoleSlug = (typeof ROLE_SLUGS)[number];

function getMetadataRoles(user: User | null): AppRole[] {
  if (!user) return [];
  const roleData = (user.user_metadata as any)?.role;
  if (typeof roleData === "string" && ROLE_SLUGS.includes(roleData as RoleSlug)) {
    return [roleData as AppRole];
  }
  return [];
}

export function useAuth(): AppAuth {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (user: User | null) => {
      if (!user) {
        if (mounted) setRoles([]);
        return;
      }

      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const mapped = (data ?? []).map((r) => r.role as AppRole);

      if (mounted) {
        if (mapped.length > 0) {
          setRoles(mapped);
        } else {
          setRoles(getMetadataRoles(user));
        }
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(async () => {
        await loadRoles(s?.user ?? null);
        if (mounted) setLoading(false);
      }, 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadRoles(data.session?.user ?? null).finally(() => mounted && setLoading(false));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    loading,
    session,
    user: session?.user ?? null,
    roles,
    isConsultant: roles.includes("consultant"),
  };
}
