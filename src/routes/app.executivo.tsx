import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useSelectedCompany } from "@/hooks/use-selected-company";
import { useSelectedBranch } from "@/hooks/use-selected-branch";
import { BranchSwitcher } from "@/components/branch-switcher";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import {
  fetchReportData, buildDRE, buildFluxoRealizado, buildContasPagar,
  buildContasReceber, buildLucroOperacional, buildMargemContribuicao,
  buildPontoEquilibrio, buildOrcadoRealizado, buildCapitalGiro,
  buildVendasMargem, buildEstoqueFinanceiro, buildIndicadores, buildComparativo,
} from "@/lib/reports";
import { ArrowLeft, Printer, Save, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/executivo")({ component: Executivo });

function Executivo() {
  const { isConsultant, user } = useAuth();
  const { companies, selected, select } = useSelectedCompany();
  const { branchId } = useSelectedBranch();

  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: ownedCompanies } = useQuery({
    queryKey: ["all-companies-exec"],
    enabled: isConsultant,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, nome, cnpj").order("nome");
      return data ?? [];
    },
  });
  const allCompanies = isConsultant ? (ownedCompanies ?? []) : companies;
  const currentCompanyId = selected ?? allCompanies[0]?.id;
  const company = useMemo(() => allCompanies.find((c: any) => c.id === currentCompanyId), [allCompanies, currentCompanyId]);

  const period = useMemo(() => {
    const start = new Date(ano, mes - 1, 1).toISOString().slice(0, 10);
    const end = new Date(ano, mes, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [mes, ano]);
  const prevPeriod = useMemo(() => {
    const start = new Date(ano, mes - 2, 1).toISOString().slice(0, 10);
    const end = new Date(ano, mes - 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [mes, ano]);

  const { data } = useQuery({
    queryKey: ["exec-data", currentCompanyId, branchId, period.start, period.end],
    enabled: !!currentCompanyId,
    queryFn: () => fetchReportData(currentCompanyId!, branchId, period),
  });
  const { data: dataPrev } = useQuery({
    queryKey: ["exec-data-prev", currentCompanyId, branchId, prevPeriod.start, prevPeriod.end],
    enabled: !!currentCompanyId,
    queryFn: () => fetchReportData(currentCompanyId!, branchId, prevPeriod),
  });

  // Diagnóstico salvo no banco
  const { data: saved, refetch: refetchSaved } = useQuery({
    queryKey: ["exec-saved", currentCompanyId, branchId, mes, ano],
    enabled: !!currentCompanyId,
    queryFn: async () => {
      let q = supabase
        .from("executive_reports" as any)
        .select("*")
        .eq("company_id", currentCompanyId!)
        .eq("mes", mes)
        .eq("ano", ano);
      q = branchId ? q.eq("branch_id", branchId) : q.is("branch_id", null);
      const { data } = await q.maybeSingle();
      return data as any;
    },
  });

  const [form, setForm] = useState({ diagnostico: "", problemas: "", recomendacoes: "", plano_acao: "", observacoes: "" });
  useEffect(() => {
    setForm({
      diagnostico: saved?.diagnostico ?? "",
      problemas: saved?.problemas ?? "",
      recomendacoes: saved?.recomendacoes ?? "",
      plano_acao: saved?.plano_acao ?? "",
      observacoes: saved?.observacoes ?? "",
    });
  }, [saved?.id, mes, ano, currentCompanyId, branchId]);

  const saveDiagnosis = async () => {
    if (!isConsultant) return;
    const payload: any = {
      company_id: currentCompanyId,
      branch_id: branchId,
      mes,
      ano,
      ...form,
      created_by: user?.id,
    };
    const { error } = saved?.id
      ? await supabase.from("executive_reports" as any).update(payload).eq("id", saved.id)
      : await supabase.from("executive_reports" as any).insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Diagnóstico salvo.");
      refetchSaved();
    }
  };

  if (!currentCompanyId) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl md:text-3xl font-display font-bold">Relatório Executivo Mensal</h1>
        <p className="text-muted-foreground">Selecione uma empresa.</p>
      </div>
    );
  }

  const dre = data ? buildDRE(data, period) : null;
  const fluxo = data ? buildFluxoRealizado(data, period) : null;
  const pay = data ? buildContasPagar(data, period) : null;
  const rec = data ? buildContasReceber(data, period) : null;
  const lucroOp = data ? buildLucroOperacional(data, period) : null;
  const mc = data ? buildMargemContribuicao(data, period) : null;
  const pe = data ? buildPontoEquilibrio(data, period) : null;
  const orc = data ? buildOrcadoRealizado(data, period) : null;
  const cg = data ? buildCapitalGiro(data) : null;
  const vendas = data ? buildVendasMargem(data, period) : null;
  const estoque = data ? buildEstoqueFinanceiro(data) : null;
  const ind = data ? buildIndicadores(data, period) : null;
  const comp = data && dataPrev ? buildComparativo(data, dataPrev, period, prevPeriod) : null;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3 flex-wrap print:hidden">
        <div className="flex items-center gap-2">
          <Link to="/app/relatorios"><Button variant="ghost" size="sm"><ArrowLeft className="size-4" /> Voltar</Button></Link>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Relatório Executivo Mensal</h1>
        </div>
        <div className="flex gap-2">
          {isConsultant && <Button onClick={saveDiagnosis}><Save className="size-4" /> Salvar diagnóstico</Button>}
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Imprimir / PDF</Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border rounded-2xl p-4 shadow-card flex flex-wrap gap-3 items-end print:hidden">
        {isConsultant && (
          <Field label="Empresa">
            <select value={currentCompanyId} onChange={(e) => select(e.target.value)} className="rounded-lg border px-3 py-2 text-sm bg-background min-w-[220px]">
              {allCompanies.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
        )}
        <Field label="Mês">
          <select value={mes} onChange={(e) => setMes(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm bg-background">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
            ))}
          </select>
        </Field>
        <Field label="Ano">
          <input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} className="w-28 rounded-lg border px-3 py-2 text-sm bg-background" />
        </Field>
        <div className="ml-auto"><BranchSwitcher /></div>
      </div>

      {/* Cabeçalho do relatório */}
      <div className="bg-card border rounded-2xl p-6 shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="size-6 text-primary" />
          <div>
            <h2 className="font-display text-2xl font-bold">{company?.nome ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">
              {(company as any)?.cnpj ? `CNPJ ${(company as any).cnpj} • ` : ""}
              Período: {String(mes).padStart(2, "0")}/{ano} • {branchId ? "Filial específica" : "Consolidado"}
            </p>
          </div>
        </div>

        {!data ? (
          <p className="text-muted-foreground">Carregando dados...</p>
        ) : (
          <div className="space-y-6">
            <Block title="Resumo Executivo">
              <Grid items={[
                ["Receita Líquida", formatMoney(dre!.summary.receitaLiquida)],
                ["Lucro Líquido", formatMoney(dre!.summary.lucroLiquido)],
                ["Margem Líquida", `${dre!.summary.margemLiquida.toFixed(1)}%`],
                ["Resultado Operacional", formatMoney(dre!.summary.resultadoOperacional)],
                ["Saldo Final do Mês", formatMoney(fluxo!.summary.saldoFinal)],
                ["A Receber", formatMoney(rec!.summary.totalReceber)],
                ["A Pagar", formatMoney(pay!.summary.totalPagar)],
                ["Capital de Giro (NCG)", formatMoney(cg!.rows[4].Valor as number)],
              ]} />
            </Block>

            <Block title="DRE Gerencial"><MiniTable rows={dre!.rows} /></Block>
            <Block title="Fluxo de Caixa">
              <Grid items={[
                ["Entradas", formatMoney(fluxo!.summary.entradas)],
                ["Saídas", formatMoney(fluxo!.summary.saidas)],
                ["Resultado", formatMoney(fluxo!.summary.resultado)],
              ]} />
            </Block>
            <Block title="Lucro Operacional"><MiniTable rows={lucroOp!.rows} /></Block>
            <Block title="Margem de Contribuição">
              <Grid items={[
                ["MC R$", formatMoney(mc!.summary.mc)],
                ["MC %", `${mc!.summary.mcPct.toFixed(1)}%`],
              ]} />
            </Block>
            <Block title="Ponto de Equilíbrio"><MiniTable rows={pe!.rows} /></Block>
            <Block title="Orçado x Realizado"><MiniTable rows={orc!.rows.slice(0, 10)} /></Block>
            <Block title="Vendas e Margem">
              <Grid items={[
                ["Total vendido", formatMoney(vendas!.summary.totalVendido)],
                ["Ticket médio", formatMoney(vendas!.summary.ticket)],
                ["Qtd. vendas", String(vendas!.summary.qtd)],
              ]} />
            </Block>
            <Block title="Estoque Financeiro">
              <Grid items={[
                ["Valor total", formatMoney(estoque!.summary.total)],
                ["Abaixo do mínimo", String(estoque!.summary.abaixoMin)],
                ["Zerados", String(estoque!.summary.zerados)],
              ]} />
            </Block>
            <Block title="Indicadores Financeiros"><MiniTable rows={ind!.rows} /></Block>
            {comp && (
              <Block title="Comparativo com mês anterior"><MiniTable rows={comp.rows} /></Block>
            )}
          </div>
        )}
      </div>

      {/* Diagnóstico do consultor */}
      <div className="bg-card border rounded-2xl p-6 shadow-card space-y-4">
        <h2 className="font-display text-xl font-bold">Diagnóstico do Consultor</h2>
        {!isConsultant && !saved && (
          <p className="text-sm text-muted-foreground">Aguardando preenchimento pelo consultor.</p>
        )}
        {(isConsultant || saved) && (
          <div className="grid gap-4">
            <ConsultantField label="Diagnóstico do mês" value={form.diagnostico} onChange={(v) => setForm((f) => ({ ...f, diagnostico: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Principais problemas encontrados" value={form.problemas} onChange={(v) => setForm((f) => ({ ...f, problemas: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Recomendações" value={form.recomendacoes} onChange={(v) => setForm((f) => ({ ...f, recomendacoes: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Plano de ação para o próximo mês" value={form.plano_acao} onChange={(v) => setForm((f) => ({ ...f, plano_acao: v }))} readOnly={!isConsultant} />
            <ConsultantField label="Observações finais" value={form.observacoes} onChange={(v) => setForm((f) => ({ ...f, observacoes: v }))} readOnly={!isConsultant} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Grid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-2 md:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-lg border p-3">
          <div className="text-[11px] text-muted-foreground">{k}</div>
          <div className="font-semibold mt-0.5">{v}</div>
        </div>
      ))}
    </div>
  );
}

function MiniTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  const headers = Object.keys(rows[0]);
  return (
    <table className="w-full text-sm border rounded-lg overflow-hidden">
      <thead className="bg-muted/50">
        <tr>{headers.map((h) => <th key={h} className="text-left py-2 px-3 text-xs font-medium uppercase text-muted-foreground">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t">
            {headers.map((h) => {
              const v = r[h];
              const isMoney = typeof v === "number" && /valor|atual|anterior|receita|lucro|saldo|custo|orçado|realizado|ebitda|diferença/i.test(h);
              return <td key={h} className={`py-2 px-3 ${isMoney ? "font-mono text-right" : ""}`}>{typeof v === "number" ? (isMoney ? formatMoney(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })) : String(v ?? "")}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConsultantField({ label, value, onChange, readOnly }: { label: string; value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {readOnly ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap min-h-[60px]">{value || <span className="text-muted-foreground">Não preenchido.</span>}</div>
      ) : (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      )}
    </div>
  );
}
