import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_BRANCHES, useSelectedBranch } from "@/hooks/use-selected-branch";

export function BranchSwitcher({ compact }: { compact?: boolean }) {
  const { branches, selected, select } = useSelectedBranch();
  if (branches.length <= 1) return null;
  return (
    <div className={`inline-flex items-center gap-2 bg-card border rounded-xl px-3 ${compact ? "py-1" : "py-1.5"} shadow-card`}>
      <Building2 className="size-4 text-muted-foreground" />
      <Select value={selected} onValueChange={select}>
        <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 px-1 min-w-[180px]">
          <SelectValue placeholder="Selecionar unidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_BRANCHES}>Consolidado geral</SelectItem>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.is_main_branch ? "Matriz" : b.nome}
              {!b.is_main_branch && b.nome ? "" : ""}
              {!b.ativa && " (inativa)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
