import { ArrowDownLeft, ArrowUpRight, Lock, Pencil, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

type Item = {
  id: string;
  data: string;
  tipo: "entrada" | "saida";
  descricao: string;
  valor: number;
  status: string;
  categoria_id: string | null;
  conta_id: string | null;
  forma_pagamento?: string | null;
  payable_id?: string | null;
  receivable_id?: string | null;
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// Lista enxuta dos lançamentos: agrupada por dia,
// com ícone arredondado, categoria e conta em segundo plano e ações ao passar o mouse.
export function FluxoListaCompacta<T extends Item>({
  itens, carregando, categorias, contas, onEditar, onExcluir,
}: {
  itens: T[];
  carregando?: boolean;
  categorias: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  onEditar: (t: T) => void;
  onExcluir: (t: T) => void;
}) {
  if (carregando) return <p className="text-sm text-muted-foreground text-center py-10">Carregando...</p>;
  if (itens.length === 0) return <p className="text-sm text-muted-foreground text-center py-10">Nenhum lançamento neste filtro.</p>;

  const cat = new Map(categorias.map((c) => [c.id, c.nome]));
  const conta = new Map(contas.map((c) => [c.id, c.nome]));
  const grupos: { data: string; itens: T[] }[] = [];
  for (const t of itens) {
    const g = grupos[grupos.length - 1];
    if (g && g.data === t.data) g.itens.push(t);
    else grupos.push({ data: t.data, itens: [t] });
  }

  return (
    <div>
      {grupos.map((g) => {
        const [a, m, d] = g.data.split("-");
        return (
          <div key={g.data} className="pt-2">
            <div className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {d} {MESES[Number(m) - 1]} {a !== String(new Date().getFullYear()) ? a : ""}
            </div>
            <ul>
              {g.itens.map((t) => {
                const entrada = t.tipo === "entrada";
                const auto = !!(t.payable_id || t.receivable_id);
                const detalhe = [t.categoria_id ? cat.get(t.categoria_id) : null, t.conta_id ? conta.get(t.conta_id) : null, t.forma_pagamento].filter(Boolean).join(" · ");
                return (
                  <li key={t.id} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-muted/60 transition-colors">
                    <span className={`size-9 shrink-0 rounded-full grid place-items-center ${entrada ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive"}`}>
                      {entrada ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-medium text-sm truncate">
                        <span className="truncate">{t.descricao}</span>
                        {auto && <Lock className="size-3 text-muted-foreground shrink-0" aria-label="Gerado por Contas a Pagar/Receber" />}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {detalhe || (!entrada ? <span className="text-amber-600">Sem categoria</span> : "—")}
                        {t.status === "previsto" && <span className="ml-1.5 rounded-full bg-warning/15 px-1.5 py-px text-[10px] text-warning-foreground">previsto</span>}
                      </div>
                    </div>
                    <div className={`text-sm font-display font-semibold tabular-nums whitespace-nowrap ${entrada ? "text-success" : "text-destructive"}`}>
                      {entrada ? "+" : "−"} {formatMoney(t.valor)}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button type="button" onClick={() => onEditar(t)} className="size-8 grid place-items-center rounded-full hover:bg-background" title="Editar">
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExcluir(t)}
                        disabled={auto}
                        className="size-8 grid place-items-center rounded-full hover:bg-background disabled:opacity-30"
                        title={auto ? "Lançamento automático. Edite em Contas a Pagar/Receber." : "Excluir"}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
