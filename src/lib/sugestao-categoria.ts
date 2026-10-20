// Sugere categoria (e conta / centro de custo) para um lançamento novo a partir do
// histórico da própria empresa: procura lançamentos anteriores com descrição parecida.

export type Historico = {
  descricao: string;
  tipo: "entrada" | "saida";
  categoria_id: string | null;
  conta_id: string | null;
  centro_custo_id: string | null;
};

export type Sugestao = {
  categoria_id: string;
  conta_id: string | null;
  centro_custo_id: string | null;
  exemplo: string; // descrição anterior que originou a sugestão
};

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "para", "pra", "com", "no", "na", "em", "ref", "pgto", "pagamento", "pag"]);

export function normalizar(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 && !PALAVRAS_VAZIAS.has(p));
}

/** Escolhe a categoria mais usada entre os lançamentos com mais palavras em comum. */
export function sugerirCategoria(descricao: string, tipo: "entrada" | "saida", historico: Historico[]): Sugestao | null {
  const alvo = normalizar(descricao);
  if (alvo.length === 0) return null;
  const alvoSet = new Set(alvo);

  let melhorPontos = 0;
  const votos = new Map<string, { n: number; h: Historico }>();
  for (const h of historico) {
    if (h.tipo !== tipo || !h.categoria_id) continue;
    const palavras = normalizar(h.descricao);
    let comum = 0;
    for (const p of palavras) if (alvoSet.has(p)) comum++;
    if (comum === 0) continue;
    // prioriza a primeira palavra igual (ex.: "aluguel", "energia", "venda")
    const pontos = comum + (palavras[0] && palavras[0] === alvo[0] ? 1 : 0);
    if (pontos < melhorPontos) continue;
    if (pontos > melhorPontos) { melhorPontos = pontos; votos.clear(); }
    const v = votos.get(h.categoria_id);
    if (v) v.n++;
    else votos.set(h.categoria_id, { n: 1, h });
  }
  let escolha: { n: number; h: Historico } | null = null;
  for (const v of votos.values()) if (!escolha || v.n > escolha.n) escolha = v;
  if (!escolha) return null;
  return {
    categoria_id: escolha.h.categoria_id!,
    conta_id: escolha.h.conta_id,
    centro_custo_id: escolha.h.centro_custo_id,
    exemplo: escolha.h.descricao,
  };
}
