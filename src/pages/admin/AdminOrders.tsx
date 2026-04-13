import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, Search, ChevronLeft, ChevronRight, Eye, Truck, X, Clock, CheckCircle2, Package, Ban, RotateCcw, CreditCard, MapPin, FileText, Send, Plus, Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { logAuditAction } from "@/lib/auditLog";
import { generatePixPayload } from "@/lib/pix";
import { QRCodeSVG } from "qrcode.react";

const ITEMS_PER_PAGE = 15;

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Aguardando pagamento", className: "bg-yellow-500/15 text-yellow-400", icon: Clock },
  paid: { label: "Pago", className: "bg-green-500/15 text-green-400", icon: CheckCircle2 },
  processing: { label: "Em separação", className: "bg-blue-500/15 text-blue-400", icon: Package },
  shipped: { label: "Enviado", className: "bg-purple-500/15 text-purple-400", icon: Truck },
  delivered: { label: "Entregue", className: "bg-green-500/15 text-green-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", className: "bg-destructive/15 text-destructive", icon: Ban },
  refunded: { label: "Reembolsado", className: "bg-muted text-muted-foreground", icon: RotateCcw },
};

const allStatuses = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

const AdminOrders = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "pix">("orders");
  const [showNewPix, setShowNewPix] = useState(false);
  const [newPixAmount, setNewPixAmount] = useState("");
  const [newPixOrderId, setNewPixOrderId] = useState("");
  const [generatedPixCode, setGeneratedPixCode] = useState("");
  const [generatedPixPayload, setGeneratedPixPayload] = useState("");
  const [newPixDate, setNewPixDate] = useState(new Date().toISOString().slice(0, 10));
  const [newPixTime, setNewPixTime] = useState(new Date().toTimeString().slice(0, 5));

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pixPayments } = useQuery({
    queryKey: ["admin-pix-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pix_payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const updatePixStatus = useMutation({
    mutationFn: async ({ id, status, order_id }: { id: string; status: string; order_id?: string | null }) => {
      const { error } = await supabase.from("pix_payments").update({ status }).eq("id", id);
      if (error) throw error;

      // When confirming PIX, also update the order status to "paid"
      if (order_id) {
        const newOrderStatus = status === "confirmed" ? "paid" : "pending";
        const { error: orderError } = await supabase
          .from("orders")
          .update({ status: newOrderStatus, payment_method: "pix", updated_at: new Date().toISOString() })
          .eq("id", order_id);
        if (orderError) throw orderError;

        // Add timeline entry
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("order_timeline").insert({
          order_id,
          status: newOrderStatus,
          note: status === "confirmed" ? "Pagamento PIX confirmado" : "Pagamento PIX revertido",
          admin_email: user?.email || "",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pix-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["report-orders"] });
      queryClient.invalidateQueries({ queryKey: ["report-all-orders"] });
      toast.success("Pagamento e pedido atualizados!");
    },
  });

  const generateNewPix = () => {
    const amount = parseFloat(newPixAmount.replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const txId = `PIX${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const payload = generatePixPayload(amount, txId);
    setGeneratedPixCode(txId);
    setGeneratedPixPayload(payload);
  };

  const savePixPayment = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(newPixAmount.replace(",", "."));
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const customDate = new Date(`${newPixDate}T${newPixTime}:00`).toISOString();

      const { error } = await supabase.from("pix_payments").insert({
        code: generatedPixCode,
        amount,
        user_id: user.id,
        order_id: newPixOrderId || null,
        status: "pending",
        created_at: customDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pix-payments"] });
      toast.success("Pagamento PIX criado com sucesso!");
      setShowNewPix(false);
      setNewPixAmount("");
      setNewPixOrderId("");
      setGeneratedPixCode("");
      setGeneratedPixPayload("");
      setNewPixDate(new Date().toISOString().slice(0, 10));
      setNewPixTime(new Date().toTimeString().slice(0, 5));
    },
    onError: () => toast.error("Erro ao salvar pagamento PIX."),
  });

  // Fetch profiles for customer names
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const getCustomerName = (userId: string) => {
    const profile = profiles?.find((p) => p.user_id === userId);
    if (profile?.name) return profile.name;
    // Fallback: try shipping_address name
    const order = orders?.find((o) => o.user_id === userId);
    const addr = order?.shipping_address as any;
    return addr?.name || "Cliente";
  };

  // Build a map of order_id -> pix code for search
  const pixByOrderId = useMemo(() => {
    const map = new Map<string, string>();
    pixPayments?.forEach((p) => {
      if (p.order_id) map.set(p.order_id, p.code);
    });
    return map;
  }, [pixPayments]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      const q = search.toLowerCase();
      const pixCode = pixByOrderId.get(o.id) || "";
      const addr = o.shipping_address as any;
      const customerName = addr?.name || getCustomerName(o.user_id);
      const matchSearch = !search ||
        o.id.toLowerCase().includes(q) ||
        customerName.toLowerCase().includes(q) ||
        pixCode.toLowerCase().includes(q);
      const matchStatus = !filterStatus || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, search, filterStatus, profiles, pixByOrderId]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${activeTab === "orders" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
        >
          Todos os Pedidos
        </button>
        <button
          onClick={() => setActiveTab("pix")}
          className={`px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${activeTab === "pix" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
        >
          Pagamentos PIX ({pixPayments?.length || 0})
        </button>
      </div>

      {activeTab === "pix" ? (
        <>
        {/* New PIX button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setShowNewPix(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} />
            Novo Pagamento PIX
          </button>
        </div>

        {/* New PIX Modal */}
        {showNewPix && (
          <div className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card rounded-xl shadow-card-hover w-full max-w-md mx-4 border border-border">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h3 className="font-body text-lg font-bold text-foreground flex items-center gap-2">
                  <QrCode size={20} className="text-primary" />
                  Gerar Pagamento PIX
                </h3>
                <button onClick={() => { setShowNewPix(false); setGeneratedPixCode(""); setGeneratedPixPayload(""); }} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <X size={18} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Valor (R$) *</label>
                  <input
                    value={newPixAmount}
                    onChange={(e) => setNewPixAmount(e.target.value)}
                    placeholder="Ex: 90,00"
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
                  />
                </div>
                <div>
                  <label className="block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">ID do Pedido (opcional)</label>
                  <select
                    value={newPixOrderId}
                    onChange={(e) => setNewPixOrderId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="">Sem pedido vinculado</option>
                    {orders?.filter((o) => o.status === "pending").map((o) => (
                      <option key={o.id} value={o.id}>#{o.id.slice(0, 8)} — R$ {Number(o.total).toFixed(2).replace(".", ",")}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Data</label>
                    <input
                      type="date"
                      value={newPixDate}
                      onChange={(e) => setNewPixDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Horário</label>
                    <input
                      type="time"
                      value={newPixTime}
                      onChange={(e) => setNewPixTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {!generatedPixCode && (
                  <button
                    onClick={generateNewPix}
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 flex items-center justify-center gap-2"
                  >
                    <QrCode size={16} />
                    Gerar Código PIX
                  </button>
                )}

                {generatedPixCode && generatedPixPayload && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-center p-4 bg-white rounded-lg">
                      <QRCodeSVG value={generatedPixPayload} size={200} />
                    </div>
                    <div>
                      <label className="block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Código PIX (Copia e Cola)</label>
                      <div className="flex gap-2">
                        <input
                          readOnly
                          value={generatedPixPayload}
                          className="flex-1 px-3 py-2 rounded-lg border border-border bg-secondary font-mono text-xs text-foreground truncate"
                        />
                        <button
                          onClick={() => { navigator.clipboard.writeText(generatedPixPayload); toast.success("Código PIX copiado!"); }}
                          className="px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                          title="Copiar"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-secondary rounded-lg p-3">
                      <p className="font-body text-xs text-muted-foreground">ID da Transação:</p>
                      <p className="font-mono text-sm text-primary font-bold">{generatedPixCode}</p>
                    </div>
                    <button
                      onClick={() => savePixPayment.mutate()}
                      disabled={savePixPayment.isPending}
                      className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {savePixPayment.isPending ? "Salvando..." : "Salvar Pagamento"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Código PIX</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Pedido</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Valor</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Data</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Status</th>
                  <th className="text-right px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pixPayments?.map((pix) => (
                  <tr key={pix.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-mono text-sm font-bold text-primary">{pix.code}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">#{pix.order_id?.slice(0, 8)}</td>
                    <td className="px-4 py-3 font-body text-sm text-foreground">{formatCurrency(pix.amount)}</td>
                    <td className="px-4 py-3 font-body text-xs text-muted-foreground">{formatDate(pix.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-body font-medium ${pix.status === "confirmed" ? "bg-green-500/15 text-green-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                        {pix.status === "confirmed" ? "Confirmado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {pix.status === "pending" ? (
                        <button
                          onClick={() => updatePixStatus.mutate({ id: pix.id, status: "confirmed", order_id: pix.order_id })}
                          className="px-3 py-1.5 rounded-lg bg-green-600 text-white font-body text-xs font-medium hover:bg-green-700"
                        >
                          Confirmar
                        </button>
                      ) : (
                        <button
                          onClick={() => updatePixStatus.mutate({ id: pix.id, status: "pending", order_id: pix.order_id })}
                          className="px-3 py-1.5 rounded-lg border border-border font-body text-xs text-muted-foreground hover:text-foreground"
                        >
                          Reverter
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!pixPayments || pixPayments.length === 0) && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground font-body text-sm">Nenhum pagamento PIX registrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
      ) : (
      <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground">Pedidos</h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-5">
        {allStatuses.map((s) => {
          const config = statusConfig[s];
          const count = orders?.filter((o) => o.status === s).length || 0;
          return (
            <button
              key={s}
              onClick={() => { setFilterStatus(filterStatus === s ? "" : s); setPage(1); }}
              className={`p-3 rounded-lg border transition-colors text-left ${
                filterStatus === s ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <p className="font-body text-lg font-bold text-foreground">{count}</p>
              <p className="font-body text-[10px] text-muted-foreground truncate">{config.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por ID, cliente ou código PIX..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Todos status</option>
          {allStatuses.map((s) => <option key={s} value={s}>{statusConfig[s].label}</option>)}
        </select>
      </div>

      {/* Orders table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <ShoppingBag size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-body text-sm">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pedido</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pagamento</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((order) => {
                  const config = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <tr key={order.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-body text-sm font-mono font-medium text-foreground">#{order.id.slice(0, 8)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-sm text-foreground">{(order.shipping_address as any)?.name || getCustomerName(order.user_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-sm font-medium text-foreground">{formatCurrency(Number(order.total))}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-xs text-muted-foreground">{(order as any).payment_method || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-body font-medium ${config.className}`}>
                          <StatusIcon size={12} />
                          {config.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title="Ver detalhes"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-border">
            {paginated.map((order) => {
              const config = statusConfig[order.status] || statusConfig.pending;
              return (
                <button key={order.id} onClick={() => setSelectedOrder(order)} className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm font-mono font-medium text-foreground">#{order.id.slice(0, 8)}</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-body font-medium ${config.className}`}>{config.label}</span>
                    </div>
                    <p className="font-body text-xs text-muted-foreground mt-0.5">{getCustomerName(order.user_id)} · {formatDate(order.created_at)}</p>
                  </div>
                  <span className="font-body text-sm font-medium text-foreground">{formatCurrency(Number(order.total))}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="font-body text-xs text-muted-foreground">{(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronLeft size={16} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg font-body text-xs font-medium ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          customerName={getCustomerName(selectedOrder.user_id)}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
          }}
        />
      )}
      </>
      )}
    </div>
  );
};

// ─── Order Detail Modal ─────────────────────────────────────────────

interface OrderDetailModalProps {
  order: any;
  customerName: string;
  onClose: () => void;
  onUpdate: () => void;
}

const OrderDetailModal = ({ order, customerName, onClose, onUpdate }: OrderDetailModalProps) => {
  const queryClient = useQueryClient();
  const [newStatus, setNewStatus] = useState(order.status);
  const [trackingCode, setTrackingCode] = useState((order as any).tracking_code || "");
  const [internalNotes, setInternalNotes] = useState((order as any).internal_notes || "");
  const [timelineNote, setTimelineNote] = useState("");

  const { data: orderItems } = useQuery({
    queryKey: ["admin-order-items", order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*, products(name, image_url)")
        .eq("order_id", order.id);
      
      // Fetch variant info for cart items that had variants
      // We check product_variants linked via the cart at order time
      return data || [];
    },
  });

  const { data: timeline } = useQuery({
    queryKey: ["admin-order-timeline", order.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_timeline")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      // Update order
      const { error } = await supabase.from("orders").update({
        status: newStatus,
        tracking_code: trackingCode,
        internal_notes: internalNotes,
      } as any).eq("id", order.id);
      if (error) throw error;

      // Add timeline entry if status changed
      if (newStatus !== order.status) {
        const { data: { session } } = await supabase.auth.getSession();
        await supabase.from("order_timeline").insert({
          order_id: order.id,
          status: newStatus,
          note: timelineNote || `Status alterado para: ${statusConfig[newStatus]?.label || newStatus}`,
          admin_email: session?.user?.email || "",
        } as any);
        await logAuditAction("update", "product", order.id, `Pedido #${order.id.slice(0, 8)}`, { status: newStatus });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order-timeline", order.id] });
      onUpdate();
      toast.success("Pedido atualizado!");
      setTimelineNote("");
    },
    onError: () => toast.error("Erro ao atualizar pedido."),
  });

  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const shippingCost = Number((order as any).shipping_cost || 0);

  const getAdminName = (email: string) => {
    if (email.includes("edwarda")) return "Edwarda";
    if (email.includes("erick")) return "Erick";
    return email.split("@")[0] || "Sistema";
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground";
  const labelClass = "block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6">
      <div className="bg-card rounded-xl shadow-card-hover w-full max-w-3xl mx-4 border border-border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h3 className="font-body text-lg font-bold text-foreground flex items-center gap-2">
              Pedido <span className="font-mono">#{order.id.slice(0, 8)}</span>
            </h3>
            <p className="font-body text-xs text-muted-foreground mt-0.5">{formatDate(order.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X size={18} /></button>
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Status + Customer info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-primary" />
                <span className="font-body text-sm font-semibold text-foreground">Informações do Pedido</span>
              </div>
              <div className="space-y-2 text-sm font-body">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="text-foreground font-medium">{customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagamento</span>
                  <span className="text-foreground">{(order as any).payment_method || "Não informado"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatCurrency(Number(order.total) - shippingCost)}</span>
                </div>
                {shippingCost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span className="text-foreground">{formatCurrency(shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="text-foreground font-bold">{formatCurrency(Number(order.total))}</span>
                </div>
              </div>
            </div>

            <div className="bg-secondary rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard size={16} className="text-primary" />
                <span className="font-body text-sm font-semibold text-foreground">Atualizar Pedido</span>
              </div>
              <div>
                <label className={labelClass}>Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={inputClass}>
                  {allStatuses.map((s) => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Código de rastreio</label>
                <input value={trackingCode} onChange={(e) => setTrackingCode(e.target.value)} className={inputClass} placeholder="Ex: BR123456789BR" />
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} className="text-primary" />
              <span className="font-body text-sm font-semibold text-foreground">Itens do Pedido</span>
            </div>
            {orderItems?.length ? (
              <div className="bg-secondary rounded-lg divide-y divide-border">
                {orderItems.map((item: any) => (
                  <div key={item.id} className="p-3 flex items-start gap-3">
                    {item.products?.image_url && (
                      <img src={item.products.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm text-foreground truncate">{item.products?.name || "Produto"}</p>
                      <p className="font-body text-xs text-muted-foreground">Qtd: {item.quantity}</p>
                    </div>
                    <span className="font-body text-sm font-medium text-foreground shrink-0">{formatCurrency(Number(item.price) * item.quantity)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground">Nenhum item encontrado.</p>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={16} className="text-primary" />
              <span className="font-body text-sm font-semibold text-foreground">Observações Internas</span>
            </div>
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="Notas internas sobre este pedido..." />
          </div>

          {/* Timeline */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={16} className="text-primary" />
              <span className="font-body text-sm font-semibold text-foreground">Timeline do Pedido</span>
            </div>

            <div className="space-y-0">
              {/* Initial creation */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-primary shrink-0 mt-1" />
                  {(timeline?.length || 0) > 0 && <div className="w-0.5 flex-1 bg-border" />}
                </div>
                <div className="pb-4">
                  <p className="font-body text-sm text-foreground">Pedido criado</p>
                  <p className="font-body text-[10px] text-muted-foreground">{formatDate(order.created_at)}</p>
                </div>
              </div>

              {timeline?.map((entry: any, i: number) => {
                const config = statusConfig[entry.status] || statusConfig.pending;
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${i === (timeline?.length || 0) - 1 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      {i < (timeline?.length || 0) - 1 && <div className="w-0.5 flex-1 bg-border" />}
                    </div>
                    <div className="pb-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-body font-medium ${config.className}`}>{config.label}</span>
                        <span className="font-body text-[10px] text-muted-foreground">por {getAdminName(entry.admin_email)}</span>
                      </div>
                      {entry.note && <p className="font-body text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                      <p className="font-body text-[10px] text-muted-foreground">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add note to timeline */}
            {newStatus !== order.status && (
              <div className="mt-2">
                <input value={timelineNote} onChange={(e) => setTimelineNote(e.target.value)} className={inputClass} placeholder="Nota para a timeline (opcional)..." />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground">Fechar</button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            <Send size={14} />
            {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
