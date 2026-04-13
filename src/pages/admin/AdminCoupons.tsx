import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Ticket, Plus, Pencil, Trash2, Copy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  category_ids: string[];
  created_at: string;
}

const emptyForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: 0,
  min_order_value: 0,
  max_discount: null as number | null,
  usage_limit: null as number | null,
  is_active: true,
  starts_at: new Date(),
  expires_at: null as Date | null,
  category_ids: [] as string[],
  applies_to: "products" as "products" | "shipping",
};

const AdminCoupons = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").eq("is_active", true);
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code: form.code.toUpperCase().trim(),
        description: form.description,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        min_order_value: form.min_order_value,
        max_discount: form.max_discount,
        usage_limit: form.usage_limit,
        is_active: form.is_active,
        starts_at: form.starts_at.toISOString(),
        expires_at: form.expires_at?.toISOString() || null,
        category_ids: form.category_ids,
        applies_to: form.applies_to,
      };
      if (editId) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success(editId ? "Cupom atualizado!" : "Cupom criado!");
      closeModal();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success("Cupom excluído!");
    },
  });

  const closeModal = () => {
    setModalOpen(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const openEdit = (c: Coupon) => {
    setEditId(c.id);
    setForm({
      code: c.code,
      description: c.description || "",
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      min_order_value: c.min_order_value || 0,
      max_discount: c.max_discount,
      usage_limit: c.usage_limit,
      is_active: c.is_active,
      starts_at: new Date(c.starts_at),
      expires_at: c.expires_at ? new Date(c.expires_at) : null,
      category_ids: c.category_ids || [],
      applies_to: (c as any).applies_to || "products",
    });
    setModalOpen(true);
  };

  const filtered = coupons.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const isExpired = (c: Coupon) => c.expires_at && new Date(c.expires_at) < new Date();
  const isLimitReached = (c: Coupon) => c.usage_limit !== null && c.usage_count >= c.usage_limit;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground">Cupons e Promoções</h2>
          <p className="font-body text-xs text-muted-foreground">Gerencie cupons de desconto da loja</p>
        </div>
        <Button size="sm" onClick={() => { setForm(emptyForm); setEditId(null); setModalOpen(true); }}>
          <Plus size={16} className="mr-1" /> Novo Cupom
        </Button>
      </div>

      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar cupom..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Ticket size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-body text-sm text-muted-foreground">Nenhum cupom encontrado.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left p-3 font-medium">Código</th>
                  <th className="text-left p-3 font-medium">Desconto</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Uso</th>
                  <th className="text-left p-3 font-medium hidden lg:table-cell">Validade</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <code className="font-mono font-semibold text-foreground">{c.code}</code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(c.code); toast.success("Copiado!"); }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                    </td>
                    <td className="p-3 font-medium">
                      {c.discount_type === "percentage" ? `${c.discount_value}%` : `R$ ${c.discount_value.toFixed(2)}`}
                      <p className="text-xs text-muted-foreground">
                        {(c as any).applies_to === "shipping" ? "🚚 Frete" : "🛍️ Produtos"}
                      </p>
                      {c.min_order_value > 0 && (
                        <p className="text-xs text-muted-foreground">Mín: R$ {c.min_order_value.toFixed(2)}</p>
                      )}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span className="text-foreground">{c.usage_count}</span>
                      <span className="text-muted-foreground">/{c.usage_limit ?? "∞"}</span>
                    </td>
                    <td className="p-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {c.expires_at ? format(new Date(c.expires_at), "dd/MM/yyyy") : "Sem validade"}
                    </td>
                    <td className="p-3">
                      {!c.is_active ? (
                        <Badge variant="secondary">Inativo</Badge>
                      ) : isExpired(c) ? (
                        <Badge variant="destructive">Expirado</Badge>
                      ) : isLimitReached(c) ? (
                        <Badge variant="outline">Esgotado</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Ativo</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => { if (confirm("Excluir este cupom?")) deleteMutation.mutate(c.id); }}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) closeModal(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.code.trim()) return toast.error("Código é obrigatório");
              if (form.discount_value <= 0) return toast.error("Valor do desconto é obrigatório");
              saveMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Código</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="EX: PROMO10" className="uppercase" />
              </div>
              <div>
                <Label className="text-xs">Aplicar em</Label>
                <Select value={form.applies_to} onValueChange={(v: "products" | "shipping") => setForm({ ...form, applies_to: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="products">🛍️ Produtos</SelectItem>
                    <SelectItem value="shipping">🚚 Frete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de desconto</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm({ ...form, discount_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Valor</Label>
                <Input type="number" min={0} step={0.01} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: +e.target.value })} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição opcional" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Pedido mín. (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.min_order_value} onChange={(e) => setForm({ ...form, min_order_value: +e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Desc. máx. (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.max_discount ?? ""} onChange={(e) => setForm({ ...form, max_discount: e.target.value ? +e.target.value : null })} placeholder="Sem limite" />
              </div>
              <div>
                <Label className="text-xs">Limite de uso</Label>
                <Input type="number" min={0} value={form.usage_limit ?? ""} onChange={(e) => setForm({ ...form, usage_limit: e.target.value ? +e.target.value : null })} placeholder="Ilimitado" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">{form.is_active ? "Ativo" : "Inativo"}</Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal h-9")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {format(form.starts_at, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={form.starts_at} onSelect={(d) => d && setForm({ ...form, starts_at: d })} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">Data expiração</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left text-xs font-normal h-9", !form.expires_at && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-3 w-3" />
                      {form.expires_at ? format(form.expires_at, "dd/MM/yyyy") : "Sem validade"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div>
                      <Calendar mode="single" selected={form.expires_at ?? undefined} onSelect={(d) => setForm({ ...form, expires_at: d ?? null })} className="p-3 pointer-events-auto" />
                      {form.expires_at && (
                        <div className="p-2 border-t border-border">
                          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setForm({ ...form, expires_at: null })}>
                            Remover data
                          </Button>
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {categories.length > 0 && (
              <div>
                <Label className="text-xs mb-1.5 block">Restringir a categorias (opcional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const selected = form.category_ids.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            category_ids: selected
                              ? form.category_ids.filter((id) => id !== cat.id)
                              : [...form.category_ids, cat.id],
                          })
                        }
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs border transition-colors",
                          selected
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        )}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                {form.category_ids.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">Nenhuma selecionada = válido para todas</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={closeModal}>Cancelar</Button>
              <Button type="submit" size="sm" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : editId ? "Atualizar" : "Criar Cupom"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCoupons;
