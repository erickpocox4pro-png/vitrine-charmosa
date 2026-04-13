import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAuditAction } from "@/lib/auditLog";
import { History, Package, Tag, Palette, Image, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const entityIcons: Record<string, any> = {
  product: Package,
  category: Tag,
  variant: Palette,
  product_image: Image,
};

const actionLabels: Record<string, string> = {
  create: "Criou",
  update: "Editou",
  delete: "Removeu",
  revert: "Reverteu",
};

const entityLabels: Record<string, string> = {
  product: "Produto",
  category: "Categoria",
  variant: "Variante",
  product_image: "Imagem",
};

const AdminAuditLog = () => {
  const queryClient = useQueryClient();
  const [revertingId, setRevertingId] = useState<string | null>(null);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const revertMutation = useMutation({
    mutationFn: async (log: any) => {
      const details = log.details as Record<string, any> | null;
      const backup = details?._backup;

      if (log.action === "delete" && backup) {
        if (log.entity_type === "product") {
          const { id, created_at, updated_at, ...rest } = backup;
          const { data: restored, error } = await supabase
            .from("products")
            .insert({ ...rest, id })
            .select()
            .single();
          if (error) throw new Error(`Erro ao restaurar produto: ${error.message}`);

          // Restore variants
          const variants = details._variants || [];
          for (const v of variants) {
            const { created_at: _c, updated_at: _u, ...vRest } = v;
            await supabase.from("product_variants").insert(vRest);
          }

          // Restore images
          const images = details._images || [];
          for (const img of images) {
            const { created_at: _c, ...imgRest } = img;
            await supabase.from("product_images").insert(imgRest);
          }

          await logAuditAction("revert", "product", id, backup.name, {
            revertido_de: log.id,
            acao_original: "delete",
          });
          return restored;
        }

        if (log.entity_type === "category") {
          const { id, created_at, ...rest } = backup;
          const { error } = await supabase.from("categories").insert({ ...rest, id });
          if (error) throw new Error(`Erro ao restaurar categoria: ${error.message}`);

          await logAuditAction("revert", "category", id, backup.name, {
            revertido_de: log.id,
            acao_original: "delete",
          });
          return backup;
        }

        throw new Error("Tipo de entidade não suportado para reversão");
      }

      if (log.action === "update" && backup) {
        if (log.entity_type === "product") {
          const { id, created_at, updated_at, ...rest } = backup;
          const { error } = await supabase.from("products").update(rest).eq("id", id);
          if (error) throw new Error(`Erro ao reverter produto: ${error.message}`);

          await logAuditAction("revert", "product", id, backup.name, {
            revertido_de: log.id,
            acao_original: "update",
          });
          return backup;
        }

        if (log.entity_type === "category") {
          const { id, created_at, ...rest } = backup;
          const { error } = await supabase.from("categories").update(rest).eq("id", id);
          if (error) throw new Error(`Erro ao reverter categoria: ${error.message}`);

          await logAuditAction("revert", "category", id, backup.name, {
            revertido_de: log.id,
            acao_original: "update",
          });
          return backup;
        }

        throw new Error("Tipo de entidade não suportado para reversão");
      }

      throw new Error("Esta ação não pode ser revertida (sem dados de backup)");
    },
    onSuccess: (_, log) => {
      queryClient.invalidateQueries({ queryKey: ["admin-audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      toast.success(`Ação revertida: "${log.entity_name}" restaurado!`);
      setRevertingId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      setRevertingId(null);
    },
  });

  const handleRevert = (log: any) => {
    const details = log.details as Record<string, any> | null;
    if (!details?._backup) {
      toast.error("Esta ação não possui dados de backup para reversão");
      return;
    }
    if (!confirm(`Deseja reverter esta ação?\n\n${actionLabels[log.action] || log.action} ${entityLabels[log.entity_type] || log.entity_type}: "${log.entity_name}"`)) {
      return;
    }
    setRevertingId(log.id);
    revertMutation.mutate(log);
  };

  const canRevert = (log: any) => {
    const details = log.details as Record<string, any> | null;
    return (log.action === "delete" || log.action === "update") && details?._backup;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const getAdminName = (email: string) => {
    if (email.includes("edwarda")) return "Edwarda";
    if (email.includes("erick")) return "Erick";
    return email.split("@")[0];
  };

  const actionColors: Record<string, string> = {
    create: "bg-success/10 text-success",
    update: "bg-primary/10 text-primary",
    delete: "bg-destructive/10 text-destructive",
    revert: "bg-warning/10 text-warning",
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <History size={24} className="text-primary" />
        <h2 className="font-heading text-2xl font-bold text-foreground">Histórico de Alterações</h2>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />
          ))}
        </div>
      ) : logs?.length === 0 ? (
        <div className="text-center py-12">
          <History size={48} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-body">Nenhuma alteração registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs?.map((log) => {
            const Icon = entityIcons[log.entity_type] || Package;
            const isReverting = revertingId === log.id;
            const revertable = canRevert(log);

            // Filter out internal backup keys from display details
            const displayDetails = log.details
              ? Object.entries(log.details as Record<string, any>)
                  .filter(([k]) => !k.startsWith("_"))
                  .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {} as Record<string, any>)
              : {};

            return (
              <div key={log.id} className="bg-card rounded-xl p-4 border border-border flex items-start gap-4 group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body text-sm font-semibold text-foreground">
                      {getAdminName(log.admin_email)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-body font-medium ${actionColors[log.action] || ""}`}>
                      {actionLabels[log.action] || log.action}
                    </span>
                    <span className="font-body text-sm text-muted-foreground">
                      {entityLabels[log.entity_type] || log.entity_type}
                    </span>
                  </div>
                  {log.entity_name && (
                    <p className="font-body text-sm text-foreground mt-0.5 truncate">
                      "{log.entity_name}"
                    </p>
                  )}
                  {Object.keys(displayDetails).length > 0 && (
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      {Object.entries(displayDetails)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {revertable && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevert(log)}
                      disabled={isReverting}
                      className="h-8 text-xs gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-warning hover:text-warning hover:bg-warning/10"
                    >
                      {isReverting ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      Reverter
                    </Button>
                  )}
                  <span className="font-body text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminAuditLog;
