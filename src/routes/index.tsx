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
      { title: "SISTEMAFP PJ — Gestão financeira para consultorias e PMEs" },
      {
        name: "description",
        content:
          "Fluxo de caixa, contas a pagar e receber, orçamento, relatórios e estoque em um só lugar. Simples, claro e profissional.",
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

function Logo({ className = "h-9" }: { className?: string }) {
  return (
    <div className="flex items-center gap-2">
      <img src={logoAsset.url} alt="SISTEMAFP PJ" className={className} />
    </div>
  );
}

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const features = [
    {
      icon: Wallet,
      title: "Fluxo de caixa",
      desc: "Acompanhe entradas, saídas e o saldo em tempo real. Tenha previsibilidade para tomar melhores decisões.",
    },
    {
      icon: CreditCard,
      title: "Contas a pagar e receber",
      desc: "Organize vencimentos, receba alertas e tenha controle total das suas obrigações e recebimentos.",
    },
    {
      icon: Users,
      title: "Painel do consultor",
      desc: "Visão consolidada de todos os clientes. Mais eficiência no acompanhamento e nas entregas.",
    },
    {
      icon: BarChart3,
      title: "Relatórios e entregáveis",
      desc: "Relatórios completos e personalizáveis para análises, apresentações e prestação de contas.",
    },
  ];

  const benefits = [
    {
      icon: ShieldCheck,
      title: "Organização",
      desc: "Centralize informações e elimine planilhas e retrabalho.",
    },
    {
      icon: Eye,
      title: "Clareza",
      desc: "Tenha dados confiáveis para decisões mais seguras e estratégicas.",
    },
    {
      icon: Zap,
      title: "Agilidade",
      desc: "Automatize rotinas e ganhe tempo para o que realmente importa.",
    },
    {
      icon: TrendingUp,
      title: "Visão gerencial",
      desc: "Indicadores e relatórios que mostram o que está acontecendo no negócio.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* NAV */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled ? "bg-sidebar/95 backdrop-blur shadow-elevated" : "bg-sidebar"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoAsset.url} alt="SISTEMAFP PJ" className="h-9 brightness-0 invert-[.95] saturate-0" />
            <span className="sr-only">SISTEMAFP PJ</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-sidebar-foreground/90 md:flex">
            <a href="#recursos" className="inline-flex items-center gap-1 hover:text-white">
              Recursos <ChevronDown className="h-3.5 w-3.5" />
            </a>
            <a href="#consultores" className="hover:text-white">Para consultores</a>
            <a href="#empresas" className="hover:text-white">Para empresas</a>
            <a href="#precos" className="hover:text-white">Preços</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white hover:text-sidebar"
            >
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
              <Link to="/signup">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <div
          aria-hidden
          className="absolute -right-32 top-1/2 h-[600px] w-[600px] -translate-y-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--success) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">
              Gestão financeira
              <br />
              operacional para
              <br />
              <span className="text-success">consultorias e</span>
              <br />
              <span className="text-success">pequenas empresas</span>
            </h1>
            <p className="mt-6 max-w-lg text-base text-sidebar-foreground/80 md:text-lg">
              Fluxo de caixa, contas a pagar e receber, orçamento, relatórios e
              estoque em um só lugar. Simples, claro e profissional.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 gap-2 bg-success px-6 text-success-foreground hover:bg-success/90"
              >
                <Link to="/signup">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 gap-2 border-white/30 bg-transparent px-6 text-white hover:bg-white hover:text-sidebar"
              >
                <a href="#demo">
                  <PlayCircle className="h-5 w-5" /> Ver demonstração
                </a>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sidebar-foreground/80">
              {["Configuração rápida", "Dados seguros", "Suporte especializado"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Mock dashboard preview */}
          <div className="relative">
            <div className="relative rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/10">
              <div className="overflow-hidden rounded-xl border border-border bg-background">
                {/* mock topbar */}
                <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <img
                      src={logoAsset.url}
                      alt=""
                      className="h-6"
                    />
                  </div>
                  <div className="hidden text-xs text-muted-foreground md:block">
                    Empresa exemplo LTDA
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-0">
                  {/* sidebar */}
                  <div className="col-span-3 border-r border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
                    {[
                      "Visão geral",
                      "Fluxo de caixa",
                      "Contas a pagar",
                      "Contas a receber",
                      "Orçamento",
                      "Estoque",
                      "Relatórios",
                      "Clientes & Fornecedores",
                      "Configurações",
                    ].map((i, idx) => (
                      <div
                        key={i}
                        className={`rounded-md px-2 py-1.5 ${
                          idx === 0 ? "bg-primary/10 text-primary font-medium" : ""
                        }`}
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                  {/* main */}
                  <div className="col-span-9 space-y-3 p-3">
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { l: "Saldo em caixa", v: "R$ 78.540,00", c: "text-foreground" },
                        { l: "Recebimentos (mês)", v: "R$ 125.230,00", c: "text-success" },
                        { l: "Pagamentos (mês)", v: "R$ 64.325,00", c: "text-destructive" },
                        { l: "Resultado (mês)", v: "R$ 60.905,00", c: "text-success" },
                      ].map((k) => (
                        <div key={k.l} className="rounded-lg border border-border bg-card p-2">
                          <div className="text-[10px] text-muted-foreground">{k.l}</div>
                          <div className={`mt-1 text-sm font-semibold ${k.c}`}>{k.v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 rounded-lg border border-border bg-card p-2">
                        <div className="text-[10px] font-medium">Fluxo de caixa</div>
                        <svg viewBox="0 0 200 80" className="mt-1 h-20 w-full">
                          <polyline
                            fill="none"
                            stroke="var(--success)"
                            strokeWidth="2"
                            points="0,60 30,45 60,50 90,30 120,38 150,20 180,25 200,15"
                          />
                          <polyline
                            fill="none"
                            stroke="var(--destructive)"
                            strokeWidth="2"
                            points="0,65 30,60 60,55 90,58 120,50 150,55 180,48 200,52"
                          />
                          <polyline
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth="2"
                            points="0,70 30,65 60,60 90,50 120,45 150,38 180,30 200,22"
                          />
                        </svg>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-2 text-[10px]">
                        <div className="font-medium">Contas a receber</div>
                        <div className="mt-2 flex justify-between"><span>A vencer</span><span>R$ 48.765</span></div>
                        <div className="flex justify-between text-destructive"><span>Vencidas</span><span>R$ 6.220</span></div>
                        <div className="flex justify-between text-success"><span>Recebidas</span><span>R$ 125.230</span></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-border bg-card p-2 text-[10px]">
                        <div className="font-medium">Contas a pagar</div>
                        <div className="mt-2 flex justify-between"><span>A vencer</span><span>R$ 29.460</span></div>
                        <div className="flex justify-between text-destructive"><span>Vencidas</span><span>R$ 3.490</span></div>
                        <div className="flex justify-between"><span>Pagas (mês)</span><span>R$ 64.325</span></div>
                      </div>
                      <div className="rounded-lg border border-border bg-card p-2 text-[10px]">
                        <div className="mb-1 font-medium">Despesas por categoria</div>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-14 w-14 rounded-full"
                            style={{
                              background:
                                "conic-gradient(var(--primary) 0 35%, var(--success) 35% 60%, var(--warning) 60% 80%, var(--destructive) 80% 90%, var(--muted-foreground) 90% 100%)",
                            }}
                          />
                          <ul className="space-y-0.5">
                            <li>● Pessoal 35%</li>
                            <li>● Serviços 25%</li>
                            <li>● Administr. 20%</li>
                            <li>● Impostos 10%</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="recursos" className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:shadow-elevated"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
                <f.icon className="h-6 w-6 text-success" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="bg-secondary/60 py-16">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-center font-display text-2xl font-semibold md:text-3xl">
            Mais organização. Mais controle. Mais crescimento.
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <div key={b.title} className="text-left">
                <b.icon className="h-8 w-8 text-success" />
                <h4 className="mt-3 font-display text-base font-semibold">{b.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="precos" className="bg-sidebar py-16 text-sidebar-foreground">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-white md:text-4xl">
            Pronto para profissionalizar sua gestão financeira?
          </h2>
          <p className="mt-3 max-w-2xl text-sidebar-foreground/80">
            Comece agora e veja em minutos o impacto de ter tudo organizado em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="h-12 gap-2 bg-success px-6 text-success-foreground hover:bg-success/90">
              <Link to="/signup">Criar conta grátis <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/30 bg-transparent px-6 text-white hover:bg-white hover:text-sidebar"
            >
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border bg-card py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <img src={logoAsset.url} alt="SISTEMAFP PJ" className="h-7" />
          </div>
          <div>© {new Date().getFullYear()} SISTEMAFP PJ — Todos os direitos reservados.</div>
        </div>
      </footer>
    </div>
  );
}
