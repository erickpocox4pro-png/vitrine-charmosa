import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Truck, Search, CheckCircle2, Clock, Package, MapPin, Phone, Mail, User, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 15;

const AdminDeliveries = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"awaiting" | "shipped" | "all">("awaiting");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Fetch paid/processing/shipped orders with items
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", ["paid", "confirmed", "processing", "shipped", "delivered"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-deliveries"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const getCustomerName = (userId: string) => {
    return profiles?.find((p) => p.user_id === userId)?.name || "Cliente";
  };

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      const matchSearch = !search ||
        o.id.toLowerCase().includes(search.toLowerCase()) ||
        getCustomerName(o.user_id).toLowerCase().includes(search.toLowerCase()) ||
        (o.shipping_address as any)?.name?.toLowerCase().includes(search.toLowerCase());

      const isAwaiting = ["paid", "confirmed", "processing"].includes(o.status);
      const isShipped = ["shipped", "delivered"].includes(o.status);

      if (filterStatus === "awaiting") return matchSearch && isAwaiting;
      if (filterStatus === "shipped") return matchSearch && isShipped;
      return matchSearch;
    });
  }, [orders, search, filterStatus, profiles]);

  const awaitingCount = orders?.filter((o) => ["paid", "confirmed", "processing"].includes(o.status)).length || 0;
  const shippedCount = orders?.filter((o) => ["shipped", "delivered"].includes(o.status)).length || 0;

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const confirmShipment = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "shipped", updated_at: new Date().toISOString() })
        .eq("id", orderId);
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("order_timeline").insert({
        order_id: orderId,
        status: "shipped",
        note: "Envio confirmado",
        admin_email: user?.email || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-deliveries"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("Envio confirmado!");
    },
  });

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-body text-xl font-bold text-foreground flex items-center gap-2">
          <Truck size={20} className="text-primary" /> Entregas
        </h2>
        <p className="font-body text-xs text-muted-foreground mt-0.5">Gerencie envios de pedidos pagos</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: "awaiting" as const, label: "Aguardando Envio", count: awaitingCount, icon: Clock },
          { key: "shipped" as const, label: "Envio Concluído", count: shippedCount, icon: CheckCircle2 },
          { key: "all" as const, label: "Todos", count: orders?.length || 0, icon: Package },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFilterStatus(tab.key); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-body text-sm font-medium transition-colors ${
              filterStatus === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon size={14} />
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por ID, cliente ou nome..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Truck size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-body text-sm">Nenhuma entrega encontrada.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Pedido</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Endereço</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Total</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((order) => {
                  const addr = order.shipping_address as any;
                  const isAwaiting = ["paid", "confirmed", "processing"].includes(order.status);
                  return (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-medium text-foreground">#{order.id.slice(0, 8)}</span>
                        <p className="font-body text-[10px] text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-body text-sm text-foreground">{addr?.name || getCustomerName(order.user_id)}</p>
                        {addr?.phone && (
                          <p className="font-body text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {addr.phone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {addr ? (
                          <div className="font-body text-xs text-muted-foreground max-w-[200px]">
                            <p className="truncate">{addr.street}, {addr.number}</p>
                            <p className="truncate">{addr.neighborhood} - {addr.city}/{addr.state}</p>
                            <p>CEP: {addr.cep}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-sm font-medium text-foreground">{formatCurrency(Number(order.total))}</span>
                        {Number(order.shipping_cost) > 0 && (
                          <p className="font-body text-[10px] text-muted-foreground">+ {formatCurrency(Number(order.shipping_cost))} frete</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-body font-medium ${
                          isAwaiting
                            ? "bg-yellow-500/15 text-yellow-400"
                            : "bg-green-500/15 text-green-400"
                        }`}>
                          {isAwaiting ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                          {isAwaiting ? "Aguardando envio" : "Envio concluído"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                            title="Ver detalhes"
                          >
                            <Eye size={16} />
                          </button>
                          {isAwaiting && (
                            <button
                              onClick={() => confirmShipment.mutate(order.id)}
                              disabled={confirmShipment.isPending}
                              className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-body text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                            >
                              Confirmar Envio
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="font-body text-xs text-muted-foreground">{(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronLeft size={16} /></button>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedOrder && (
        <DeliveryDetailModal
          order={selectedOrder}
          customerName={getCustomerName(selectedOrder.user_id)}
          onClose={() => setSelectedOrder(null)}
          onConfirmShipment={() => {
            confirmShipment.mutate(selectedOrder.id);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────
const DeliveryDetailModal = ({ order, customerName, onClose, onConfirmShipment }: {
  order: any; customerName: string; onClose: () => void; onConfirmShipment: () => void;
}) => {
  const addr = order.shipping_address as any;
  const isAwaiting = ["paid", "confirmed", "processing"].includes(order.status);

  const { data: orderItems } = useQuery({
    queryKey: ["delivery-items", order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*, products(name, image_url, sku, category), product_variants(name, color, color_name, size, numbering)")
        .eq("order_id", order.id);
      if (!data) return [];

      // Fetch variant-specific images
      const variantIds = data.filter((i: any) => i.variant_id).map((i: any) => i.variant_id);
      let variantImages: Record<string, string> = {};
      if (variantIds.length > 0) {
        const { data: imgs } = await supabase
          .from("product_images")
          .select("variant_id, image_url")
          .in("variant_id", variantIds)
          .order("sort_order", { ascending: true });
        imgs?.forEach((img: any) => {
          if (!variantImages[img.variant_id]) {
            variantImages[img.variant_id] = img.image_url;
          }
        });
      }

      return data.map((item: any) => ({
        ...item,
        variant_image: item.variant_id ? variantImages[item.variant_id] : null,
      }));
    },
  });

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-body text-lg font-bold text-foreground">Entrega #{order.id.slice(0, 8)}</h3>
            <p className="font-body text-xs text-muted-foreground">
              {isAwaiting ? "Aguardando envio" : "Envio concluído"}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Customer info */}
          <div className="bg-secondary/20 rounded-lg p-4 space-y-2">
            <h4 className="font-body text-sm font-semibold text-foreground flex items-center gap-2"><User size={14} /> Dados do Cliente</h4>
            <div className="grid grid-cols-2 gap-2 text-xs font-body">
              <div>
                <span className="text-muted-foreground">Nome:</span>
                <p className="text-foreground font-medium">{addr?.name || customerName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="text-foreground font-medium">{addr?.email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone:</span>
                <p className="text-foreground font-medium">{addr?.phone || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Pagamento:</span>
                <p className="text-foreground font-medium">{order.payment_method === "pix" ? "Pix" : order.payment_method || "—"}</p>
              </div>
            </div>
          </div>

          {/* Address */}
          {addr && (
            <div className="bg-secondary/20 rounded-lg p-4 space-y-2">
              <h4 className="font-body text-sm font-semibold text-foreground flex items-center gap-2"><MapPin size={14} /> Endereço de Entrega</h4>
              <div className="font-body text-xs text-foreground space-y-1">
                <p>{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}</p>
                <p>{addr.neighborhood} - {addr.city}/{addr.state}</p>
                <p className="font-mono">CEP: {addr.cep}</p>
              </div>
            </div>
          )}

          {/* Items */}
          <div>
            <h4 className="font-body text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Package size={14} /> Itens do Pedido</h4>
            <div className="space-y-2">
              {orderItems?.map((item: any) => {
                const displayImage = item.variant_image || item.products?.image_url;
                const v = item.product_variants;
                const variantDetails = v ? [v.color_name, v.size, v.numbering].filter(Boolean) : [];
                return (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                    {displayImage && (
                      <img src={displayImage} alt="" className="w-14 h-14 rounded-lg object-cover border border-border" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-foreground truncate">{item.products?.name || "Produto"}</p>
                      {item.products?.sku && (
                        <p className="font-mono text-[10px] text-muted-foreground">SKU: {item.products.sku}</p>
                      )}
                      {variantDetails.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {v?.color && (
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-border shrink-0"
                              style={{ backgroundColor: v.color }}
                              title={v.color_name || v.color}
                            />
                          )}
                          <p className="font-body text-xs text-muted-foreground">
                            {variantDetails.join(" · ")}
                          </p>
                        </div>
                      )}
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">Qtd: {item.quantity}</p>
                    </div>
                    <span className="font-body text-sm font-medium text-foreground shrink-0">{formatCurrency(Number(item.price) * item.quantity)}</span>
                  </div>
                );
              })}
              {(!orderItems || orderItems.length === 0) && (
                <p className="text-center text-muted-foreground font-body text-xs py-4">Carregando itens...</p>
              )}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
            <span className="font-body text-sm font-semibold text-foreground">Total</span>
            <span className="font-body text-lg font-bold text-primary">
              {formatCurrency(Number(order.total) + Number(order.shipping_cost || 0))}
            </span>
          </div>
        </div>

        {/* Footer */}
        {isAwaiting && (
          <div className="p-5 border-t border-border">
            <button
              onClick={onConfirmShipment}
              className="w-full py-3 rounded-lg bg-green-600 text-white font-body text-sm font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <Truck size={16} /> Confirmar Envio
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDeliveries;
