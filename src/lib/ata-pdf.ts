// PDF da ata no modelo padrão (o mesmo de gerar_ata.py): logo da consultoria,
// "ATA DE REUNIÃO", nº/empresa/CNPJ, faixas coloridas por seção, tabelas,
// rodapé com nº da página e assinaturas. O texto da ata é Markdown nas 9 seções
// do modelo; aqui ele é desenhado com jsPDF e baixado como arquivo (sem diálogo
// de impressão nem pop-up). Logo e cores vêm da identidade visual do consultor.
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

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

export const formatCnpj = (v?: string | null) => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : (v ?? "");
};

// ---------- Leitura do Markdown ----------

type Item = { text: string; subs: string[] };
type Block =
  | { t: "ficha"; pairs: [string, string][] }
  | { t: "table"; rows: string[][] }
  | { t: "itemTit"; text: string }
  | { t: "ol"; items: Item[] }
  | { t: "ul"; items: Item[] }
  | { t: "p"; text: string }
  | { t: "callout"; text: string };
type Section = { title: string; blocks: Block[] };

const cells = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const isSeparator = (line: string) => /^\|?\s*:?-{2,}/.test(line.trim());
const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").trim();

function parseSection(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let ficha: [string, string][] = [];
  let list: { t: "ol" | "ul"; items: Item[] } | null = null;
  const flushFicha = () => { if (ficha.length) blocks.push({ t: "ficha", pairs: ficha }); ficha = []; };
  const flushList = () => { if (list) blocks.push(list); list = null; };

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
      if (rows.length) blocks.push({ t: "table", rows });
      continue;
    }
    if (line.startsWith(">")) {
      flushFicha(); flushList();
      const parts: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        parts.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocks.push({ t: "callout", text: parts.join(" ").trim() });
      continue;
    }
    const h3 = line.match(/^###\s+(.*)$/);
    if (h3) { flushFicha(); flushList(); blocks.push({ t: "itemTit", text: h3[1] }); continue; }

    const par = line.match(/^[-*]\s+\*\*([^*]+?):\*\*\s*(.*)$/);
    if (par) { flushList(); ficha.push([par[1], par[2] || "Não informado"]); continue; }
    flushFicha();

    const sub = raw.match(/^\s{2,}[-*•]\s+(.*)$/);
    if (sub && list && list.items.length) { list.items[list.items.length - 1].subs.push(sub[1]); continue; }

    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list?.t !== "ol") { flushList(); list = { t: "ol", items: [] }; }
      list.items.push({ text: ol[1], subs: [] });
      continue;
    }
    const ul = line.match(/^[-*•]\s+(.*)$/);
    if (ul) {
      if (list?.t !== "ul") { flushList(); list = { t: "ul", items: [] }; }
      list.items.push({ text: ul[1], subs: [] });
      continue;
    }
    flushList();
    blocks.push({ t: "p", text: line });
  }
  flushFicha(); flushList();
  return blocks;
}

function parseAta(markdown: string): Section[] {
  return markdown.replace(/\r\n/g, "\n").split(/^##\s+/m).slice(1).map((part) => {
    const [titleLine, ...rest] = part.split("\n");
    return { title: plain(titleLine), blocks: parseSection(rest) };
  });
}

// ---------- Desenho ----------

const MM = { left: 20, right: 20, top: 15, bottom: 22 };
const PAGE_W = 210;
const PAGE_H = 297;
const WIDTH = PAGE_W - MM.left - MM.right;
const PT = 0.3528; // mm por ponto
const LINE = (size: number) => size * PT * 1.42;
const HEX = /^#[0-9a-fA-F]{6}$/;
const rgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const TEXTO: [number, number, number] = [26, 26, 26];
const CINZA: [number, number, number] = [85, 85, 85];
const GRADE: [number, number, number] = [201, 203, 176];
const statusColor = (status: string): [number, number, number] => {
  const st = status.toLowerCase();
  if (/conclu|realizad|feito|ok/.test(st)) return [46, 125, 50];
  if (/andamento|parcial|iniciad/.test(st)) return [183, 121, 31];
  if (/atras|vencid|cancel/.test(st)) return [185, 28, 28];
  if (/n[ãa]o menciona|sem informa/.test(st)) return [110, 110, 110];
  return [94, 96, 52]; // pendente
};

async function loadImage(url: string): Promise<{ data: string; w: number; h: number; fmt: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims: { w: number; h: number } = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = data;
    });
    const fmt = blob.type.includes("png") ? "PNG" : blob.type.includes("webp") ? "WEBP" : "JPEG";
    return { data, ...dims, fmt };
  } catch {
    return null;
  }
}

export async function downloadAtaPdf(markdown: string, meta: AtaMeta) {
  const b = meta.brand ?? DEFAULT_BRAND;
  const P = rgb(HEX.test(b.primaria) ? b.primaria : DEFAULT_BRAND.primaria);
  const E = rgb(HEX.test(b.escura) ? b.escura : DEFAULT_BRAND.escura);
  const C = rgb(HEX.test(b.clara) ? b.clara : DEFAULT_BRAND.clara);
  const nome = b.nome?.trim() || DEFAULT_BRAND.nome;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({ title: `${meta.numero} - ${meta.empresa}`, author: nome });
  let y = MM.top;

  const ensure = (h: number) => {
    if (y + h > PAGE_H - MM.bottom) { doc.addPage(); y = MM.top; }
  };

  // Texto com trechos em **negrito**, quebrado em linhas dentro da largura.
  const rich = (text: string, x: number, width: number, size = 9.5, color = TEXTO) => {
    const words: { w: string; bold: boolean }[] = [];
    text.split(/(\*\*.+?\*\*)/g).forEach((part) => {
      if (!part) return;
      const bold = /^\*\*.+\*\*$/.test(part);
      const s = bold ? part.slice(2, -2) : part.replace(/\*(.+?)\*/g, "$1");
      s.split(/(\s+)/).forEach((w) => w && words.push({ w, bold }));
    });
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lh = LINE(size);
    let line: { w: string; bold: boolean }[] = [];
    let lineW = 0;
    const measure = (w: { w: string; bold: boolean }) => { doc.setFont("helvetica", w.bold ? "bold" : "normal"); return doc.getTextWidth(w.w); };
    const flush = () => {
      while (line.length && !line[line.length - 1].w.trim()) line.pop();
      ensure(lh);
      let cx = x;
      line.forEach((w) => { doc.setFont("helvetica", w.bold ? "bold" : "normal"); doc.text(w.w, cx, y + lh * 0.75); cx += doc.getTextWidth(w.w); });
      y += lh;
      line = []; lineW = 0;
    };
    words.forEach((w) => {
      if (!w.w.trim() && !line.length) return;
      const ww = measure(w);
      if (lineW + ww > width && line.length) {
        flush();
        if (!w.w.trim()) return;
      }
      line.push(w); lineW += ww;
    });
    if (line.length) flush();
  };

  // Cabeçalho
  const logo = b.logoUrl ? await loadImage(b.logoUrl) : null;
  if (logo) {
    const boxW = 50, boxH = 25;
    const r = Math.min(boxW / logo.w, boxH / logo.h);
    const w = logo.w * r, h = logo.h * r;
    doc.addImage(logo.data, logo.fmt, (PAGE_W - w) / 2, y, w, h);
    y += h + 2;
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...E);
    doc.text(nome, PAGE_W / 2, y + 8, { align: "center" });
    y += 12;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...E);
  doc.text("ATA DE REUNIÃO", PAGE_W / 2, y + 6, { align: "center" });
  y += 9;
  const cnpj = formatCnpj(meta.cnpj);
  const sub = [meta.numero, meta.empresa, cnpj && cnpj !== "Não informado" ? `CNPJ ${cnpj}` : ""].filter(Boolean).join("  •  ");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  doc.text(sub, PAGE_W / 2, y + 3.5, { align: "center" });
  y += 6;
  doc.setDrawColor(...P); doc.setLineWidth(0.5);
  doc.line(MM.left, y, PAGE_W - MM.right, y);
  y += 2;

  const margin = { left: MM.left, right: MM.right, top: MM.top, bottom: MM.bottom };

  const table = (rows: string[][]) => {
    const [head, ...body] = rows;
    const key = head.map((h) => plain(h).toLowerCase()).join("|");
    const widths: Record<string, number[]> = {
      "nº|ação|responsável|prazo|status": [6, 45, 15, 19, 15],
      "nome|função|organização": [40, 30, 30],
      "ação|responsável|status": [60, 20, 20],
    };
    const w = widths[key];
    autoTable(doc, {
      startY: y,
      margin,
      head: [head.map(plain)],
      body: body.map((r) => head.map((_, i) => plain(r[i] ?? ""))),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 1.4, lineColor: GRADE, lineWidth: 0.18, textColor: TEXTO, valign: "middle" },
      headStyles: { fillColor: E, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: C },
      columnStyles: w ? Object.fromEntries(w.map((p, i) => [i, { cellWidth: (WIDTH * p) / 100 }])) : {},
      didParseCell: (data: any) => {
        const isStatus = /status/i.test(String(head[data.column.index] ?? ""));
        if (isStatus && data.section === "body") {
          data.cell.styles.textColor = statusColor(String(data.cell.raw ?? ""));
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 2;
  };

  // Quadro de destaque com pares "Rótulo: valor" em duas colunas.
  const ficha = (pairs: [string, string][]) => {
    const rows = Math.ceil(pairs.length / 2);
    const h = rows * 6 + 3;
    ensure(h + 2);
    doc.setFillColor(...C);
    doc.roundedRect(MM.left, y, WIDTH, h, 1.5, 1.5, "F");
    pairs.forEach(([r, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = MM.left + 4 + col * (WIDTH / 2);
      const ty = y + 5.3 + row * 6;
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...E);
      const label = `${plain(r)}: `;
      doc.text(label, x, ty);
      doc.setFont("helvetica", "normal"); doc.setTextColor(...TEXTO);
      const lw = doc.getTextWidth(label);
      doc.text(doc.splitTextToSize(plain(v), WIDTH / 2 - 8 - lw)[0] ?? "", x + lw, ty);
    });
    y += h + 2;
  };

  // Quadro de síntese: fundo claro com barra lateral na cor principal.
  const callout = (text: string) => {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
    const linhas = doc.splitTextToSize(plain(text), WIDTH - 10).length;
    const h = linhas * LINE(9.5) + 4;
    ensure(h + 2);
    doc.setFillColor(...C);
    doc.rect(MM.left, y, WIDTH, h, "F");
    doc.setFillColor(...P);
    doc.rect(MM.left, y, 1.3, h, "F");
    const top = y;
    y += 2;
    rich(text, MM.left + 5, WIDTH - 10);
    y = Math.max(y, top + h) + 2;
  };

  // Item de lista com etiqueta colorida: "[Concluída] Ação — Responsável".
  const tagged = (status: string, text: string, x: number, width: number) => {
    ensure(LINE(9.5) + 1);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
    const label = status.toUpperCase();
    const tw = doc.getTextWidth(label) + 4;
    doc.setFillColor(...statusColor(status));
    doc.roundedRect(x, y + 0.6, tw, 4.2, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(label, x + 2, y + 3.65);
    rich(text, x + tw + 2.5, width - tw - 2.5);
    y += 0.8;
  };

  const sectionBar = (title: string) => {
    y += 3.5;
    ensure(6.5 + 12);
    doc.setFillColor(...P);
    doc.rect(MM.left, y, WIDTH, 6.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
    doc.text(title.toUpperCase(), MM.left + 2.8, y + 4.6);
    y += 6.5 + 2;
  };

  let signers: [string, string][] = [];

  for (const sec of parseAta(markdown)) {
    const encerramento = /^\s*\d+\.?\s*encerramento/i.test(sec.title);
    if (/^\s*2\.?\s*participantes/i.test(sec.title)) {
      const tb = sec.blocks.find((bl) => bl.t === "table") as { rows: string[][] } | undefined;
      const lista = sec.blocks.find((bl) => bl.t === "ul") as { items: Item[] } | undefined;
      signers = tb
        ? tb.rows.slice(1).filter((r) => r[0]).map((r) => [plain(r[0]), plain(r[1] ?? "")])
        : (lista?.items ?? []).map((it) => {
            const [nomeP, resto = ""] = plain(it.text).split(/\s+[—–-]\s+/, 2);
            return [nomeP.trim(), resto.replace(/\s*\(.*\)\s*$/, "").trim()] as [string, string];
          });
    }
    // Encerramento e assinaturas ficam juntos na mesma página.
    if (encerramento) ensure(40 + Math.ceil(signers.length / 3) * 22);
    sectionBar(sec.title);

    for (const bl of sec.blocks) {
      if (bl.t === "table") table(bl.rows);
      else if (bl.t === "ficha") ficha(bl.pairs);
      else if (bl.t === "itemTit") { y += 1.2; ensure(12); rich(`**${plain(bl.text)}**`, MM.left, WIDTH, 9.5, E); }
      else if (bl.t === "p") { rich(bl.text, MM.left, WIDTH); y += 1.2; }
      else if (bl.t === "callout") callout(bl.text);
      else if (bl.t === "ol") {
        bl.items.forEach((it, i) => {
          rich(`**${i + 1}.** ${it.text}`, MM.left, WIDTH);
          it.subs.forEach((s) => rich(`•  ${s}`, MM.left + 6, WIDTH - 6));
          y += 0.6;
        });
      } else {
        bl.items.forEach((it) => {
          const tag = it.text.match(/^\[([^\]]+)\]\s*(.*)$/);
          if (tag) tagged(tag[1], tag[2], MM.left + 2, WIDTH - 2);
          else rich(`•  ${it.text}`, MM.left + 2, WIDTH - 2);
          it.subs.forEach((s) => rich(`–  ${s}`, MM.left + 8, WIDTH - 8));
        });
        y += 0.8;
      }
    }

    if (encerramento && signers.length) {
      y += 12;
      const colW = WIDTH / 3;
      signers.forEach(([n, f], i) => {
        const col = i % 3;
        if (col === 0 && i > 0) y += 22;
        ensure(18);
        const cx = MM.left + colW * col + colW / 2;
        doc.setDrawColor(26, 26, 26); doc.setLineWidth(0.25);
        doc.line(cx - colW * 0.42, y, cx + colW * 0.42, y);
        doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...TEXTO);
        doc.text(doc.splitTextToSize(n, colW - 4), cx, y + 4, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.text(doc.splitTextToSize(f, colW - 4), cx, y + 8, { align: "center" });
      });
    }
  }

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const fy = PAGE_H - 15;
    doc.setDrawColor(...P); doc.setLineWidth(0.28);
    doc.line(MM.left, fy, PAGE_W - MM.right, fy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    doc.text(`${nome} — Consultoria Financeira  |  ${meta.numero}`, MM.left, fy + 4.2);
    doc.text(`Página ${i}`, PAGE_W - MM.right, fy + 4.2, { align: "right" });
  }

  const arquivo = `${meta.numero} - ${meta.empresa}`.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
  doc.save(`${arquivo}.pdf`);
  return true;
}
