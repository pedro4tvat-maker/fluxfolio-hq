// PDF da ata no modelo padrão (o mesmo de gerar_ata.py): logo da consultoria,
// "ATA DE REUNIÃO", nº/empresa/CNPJ, faixas coloridas por seção, tabelas e
// assinaturas. O texto da ata é Markdown nas 9 seções do modelo; aqui ele vira
// HTML estilizado e o navegador salva em PDF. Logo e cores vêm da identidade
// visual que cada consultor configura.

export type AtaBrand = {
  nome: string; // nome da consultoria no rodapé
  logoUrl?: string | null;
  primaria: string; // faixas das seções e réguas
  escura: string; // títulos e cabeçalho das tabelas
  clara: string; // zebra das tabelas e rótulos
};

export const DEFAULT_BRAND: AtaBrand = {
  nome: "Finanças em Propósito",
  logoUrl: null,
  primaria: "#6B6D3C",
  escura: "#4A4B29",
  clara: "#EEEFE3",
};

export type AtaMeta = {
  numero: string; // "Ata nº 001/2026"
  empresa: string;
  cnpj?: string | null;
  brand?: AtaBrand;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const cor = (v: string | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// **negrito** e *itálico* depois de escapar o HTML.
const inline = (s: string) =>
  esc(s.trim())
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, "$1<i>$2</i>");

export const formatCnpj = (v?: string | null) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v ?? "");
};

const cells = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const isSeparator = (line: string) => /^\|?\s*:?-{2,}/.test(line.trim());

function tableHtml(rows: string[][], widths?: number[]) {
  const [head, ...body] = rows;
  const col = (i: number) => (widths?.[i] ? ` style="width:${widths[i]}%"` : "");
  return `<table class="grid"><thead><tr>${head.map((h, i) => `<th${col(i)}>${inline(h)}</th>`).join("")}</tr></thead><tbody>${body
    .map((r) => `<tr>${head.map((_, i) => `<td>${inline(r[i] ?? "")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

// Pares "Rótulo: valor" em grade de 2 pares por linha (como a ficha do modelo).
function fichaHtml(pairs: [string, string][]) {
  let html = '<table class="ficha">';
  for (let i = 0; i < pairs.length; i += 2) {
    html += "<tr>";
    for (const [rot, val] of pairs.slice(i, i + 2)) html += `<td class="rot">${inline(rot)}</td><td>${inline(val)}</td>`;
    if (pairs.length - i < 2) html += "<td class='rot'></td><td></td>";
    html += "</tr>";
  }
  return html + "</table>";
}

const WIDTHS: Record<string, number[]> = {
  "nº|ação|responsável|prazo|status": [6, 45, 15, 19, 15],
  "nome|função|organização": [40, 30, 30],
};

function sectionBody(lines: string[]) {
  let html = "";
  let fichas: [string, string][] = [];
  let list: { kind: "ol" | "ul"; items: { text: string; subs: string[] }[] } | null = null;

  const flushFicha = () => {
    if (fichas.length) html += fichaHtml(fichas);
    fichas = [];
  };
  const flushList = () => {
    if (!list) return;
    html += list.kind === "ol"
      ? list.items
          .map((it, i) => `<p class="txt"><b>${i + 1}.</b> ${inline(it.text)}</p>${it.subs.map((s) => `<p class="txt sub">• ${inline(s)}</p>`).join("")}`)
          .join("")
      : `<ul>${list.items.map((it) => `<li>${inline(it.text)}${it.subs.length ? `<ul>${it.subs.map((s) => `<li>${inline(s)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>`;
    list = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { flushList(); continue; }

    if (line.startsWith("|")) {
      flushFicha(); flushList();
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        if (!isSeparator(lines[i])) rows.push(cells(lines[i]));
        i++;
      }
      i--;
      const key = rows[0]?.map((h) => h.toLowerCase()).join("|") ?? "";
      if (rows.length) html += tableHtml(rows, WIDTHS[key]);
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushFicha(); flushList(); html += `<p class="item-tit">${inline(h3[1])}</p>`; continue; }

    // "- **Data:** 16/10/2026" vira par da ficha
    const par = line.match(/^[-*]\s+\*\*([^*]+?):\*\*\s*(.*)$/);
    if (par) { flushList(); fichas.push([par[1], par[2] || "Não informado"]); continue; }
    flushFicha();

    const sub = raw.match(/^\s{2,}[-*•]\s+(.*)$/);
    if (sub && list?.items.length) { list.items[list.items.length - 1].subs.push(sub[1]); continue; }

    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list?.kind !== "ol") { flushList(); list = { kind: "ol", items: [] }; }
      list.items.push({ text: ol[1], subs: [] });
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      if (list?.kind !== "ul") { flushList(); list = { kind: "ul", items: [] }; }
      list.items.push({ text: ul[1], subs: [] });
      continue;
    }
    flushList();
    html += `<p class="txt">${inline(line)}</p>`;
  }
  flushFicha(); flushList();
  return html;
}

// Participantes (nome, função) lidos da tabela da seção 2, para as assinaturas.
function signers(md: string): [string, string][] {
  const sec = md.split(/^##\s+/m).find((s) => /^\s*2\.?\s*participantes/i.test(s));
  if (!sec) return [];
  const rows = sec.split("\n").filter((l) => l.trim().startsWith("|") && !isSeparator(l)).map(cells);
  return rows.slice(1).filter((r) => r[0]).map((r) => [r[0], r[1] ?? ""]);
}

export function buildAtaHtml(markdown: string, meta: AtaMeta) {
  const md = markdown.replace(/\r\n/g, "\n");
  // Ignora título solto antes da seção 1 (o cabeçalho é desenhado aqui).
  const parts = md.split(/^##\s+/m).slice(1);
  let body = "";
  for (const part of parts) {
    const [titleLine, ...rest] = part.split("\n");
    const title = titleLine.replace(/\*\*/g, "").trim();
    let sectionHtml = `<div class="secao">${esc(title.toUpperCase())}</div>${sectionBody(rest)}`;
    if (/^\s*\d+\.?\s*encerramento/i.test(title)) {
      const s = signers(md);
      const assinaturas = s
        .map(([n, f]) => `<div class="ass"><div class="linha"></div><b>${esc(n)}</b><br/>${esc(f)}</div>`)
        .join("");
      sectionHtml = `<div class="bloco-final">${sectionHtml}<div class="assinaturas">${assinaturas}</div></div>`;
    }
    body += sectionHtml;
  }

  const cnpj = formatCnpj(meta.cnpj);
  const sub = [meta.numero, meta.empresa, cnpj && cnpj !== "Não informado" ? `CNPJ ${cnpj}` : ""].filter(Boolean).join("  •  ");
  const b = meta.brand ?? DEFAULT_BRAND;
  const P = cor(b.primaria, DEFAULT_BRAND.primaria);
  const E = cor(b.escura, DEFAULT_BRAND.escura);
  const C = cor(b.clara, DEFAULT_BRAND.clara);
  const nome = b.nome?.trim() || DEFAULT_BRAND.nome;
  const rodape = `${nome} — Consultoria Financeira  |  ${meta.numero}`;
  const logo = b.logoUrl ? new URL(b.logoUrl, window.location.origin).href : null;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(`${meta.numero} - ${meta.empresa}`)}</title>
<style>
@page { size: A4; margin: 1.5cm 2cm 2.2cm 2cm;
  @bottom-left { content: "${rodape.replace(/"/g, "'")}"; font: 7.5pt Arial, sans-serif; color: #555; border-top: 0.8pt solid ${P}; vertical-align: top; padding-top: 4pt; }
  @bottom-right { content: "Página " counter(page); font: 7.5pt Arial, sans-serif; color: #555; border-top: 0.8pt solid ${P}; vertical-align: top; padding-top: 4pt; }
}
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; font-size: 9.5pt; }
.cab { text-align: center; }
.cab img { width: 5cm; height: 2.5cm; object-fit: contain; }
.cab-nome { font-size: 14pt; font-weight: bold; color: ${E}; letter-spacing: 0.5pt; padding: 0.6cm 0 0.2cm; }
h1 { font-size: 18pt; color: ${E}; text-align: center; margin: 6pt 0 2pt; }
.sub { font-size: 9.5pt; color: #555; text-align: center; margin: 0 0 4pt; }
.regua { border-bottom: 1.5pt solid ${P}; margin-bottom: 4pt; }
.secao { background: ${P}; color: #fff; font-weight: bold; font-size: 10.5pt; padding: 4pt 8pt; margin: 10pt 0 6pt; break-after: avoid; }
.txt { text-align: justify; line-height: 13.5pt; margin: 0 0 3pt; }
.txt.sub { padding-left: 16pt; }
.item-tit { font-weight: bold; color: ${E}; margin: 6pt 0 2pt; break-after: avoid; }
ul { margin: 0 0 4pt 0; padding-left: 16pt; line-height: 13.5pt; }
table { width: 100%; border-collapse: collapse; margin: 2pt 0 4pt; font-size: 9pt; }
.grid th { background: ${E}; color: #fff; text-align: left; padding: 4pt; border: 0.5pt solid #C9CBB0; }
.grid td { padding: 4pt; border: 0.5pt solid #C9CBB0; vertical-align: middle; }
.grid tbody tr:nth-child(even) td { background: ${C}; }
.grid tr { break-inside: avoid; }
.ficha td { padding: 5pt; border: 0.5pt solid #C9CBB0; width: 35%; }
.ficha td.rot { background: ${C}; color: ${E}; font-weight: bold; width: 15%; }
.bloco-final { break-inside: avoid; }
.assinaturas { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28pt 12pt; margin-top: 34pt; }
.ass { text-align: center; font-size: 8.5pt; line-height: 11pt; }
.ass .linha { border-top: 0.8pt solid #1a1a1a; width: 85%; margin: 0 auto 3pt; }
</style></head><body>
<div class="cab">${logo ? `<img src="${esc(logo)}" alt="${esc(nome)}">` : `<div class="cab-nome">${esc(nome)}</div>`}</div>
<h1>ATA DE REUNIÃO</h1>
<p class="sub">${esc(sub)}</p>
<div class="regua"></div>
${body}
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`;
}

export function openAtaPdf(markdown: string, meta: AtaMeta, target?: Window | null) {
  const w = target ?? window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildAtaHtml(markdown, meta));
  w.document.close();
  return true;
}
