import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Wallet, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle,
  Target, Package, FileBarChart, Settings, LogOut, Menu, Building2,
  Layers, ShoppingCart, Tag, Gauge, Upload, BadgeCheck, Copy, Users, FolderArchive,
  ChevronDown, ChevronRight, CalendarDays, Inbox, Route as RouteIcon, NotebookPen,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CONSULTORIA_SECTIONS } from "@/routes/app.consultoria";
import { AGENDA_SECTIONS } from "@/routes/app.agenda";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

const consultantNav: NavItem[] = [
  { to: "/app", label: "Painel do consultor", icon: LayoutDashboard, exact: true },
  { to: "/app/clientes", label: "Empresas / Clientes", icon: Building2 },
  { to: "/app/consultoria", label: "Minha Consultoria", icon: BadgeCheck },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/app/pendencias", label: "Central de Pendências", icon: Inbox },
  { to: "/app/jornada", label: "Jornada da Consultoria", icon: RouteIcon },
  { to: "/app/atas", label: "Atas de Reunião", icon: NotebookPen },
  { to: "/app/biblioteca", label: "Biblioteca do Consultor", icon: BookOpen },
  { to: "/app/relatorios", label: "Relatórios consolidados", icon: FileBarChart },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

const clientNav: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/pendencias", label: "Minhas Pendências", icon: Inbox },
  { to: "/app/fluxo-caixa", label: "Fluxo de Caixa", icon: ArrowLeftRight },
  { to: "/app/contas-pagar", label: "Contas a Pagar", icon: ArrowUpCircle },
  { to: "/app/contas-receber", label: "Contas a Receber", icon: ArrowDownCircle },
  { to: "/app/orcamento", label: "Orçamento", icon: Target },
  { to: "/app/centro-custos", label: "Centro de Custos", icon: Layers },
  { to: "/app/vendas", label: "Fluxo de Vendas", icon: ShoppingCart },
  { to: "/app/crm", label: "CRM", icon: Users },
  { to: "/app/estoque", label: "Controle de Estoque", icon: Package },
  { to: "/app/precificacao", label: "Precificação e Margem", icon: Tag },
  { to: "/app/kpis", label: "KPIs", icon: Gauge },
  { to: "/app/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/app/importacoes", label: "Importador de Dados", icon: Upload },
  { to: "/app/documentos", label: "Documentos e Anexos", icon: FolderArchive },
  { to: "/app/configuracoes", label: "Configurações da Empresa", icon: Settings },
];

function AppLayout() {

  const navigate = useNavigate();
  const { user, isConsultant, loading } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search as { section?: string } });
  const [open, setOpen] = useState(false);
  const [consultoriaOpen, setConsultoriaOpen] = useState(path.startsWith("/app/consultoria"));
  const [agendaOpen, setAgendaOpen] = useState(path.startsWith("/app/agenda"));

  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => { if (path.startsWith("/app/consultoria")) setConsultoriaOpen(true); }, [path]);
  useEffect(() => { if (path.startsWith("/app/agenda")) setAgendaOpen(true); }, [path]);

  const nav = useMemo<NavItem[]>(() => (isConsultant ? consultantNav : clientNav), [isConsultant]);

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("sfp:selected_company");
    toast.success("Sessão encerrada");
    navigate({ to: "/login", replace: true });
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando...</div>;
  }

  const renderSubmenu = (n: NavItem, sections: ReadonlyArray<{ id: string; label: string }>, isOpen: boolean, toggle: () => void, defaultSection: string) => {
    const active = path.startsWith(n.to);
    const currentSection = active ? (search.section ?? defaultSection) : null;
    return (
      <div key={n.to}>
        <button
          type="button"
          onClick={toggle}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
        >
          <n.icon className="size-4" />
          <span className="flex-1 text-left">{n.label}</span>
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {isOpen && (
          <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
            {sections.map((s) => {
              const isActive = currentSection === s.id;
              return (
                <Link
                  key={s.id}
                  to={n.to}
                  search={{ section: s.id }}
                  className={`block px-3 py-1.5 rounded-md text-[13px] transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}
                >
                  {s.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderNavItem = (n: NavItem) => {
    const active = n.exact ? path === n.to : path.startsWith(n.to);
    if (n.to === "/app/consultoria") {
      return renderSubmenu(n, CONSULTORIA_SECTIONS, consultoriaOpen, () => setConsultoriaOpen((v) => !v), "dashboard");
    }
    if (n.to === "/app/agenda") {
      return renderSubmenu(n, AGENDA_SECTIONS, agendaOpen, () => setAgendaOpen((v) => !v), "lista");
    }
    return (
      <Link key={n.to} to={n.to} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}`}>
        <n.icon className="size-4" />
        {n.label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="size-9 rounded-xl bg-sidebar-primary grid place-items-center text-sidebar-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <div>
            <div className="font-display font-semibold leading-tight">SISTEMAFP PJ</div>
            <div className="text-[11px] text-sidebar-foreground/60">{isConsultant ? "Painel do consultor" : "Gestão da empresa"}</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((n) => renderNavItem(n))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
            <span className="ml-2 px-1.5 py-0.5 rounded bg-sidebar-primary/20 text-sidebar-primary text-[10px] font-medium">
              {isConsultant ? "CONSULTOR" : "CLIENTE"}
            </span>
          </div>
          <Button onClick={logout} variant="ghost" className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative w-64 bg-sidebar text-sidebar-foreground flex flex-col">
            <div className="p-5 border-b border-sidebar-border font-display font-semibold">SISTEMAFP PJ</div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {nav.map((n) => renderNavItem(n))}
            </nav>
            <div className="p-3 border-t border-sidebar-border">
              <Button onClick={logout} variant="ghost" className="w-full justify-start"><LogOut className="size-4" /> Sair</Button>
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 border-b flex items-center px-4 gap-3 bg-card">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2"><Menu className="size-5" /></button>
          <span className="font-display font-semibold">SISTEMAFP PJ</span>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
