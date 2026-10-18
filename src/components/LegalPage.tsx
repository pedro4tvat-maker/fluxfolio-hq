import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logoAsset from "@/assets/sistemafp-icone.png";
import { EMPRESA, LEGAL_VERSAO, LEGAL_VIGENCIA, type Secao } from "@/lib/legal";

// Página de texto legal (Termos de Uso / Política de Privacidade), no visual da página de apresentação.
export function LegalPage({ titulo, secoes }: { titulo: string; secoes: Secao[] }) {
  return (
    <div className="min-h-screen" style={{ background: "#F4F1E8", color: "#1E2318" }}>
      <header className="border-b" style={{ borderColor: "#D3CDB9" }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoAsset} alt="" className="h-8 w-auto" />
            <span className="font-display font-bold tracking-tight">SISTEMAFP PJ</span>
          </Link>
          <Link to="/" className="text-sm inline-flex items-center gap-1.5 hover:underline underline-offset-4" style={{ color: "#55594B" }}>
            <ArrowLeft className="size-4" /> Voltar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-[-0.01em]">{titulo}</h1>
        <p className="mt-3 text-sm" style={{ color: "#55594B" }}>
          Versão {LEGAL_VERSAO} · em vigor desde {LEGAL_VIGENCIA}
        </p>

        <div className="mt-10 space-y-9">
          {secoes.map((s) => (
            <section key={s.titulo}>
              <h2 className="font-serif text-2xl font-semibold mb-3">{s.titulo}</h2>
              {s.paragrafos?.map((p) => (
                <p key={p} className="leading-relaxed mb-3" style={{ color: "#3a3e33" }}>{p}</p>
              ))}
              {s.itens && (
                <ul className="space-y-2 pl-1">
                  {s.itens.map((i) => (
                    <li key={i} className="flex gap-3 leading-relaxed" style={{ color: "#3a3e33" }}>
                      <span className="mt-[10px] size-1.5 shrink-0 rounded-full" style={{ background: "#4E6B2E" }} />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t text-sm flex flex-wrap gap-x-6 gap-y-2" style={{ borderColor: "#D3CDB9", color: "#55594B" }}>
          <Link to="/termos" className="hover:underline underline-offset-4">Termos de Uso</Link>
          <Link to="/privacidade" className="hover:underline underline-offset-4">Política de Privacidade</Link>
          <a href={`mailto:${EMPRESA.emailPrivacidade}`} className="hover:underline underline-offset-4">{EMPRESA.emailPrivacidade}</a>
        </div>
      </main>
    </div>
  );
}
