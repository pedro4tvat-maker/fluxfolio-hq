import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Calculator,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  HandCoins,
  LineChart,
  MessageCircle,
  NotebookPen,
  ShoppingCart,
  Sparkles,
  Store,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import logoAsset from "@/assets/sistemafp-icone.png";
import fepLogo from "@/assets/financas-em-proposito.png";

// Contato comercial: todos os botões principais abrem o WhatsApp.
const WHATSAPP = "5577981427618";
const waLink = (msg: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
const MSG_PADRAO = "Olá! Vi o site do SISTEMAFP PJ e quero saber mais sobre o sistema.";

const PRECO = "R$ 89,90";

// Depoimentos autorizados pelos clientes. A seção só aparece quando houver algum.
const DEPOIMENTOS: { nome: string; empresa: string; texto: string }[] = [];

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  head: () => ({
    meta: [
      { title: "SISTEMAFP PJ — Gestão financeira com acompanhamento de consultor" },
      {
        name: "description",
        content:
          "Sistema financeiro para pequenas empresas: caixa, contas, vendas, estoque e relatórios, com análise em linguagem simples e acompanhamento da Finanças em Propósito.",
      },
      { property: "og:title", content: "SISTEMAFP PJ — Gestão financeira com acompanhamento" },
      {
        property: "og:description",
        content: "Organize o financeiro da sua empresa e entenda seus números, com um consultor ao seu lado.",
      },
    ],
  }),
  component: LandingPage,
});

function WhatsButton({ children, msg = MSG_PADRAO, className = "", size = "lg" as const, variant }: {
  children: React.ReactNode; msg?: string; className?: string; size?: "lg" | "default" | "sm"; variant?: "outline";
}) {
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a href={waLink(msg)} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-5" /> {children}
      </a>
    </Button>
  );
}

const FUNCOES = [
  { icon: Wallet, title: "Fluxo de caixa", desc: "Entradas e saídas organizadas por conta e categoria, com saldo do dia." },
  { icon: CreditCard, title: "Contas a pagar e a receber", desc: "Vencimentos, atrasos e clientes devendo, tudo à vista." },
  { icon: ShoppingCart, title: "Vendas", desc: "Registro das vendas à vista e a prazo, por cliente e por produto." },
  { icon: Boxes, title: "Estoque", desc: "Entradas, saídas e alerta de produto zerado ou abaixo do mínimo." },
  { icon: Calculator, title: "Precificação", desc: "Calcule o preço de venda a partir do custo e da margem que você quer." },
  { icon: BarChart3, title: "DRE e relatórios", desc: "Resultado do mês e do ano montados a partir dos seus lançamentos." },
  { icon: Store, title: "Revendedores", desc: "Controle do que está com cada revendedor e do que já foi acertado." },
  { icon: FileText, title: "Importação de extrato", desc: "Traga o extrato do banco (OFX) ou planilhas sem digitar tudo de novo." },
];

const PASSOS = [
  { n: "1", icon: UserCheck, title: "Implantação com o consultor", desc: "Configuramos o sistema do jeito da sua empresa: contas, categorias e produtos." },
  { n: "2", icon: ClipboardList, title: "Você lança no dia a dia", desc: "Vendas, despesas e recebimentos, em poucos cliques, no computador ou no celular." },
  { n: "3", icon: LineChart, title: "Acompanhamento mensal", desc: "Seu consultor analisa os números com você e define os próximos passos." },
];

const FAQ = [
  { q: "Preciso entender de finanças para usar?", a: "Não. O sistema foi pensado para o dono do negócio, e a análise mostra os números em linguagem simples, explicando o que cada um significa para a sua empresa." },
  { q: "Funciona no celular?", a: "Sim. Você acessa pelo navegador do celular ou do computador, e pode instalar como aplicativo na tela inicial." },
  { q: "Meus dados ficam seguros?", a: "Cada empresa só enxerga os próprios dados, e o consultor só acessa as empresas que autorizarem o vínculo. Os dados ficam em servidores profissionais com cópia de segurança." },
  { q: "Para que tipo de empresa ele serve?", a: "Principalmente pequenas empresas que vendem produtos e controlam estoque: comércio, pequena indústria, alimentação, revenda, agro e serviços com venda de produtos." },
  { q: "O sistema emite nota fiscal?", a: "Não. O SISTEMAFP PJ cuida da gestão financeira e dos resultados; a nota fiscal continua no emissor que você já usa." },
  { q: "Como faço para começar?", a: "Chame no WhatsApp. Conversamos sobre a sua empresa, fazemos a implantação e você já começa a usar." },
];

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [faqAberto, setFaqAberto] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* TOPO */}
      <header className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/90 backdrop-blur shadow-sm" : "bg-transparent"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3">
          <Link to="/" className="flex items-center gap-2 min-w-0">
            <img src={logoAsset} alt="" className="h-9 w-auto shrink-0" />
            <span className="font-display font-bold text-lg sm:text-xl truncate">SISTEMAFP PJ</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium lg:flex">
            <a href="#como-funciona" className="hover:text-primary transition-colors">Como funciona</a>
            <a href="#funcoes" className="hover:text-primary transition-colors">O que faz</a>
            <a href="#plano" className="hover:text-primary transition-colors">Plano</a>
            <a href="#duvidas" className="hover:text-primary transition-colors">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button asChild variant="ghost" className="px-2 sm:px-4 text-sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <WhatsButton size="default" className="h-9 px-3 sm:px-4 text-sm">
              <span className="hidden sm:inline">Fale com a gente</span><span className="sm:hidden">Contato</span>
            </WhatsButton>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-14 sm:pt-20 pb-20 sm:pb-28 overflow-hidden">
        <div className="mx-auto max-w-4xl text-center px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide mb-6">
            <Sparkles className="size-4" /> Sistema + acompanhamento de consultor
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-[1.1]">
            Saiba quanto sua empresa <span className="text-primary">realmente ganha</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            O SISTEMAFP PJ organiza caixa, contas, vendas e estoque num só lugar, e um consultor da
            Finanças em Propósito acompanha seus números com você, em linguagem simples.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <WhatsButton className="h-14 px-8 text-lg w-full sm:w-auto">Quero conhecer</WhatsButton>
            <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto">
              <a href="#como-funciona">Como funciona <ArrowRight className="size-5" /></a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">Plano a partir de {PRECO}/mês · Implantação com o consultor</p>
        </div>
      </section>

      {/* PARA QUEM É */}
      <section className="py-16 sm:py-20 bg-muted/30 border-y">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-3xl font-display font-bold mb-4">Feito para o dono de pequena empresa</h2>
            <p className="text-muted-foreground text-lg">
              Se você vende produtos, controla estoque e sente que o dinheiro entra mas não sabe para onde vai,
              o SISTEMAFP PJ foi pensado para você.
            </p>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {["Comércio e lojas", "Pequenas indústrias", "Alimentação e marmitarias", "Torrefações e agro", "Revendas", "Óticas e varejo especializado"].map((t) => (
              <li key={t} className="flex items-center gap-3 bg-card border rounded-2xl px-4 py-3">
                <CheckCircle2 className="size-5 text-primary shrink-0" /> <span className="font-medium">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 sm:py-24 scroll-mt-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-display font-bold text-center mb-3">Como funciona</h2>
          <p className="text-center text-muted-foreground mb-12">Você não fica sozinho com o sistema.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {PASSOS.map((p) => (
              <div key={p.n} className="bg-card p-7 rounded-3xl border shadow-sm relative">
                <div className="absolute -top-4 left-7 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-bold">{p.n}</div>
                <p.icon className="size-7 text-primary mb-4 mt-2" />
                <h3 className="text-lg font-display font-semibold mb-2">{p.title}</h3>
                <p className="text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFERENCIAL: ANÁLISE + CONSULTOR */}
      <section id="diferencial" className="py-20 sm:py-24 bg-primary/5 border-y">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-5">
              O diferencial
            </div>
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6">Números explicados como numa conversa</h2>
            <ul className="space-y-5">
              {[
                { icon: Sparkles, t: "Análise com inteligência artificial", d: "O sistema lê seus números e escreve o que está indo bem, o que merece atenção e o que fazer, sem palavras difíceis." },
                { icon: Users, t: "Empresário e consultor no mesmo lugar", d: "Você lança, o consultor acompanha. Ninguém precisa ficar trocando planilha por e-mail." },
                { icon: NotebookPen, t: "Reuniões registradas em ata", d: "Cada reunião vira uma ata com decisões e plano de ação, para nada se perder." },
              ].map((i) => (
                <li key={i.t} className="flex gap-4">
                  <div className="size-10 rounded-xl bg-primary/15 grid place-items-center shrink-0"><i.icon className="size-5 text-primary" /></div>
                  <div>
                    <h3 className="font-semibold">{i.t}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{i.d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Exemplo ilustrativo da análise (dados fictícios) */}
          <div className="bg-card border rounded-3xl shadow-xl p-5 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-semibold">Análise do mês</div>
              <span className="text-[11px] text-muted-foreground">Exemplo ilustrativo</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[{ l: "Vendas", v: "R$ 42.800" }, { l: "Lucro", v: "R$ 9.150" }, { l: "A receber", v: "R$ 6.300" }].map((k) => (
                <div key={k.l} className="rounded-xl border p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.l}</div>
                  <div className="font-semibold text-sm sm:text-base mt-0.5">{k.v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="font-semibold text-primary flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-primary" />Resumo</div>
                <p className="text-muted-foreground mt-1">
                  A empresa vendeu <strong className="text-foreground">R$ 42.800</strong> e ficou com <strong className="text-foreground">R$ 21 de sobra a cada R$ 100</strong> vendidos.
                </p>
              </div>
              <div>
                <div className="font-semibold text-primary flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-primary" />O que merece atenção</div>
                <p className="text-muted-foreground mt-1">R$ 6.300 de clientes estão com pagamento atrasado (dinheiro vendido que ainda não entrou no caixa).</p>
              </div>
              <div>
                <div className="font-semibold text-primary flex items-center gap-2"><span className="w-1 h-4 rounded-full bg-primary" />Próximo passo</div>
                <p className="text-muted-foreground mt-1">Esta semana: cobrar os três maiores devedores.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FUNÇÕES */}
      <section id="funcoes" className="py-20 sm:py-24 scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h2 className="text-3xl font-display font-bold text-center mb-3">O que o sistema faz</h2>
          <p className="text-center text-muted-foreground mb-12">Tudo o que o financeiro de uma pequena empresa precisa, num só lugar.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FUNCOES.map((f) => (
              <div key={f.title} className="bg-card p-6 rounded-3xl border shadow-sm">
                <div className="size-11 rounded-2xl bg-primary/10 grid place-items-center mb-4">
                  <f.icon className="size-5 text-primary" />
                </div>
                <h3 className="font-display font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEPOIMENTOS (só aparece quando houver depoimentos autorizados) */}
      {DEPOIMENTOS.length > 0 && (
        <section className="py-20 bg-muted/30 border-y">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-3xl font-display font-bold text-center mb-12">Quem usa, recomenda</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {DEPOIMENTOS.map((d) => (
                <figure key={d.nome} className="bg-card border rounded-3xl p-6 shadow-sm">
                  <blockquote className="text-foreground/90">“{d.texto}”</blockquote>
                  <figcaption className="mt-4 text-sm"><strong>{d.nome}</strong> · {d.empresa}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PLANO */}
      <section id="plano" className="py-20 sm:py-24 bg-muted/30 border-y scroll-mt-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-display font-bold text-center mb-12">Um plano, sem surpresa</h2>
          <div className="bg-card border-2 border-primary rounded-3xl shadow-xl p-7 sm:p-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-display font-bold">SISTEMAFP PJ</h3>
                <p className="text-muted-foreground text-sm mt-1">Para pequenas empresas que querem organizar o financeiro.</p>
              </div>
              <div className="sm:text-right">
                <span className="text-sm text-muted-foreground">a partir de</span>
                <div className="text-4xl font-bold text-primary">{PRECO}<span className="text-base font-normal text-muted-foreground">/mês</span></div>
              </div>
            </div>
            <ul className="grid sm:grid-cols-2 gap-3 mb-8">
              {["Caixa, contas a pagar e a receber", "Vendas, estoque e precificação", "DRE e relatórios do mês e do ano", "Análise com IA em linguagem simples", "Implantação com o consultor", "Acesso pelo computador e celular"].map((i) => (
                <li key={i} className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-4 text-primary shrink-0" /> {i}</li>
              ))}
            </ul>
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-sm mb-8 flex gap-3">
              <HandCoins className="size-5 text-primary shrink-0 mt-0.5" />
              <p>Quer reuniões de acompanhamento e plano de ação com o consultor? Chame no WhatsApp para montar o acompanhamento ideal para sua empresa.</p>
            </div>
            <WhatsButton className="w-full h-12 text-base" msg="Olá! Quero contratar o SISTEMAFP PJ. Pode me explicar como funciona a implantação?">
              Quero contratar
            </WhatsButton>
          </div>
        </div>
      </section>

      {/* DÚVIDAS */}
      <section id="duvidas" className="py-20 sm:py-24 scroll-mt-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-3xl font-display font-bold text-center mb-10">Dúvidas frequentes</h2>
          <div className="space-y-3">
            {FAQ.map((f, i) => (
              <div key={f.q} className="bg-card border rounded-2xl">
                <button
                  type="button"
                  onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold"
                  aria-expanded={faqAberto === i}
                >
                  {f.q}
                  <ChevronDown className={`size-5 shrink-0 text-muted-foreground transition-transform ${faqAberto === i ? "rotate-180" : ""}`} />
                </button>
                {faqAberto === i && <p className="px-5 pb-5 -mt-1 text-muted-foreground">{f.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CHAMADA FINAL */}
      <section className="pb-20 sm:pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-[32px] bg-primary text-primary-foreground p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Vamos organizar o financeiro da sua empresa?</h2>
            <p className="opacity-90 mb-8 max-w-xl mx-auto">Conte como é o seu negócio e mostramos o sistema funcionando.</p>
            <Button asChild size="lg" className="h-14 px-8 text-lg bg-white text-primary hover:bg-white/90">
              <a href={waLink(MSG_PADRAO)} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-5" /> Falar no WhatsApp</a>
            </Button>
          </div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="border-t py-10 bg-card">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <img src={fepLogo} alt="Finanças em Propósito" className="h-12 w-auto" />
            <div>
              <div className="font-semibold text-foreground">SISTEMAFP PJ</div>
              <div>Um sistema da Finanças em Propósito</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <a href={waLink(MSG_PADRAO)} target="_blank" rel="noopener noreferrer" className="hover:text-primary">WhatsApp</a>
            <Link to="/login" className="hover:text-primary">Entrar no sistema</Link>
          </div>
          <p>© {new Date().getFullYear()} Finanças em Propósito</p>
        </div>
      </footer>
    </div>
  );
}
