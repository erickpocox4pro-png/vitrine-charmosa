import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { logAuditAction } from "@/lib/auditLog";

const AdminCategories = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const slug = newSlug || newName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
      const { error } = await supabase.from("categories").insert({ name: newName, slug, sort_order: (categories?.length || 0) + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      logAuditAction("create", "category", undefined, newName);
      setNewName(""); setNewSlug(""); setShowAdd(false);
      toast.success("Categoria criada!");
    },
    onError: () => toast.error("Erro ao criar categoria."),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("categories").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      logAuditAction("update", "category", variables.id, variables.name);
      setEditing(null);
      toast.success("Categoria atualizada!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data: backup } = await supabase.from("categories").select("*").eq("id", id).single();
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
      await logAuditAction("delete", "category", id, name, { _backup: backup });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoria removida!");
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-2xl font-bold text-foreground">Categorias</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Nova Categoria
        </button>
      </div>

      {showAdd && (
        <div className="bg-card rounded-xl p-4 border border-border mb-4 flex items-center gap-3">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da categoria"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background font-body text-sm outline-none focus:border-primary" />
          <button onClick={() => addMutation.mutate()} disabled={!newName.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium disabled:opacity-50">Salvar</button>
          <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="space-y-2">
          {categories?.map((cat) => (
            <div key={cat.id} className="bg-card rounded-xl px-4 py-3 border border-border flex items-center justify-between">
              {editing === cat.id ? (
                <input
                  defaultValue={cat.name}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") updateMutation.mutate({ id: cat.id, name: (e.target as HTMLInputElement).value });
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="flex-1 px-2 py-1 rounded border border-border bg-background font-body text-sm outline-none"
                />
              ) : (
                <span className="font-body text-sm text-foreground">{cat.name}</span>
              )}
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(editing === cat.id ? null : cat.id)} className="p-1.5 rounded text-muted-foreground hover:text-foreground">
                  <Pencil size={15} />
                </button>
                <button onClick={() => { if (confirm("Remover esta categoria?")) deleteMutation.mutate({ id: cat.id, name: cat.name }); }} className="p-1.5 rounded text-muted-foreground hover:text-destructive">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
