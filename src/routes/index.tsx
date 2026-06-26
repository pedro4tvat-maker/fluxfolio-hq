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
  NotebookPen,
  ArrowUpCircle,
  ArrowDownCircle,
  Layers,
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
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="ghost" className="px-2 sm:px-4 text-sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-primary text-primary-foreground text-sm h-9 px-3 sm:h-10 sm:px-4">
              <Link to="/signup">Começar agora</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="mx-auto max-w-5xl text-center px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide mb-6">
            <BadgeCheck className="size-4" /> Gestão Financeira para Pequenas Empresas
          </div>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Controle financeiro total <br/>
            para <span className="text-primary">sua empresa</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Chega de planilhas dispersas. Centralize seu fluxo de caixa, contas a pagar, receber, indicadores e relatórios de performance em uma única plataforma profissional.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button asChild size="lg" className="h-14 px-8 text-lg">
              <Link to="/signup">Experimentar Grátis <ArrowRight className="size-5 ml-2" /></Link>
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
              { icon: Layers, title: "Centros de Custo", desc: "Classifique suas despesas e entenda para onde o dinheiro está indo." },
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
                { title: "Simplicidade", desc: "Interface intuitiva focada no empresário e no consultor." },
                { title: "Projeções Precisas", desc: "Tome decisões baseadas em dados, não em suposições." },
                { title: "Gestão Integrada", desc: "Contas, estoque, precificação e orçamentos em um só lugar." },
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
          <div className="bg-card border p-4 md:p-8 rounded-3xl shadow-2xl relative">
            <div className="aspect-video bg-muted rounded-xl flex flex-col overflow-hidden border shadow-inner">
              {/* Mock Dashboard UI */}
              <div className="h-8 bg-card border-b flex items-center px-3 gap-2 shrink-0">
                <div className="flex gap-1.5">
                  <div className="size-2 rounded-full bg-destructive/20" />
                  <div className="size-2 rounded-full bg-warning/20" />
                  <div className="size-2 rounded-full bg-success/20" />
                </div>
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </div>
              <div className="flex-1 flex gap-0">
                <div className="w-16 border-r bg-muted/30 p-2 space-y-2 shrink-0">
                  <div className="h-2 w-full bg-muted rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                  <div className="h-2 w-full bg-muted rounded" />
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-hidden">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 bg-card border rounded-lg p-2 space-y-2">
                      <div className="h-2 w-1/2 bg-muted rounded" />
                      <div className="h-4 w-3/4 bg-success/10 rounded" />
                    </div>
                    <div className="h-16 bg-card border rounded-lg p-2 space-y-2">
                      <div className="h-2 w-1/2 bg-muted rounded" />
                      <div className="h-4 w-3/4 bg-destructive/10 rounded" />
                    </div>
                    <div className="h-16 bg-card border rounded-lg p-2 space-y-2">
                      <div className="h-2 w-1/2 bg-muted rounded" />
                      <div className="h-4 w-3/4 bg-primary/10 rounded" />
                    </div>
                  </div>
                  <div className="h-32 bg-card border rounded-lg p-3 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-end px-3 pb-3 gap-1">
                      {[40, 70, 45, 90, 65, 80, 55, 95, 75, 85].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary/20 rounded-t" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PARA EMPRESAS SECTION */}
      <section id="empresas" className="py-24 border-t">
        <div className="mx-auto max-w-7xl px-6">
          <div className="bg-primary/5 rounded-[40px] p-8 md:p-16 flex flex-col lg:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6 text-center lg:text-left">
              <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                Solução para sua Empresa
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-bold">
                A gestão que sua <span className="text-primary">empresa merece</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Elimine o retrabalho e tenha visibilidade total do seu negócio. O SISTEMAFP PJ foi criado para que você gaste menos tempo com burocracia e mais tempo crescendo.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                <Button asChild size="lg" className="h-12 px-6">
                  <Link to="/signup">Começar agora gratuitamente</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-12 px-6">
                  <Link to="/login">Fazer Login</Link>
                </Button>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-2 gap-4">
              {[
                { icon: Wallet, label: "Fluxo de Caixa", desc: "Controle diário" },
                { icon: CreditCard, label: "Contas", desc: "Pagar e Receber" },
                { icon: BarChart3, label: "Relatórios", desc: "DRE Automático" },
                { icon: ShieldCheck, label: "Segurança", desc: "Dados protegidos" },
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

      {/* PRECOS SECTION */}
      <section id="precos" className="py-24 bg-muted/30">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-display font-bold text-center mb-16">Planos que cabem no seu negócio</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { title: "Empresa", price: "R$ 97", desc: "Para pequenos negócios que buscam organização.", items: ["Fluxo de Caixa", "Contas a Pagar/Receber", "Relatórios Financeiros", "1 Usuário"], featured: true },
              { title: "Consultor", price: "Sob consulta", desc: "Para consultores que gerenciam múltiplos clientes.", items: ["Painel do Consultor", "Atas de Reunião", "Gestão de Clientes", "Multi-empresas", "Relatórios consolidados"] },
              { title: "Enterprise", price: "Sob consulta", desc: "Para redes de franquias ou grandes empresas.", items: ["Customização total", "API de Integração", "Suporte 24/7", "Treinamento exclusivo"] },
            ].map((p) => (
              <div key={p.title} className={`p-8 rounded-3xl border ${p.featured ? "bg-primary text-primary-foreground scale-105 shadow-xl border-primary" : "bg-card border-border shadow-sm"}`}>
                <h3 className="text-xl font-bold mb-2">{p.title}</h3>
                <div className="text-3xl font-bold mb-4">{p.price}<span className="text-sm font-normal opacity-70">{p.price.includes("R$") ? "/mês" : ""}</span></div>
                <p className={`text-sm mb-6 ${p.featured ? "opacity-90" : "text-muted-foreground"}`}>{p.desc}</p>
                <ul className="space-y-3 mb-8">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`size-4 ${p.featured ? "text-primary-foreground" : "text-success"}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className={`w-full ${p.featured ? "bg-white text-primary hover:bg-white/90" : ""}`}>
                  <Link to="/signup">Começar agora</Link>
                </Button>
              </div>
            ))}
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
