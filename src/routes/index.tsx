import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  PlayCircle,
  CheckCircle2,
  Wallet,
  CreditCard,
  Users,
  BarChart3,
  ShieldCheck,
  Eye,
  Zap,
  TrendingUp,
  ChevronDown,
  Building2,
  FileText,
  BadgeCheck,
} from "lucide-react";
import logoAsset from "@/assets/sistemafp-logo.png.asset.json";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "SISTEMAFP PJ — Gestão financeira profissional para consultorias e PMEs" },
      {
        name: "description",
        content:
          "Plataforma completa de gestão financeira: fluxo de caixa, DRE automatizado, contas a pagar/receber e indicadores de performance.",
      },
      { property: "og:title", content: "SISTEMAFP PJ — Gestão financeira" },
      {
        property: "og:description",
        content:
          "Plataforma de gestão financeira operacional para consultorias e pequenas empresas.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? "bg-background/90 backdrop-blur shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="SISTEMAFP PJ" className="h-9 w-auto" />
            <span className="font-display font-bold text-xl">SISTEMAFP PJ</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium lg:flex">
            <a href="#funcionalidades" className="hover:text-primary transition-colors">Funcionalidades</a>
            <a href="#diferenciais" className="hover:text-primary transition-colors">Diferenciais</a>
            <a href="#precos" className="hover:text-primary transition-colors">Planos</a>
            <div className="w-px h-4 bg-border mx-2" />
            <Link to="/login" className="text-primary font-semibold hover:underline flex items-center gap-1">
              <Users className="size-4" /> Área do Consultor
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground">
              <Link to="/signup">Criar conta grátis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="mx-auto max-w-5xl text-center px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide mb-6">
            <BadgeCheck className="size-4" /> Gestão Financeira Inteligente
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Controle financeiro total <br/>
            para <span className="text-primary">sua consultoria</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Chega de planilhas dispersas. Centralize seu fluxo de caixa, contas a pagar, receber, indicadores e relatórios de performance em uma única plataforma profissional.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-lg">
              <Link to="/signup">Começar agora <ArrowRight className="size-5 ml-2" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FUNCIONALIDADES */}
      <section id="funcionalidades" className="py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-display font-bold text-center mb-16">Tudo o que sua empresa precisa</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Wallet, title: "Fluxo de Caixa", desc: "Visão consolidada em tempo real de todas as contas e movimentações." },
              { icon: CreditCard, title: "Contas a Pagar/Receber", desc: "Gestão inteligente de prazos, cobranças e obrigações financeiras." },
              { icon: BarChart3, title: "Relatórios DRE", desc: "Análise de resultado automático, sem erros de digitação." },
              { icon: Users, title: "Painel do Consultor", desc: "Gerencie múltiplos clientes de forma centralizada e profissional." },
              { icon: ShieldCheck, title: "Segurança total", desc: "Seus dados financeiros protegidos com tecnologia de ponta." },
              { icon: Zap, title: "Automação", desc: "Reduza o trabalho manual e foque no crescimento do negócio." },
            ].map((f) => (
              <div key={f.title} className="bg-card p-8 rounded-3xl border border-border shadow-sm">
                <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <f.icon className="size-6 text-primary" />
                </div>
                <h3 className="text-xl font-display font-semibold mb-3">{f.title}</h3>
                <p className="text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIAIS */}
      <section id="diferenciais" className="py-24">
        <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-display font-bold mb-8">Por que escolher o SISTEMAFP PJ?</h2>
            <ul className="space-y-6">
              {[
                { title: "Foco no Consultor", desc: "Ferramentas desenhadas especificamente para quem presta consultoria financeira." },
                { title: "Projeções Precisas", desc: "Tome decisões baseadas em dados, não em suposições." },
                { title: "Integração Total", desc: "Conecte financeiro, estoque, precificação e orçamentos." },
              ].map((item) => (
                <li key={item.title} className="flex gap-4">
                  <div className="size-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-5 text-success" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-card border p-8 rounded-3xl shadow-2xl">
            <div className="aspect-video bg-muted rounded-xl flex items-center justify-center text-muted-foreground border border-dashed">
              Dashboard Demo Preview
            </div>
          </div>
        </div>
      </section>

      {/* PARA CONSULTORES SECTION */}
      <section id="consultores" className="py-24 border-t">
        <div className="mx-auto max-w-7xl px-6">
          <div className="bg-primary/5 rounded-[40px] p-8 md:p-16 flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6 text-center lg:text-left">
              <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                Exclusivo para Consultores
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold">
                Escale seu negócio de <span className="text-primary">consultoria financeira</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Tenha um painel centralizado para acompanhar todos os seus clientes, gerenciar atas de reunião, diagnósticos e entregas automáticas de relatórios.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <Button asChild size="lg" className="h-12 px-6">
                  <Link to="/signup">Quero ser um consultor parceiro</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-6">
                  <Link to="/login">Acessar Painel do Consultor</Link>
                </Button>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { icon: Users, label: "Multi-clientes", desc: "Gestão centralizada" },
                { icon: NotebookPen, label: "Atas Inteligentes", desc: "Com suporte de IA" },
                { icon: BadgeCheck, label: "Diagnósticos", desc: "Padronizados e rápidos" },
                { icon: FileText, label: "Relatórios", desc: "Prontos em segundos" },
              ].map((item) => (
                <div key={item.label} className="bg-card p-6 rounded-3xl border border-border shadow-sm">
                  <item.icon className="size-6 text-primary mb-3" />
                  <div className="font-bold text-sm">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-12 bg-card">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SISTEMAFP PJ. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
