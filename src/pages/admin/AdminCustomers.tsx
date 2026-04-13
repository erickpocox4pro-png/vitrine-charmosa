import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, Eye, X, ShoppingBag, StickyNote, Send, ChevronLeft, ChevronRight, Mail, Calendar, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 15;

interface CustomerDetail {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  address: any;
  created_at: string;
  orders: any[];
  totalSpent: number;
  orderCount: number;
}

const AdminCustomers = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [segment, setSegment] = useState("");

  // Fetch all orders with contact info from shipping_address
  const { data: allOrders, isLoading } = useQuery({
    queryKey: ["admin-all-orders-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, user_id, total, status, created_at, shipping_address, payment_method")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Build customer list from orders (grouped by user_id)
  const enrichedProfiles = useMemo(() => {
    if (!allOrders) return [];
    const map = new Map<string, {
      user_id: string;
      name: string;
      email: string;
      phone: string;
      address: any;
      created_at: string;
      totalSpent: number;
      orderCount: number;
      lastOrder: string;
    }>();

    allOrders.forEach((o) => {
      const isPaid = ["paid", "confirmed", "processing", "shipped", "delivered"].includes(o.status);
      const addr = o.shipping_address as any;
      const existing = map.get(o.user_id);

      if (existing) {
        if (isPaid) {
          existing.totalSpent += Number(o.total);
          existing.orderCount += 1;
        }
        if (o.created_at > existing.lastOrder) {
          existing.lastOrder = o.created_at;
          if (addr) {
            existing.name = addr.name || existing.name;
            existing.email = addr.email || existing.email;
            existing.phone = addr.phone || existing.phone;
            existing.address = addr;
          }
        }
        if (o.created_at < existing.created_at) {
          existing.created_at = o.created_at;
        }
      } else {
        map.set(o.user_id, {
          user_id: o.user_id,
          name: addr?.name || "Cliente",
          email: addr?.email || "",
          phone: addr?.phone || "",
          address: addr || null,
          created_at: o.created_at,
          totalSpent: isPaid ? Number(o.total) : 0,
          orderCount: isPaid ? 1 : 0,
          lastOrder: o.created_at,
        });
      }
    });

    return Array.from(map.values()).filter((c) => c.orderCount > 0);
  }, [allOrders]);

  const filtered = useMemo(() => {
    let list = enrichedProfiles;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.user_id.toLowerCase().includes(q)
      );
    }

    if (segment === "vip") list = list.filter((c) => c.totalSpent >= 500);
    else if (segment === "recurring") list = list.filter((c) => c.orderCount >= 3);
    else if (segment === "new") list = list.filter((c) => c.orderCount <= 1);
    else if (segment === "inactive") {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      list = list.filter((c) => !c.lastOrder || c.lastOrder < thirtyDaysAgo);
    }

    return list;
  }, [enrichedProfiles, search, segment]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

  const segments = [
    { value: "", label: "Todos", count: enrichedProfiles.length },
    { value: "vip", label: "VIP (R$500+)", count: enrichedProfiles.filter((c) => c.totalSpent >= 500).length },
    { value: "recurring", label: "Recorrente (3+)", count: enrichedProfiles.filter((c) => c.orderCount >= 3).length },
    { value: "new", label: "Novos (≤1)", count: enrichedProfiles.filter((c) => c.orderCount <= 1).length },
    { value: "inactive", label: "Inativos (30d)", count: enrichedProfiles.filter((c) => {
      const t = new Date(Date.now() - 30 * 86400000).toISOString();
      return !c.lastOrder || c.lastOrder < t;
    }).length },
  ];

  const openCustomerDetail = async (profile: any) => {
    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", profile.user_id)
      .order("created_at", { ascending: false });

    setSelectedCustomer({
      user_id: profile.user_id,
      name: profile.name || "Cliente",
      email: profile.email || "",
      phone: profile.phone || "",
      address: profile.address,
      created_at: profile.created_at,
      orders: orders || [],
      totalSpent: profile.totalSpent,
      orderCount: profile.orderCount,
    });
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-body text-xl font-bold text-foreground">Clientes</h2>
        <p className="font-body text-xs text-muted-foreground mt-0.5">{filtered.length} cliente{filtered.length !== 1 ? "s" : ""} com pedidos confirmados</p>
      </div>

      {/* Segments */}
      <div className="flex flex-wrap gap-2 mb-5">
        {segments.map((s) => (
          <button
            key={s.value}
            onClick={() => { setSegment(s.value); setPage(1); }}
            className={`px-3 py-2 rounded-lg font-body text-xs font-medium transition-colors ${
              segment === s.value ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s.label} ({s.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Buscar por nome, email, telefone..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-14 bg-card rounded-lg animate-pulse" />)}</div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <Users size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-body text-sm">Nenhum cliente encontrado.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Cliente</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Contato</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Pedidos</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Total Gasto</th>
                  <th className="text-right px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => (
                  <tr key={c.user_id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-body text-sm font-medium text-foreground">{c.address?.name || c.name || "Sem nome"}</p>
                      <p className="font-body text-[10px] text-muted-foreground">
                        {c.address?.city && c.address?.state ? `${c.address.city}/${c.address.state}` : "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {c.email && (
                        <p className="font-body text-xs text-muted-foreground flex items-center gap-1">
                          <Mail size={10} /> {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p className="font-body text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> {c.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-body text-sm text-foreground">{c.orderCount}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-body text-sm font-medium text-foreground">{formatCurrency(c.totalSpent)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openCustomerDetail(c)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
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

      {/* Customer detail modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
};

// ─── Customer Detail Modal ────────────────────────────────────────

interface CustomerDetailModalProps {
  customer: CustomerDetail;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente", paid: "Pago", processing: "Em separação",
  shipped: "Enviado", delivered: "Entregue", cancelled: "Cancelado", refunded: "Reembolsado",
};

const CustomerDetailModal = ({ customer, onClose }: CustomerDetailModalProps) => {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "orders" | "notes">("info");

  const { data: notes, isLoading: notesLoading } = useQuery({
    queryKey: ["customer-notes", customer.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_user_id", customer.user_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!newNote.trim()) return;
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      const { error } = await supabase.from("customer_notes").insert({
        customer_user_id: customer.user_id,
        admin_user_id: session.session.user.id,
        admin_email: session.session.user.email || "",
        note: newNote.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      queryClient.invalidateQueries({ queryKey: ["customer-notes", customer.user_id] });
      toast.success("Nota adicionada!");
    },
    onError: () => toast.error("Erro ao adicionar nota."),
  });

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const addr = customer.address;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border w-full max-w-2xl max-h-[85vh] flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-body text-lg font-bold text-foreground">{addr?.name || customer.name}</h3>
            <p className="font-body text-xs text-muted-foreground">Cliente desde {formatDate(customer.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-border">
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="font-body text-lg font-bold text-foreground">{customer.orderCount}</p>
            <p className="font-body text-[10px] text-muted-foreground">Pedidos</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="font-body text-lg font-bold text-foreground">{formatCurrency(customer.totalSpent)}</p>
            <p className="font-body text-[10px] text-muted-foreground">Total Gasto</p>
          </div>
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="font-body text-lg font-bold text-foreground">
              {customer.orderCount > 0 ? formatCurrency(customer.totalSpent / customer.orderCount) : "—"}
            </p>
            <p className="font-body text-[10px] text-muted-foreground">Ticket Médio</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 py-3 font-body text-sm font-medium text-center transition-colors ${activeTab === "info" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Users size={14} className="inline mr-1.5" /> Dados
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex-1 py-3 font-body text-sm font-medium text-center transition-colors ${activeTab === "orders" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ShoppingBag size={14} className="inline mr-1.5" /> Pedidos ({customer.orders.length})
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`flex-1 py-3 font-body text-sm font-medium text-center transition-colors ${activeTab === "notes" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <StickyNote size={14} className="inline mr-1.5" /> Notas ({notes?.length || 0})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "info" && (
            <div className="space-y-4">
              {/* Contact */}
              <div className="bg-secondary/20 rounded-lg p-4 space-y-3">
                <h4 className="font-body text-sm font-semibold text-foreground">Informações de Contato</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-body text-[10px] text-muted-foreground">Email</p>
                      <p className="font-body text-sm text-foreground">{customer.email || addr?.email || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="font-body text-[10px] text-muted-foreground">Telefone</p>
                      <p className="font-body text-sm text-foreground">{customer.phone || addr?.phone || "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              {addr && (
                <div className="bg-secondary/20 rounded-lg p-4 space-y-3">
                  <h4 className="font-body text-sm font-semibold text-foreground flex items-center gap-2">
                    <MapPin size={14} /> Endereço
                  </h4>
                  <div className="font-body text-sm text-foreground space-y-1">
                    <p>{addr.street}, {addr.number}{addr.complement ? ` - ${addr.complement}` : ""}</p>
                    <p>{addr.neighborhood} - {addr.city}/{addr.state}</p>
                    <p className="font-mono text-xs">CEP: {addr.cep}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <div className="space-y-2">
              {customer.orders.length === 0 ? (
                <p className="text-center text-muted-foreground font-body text-sm py-8">Nenhum pedido.</p>
              ) : (
                customer.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border">
                    <div>
                      <p className="font-mono text-xs text-foreground">#{o.id.slice(0, 8)}</p>
                      <p className="font-body text-[10px] text-muted-foreground mt-0.5">{formatDate(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-body text-sm font-semibold text-foreground">{formatCurrency(Number(o.total))}</p>
                      <span className="font-body text-[10px] text-muted-foreground">{statusLabels[o.status] || o.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-4">
              {/* Add note */}
              <div className="flex gap-2">
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Adicionar nota interna..."
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
                  onKeyDown={(e) => e.key === "Enter" && addNoteMutation.mutate()}
                />
                <button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!newNote.trim() || addNoteMutation.isPending}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm disabled:opacity-50"
                >
                  <Send size={14} />
                </button>
              </div>

              {/* Notes list */}
              {notesLoading ? (
                <div className="h-20 bg-secondary/20 rounded-lg animate-pulse" />
              ) : notes?.length === 0 ? (
                <p className="text-center text-muted-foreground font-body text-sm py-8">Nenhuma nota.</p>
              ) : (
                notes?.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg bg-secondary/20 border border-border">
                    <p className="font-body text-sm text-foreground">{n.note}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="font-body text-[10px] text-muted-foreground">{n.admin_email}</span>
                      <span className="font-body text-[10px] text-muted-foreground">• {formatDate(n.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCustomers;
