import { Wrench, AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecoveryFlags, type RecoveryToolsMode } from "@/hooks/use-recovery-flags";
import { toast } from "sonner";

export function RecoveryToolsCard() {
  const { mode, setMode, hasPending, pendingCount, pendingReconstruction, pendingOsFix } = useRecoveryFlags();

  const change = (m: RecoveryToolsMode) => {
    setMode(m);
    toast.success(
      m === "auto"
        ? "Exibição automática ativada"
        : m === "show"
          ? "Ferramentas sempre visíveis no menu"
          : "Ferramentas ocultas no menu",
    );
  };

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-xl bg-muted grid place-items-center shrink-0">
          <Wrench className="size-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Ferramentas de recuperação</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Controle a exibição de "Reconstrução de Vendas" e "Correção de Centro de Estoque das OSs" no menu lateral.
            As telas continuam acessíveis pelo endereço direto mesmo quando ocultas.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-[260px_1fr] gap-3 items-end">
        <div className="space-y-1.5">
          <Label className="text-xs">Exibição no menu</Label>
          <Select value={mode} onValueChange={(v) => change(v as RecoveryToolsMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático (só com pendências)</SelectItem>
              <SelectItem value="show">Sempre visível</SelectItem>
              <SelectItem value="hide">Sempre oculto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {hasPending
            ? `Pendências detectadas: ${pendingReconstruction} de reconstrução e ${pendingOsFix} de OS.`
            : "Nenhuma pendência detectada nesta empresa."}
        </p>
      </div>

      {mode === "hide" && hasPending && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Existem {pendingCount} pendência(s) em aberto e as ferramentas estão ocultas. Volte para "Automático" quando
            quiser tratá-las.
          </span>
        </div>
      )}
    </div>
  );
}
