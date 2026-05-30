import * as React from "react";
import { Input } from "@/components/ui/input";

interface Props extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string | number | null | undefined;
  onChange: (value: string) => void;
}

function formatBRL(digitsOnly: string): string {
  const cleaned = digitsOnly.replace(/\D/g, "");
  if (!cleaned) return "";
  const n = Number(cleaned) / 100;
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Converts a numeric value (e.g. 12.5) or stored string into a display string "12,50"
function toDisplay(v: string | number | null | undefined): string {
  if (v === "" || v === null || v === undefined) return "";
  let num: number;
  if (typeof v === "number") {
    num = v;
  } else {
    const s = String(v).trim();
    // If string contains a comma, treat as BR-formatted ("1.234,56"); otherwise as canonical JS number ("1234.56")
    num = s.includes(",")
      ? Number(s.replace(/\./g, "").replace(",", "."))
      : Number(s);
  }
  if (!Number.isFinite(num) || num === 0) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onChange, placeholder = "0,00", ...props }, ref) => {
    const [display, setDisplay] = React.useState<string>(toDisplay(value));

    React.useEffect(() => {
      setDisplay(toDisplay(value));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">R$</span>
        <Input
          {...props}
          ref={ref}
          inputMode="decimal"
          type="text"
          className={`pl-9 ${props.className ?? ""}`}
          placeholder={placeholder}
          value={display}
          onChange={(e) => {
            const formatted = formatBRL(e.target.value);
            setDisplay(formatted);
            // emit canonical decimal string with dot (e.g. "12.50") or "" when empty
            const numeric = formatted ? String(Number(formatted.replace(/\./g, "").replace(",", "."))) : "";
            onChange(numeric);
          }}
        />
      </div>
    );
  },
);
CurrencyInput.displayName = "CurrencyInput";
