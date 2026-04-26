import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, Tag, ShoppingBag, Users, TrendingUp, AlertTriangle, DollarSign, BarChart3 } from "lucide-react";

const AdminDashboard = () => {
  const { data: productCount } = useQuery({
    queryKey: ["admin-product-count"],
    queryFn: async () => {
      const { count } = await supabase.from("products").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: categoryCount } = useQuery({
    queryKey: ["admin-category-count"],
    queryFn: async () => {
      const { count } = await supabase.from("categories").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: orderCount } = useQuery({
    queryKey: ["admin-order-count"],
    queryFn: async () => {
      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["admin-recent-orders"],
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["admin-recent-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const stats = [
    { label: "Produtos", value: productCount ?? 0, icon: Package, color: "text-primary", bg: "bg-primary/15" },
    { label: "Categorias", value: categoryCount ?? 0, icon: Tag, color: "text-blue-400", bg: "bg-blue-500/15" },
    { label: "Pedidos", value: orderCount ?? 0, icon: ShoppingBag, color: "text-green-400", bg: "bg-green-500/15" },
    { label: "Faturamento", value: "R$ 0,00", icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/15" },
  ];

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const getAdminName = (email: string) => {
    if (email.includes("edwarda")) return "Edwarda";
    if (email.includes("erick")) return "Erick";
    return email.split("@")[0];
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-foreground tracking-tight">Dashboard</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Visão geral da loja</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-4 border border-border/60 hover:border-border transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={20} className={stat.color} />
              </div>
            </div>
            <p className="font-heading text-3xl font-bold text-foreground tabular-nums tracking-tight">{stat.value}</p>
            <p className="text-[12px] text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Orders */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-body text-sm font-semibold text-foreground">Últimos Pedidos</h3>
            <ShoppingBag size={16} className="text-muted-foreground" />
          </div>
          <div className="p-4">
            {recentOrders?.length ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-body text-sm text-foreground font-mono">#{order.id.slice(0, 8)}</p>
                      <p className="font-body text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm font-medium text-foreground">R$ {Number(order.total).toFixed(2).replace(".", ",")}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                        order.status === "paid" ? "bg-success/15 text-success" :
                        order.status === "pending" ? "bg-warning/15 text-warning" :
                        "bg-muted text-muted-foreground"
                      }`}>{order.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground text-center py-6">Nenhum pedido ainda.</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-body text-sm font-semibold text-foreground">Atividade Recente</h3>
            <BarChart3 size={16} className="text-muted-foreground" />
          </div>
          <div className="p-4">
            {recentLogs?.length ? (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      log.action === "create" ? "bg-green-400" :
                      log.action === "update" ? "bg-blue-400" :
                      "bg-destructive"
                    }`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-sm text-foreground truncate">
                        <span className="font-medium">{getAdminName(log.admin_email)}</span>{" "}
                        {log.action === "create" ? "criou" : log.action === "update" ? "editou" : "removeu"}{" "}
                        <span className="text-muted-foreground">{log.entity_name}</span>
                      </p>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
