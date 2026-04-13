import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus, Pencil, Trash2, Store, Search, DollarSign, Sparkles,
} from "lucide-react";
import AiBulkSalesModal from "@/components/admin/AiBulkSalesModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
  { value: "outro", label: "Outro" },
];

const paymentLabel = (v: string) =>
  PAYMENT_METHODS.find((m) => m.value === v)?.label || v;

type ManualSale = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_id: string | null;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  payment_method: string;
  notes: string | null;
  sale_date: string;
  admin_email: string;
  created_at: string;
};

const AdminManualSales = () => {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ManualSale | null>(null);
  const [search, setSearch] = useState("");

  // Form state
  const [productId, setProductId] = useState<string>("");
  const [variantId, setVariantId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [variantName, setVariantName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [notes, setNotes] = useState("");
  const [saleDate, setSaleDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["manual-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_sales")
        .select("*")
        .order("sale_date", { ascending: false });
      if (error) throw error;
      return (data || []) as ManualSale[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-for-manual-sale"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  const { data: variants = [] } = useQuery({
    queryKey: ["variants-for-manual-sale", productId],
    queryFn: async () => {
      if (!productId) return [];
      const { data } = await supabase
        .from("product_variants")
        .select("id, name, size, color_name, price, stock")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!productId,
  });

  const resetForm = () => {
    setProductId("");
    setVariantId("");
    setProductName("");
    setVariantName("");
    setQuantity(1);
    setUnitPrice("");
    setPaymentMethod("dinheiro");
    setNotes("");
    setSaleDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (sale: ManualSale) => {
    setEditing(sale);
    setProductId(sale.product_id || "");
    setVariantId(sale.variant_id || "");
    setProductName(sale.product_name);
    setVariantName(sale.variant_name || "");
    setQuantity(sale.quantity);
    setUnitPrice(String(sale.unit_price));
    setPaymentMethod(sale.payment_method);
    setNotes(sale.notes || "");
    setSaleDate(format(new Date(sale.sale_date), "yyyy-MM-dd'T'HH:mm"));
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const price = parseFloat(unitPrice);
      if (isNaN(price) || price <= 0) throw new Error("Preço inválido");
      if (!productName.trim()) throw new Error("Selecione um produto");

      const payload = {
        product_id: productId || null,
        product_name: productName.trim(),
        variant_id: variantId || null,
        variant_name: variantName || null,
        quantity,
        unit_price: price,
        total: price * quantity,
        payment_method: paymentMethod,
        notes: notes.trim() || null,
        sale_date: new Date(saleDate).toISOString(),
        admin_user_id: session.user.id,
        admin_email: session.user.email || "",
      };

      if (editing) {
        const { error } = await supabase
          .from("manual_sales")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("manual_sales").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-sales"] });
      toast.success(editing ? "Venda atualizada!" : "Venda registrada!");
      setModalOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manual_sales").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manual-sales"] });
      toast.success("Venda excluída!");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // When product changes, auto-fill name and price
  const handleProductChange = (id: string) => {
    setProductId(id);
    setVariantId("");
    setVariantName("");
    const product = products.find((p) => p.id === id);
    if (product) {
      setProductName(product.name);
      setUnitPrice(String(product.price));
    }
  };

  const handleVariantChange = (id: string) => {
    setVariantId(id);
    const variant = variants.find((v) => v.id === id);
    if (variant) {
      const label = [variant.name, variant.size, variant.color_name].filter(Boolean).join(" / ");
      setVariantName(label);
      if (variant.price) setUnitPrice(String(variant.price));
    }
  };

  const filtered = sales.filter((s) =>
    s.product_name.toLowerCase().includes(search.toLowerCase()) ||
    paymentLabel(s.payment_method).toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltered = filtered.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Store size={16} className="text-primary" /> Vendas Manuais
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registre vendas físicas para controle de estoque e relatórios
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAiModalOpen(true)} className="gap-1.5">
            <Sparkles size={14} /> Gerar com IA
          </Button>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={14} /> Nova Venda
          </Button>
        </div>
      </div>

      {/* Summary + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="glass-card p-4 flex items-center gap-3 flex-1">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[11px] text-muted-foreground">Total Vendas Manuais</p>
            <p className="text-lg font-semibold font-mono text-foreground">
              R$ {totalFiltered.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] text-muted-foreground">Registros</p>
            <p className="text-lg font-semibold font-mono text-foreground">{filtered.length}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar vendas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
            <Store size={24} className="opacity-40" />
            <p>Nenhuma venda manual registrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Obs</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {format(new Date(sale.sale_date), "dd/MM/yy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-xs font-medium truncate max-w-[180px]">{sale.product_name}</p>
                      {sale.variant_name && (
                        <p className="text-[11px] text-muted-foreground">{sale.variant_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{sale.quantity}</TableCell>
                  <TableCell className="text-xs font-mono">
                    R$ {Number(sale.unit_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-xs font-mono font-medium text-primary">
                    R$ {Number(sale.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-xs">{paymentLabel(sale.payment_method)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {sale.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sale)}>
                        <Pencil size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(sale.id)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) resetForm(); setModalOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Venda" : "Nova Venda Manual"}</DialogTitle>
            <DialogDescription>
              {editing ? "Atualize os dados da venda" : "Registre uma venda física para controle"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Product */}
            <div className="space-y-1.5">
              <Label className="text-xs">Produto</Label>
              <Select value={productId} onValueChange={handleProductChange}>
                <SelectTrigger><SelectValue placeholder="Selecione um produto" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Variant */}
            {variants.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Variante</Label>
                <Select value={variantId} onValueChange={handleVariantChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione variante (opcional)" /></SelectTrigger>
                  <SelectContent>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {[v.name, v.size, v.color_name].filter(Boolean).join(" / ")} (estoque: {v.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Manual name fallback */}
            {!productId && (
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do Produto (manual)</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Digite o nome do produto"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Preço Unitário (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>

            {unitPrice && quantity > 0 && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-muted-foreground">Total da venda</p>
                <p className="text-lg font-semibold font-mono text-primary">
                  R$ {(parseFloat(unitPrice || "0") * quantity).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Forma de Pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Data da Venda</Label>
              <Input
                type="datetime-local"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observações</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observação opcional..."
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : editing ? "Atualizar Venda" : "Registrar Venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os dados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Bulk Sales Modal */}
      <AiBulkSalesModal
        open={aiModalOpen}
        onOpenChange={setAiModalOpen}
        onSalesCreated={() => qc.invalidateQueries({ queryKey: ["manual-sales"] })}
      />
    </div>
  );
};

export default AdminManualSales;
