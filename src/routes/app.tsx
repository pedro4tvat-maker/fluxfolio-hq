import { cn } from "@/lib/utils";
import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, ArrowLeftRight, ArrowDownCircle, ArrowUpCircle,
  Target, Package, FileBarChart, Settings, LogOut, Menu, Building2,
  Layers, ShoppingCart, Tag, Upload, BadgeCheck, Copy, Users, FolderArchive,
  ChevronDown, ChevronRight, CalendarDays, Inbox, Route as RouteIcon, NotebookPen, BookOpen,
  Wheat, Wrench,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useRecoveryFlags } from "@/hooks/use-recovery-flags";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CONSULTORIA_SECTIONS } from "@/routes/app.consultoria";
import { AGENDA_SECTIONS } from "@/routes/app.agenda";
import fepLogo from "@/assets/financas-em-proposito.png.asset.json";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };
type NavGroup = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; children: NavItem[] };
type NavEntry = NavItem | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

const consultantNav: NavEntry[] = [
  { to: "/app", label: "Painel do consultor", icon: LayoutDashboard, exact: true },
  { to: "/app/clientes", label: "Empresas / Clientes", icon: Building2 },
  { to: "/app/diagnostico", label: "Diagnóstico Financeiro", icon: BadgeCheck },
  { to: "/app/executivo", label: "Análise Gerencial", icon: FileBarChart },
  { to: "/app/historicos", label: "Dados Históricos", icon: NotebookPen },

  { to: "/app/consultoria", label: "Minha Consultoria", icon: BadgeCheck },
  { to: "/app/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/app/jornada", label: "Jornada da Consultoria", icon: RouteIcon },
  { to: "/app/atas", label: "Atas de Reunião", icon: NotebookPen },
  { to: "/app/biblioteca", label: "Biblioteca do Consultor", icon: BookOpen },
  { to: "/app/relatorios", label: "Relatórios consolidados", icon: FileBarChart },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

const clientNav: NavEntry[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  {
    id: "fluxo",
    label: "Fluxo",
    icon: ArrowLeftRight,
    children: [
      { to: "/app/fluxo-caixa", label: "Fluxo de Caixa", icon: ArrowLeftRight },
      { to: "/app/vendas", label: "Fluxo de Vendas", icon: ShoppingCart },
      { to: "/app/estoque", label: "Fluxo de Estoque", icon: Package },
      { to: "/app/revendedores", label: "Revendedores", icon: ShoppingCart },
      { to: "/app/reconstrucao-vendas", label: "Reconstrução de Vendas", icon: Wrench },
      { to: "/app/correcao-os", label: "Correção de Centro de Estoque das OSs", icon: Wrench },
    ],
  },
  {
    id: "gerenciamento",
    label: "Gerenciamento",
    icon: Tag,
    children: [
      { to: "/app/executivo", label: "Análise Gerencial", icon: FileBarChart },
      { to: "/app/historicos", label: "Dados Históricos", icon: NotebookPen },

      { to: "/app/precificacao", label: "Precificação e Margem", icon: Tag },
      { to: "/app/relatorios", label: "Relatórios", icon: FileBarChart },
      { to: "/app/documentos", label: "Documentos e Anexos", icon: FolderArchive },
      { to: "/app/centro-custos", label: "Centro de Custos", icon: Layers },
    ],
  },
  {
    id: "organizacao",
    label: "Organização",
    icon: Inbox,
    children: [
      { to: "/app/contas-pagar", label: "Contas a Pagar", icon: ArrowUpCircle },
      { to: "/app/contas-receber", label: "Contas a Receber", icon: ArrowDownCircle },
      { to: "/app/orcamento", label: "Orçamento", icon: Target },
    ],
  },
  { to: "/app/importacoes", label: "Importador de Dados", icon: Upload },
  { to: "/app/crm", label: "CRM", icon: Users },
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

  const { showReconstrucao, showCorrecaoOs } = useRecoveryFlags();

  const nav = useMemo<NavEntry[]>(() => {
    if (isConsultant) return consultantNav;
    return clientNav.map((entry) => {
      if (!isGroup(entry) || entry.id !== "fluxo") return entry;
      return {
        ...entry,
        children: entry.children.filter((c) => {
          if (c.to === "/app/reconstrucao-vendas") return showReconstrucao;
          if (c.to === "/app/correcao-os") return showCorrecaoOs;
          return true;
        }),
      };
    });
  }, [isConsultant, showReconstrucao, showCorrecaoOs]);

  const [groupsOpen, setGroupsOpen] = useState<Record<string, boolean>>({
    fluxo: true,
    gerenciamento: true,
    organizacao: true,
  });
  const toggleGroup = (id: string) => setGroupsOpen((s) => ({ ...s, [id]: !s[id] }));

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
          className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}
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
                  className={cn("block px-3 py-1.5 rounded-md text-[13px] transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}
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

  const renderLeaf = (n: NavItem) => {
    const active = n.exact ? path === n.to : path.startsWith(n.to);
    if (n.to === "/app/consultoria") {
      return renderSubmenu(n, CONSULTORIA_SECTIONS, consultoriaOpen, () => setConsultoriaOpen((v) => !v), "dashboard");
    }
    if (n.to === "/app/agenda") {
      return renderSubmenu(n, AGENDA_SECTIONS, agendaOpen, () => setAgendaOpen((v) => !v), "calendario");
    }
    return (
      <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
        <n.icon className="size-4" />
        {n.label}
      </Link>
    );
  };

  const renderGroup = (g: NavGroup) => {
    const isOpen = groupsOpen[g.id] ?? true;
    const groupActive = g.children.some((c) => path.startsWith(c.to));
    return (
      <div key={g.id}>
        <button
          type="button"
          onClick={() => toggleGroup(g.id)}
          className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors", groupActive ? "text-sidebar-foreground" : "text-sidebar-foreground/60 hover:text-sidebar-foreground")}
        >
          <g.icon className="size-4" />
          <span className="flex-1 text-left">{g.label}</span>
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </button>
        {isOpen && (
          <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-0.5">
            {g.children.map((c) => renderLeaf(c))}
          </div>
        )}
      </div>
    );
  };

  const renderEntry = (e: NavEntry) => (isGroup(e) ? renderGroup(e) : renderLeaf(e));

  return (
    <div className="min-h-screen flex bg-background">
      <div
        className={cn(
          "fixed inset-0 z-50 flex pointer-events-none transition-all duration-300 ease-out",
          open && "pointer-events-auto"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out",
            open ? "opacity-100 pointer-events-auto" : "opacity-0"
          )}
          onClick={() => setOpen(false)}
        />
        <aside
          className={cn(
            "relative w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-out",
            open ? "translate-x-0 pointer-events-auto" : "-translate-x-full"
          )}
        >
          <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
            <div className="size-9 rounded-xl bg-sidebar-primary grid place-items-center text-sidebar-primary-foreground shrink-0 overflow-hidden">
              <img src={fepLogo.url} alt="Finanças em Propósito" className="size-7 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold truncate leading-tight">SISTEMAFP PJ</div>
              <div className="text-[11px] text-sidebar-foreground/60">{isConsultant ? "Painel do consultor" : "Gestão da empresa"}</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 -mr-1 rounded hover:bg-sidebar-accent/50" aria-label="Fechar menu">
              <Menu className="size-4" />
            </button>
          </div>
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {nav.map((n) => renderEntry(n))}
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
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center px-4 gap-3 bg-primary text-primary-foreground shadow-sm">
          <button onClick={() => setOpen(true)} className="p-2 -ml-2 rounded hover:bg-white/10" aria-label="Abrir menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold tracking-tight">SISTEMAFP PJ</span>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
