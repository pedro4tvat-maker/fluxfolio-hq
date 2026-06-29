// Edge function: generate-weekly-backup
// Exporta tabelas críticas do SISTEMAFP PJ em CSV para o bucket privado system-backups.
// Modo manual: requer JWT do usuário. Backup limitado a empresas do próprio usuário (owner ou member).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CRITICAL_TABLES = [
  "transactions",
  "receivables",
  "sale_items",
  "stock_movements",
  "products",
  "crm_contacts",
  "companies",
  "company_members",
  "consultants",
] as const;

// Campos sensíveis a remover de qualquer linha exportada
const STRIPPED_FIELDS = new Set([
  "password", "password_hash", "token", "access_token", "refresh_token",
  "api_key", "secret", "auth_token", "session_token",
]);

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]).filter((h) => !STRIPPED_FIELDS.has(h));
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Identifica o usuário a partir do JWT
    const supaUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const requestedCompanyId: string | null = body?.company_id ?? null;

    // Admin: bypass RLS, mas autorização escopo por user (owner/member)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Resolve empresas do usuário
    const { data: owned } = await admin
      .from("companies").select("id, nome").eq("owner_id", user.id);
    const { data: memberOf } = await admin
      .from("company_members").select("company_id").eq("user_id", user.id);
    const memberIds = (memberOf ?? []).map((m: any) => m.company_id);
    const { data: memberCompanies } = memberIds.length
      ? await admin.from("companies").select("id, nome").in("id", memberIds)
      : { data: [] as any[] };

    const allowed: { id: string; nome: string }[] = [
      ...(owned ?? []), ...(memberCompanies ?? []),
    ].filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i);

    if (!allowed.length) {
      return new Response(JSON.stringify({ error: "Nenhuma empresa acessível" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targets = requestedCompanyId
      ? allowed.filter((c) => c.id === requestedCompanyId)
      : allowed;

    if (!targets.length) {
      return new Response(JSON.stringify({ error: "Empresa não permitida" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const results: any[] = [];

    for (const company of targets) {
      // Cria log pending
      const { data: logRow, error: logErr } = await admin.from("backup_logs").insert({
        backup_date: today,
        company_id: company.id,
        status: "running",
        bucket_name: "system-backups",
        created_by: user.id,
      }).select("id").single();
      if (logErr) {
        results.push({ company: company.nome, ok: false, error: logErr.message });
        continue;
      }

      const exported: any[] = [];
      let totalRows = 0;
      let totalFiles = 0;
      let hadError = false;
      let lastError: string | null = null;

      for (const table of CRITICAL_TABLES) {
        try {
          let query = admin.from(table).select("*");
          // Tabelas com company_id: filtra; demais (profiles/consultants/companies) trata separado
          if (table === "companies") query = query.eq("id", company.id);
          else if (table === "consultants") {
            // consultor responsável pela empresa
            const { data: links } = await admin
              .from("consultant_company_links").select("consultant_id")
              .eq("company_id", company.id);
            const ids = (links ?? []).map((l: any) => l.consultant_id);
            if (!ids.length) { exported.push({ table, rows: 0, skipped: true }); continue; }
            query = admin.from("consultants").select("*").in("id", ids);
          } else {
            query = query.eq("company_id", company.id);
          }

          const { data: rows, error: qErr } = await query;
          if (qErr) {
            exported.push({ table, ok: false, error: qErr.message });
            hadError = true; lastError = qErr.message;
            continue;
          }
          const csv = toCsv((rows ?? []) as any[]);
          const path = `${company.id}/${today}/${table}.csv`;
          const { error: upErr } = await admin.storage
            .from("system-backups")
            .upload(path, new Blob([csv], { type: "text/csv" }), {
              upsert: true, contentType: "text/csv",
            });
          if (upErr) {
            exported.push({ table, ok: false, error: upErr.message });
            hadError = true; lastError = upErr.message;
            continue;
          }
          exported.push({ table, ok: true, rows: rows?.length ?? 0, path });
          totalRows += rows?.length ?? 0;
          totalFiles += 1;
        } catch (e: any) {
          exported.push({ table, ok: false, error: e.message });
          hadError = true; lastError = e.message;
        }
      }

      await admin.from("backup_logs").update({
        status: hadError ? (totalFiles ? "partial" : "failed") : "completed",
        file_path: `${company.id}/${today}/`,
        tables_exported: exported,
        total_files: totalFiles,
        total_rows: totalRows,
        error_message: lastError,
        completed_at: new Date().toISOString(),
      }).eq("id", logRow.id);

      results.push({ company: company.nome, log_id: logRow.id, totalFiles, totalRows, hadError });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
