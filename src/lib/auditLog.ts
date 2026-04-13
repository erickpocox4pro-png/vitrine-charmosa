import { supabase } from "@/integrations/supabase/client";

type AuditAction = "create" | "update" | "delete" | "revert";
type EntityType = "product" | "category" | "variant" | "product_image";

export const logAuditAction = async (
  action: AuditAction,
  entityType: EntityType,
  entityId?: string,
  entityName?: string,
  details?: Record<string, any>
) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from("audit_logs").insert({
      admin_user_id: session.user.id,
      admin_email: session.user.email || "",
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      entity_name: entityName || null,
      details: details || {},
    });
  } catch (e) {
    console.error("Audit log error:", e);
  }
};
