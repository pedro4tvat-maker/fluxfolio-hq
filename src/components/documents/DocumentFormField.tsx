import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { DocField } from "@/lib/document-types";

interface Props {
  field: DocField;
  value: any;
  onChange: (v: any) => void;
}

export function DocumentFormField({ field, value, onChange }: Props) {
  if (field.type === "table") {
    const rows: any[] = Array.isArray(value) ? value : [];
    const cols = field.columns ?? [];
    return (
      <div className="space-y-2">
        <Label>{field.label}</Label>
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} className="text-left p-2 font-medium">{c.label}</th>
                ))}
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={cols.length + 1} className="p-3 text-center text-muted-foreground">Nenhuma linha. Clique em "Adicionar linha".</td></tr>
              )}
              {rows.map((row, i) => (
                <tr key={i} className="border-t">
                  {cols.map((c) => (
                    <td key={c.key} className="p-1">
                      <Input
                        value={row[c.key] ?? ""}
                        onChange={(e) => {
                          const next = [...rows];
                          next[i] = { ...next[i], [c.key]: e.target.value };
                          onChange(next);
                        }}
                        className="h-8"
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <Button type="button" size="icon" variant="ghost" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, {}])}>
          <Plus className="size-4 mr-1" /> Adicionar linha
        </Button>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
        <Textarea
          rows={4}
          placeholder={field.placeholder}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
        {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  const inputType =
    field.type === "number" || field.type === "currency" ? "number" :
    field.type === "date" ? "date" : "text";

  return (
    <div className="space-y-1.5">
      <Label>{field.label}{field.required && <span className="text-destructive"> *</span>}</Label>
      <Input
        type={inputType}
        step={field.type === "currency" ? "0.01" : undefined}
        placeholder={field.placeholder}
        value={value ?? ""}
        onChange={(e) => onChange(field.type === "number" || field.type === "currency" ? e.target.valueAsNumber : e.target.value)}
      />
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  );
}
