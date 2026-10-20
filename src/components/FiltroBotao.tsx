import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type GrupoFiltro = {
  titulo: string;
  valor: string;
  padrao: string;
  opcoes: [string, string][];
  onChange: (v: string) => void;
  // "lista" vira um menu de seleção (bom para listas longas, como categorias)
  formato?: "pilulas" | "lista";
};

// Um único botão "Filtros": as opções ficam guardadas dentro dele.
export function FiltroBotao({ grupos, resumo }: { grupos: GrupoFiltro[]; resumo?: string }) {
  const [aberto, setAberto] = useState(false);
  const ativos = grupos.filter((g) => g.valor !== g.padrao).length;

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`h-11 px-4 rounded-full border shadow-sm inline-flex items-center gap-2 text-sm font-medium transition-colors shrink-0 ${ativos > 0 ? "bg-primary/10 border-primary/30 text-primary" : "bg-card hover:bg-muted"}`}
        >
          <SlidersHorizontal className="size-4" />
          Filtros
          {resumo && <span className="hidden sm:inline text-muted-foreground font-normal">· {resumo}</span>}
          {ativos > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] grid place-items-center">{ativos}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] rounded-2xl p-4 space-y-4">
        {grupos.map((g) => (
          <div key={g.titulo} className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{g.titulo}</div>
            {g.formato === "lista" ? (
              <Select value={g.valor} onValueChange={g.onChange}>
                <SelectTrigger className="h-9 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {g.opcoes.map(([v, r]) => <SelectItem key={v} value={v}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {g.opcoes.map(([v, r]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => g.onChange(v)}
                    className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${g.valor === v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between pt-1 border-t">
          <button
            type="button"
            disabled={ativos === 0}
            onClick={() => grupos.forEach((g) => g.onChange(g.padrao))}
            className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 pt-3"
          >
            Limpar filtros
          </button>
          <button type="button" onClick={() => setAberto(false)} className="text-xs font-medium text-primary pt-3">
            Pronto
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
