import { Fragment, type ReactNode } from "react";

// Mostra o texto da análise da IA já formatado: títulos, listas e destaques,
// sem deixar aparecer os símbolos (#, *, -) para o leitor.

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4
      ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
      : <Fragment key={i}>{p.replace(/\*\*/g, "").replace(/(^|\s)\*(\S[^*]*\S)\*(?=\s|$|[.,;:])/g, "$1$2")}</Fragment>,
  );
}

type Block =
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.replace(/\r/g, "").split("\n")) {
    const line = raw.trim();
    if (!line || /^[-*_]{3,}$/.test(line)) continue;
    const h = line.match(/^#{1,6}\s+(.*)$/);
    const ul = line.match(/^[-*•]\s+(.*)$/);
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (h) blocks.push({ kind: "h", text: h[1].replace(/\*\*/g, "") });
    else if (ul) last?.kind === "ul" ? last.items.push(ul[1]) : blocks.push({ kind: "ul", items: [ul[1]] });
    else if (ol) last?.kind === "ol" ? last.items.push(ol[1]) : blocks.push({ kind: "ol", items: [ol[1]] });
    else if (last?.kind === "p") last.text += " " + line;
    else blocks.push({ kind: "p", text: line });
  }
  return blocks;
}

export function AnaliseTexto({ texto, cor = "#628A4C" }: { texto: string; cor?: string }) {
  return (
    <div className="space-y-2 text-[14px] leading-relaxed text-foreground/90">
      {parse(texto).map((b, i) => {
        if (b.kind === "h")
          return (
            <h4 key={i} className="font-display font-semibold text-[15px] pt-3 first:pt-0 flex items-center gap-2" style={{ color: cor }}>
              <span className="inline-block w-1 h-4 rounded-full" style={{ backgroundColor: cor }} />
              {b.text}
            </h4>
          );
        if (b.kind === "ul")
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[9px] size-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                  <span>{inline(it)}</span>
                </li>
              ))}
            </ul>
          );
        if (b.kind === "ol")
          return (
            <ol key={i} className="space-y-1.5 pl-1">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="font-semibold shrink-0" style={{ color: cor }}>{j + 1}.</span>
                  <span>{inline(it)}</span>
                </li>
              ))}
            </ol>
          );
        return <p key={i}>{inline(b.text)}</p>;
      })}
    </div>
  );
}
