import { Building2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedCompany } from "@/hooks/use-selected-company";

export function CompanySwitcher() {
  const { companies, selected, select } = useSelectedCompany();
  if (!companies.length) return null;
  return (
    <div className="inline-flex items-center gap-2 bg-card border rounded-xl px-3 py-1.5 shadow-card">
      <Building2 className="size-4 text-muted-foreground" />
      <Select value={selected ?? undefined} onValueChange={select}>
        <SelectTrigger className="h-8 border-0 shadow-none focus:ring-0 px-1 min-w-[180px]">
          <SelectValue placeholder="Selecionar empresa" />
        </SelectTrigger>
        <SelectContent>
          {companies.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
