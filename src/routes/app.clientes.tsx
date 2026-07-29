import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlusCircle, Building2, Pencil, FileBarChart, NotebookPen, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/clientes")({
  component: ClientesGuard,
});

function ClientesGuard() {
  const { isConsultant, loading } = useAuth();
  if (loading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!isConsultant) {
    return (
      <div className="bg-card border rounded-2xl p-10 text-center shadow-card max-w-xl mx-auto">
        <h2 className="font-display font-semibold">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-1">Esta área é exclusiva para consultores.</p>
      </div>
    );
  }
  return <ClientesPage />;
}

function ClientesPage() {
  const { isConsultant, user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["companies-list", isConsultant, user?.id],
    queryFn: async () => {
      const query = supabase.from("companies").select("*").order("nome");
      
      if (isConsultant && user) {
        // Find the consultant record to get their ID
        const { data: consultant } = await supabase.from("consultants").select("id").eq("user_id", user.id).maybeSingle();
        if (consultant) {
          // If consultant, show companies they own OR are linked to
          query.or(`consultant_id.eq.${consultant.id},owner_id.eq.${user.id}`);
        } else {
          query.eq("owner_id", user.id);
        }
      } else if (user) {
        query.eq("owner_id", user.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);
  const [removing, setRemoving] = useState(false);
  const [form, setForm] = useState({ nome: "", responsavel: "", documento: "", telefone: "", email: "", segmento: "", cidade: "", estado: "" });

  const confirmDelete = async () => {
    if (!deleting) return;
    setRemoving(true);
    const { error } = await supabase.from("companies").delete().eq("id", deleting.id);
    setRemoving(false);
    if (error) {
      toast.error(
        error.message.includes("foreign key") || error.code === "23503"
          ? "Esta empresa possui lançamentos vinculados e não pode ser excluída."
          : error.message,
      );
      return;
    }
    if (localStorage.getItem("sfp:selected_company") === deleting.id) {
      localStorage.removeItem("sfp:selected_company");
    }
    toast.success("Empresa excluída");
    setDeleting(null);
    qc.invalidateQueries({ queryKey: ["companies-list"] });
    qc.invalidateQueries({ queryKey: ["companies-lite"] });
    qc.invalidateQueries({ queryKey: ["dashboard-companies"] });
  };

  const startNew = () => { setEditing(null); setForm({ nome: "", responsavel: "", documento: "", telefone: "", email: "", segmento: "", cidade: "", estado: "" }); setOpen(true); };
  const startEdit = (c: any) => { setEditing(c); setForm({ nome: c.nome ?? "", responsavel: c.responsavel ?? "", documento: c.documento ?? "", telefone: c.telefone ?? "", email: c.email ?? "", segmento: c.segmento ?? "", cidade: c.cidade ?? "", estado: c.estado ?? "" }); setOpen(true); };

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    if (editing) {
      const { error } = await supabase.from("companies").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Empresa atualizada");
    } else {
      const { data: u } = await supabase.auth.getUser();
      
      // If the current user is a consultant, we should also set the consultant_id
      let consultant_id = null;
      if (isConsultant) {
        const { data: consultant } = await supabase.from("consultants")
          .select("id")
          .eq("user_id", u.user!.id)
          .maybeSingle();
        if (consultant) consultant_id = consultant.id;
      }

      const { error } = await supabase.from("companies").insert({ 
        ...form, 
        owner_id: u.user!.id,
        consultant_id
      });
      if (error) return toast.error(error.message);
      toast.success("Empresa cadastrada");
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["companies-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard-companies"] });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie os clientes acompanhados.</p>
        </div>
        {isConsultant && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={startNew}><PlusCircle className="size-4" /> Nova empresa</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar empresa" : "Nova empresa"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5"><Label>Nome da empresa *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Responsável</Label><Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>CNPJ/CPF</Label><Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Segmento</Label><Input value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Estado</Label><Input value={form.estado} maxLength={2} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-card border rounded-2xl shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-muted-foreground">Carregando...</div>
        ) : !data || data.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="size-12 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-muted-foreground">Nenhuma empresa cadastrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Empresa</th>
                  <th className="p-3">Responsável</th>
                  <th className="p-3">Segmento</th>
                  <th className="p-3">Cidade/UF</th>
                  <th className="p-3">Início</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Módulos</th>
                  <th className="p-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((c: any) => (
                  <tr key={c.id} className="hover:bg-muted/30 group">
                    <td className="p-3 font-medium">
                      <Link 
                        to="/app/empresa/$id" 
                        params={{ id: c.id }}
                        onClick={() => localStorage.setItem("sfp:selected_company", c.id)}
                        className="hover:text-primary transition-colors"
                      >
                        {c.nome}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{c.responsavel || "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.segmento || "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.cidade ? `${c.cidade}/${c.estado || ""}` : "—"}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.data_inicio)}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${c.ativo ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button asChild size="icon" variant="ghost" title="Relatórios" className="h-8 w-8" onClick={() => localStorage.setItem("sfp:selected_company", c.id)}>
                          <Link to="/app/relatorios"><FileBarChart className="size-4" /></Link>
                        </Button>
                        <Button asChild size="icon" variant="ghost" title="Atas" className="h-8 w-8" onClick={() => localStorage.setItem("sfp:selected_company", c.id)}>
                          <Link to="/app/atas"><NotebookPen className="size-4" /></Link>
                        </Button>
                        <Button asChild size="icon" variant="ghost" title="Agenda" className="h-8 w-8" onClick={() => localStorage.setItem("sfp:selected_company", c.id)}>
                          <Link to="/app/agenda" search={{ company: c.id }}><Calendar className="size-4" /></Link>
                        </Button>
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" className="h-8 w-8" title="Resumo" onClick={() => localStorage.setItem("sfp:selected_company", c.id)}>
                          <Link to="/app/empresa/$id" params={{ id: c.id }}><PlusCircle className="size-4" /></Link>
                        </Button>
                        {isConsultant && (
                          <>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(c)}><Pencil className="size-4" /></Button>
                            <Button size="icon" variant="ghost" title="Excluir empresa" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(c)}><Trash2 className="size-4" /></Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleting?.nome}</strong>? Esta ação não pode ser desfeita.
              Empresas com lançamentos vinculados não poderão ser excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => { e.preventDefault(); confirmDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}
