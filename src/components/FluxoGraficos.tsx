import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

type Lanc = { data: string; tipo: "entrada" | "saida"; valor: number; status: string; categoria_id: string | null };

const VERDE = "#4E7A35";
const VERMELHO = "#B4513C";
const TONS = ["#4E6B2E", "#6B8E3A", "#8AA663", "#A9BF7E", "#C3D39D", "#B5733A", "#C99260", "#DDB389"];

const moedaCurta = (v: number) =>
  Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `R$ ${Math.round(v)}`;

// Visão em gráfico dos lançamentos já filtrados: entradas x saídas no tempo e
// para onde foi o dinheiro (saídas por categoria). Considera só o que foi realizado.
export function FluxoGraficos({ lancamentos, categorias }: { lancamentos: Lanc[]; categorias: { id: string; nome: string }[] }) {
  const realizados = lancamentos.filter((t) => t.status === "realizado");

  const porPeriodo = useMemo(() => {
    if (realizados.length === 0) return { dados: [], porMes: false };
    const datas = realizados.map((t) => t.data).sort();
    const dias = (new Date(datas[datas.length - 1]).getTime() - new Date(datas[0]).getTime()) / 86_400_000;
    const porMes = dias > 62;
    const mapa = new Map<string, { chave: string; rotulo: string; Entradas: number; Saídas: number }>();
    for (const t of realizados) {
      const chave = porMes ? t.data.slice(0, 7) : t.data;
      const [a, m, d] = t.data.split("-");
      const rotulo = porMes ? `${m}/${a.slice(2)}` : `${d}/${m}`;
      const item = mapa.get(chave) ?? { chave, rotulo, Entradas: 0, Saídas: 0 };
      if (t.tipo === "entrada") item.Entradas += Number(t.valor);
      else item.Saídas += Number(t.valor);
      mapa.set(chave, item);
    }
    return { dados: [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave)), porMes };
  }, [realizados]);

  const porCategoria = useMemo(() => {
    const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
    const mapa = new Map<string, number>();
    for (const t of realizados) {
      if (t.tipo !== "saida") continue;
      const nome = (t.categoria_id && nomes.get(t.categoria_id)) || "Sem categoria";
      mapa.set(nome, (mapa.get(nome) ?? 0) + Number(t.valor));
    }
    const total = [...mapa.values()].reduce((s, v) => s + v, 0);
    const lista = [...mapa.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    const top = lista.slice(0, 7);
    const resto = lista.slice(7).reduce((s, x) => s + x.valor, 0);
    if (resto > 0) top.push({ nome: "Outras", valor: resto });
    return { dados: top.map((x) => ({ ...x, pct: total > 0 ? (x.valor / total) * 100 : 0 })), total };
  }, [realizados, categorias]);

  if (realizados.length === 0) {
    return (
      <div className="bg-card border rounded-2xl shadow-card p-10 text-center text-muted-foreground">
        Nenhum lançamento realizado neste período para mostrar em gráfico.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="bg-card border rounded-2xl shadow-card p-5">
        <h3 className="font-display font-semibold">Entradas x saídas {porPeriodo.porMes ? "por mês" : "por dia"}</h3>
        <p className="text-xs text-muted-foreground mb-3">Somente lançamentos realizados.</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porPeriodo.dados} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={moedaCurta} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
              <Tooltip formatter={(v: number) => formatMoney(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Entradas" fill={VERDE} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Saídas" fill={VERMELHO} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border rounded-2xl shadow-card p-5">
        <h3 className="font-display font-semibold">Para onde foi o dinheiro</h3>
        <p className="text-xs text-muted-foreground mb-3">Saídas por categoria · total {formatMoney(porCategoria.total)}</p>
        {porCategoria.dados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma saída no período.</p>
        ) : (
          <div className="space-y-2.5">
            {porCategoria.dados.map((c, i) => (
              <div key={c.nome}>
                <div className="flex justify-between text-sm mb-1 gap-3">
                  <span className="truncate">{c.nome}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMoney(c.valor)} · {c.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(c.pct, 1.5)}%`, background: TONS[i % TONS.length] }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
