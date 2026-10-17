import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, ArrowUpRight, MessageCircle, Plus } from "lucide-react";
import logoAsset from "@/assets/sistemafp-icone.png";
import fepLogo from "@/assets/financas-em-proposito.png";

// Contato comercial: todos os botões principais abrem o WhatsApp.
const WHATSAPP = "5577981427618";
const waLink = (msg: string) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
const MSG_PADRAO = "Olá! Vi o site do SISTEMAFP PJ e quero saber mais sobre o sistema.";
const MSG_CONTRATAR = "Olá! Quero contratar o SISTEMAFP PJ. Pode me explicar como funciona a implantação?";

const PRECO = "R$ 89,90";

// Depoimentos autorizados pelos clientes. A seção só aparece quando houver algum.
const DEPOIMENTOS: { nome: string; empresa: string; texto: string }[] = [];

// Paleta própria da página (papel, tinta, oliva e um toque de café)
const C = {
  papel: "#F4F1E8",
  papelEscuro: "#EAE5D6",
  tinta: "#1E2318",
  tintaSuave: "#55594B",
  oliva: "#4E6B2E",
  olivaEscuro: "#2C3A1B",
  musgo: "#DCE4C4",
  cafe: "#B5733A",
  bilhete: "#F6E7A6",
  linha: "#D3CDB9",
};

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
      { property: "og:title", content: "SISTEMAFP PJ — O dinheiro entra. Para onde ele vai?" },
      { property: "og:description", content: "Organize o financeiro da sua empresa e entenda seus números, com um consultor ao seu lado." },
    ],
  }),
  component: LandingPage,
});

const FUNCOES = [
  ["Fluxo de caixa", "Entradas e saídas por conta e categoria, com o saldo do dia."],
  ["Contas a pagar e a receber", "Vencimentos, atrasos e quem está devendo, tudo à vista."],
  ["Vendas", "À vista e a prazo, por cliente e por produto."],
  ["Estoque", "Entradas, saídas e aviso de produto acabando."],
  ["Precificação", "Preço de venda calculado a partir do custo e da margem."],
  ["DRE e relatórios", "O resultado do mês e do ano, montado com os seus lançamentos."],
  ["Revendedores", "O que está com cada revendedor e o que já foi acertado."],
  ["Extrato do banco", "Importe o extrato (OFX) ou planilhas, sem redigitar."],
];

const PASSOS = [
  ["Implantação", "O consultor configura o sistema do jeito da sua empresa: contas, categorias e produtos."],
  ["Dia a dia", "Você lança vendas, despesas e recebimentos em poucos cliques, no computador ou no celular."],
  ["Acompanhamento", "Todo mês, os números viram uma análise clara, e vocês decidem juntos o próximo passo."],
];

const FAQ = [
  ["Preciso entender de finanças para usar?", "Não. O sistema foi pensado para o dono do negócio, e a análise explica cada número em linguagem simples: o que ele significa e o que fazer com ele."],
  ["Funciona no celular?", "Sim. Você acessa pelo navegador do celular ou do computador, e pode instalar como aplicativo na tela inicial."],
  ["Meus dados ficam seguros?", "Cada empresa só enxerga os próprios dados, e o consultor só acessa as empresas que autorizarem o vínculo. Os dados ficam em servidores profissionais na nuvem, com acesso protegido por senha."],
  ["Para que tipo de empresa ele serve?", "Principalmente pequenas empresas que vendem produtos e controlam estoque: comércio, pequena indústria, alimentação, revenda, agro e serviços que também vendem produtos."],
  ["O sistema emite nota fiscal?", "Não. O SISTEMAFP PJ cuida da gestão financeira e dos resultados; a nota fiscal continua no emissor que você já usa."],
  ["Como faço para começar?", "Chame no WhatsApp. Conversamos sobre a sua empresa, combinamos a implantação (contratada à parte) e você já começa a usar."],
];

function CtaWhats({ children, msg = MSG_PADRAO, claro = false, className = "" }: { children: React.ReactNode; msg?: string; claro?: boolean; className?: string }) {
  return (
    <a
      href={waLink(msg)}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center justify-center gap-2.5 rounded-md px-6 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5 ${className}`}
      style={claro ? { background: C.papel, color: C.olivaEscuro } : { background: C.olivaEscuro, color: C.papel }}
    >
      <MessageCircle className="size-[18px]" /> {children}
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

function Rotulo({ children, cor = C.cafe }: { children: React.ReactNode; cor?: string }) {
  return <div className="text-[12px] font-semibold uppercase tracking-[0.18em] mb-4" style={{ color: cor }}>{children}</div>;
}

function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [faqAberto, setFaqAberto] = useState<number | null>(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: C.papel, color: C.tinta }}>
      {/* TOPO */}
      <header
        className="sticky top-0 z-50 transition-colors duration-300"
        style={{ background: scrolled ? "rgba(244,241,232,0.92)" : "transparent", backdropFilter: scrolled ? "blur(8px)" : undefined, borderBottom: `1px solid ${scrolled ? C.linha : "transparent"}` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            <img src={logoAsset} alt="" className="h-8 w-auto shrink-0" />
            <span className="font-display font-bold tracking-tight truncate">SISTEMAFP PJ</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm lg:flex" style={{ color: C.tintaSuave }}>
            <a href="#como-funciona" className="hover:underline underline-offset-4">Como funciona</a>
            <a href="#o-que-faz" className="hover:underline underline-offset-4">O que faz</a>
            <a href="#plano" className="hover:underline underline-offset-4">Plano</a>
            <a href="#duvidas" className="hover:underline underline-offset-4">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-4 text-sm font-semibold">
            <Link to="/login" className="hover:underline underline-offset-4" style={{ color: C.tintaSuave }}>Entrar</Link>
            <a href={waLink(MSG_PADRAO)} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex items-center gap-1 border-b-2 pb-0.5" style={{ borderColor: C.oliva, color: C.olivaEscuro }}>
              Falar no WhatsApp <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-16 pb-24 sm:pb-28 grid lg:grid-cols-12 gap-14 lg:gap-8 items-center">
        <div className="lg:col-span-7">
          <Rotulo>Finanças em Propósito apresenta</Rotulo>
          <h1 className="font-serif text-[44px] leading-[1.02] sm:text-[60px] lg:text-[66px] font-semibold tracking-[-0.02em]">
            O dinheiro entra.
            <br />
            <em className="font-normal" style={{ color: C.oliva }}>Mas para onde ele vai?</em>
          </h1>
          <p className="mt-7 text-lg sm:text-xl max-w-xl leading-relaxed" style={{ color: C.tintaSuave }}>
            O SISTEMAFP PJ junta caixa, contas, vendas e estoque num lugar só. E um consultor
            acompanha seus números com você, explicando cada um como numa conversa.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row sm:items-center gap-5">
            <CtaWhats>Quero conhecer o sistema</CtaWhats>
            <a href="#como-funciona" className="text-[15px] font-semibold underline underline-offset-4 decoration-2" style={{ color: C.tinta, textDecorationColor: C.cafe }}>
              Ver como funciona
            </a>
          </div>
          <p className="mt-8 text-sm" style={{ color: C.tintaSuave }}>
            Sistema a partir de <strong style={{ color: C.tinta }}>{PRECO}/mês</strong> · implantação contratada à parte
          </p>
        </div>

        {/* Folha de relatório + bilhete do consultor (exemplo ilustrativo) */}
        <div className="lg:col-span-5 relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-[2deg] rounded-sm" style={{ background: C.papelEscuro }} />
          <div className="relative bg-white rounded-sm shadow-[0_18px_40px_-20px_rgba(30,35,24,0.45)] -rotate-[1.5deg] p-6 sm:p-7">
            <div className="flex items-baseline justify-between border-b pb-3 mb-4" style={{ borderColor: C.linha }}>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: C.tintaSuave }}>Análise de outubro</div>
                <div className="font-serif text-xl font-semibold">Torrefação Exemplo</div>
              </div>
              <span className="text-[10px]" style={{ color: C.tintaSuave }}>exemplo</span>
            </div>
            <dl className="grid grid-cols-3 gap-3 mb-5">
              {[["Vendas", "42.800"], ["Lucro", "9.150"], ["Atrasados", "6.300"]].map(([l, v]) => (
                <div key={l}>
                  <dt className="text-[10px] uppercase tracking-wider" style={{ color: C.tintaSuave }}>{l}</dt>
                  <dd className="font-serif text-lg sm:text-xl font-semibold tabular-nums">R$ {v}</dd>
                </div>
              ))}
            </dl>
            <div className="space-y-3 text-[13.5px] leading-relaxed" style={{ color: C.tintaSuave }}>
              <p><strong style={{ color: C.tinta }}>Resumo.</strong> A empresa ficou com <strong style={{ color: C.oliva }}>R$ 21 de sobra a cada R$ 100</strong> vendidos. Um bom mês.</p>
              <p><strong style={{ color: C.tinta }}>Atenção.</strong> R$ 6.300 de clientes estão atrasados: é dinheiro vendido que ainda não entrou no caixa.</p>
            </div>
            <div className="mt-5 flex items-end gap-1.5 h-14" aria-hidden>
              {[38, 52, 45, 61, 57, 72, 66, 84].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-[2px]" style={{ height: `${h}%`, background: i === 7 ? C.oliva : C.musgo }} />
              ))}
            </div>
          </div>
          {/* bilhete */}
          <div
            className="absolute -bottom-12 -left-2 sm:-left-8 rotate-[-5deg] w-52 px-4 pt-4 pb-3 shadow-[0_10px_20px_-10px_rgba(30,35,24,0.5)]"
            style={{ background: C.bilhete }}
          >
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-14 h-5 rotate-2 opacity-70" style={{ background: "rgba(255,255,255,0.7)" }} />
            <p className="font-hand text-[22px] leading-[1.1]" style={{ color: "#3b3a2a" }}>
              Cobrar os 3 maiores devedores até sexta!
            </p>
            <p className="font-hand text-lg mt-1 text-right" style={{ color: C.oliva }}>— seu consultor</p>
          </div>
        </div>
      </section>

      {/* ANTES / DEPOIS */}
      <section className="border-y" style={{ borderColor: C.linha, background: C.papelEscuro }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-12 flex flex-col md:flex-row md:items-center gap-6 md:gap-10">
          <p className="text-sm uppercase tracking-[0.16em] font-semibold shrink-0" style={{ color: C.tintaSuave }}>Hoje está em</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 font-serif text-xl sm:text-2xl" style={{ color: C.tintaSuave }}>
            {["caderno", "planilha", "mensagem no WhatsApp", "na cabeça"].map((t) => (
              <li key={t} className="line-through decoration-2" style={{ textDecorationColor: C.cafe }}>{t}</li>
            ))}
          </ul>
          <p className="font-serif text-2xl sm:text-[28px] italic md:ml-auto shrink-0" style={{ color: C.oliva }}>→ num lugar só.</p>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 scroll-mt-16">
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Rotulo>Como funciona</Rotulo>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold leading-[1.05] tracking-[-0.01em]">Você não fica sozinho com o sistema.</h2>
          </div>
          <ol className="lg:col-span-8 lg:pl-8">
            {PASSOS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[64px_1fr] sm:grid-cols-[96px_1fr] gap-4 py-7 border-t first:border-t-0 first:pt-0" style={{ borderColor: C.linha }}>
                <span className="font-serif text-5xl sm:text-6xl leading-none italic" style={{ color: C.cafe }}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-serif text-2xl font-semibold mb-1.5">{t}</h3>
                  <p className="text-[17px] leading-relaxed" style={{ color: C.tintaSuave }}>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* DIFERENCIAL */}
      <section style={{ background: C.olivaEscuro, color: C.papel }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <Rotulo cor={C.bilhete}>O que muda na prática</Rotulo>
          <h2 className="font-serif text-4xl sm:text-6xl font-semibold leading-[1.03] tracking-[-0.015em] max-w-4xl">
            Números explicados <em className="font-normal" style={{ color: C.musgo }}>como numa conversa</em>, e alguém do seu lado para decidir.
          </h2>
          <div className="mt-14 grid md:grid-cols-3 gap-10 md:gap-0">
            {[
              ["Análise com inteligência artificial", "O sistema lê seus números e escreve o que está indo bem, o que merece atenção e o que fazer. Sem palavras difíceis."],
              ["Empresário e consultor juntos", "Você lança, o consultor acompanha. Ninguém precisa trocar planilha por e-mail ou mandar foto do caderno."],
              ["Reuniões que viram ata", "Cada conversa vira uma ata com decisões e plano de ação, para nada se perder entre um mês e outro."],
            ].map(([t, d], i) => (
              <div key={t} className={`md:px-8 ${i > 0 ? "md:border-l" : "md:pl-0"}`} style={{ borderColor: "rgba(244,241,232,0.2)" }}>
                <h3 className="font-serif text-2xl font-semibold mb-3">{t}</h3>
                <p className="leading-relaxed opacity-80">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARA QUEM */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24">
        <Rotulo>Para quem é</Rotulo>
        <p className="font-serif text-3xl sm:text-[42px] leading-[1.25] max-w-5xl">
          Para o dono de{" "}
          {["loja", "pequena indústria", "marmitaria", "torrefação", "revenda", "ótica"].map((s, i, a) => (
            <span key={s}>
              <span className="italic" style={{ color: C.oliva, backgroundImage: `linear-gradient(transparent 62%, ${C.musgo} 62%)` }}>{s}</span>
              {i < a.length - 2 ? ", " : i === a.length - 2 ? " ou " : ""}
            </span>
          ))}{" "}
          que vende bem, mas no fim do mês não sabe direito quanto sobrou.
        </p>
      </section>

      {/* O QUE FAZ */}
      <section id="o-que-faz" className="border-t scroll-mt-16" style={{ borderColor: C.linha }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-24 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4">
            <Rotulo>O que o sistema faz</Rotulo>
            <h2 className="font-serif text-4xl font-semibold leading-[1.08]">O financeiro inteiro de uma pequena empresa.</h2>
          </div>
          <dl className="lg:col-span-8 grid sm:grid-cols-2 gap-x-10">
            {FUNCOES.map(([t, d]) => (
              <div key={t} className="py-5 border-t" style={{ borderColor: C.linha }}>
                <dt className="font-semibold text-[17px]">{t}</dt>
                <dd className="mt-1 leading-relaxed" style={{ color: C.tintaSuave }}>{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* DEPOIMENTOS (só aparece quando houver depoimentos autorizados) */}
      {DEPOIMENTOS.length > 0 && (
        <section className="border-t" style={{ borderColor: C.linha, background: C.papelEscuro }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-12">
            {DEPOIMENTOS.map((d) => (
              <figure key={d.nome}>
                <blockquote className="font-serif text-2xl leading-snug italic">“{d.texto}”</blockquote>
                <figcaption className="mt-4 text-sm" style={{ color: C.tintaSuave }}><strong style={{ color: C.tinta }}>{d.nome}</strong> · {d.empresa}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* PLANO — em formato de recibo */}
      <section id="plano" className="border-t scroll-mt-16" style={{ borderColor: C.linha, background: C.papelEscuro }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5">
            <Rotulo>Plano</Rotulo>
            <h2 className="font-serif text-4xl sm:text-5xl font-semibold leading-[1.05]">Um preço só. Sem letra miúda.</h2>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: C.tintaSuave }}>
              Todas as funções do sistema, atualizações incluídas. A implantação e o acompanhamento com o consultor
              são combinados conforme a necessidade da sua empresa.
            </p>
          </div>
          <div className="lg:col-span-7">
            <div className="relative bg-white mx-auto max-w-lg px-7 sm:px-9 pt-9 pb-8 shadow-[0_18px_40px_-24px_rgba(30,35,24,0.5)] rotate-[0.6deg]">
              {/* serrilhado do recibo */}
              <div className="absolute -bottom-2 left-0 right-0 h-3" style={{ background: "radial-gradient(circle at 8px 0, transparent 6px, white 6.5px) 0 0 / 16px 12px repeat-x" }} />
              <div className="text-center border-b border-dashed pb-5 mb-5" style={{ borderColor: C.linha }}>
                <div className="font-display font-bold tracking-tight">SISTEMAFP PJ</div>
                <div className="text-xs uppercase tracking-[0.2em] mt-1" style={{ color: C.tintaSuave }}>sua conta mensal</div>
              </div>
              <ul className="space-y-3 font-mono text-[14px]">
                {([
                  ["Sistema completo", `${PRECO}/mês`, true],
                  ["Análise com IA", "incluída", false],
                  ["Atualizações", "incluídas", false],
                  ["Implantação", "à parte", false],
                  ["Acompanhamento", "opcional", false],
                ] as const).map(([l, v, destaque]) => (
                  <li key={l} className="flex items-baseline gap-2">
                    <span>{l}</span>
                    <span className="flex-1 border-b border-dotted -translate-y-1" style={{ borderColor: C.tintaSuave }} />
                    <span className={destaque ? "font-bold" : ""} style={{ color: destaque ? C.oliva : C.tintaSuave }}>{v}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-dashed mt-6 pt-6" style={{ borderColor: C.linha }}>
                <CtaWhats msg={MSG_CONTRATAR} className="w-full">Quero contratar</CtaWhats>
                <p className="text-center text-xs mt-3" style={{ color: C.tintaSuave }}>Você fala direto com o consultor.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DÚVIDAS */}
      <section id="duvidas" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid lg:grid-cols-12 gap-10 scroll-mt-16">
        <div className="lg:col-span-4">
          <Rotulo>Dúvidas</Rotulo>
          <h2 className="font-serif text-4xl font-semibold leading-[1.08]">Perguntas que todo dono faz.</h2>
        </div>
        <div className="lg:col-span-8">
          {FAQ.map(([q, a], i) => (
            <div key={q} className="border-t last:border-b" style={{ borderColor: C.linha }}>
              <button
                type="button"
                onClick={() => setFaqAberto(faqAberto === i ? null : i)}
                className="w-full flex items-center justify-between gap-6 text-left py-5 font-serif text-xl sm:text-2xl"
                aria-expanded={faqAberto === i}
              >
                {q}
                <Plus className={`size-5 shrink-0 transition-transform ${faqAberto === i ? "rotate-45" : ""}`} style={{ color: C.cafe }} />
              </button>
              {faqAberto === i && <p className="pb-6 -mt-1 text-[17px] leading-relaxed max-w-2xl" style={{ color: C.tintaSuave }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CHAMADA FINAL + RODAPÉ */}
      <footer style={{ background: C.olivaEscuro, color: C.papel }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-20 sm:pt-24 pb-12">
          <div className="grid lg:grid-cols-12 gap-10 items-end pb-16 border-b" style={{ borderColor: "rgba(244,241,232,0.2)" }}>
            <h2 className="lg:col-span-8 font-serif text-4xl sm:text-6xl font-semibold leading-[1.03] tracking-[-0.015em]">
              Vamos descobrir <em className="font-normal" style={{ color: C.musgo }}>quanto sobra</em> na sua empresa?
            </h2>
            <div className="lg:col-span-4 lg:justify-self-end">
              <CtaWhats claro>Falar no WhatsApp</CtaWhats>
            </div>
          </div>
          <div className="pt-10 flex flex-col md:flex-row md:items-center justify-between gap-6 text-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-md p-1.5" style={{ background: C.papel }}>
                <img src={fepLogo} alt="Finanças em Propósito" className="h-10 w-auto" />
              </div>
              <div>
                <div className="font-semibold">SISTEMAFP PJ</div>
                <div className="opacity-70">Um sistema da Finanças em Propósito</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 opacity-80">
              <a href={waLink(MSG_PADRAO)} target="_blank" rel="noopener noreferrer" className="hover:underline underline-offset-4">WhatsApp</a>
              <Link to="/login" className="hover:underline underline-offset-4">Entrar no sistema</Link>
              <span>© {new Date().getFullYear()} Finanças em Propósito</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
