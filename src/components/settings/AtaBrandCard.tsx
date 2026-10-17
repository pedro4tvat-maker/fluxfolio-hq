import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, ImageUp, Palette, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_BRAND, downloadAtaPdf } from "@/lib/ata-pdf";

const sb = supabase as any;
const HEX = /^#[0-9a-fA-F]{6}$/;

type Consultant = {
  id: string;
  user_id: string;
  consultancy_name: string;
  logo_url: string | null;
  brand_primary?: string | null;
  brand_dark?: string | null;
  brand_light?: string | null;
};

const EXEMPLO = `## 1. Identificação da reunião
- **Data:** 20/10/2026
- **Horário:** 09:00
- **Modalidade:** Online (Google Meet)
- **Tipo:** Acompanhamento mensal

## 2. Participantes
- **Consultor Responsável** — Consultor Financeiro (Sua Consultoria)
- **Cliente Exemplo** — Proprietário (Empresa Exemplo)

**Ausentes:** Não houve ausências.

**Redação da ata:** Consultor Responsável

## 3. Pauta
1. Apresentação do fluxo de caixa do mês.
2. Revisão do plano de ação.

## 4. Assuntos discutidos
> Reunião de acompanhamento com foco no fluxo de caixa do mês e na revisão do plano de ação.

### 4.1 Fluxo de caixa do mês
Foi apresentado o fluxo de caixa realizado no período, com destaque para a evolução das receitas e o controle das despesas fixas.

## 5. Decisões tomadas
1. **Cliente Exemplo** passará a lançar as despesas diariamente.

## 6. Plano de ação
| Nº | Ação | Responsável | Prazo | Status |
|---|---|---|---|---|
| 1 | Classificar as categorias pendentes | Cliente Exemplo | 27/10/2026 | Pendente |
| 2 | Preparar relatório gerencial | Consultor Responsável | 27/10/2026 | Pendente |

## 7. Pendências da reunião anterior
Não se aplica: esta foi a primeira reunião registrada.

## 8. Próxima reunião
A próxima reunião está prevista para **27/10/2026**, às **09:00**, com a seguinte pauta:
1. Acompanhamento do plano de ação.

## 9. Encerramento
Nada mais havendo a tratar, a reunião foi encerrada e a presente ata foi lavrada para ciência e concordância dos participantes.
`;

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex gap-2 mt-2 items-center">
        <input
          type="color"
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 rounded border cursor-pointer bg-background"
          aria-label={label}
        />
        <Input value={value} onChange={(e) => onChange(e.target.value.trim())} className="font-mono uppercase w-32" maxLength={7} />
      </div>
    </div>
  );
}

export function AtaBrandCard({ consultant }: { consultant: Consultant }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cores, setCores] = useState({
    primaria: consultant.brand_primary || DEFAULT_BRAND.primaria,
    escura: consultant.brand_dark || DEFAULT_BRAND.escura,
    clara: consultant.brand_light || DEFAULT_BRAND.clara,
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(consultant.logo_url);
  useEffect(() => setLogoUrl(consultant.logo_url), [consultant.logo_url]);

  const valid = HEX.test(cores.primaria) && HEX.test(cores.escura) && HEX.test(cores.clara);

  const saveColors = useMutation({
    mutationFn: async () => {
      if (!valid) throw new Error("Use cores no formato #RRGGBB.");
      const { error } = await sb.from("consultants").update({
        brand_primary: cores.primaria.toUpperCase(),
        brand_dark: cores.escura.toUpperCase(),
        brand_light: cores.clara.toUpperCase(),
      }).eq("id", consultant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cores salvas"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("Envie uma imagem PNG, JPG ou WEBP.");
      if (file.size > 2 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 2 MB.");
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${consultant.user_id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from("branding").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const url = sb.storage.from("branding").getPublicUrl(path).data.publicUrl as string;
      const { error } = await sb.from("consultants").update({ logo_url: url }).eq("id", consultant.id);
      if (error) throw error;
      return url;
    },
    onSuccess: (url) => { setLogoUrl(url); toast.success("Logo atualizada"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("consultants").update({ logo_url: null }).eq("id", consultant.id);
      if (error) throw error;
    },
    onSuccess: () => { setLogoUrl(null); toast.success("Logo removida"); qc.invalidateQueries({ queryKey: ["my-consultancy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const preview = () => {
    downloadAtaPdf(EXEMPLO, {
      numero: "Ata nº 001/2026",
      empresa: "Empresa Exemplo",
      cnpj: "00000000000000",
      brand: { nome: consultant.consultancy_name, logoUrl, ...(valid ? cores : DEFAULT_BRAND) },
    }).catch(() => toast.error("Não foi possível gerar o exemplo."));
  };

  return (
    <div className="bg-card border rounded-2xl p-6 shadow-card space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold flex items-center gap-2"><Palette className="size-4 text-primary" /> Identidade visual das atas</h3>
          <p className="text-sm text-muted-foreground">Logo e cores que aparecem nas atas em PDF enviadas aos seus clientes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={preview}><Eye className="size-4" /> Baixar ata de exemplo</Button>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-6 items-start">
        <div className="space-y-2">
          <Label className="text-sm">Logo da consultoria</Label>
          <div className="h-28 rounded-xl border bg-white flex items-center justify-center overflow-hidden">
            {logoUrl
              ? <img src={logoUrl} alt="Logo da consultoria" className="max-h-24 max-w-[200px] object-contain" />
              : <span className="text-xs text-muted-foreground px-3 text-center">Sem logo: o nome da consultoria aparece no lugar.</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo.mutate(f); e.target.value = ""; }}
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploadLogo.isPending}>
              <ImageUp className="size-4" /> {uploadLogo.isPending ? "Enviando..." : logoUrl ? "Trocar" : "Enviar logo"}
            </Button>
            {logoUrl && (
              <Button variant="ghost" size="sm" onClick={() => removeLogo.mutate()} disabled={removeLogo.isPending} title="Remover logo">
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP, até 2 MB. Formato horizontal fica melhor.</p>
        </div>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <ColorField label="Cor principal" hint="Faixas das seções" value={cores.primaria} onChange={(v) => setCores({ ...cores, primaria: v })} />
            <ColorField label="Cor escura" hint="Títulos e tabelas" value={cores.escura} onChange={(v) => setCores({ ...cores, escura: v })} />
            <ColorField label="Cor clara" hint="Fundo de destaques" value={cores.clara} onChange={(v) => setCores({ ...cores, clara: v })} />
          </div>

          {valid && (
            <div className="rounded-xl border overflow-hidden text-xs" aria-label="Prévia das cores">
              <div style={{ background: cores.primaria }} className="text-white font-bold px-3 py-1.5">6. PLANO DE AÇÃO</div>
              <div className="p-3 space-y-0">
                <div style={{ background: cores.escura }} className="text-white font-bold px-2 py-1 grid grid-cols-[2fr_1fr_1fr]"><span>Ação</span><span>Responsável</span><span>Prazo</span></div>
                <div className="px-2 py-1 grid grid-cols-[2fr_1fr_1fr] border-x border-b"><span>Classificar categorias</span><span>Cliente</span><span>27/10</span></div>
                <div style={{ background: cores.clara }} className="px-2 py-1 grid grid-cols-[2fr_1fr_1fr] border-x border-b"><span>Relatório gerencial</span><span>Consultor</span><span>27/10</span></div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setCores({ primaria: DEFAULT_BRAND.primaria, escura: DEFAULT_BRAND.escura, clara: DEFAULT_BRAND.clara })}>
              <RotateCcw className="size-4" /> Cores padrão
            </Button>
            <Button onClick={() => saveColors.mutate()} disabled={saveColors.isPending || !valid}>
              {saveColors.isPending ? "Salvando..." : "Salvar cores"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
