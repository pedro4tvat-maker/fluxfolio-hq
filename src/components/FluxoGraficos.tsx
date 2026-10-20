import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/format";

type Lanc = { data: string; tipo: "entrada" | "saida"; valor: number; status: string; categoria_id: string | null };

const VERDE = "#5B8C3E";
const VERMELHO = "#C0573F";
const TONS = ["#4E6B2E", "#7A9A45", "#A7BE74", "#B5733A", "#D39A62", "#8C7B5A", "#C9B98F", "#9AA88A"];

const moedaCurta = (v: number) =>
  Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : `${Math.round(v)}`;

function DicaGrafico({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl bg-popover/95 backdrop-blur border shadow-lg px-3 py-2 text-xs">
      {label && <div className="font-semibold mb-1">{label}</div>}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums">{formatMoney(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// Gráficos dos lançamentos já filtrados (só realizados): evolução de entradas x saídas
// em curvas suaves e a divisão das saídas por categoria em rosca.
export function FluxoGraficos({
  lancamentos, categorias, compacto = false,
}: {
  lancamentos: Lanc[];
  categorias: { id: string; nome: string }[];
  compacto?: boolean;
}) {
  const realizados = useMemo(() => lancamentos.filter((t) => t.status === "realizado"), [lancamentos]);

  const serie = useMemo(() => {
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

  const cats = useMemo(() => {
    const nomes = new Map(categorias.map((c) => [c.id, c.nome]));
    const mapa = new Map<string, number>();
    for (const t of realizados) {
      if (t.tipo !== "saida") continue;
      const nome = (t.categoria_id && nomes.get(t.categoria_id)) || "Sem categoria";
      mapa.set(nome, (mapa.get(nome) ?? 0) + Number(t.valor));
    }
    const total = [...mapa.values()].reduce((s, v) => s + v, 0);
    const lista = [...mapa.entries()].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    const top = lista.slice(0, 5);
    const resto = lista.slice(5).reduce((s, x) => s + x.valor, 0);
    if (resto > 0) top.push({ nome: "Outras", valor: resto });
    return { dados: top.map((x, i) => ({ ...x, cor: TONS[i % TONS.length], pct: total > 0 ? (x.valor / total) * 100 : 0 })), total };
  }, [realizados, categorias]);

  if (realizados.length === 0) {
    return (
      <div className="rounded-3xl bg-muted/40 p-10 text-center text-sm text-muted-foreground">
        Nenhum lançamento realizado neste período para mostrar em gráfico.
      </div>
    );
  }

  return (
    <div className={`grid gap-5 ${compacto ? "" : "lg:grid-cols-[1.4fr_1fr]"}`}>
      {/* Evolução */}
      <div className="rounded-3xl bg-gradient-to-b from-muted/50 to-transparent p-5">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <h3 className="font-display font-semibold">Como o dinheiro andou</h3>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: VERDE }} />Entradas</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: VERMELHO }} />Saídas</span>
          </div>
        </div>
        <div className={compacto ? "h-48" : "h-72"}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie.dados} margin={{ left: -8, right: 6, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VERDE} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={VERDE} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={VERMELHO} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={VERMELHO} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="2 6" stroke="var(--border)" />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis tickFormatter={moedaCurta} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<DicaGrafico />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="Entradas" stroke={VERDE} strokeWidth={2.5} fill="url(#gEntradas)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="Saídas" stroke={VERMELHO} strokeWidth={2.5} fill="url(#gSaidas)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Para onde foi */}
      <div className="rounded-3xl bg-gradient-to-b from-muted/50 to-transparent p-5">
        <h3 className="font-display font-semibold mb-2">Para onde foi o dinheiro</h3>
        {cats.dados.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma saída no período.</p>
        ) : (
          <div className={`flex ${compacto ? "flex-row" : "flex-col sm:flex-row"} items-center gap-5`}>
            <div className="relative shrink-0" style={{ width: compacto ? 132 : 170, height: compacto ? 132 : 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={cats.dados} dataKey="valor" nameKey="nome" innerRadius="68%" outerRadius="100%" paddingAngle={3} cornerRadius={8} stroke="none">
                    {cats.dados.map((c) => <Cell key={c.nome} fill={c.cor} />)}
                  </Pie>
                  <Tooltip content={<DicaGrafico />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas</div>
                  <div className="font-display font-bold text-sm tabular-nums">{formatMoney(cats.total)}</div>
                </div>
              </div>
            </div>
            <ul className="flex-1 w-full space-y-2 text-sm">
              {cats.dados.map((c) => (
                <li key={c.nome} className="flex items-center gap-2.5">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: c.cor }} />
                  <span className="truncate">{c.nome}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-muted-foreground text-xs">
                    {c.pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
