import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GripVertical, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getProductImage } from "@/data/products";

interface ProductItem {
  id: string;
  name: string;
  image_url: string;
  price: number;
  sort_order: number;
  category_id: string | null;
  category: string;
}

const AdminProductOrder = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [orderedProducts, setOrderedProducts] = useState<ProductItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products-order"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, image_url, price, sort_order, category_id, category")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ProductItem[];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    const list = selectedCategory
      ? products.filter((p) => p.category_id === selectedCategory)
      : products;
    return [...list].sort((a, b) => a.sort_order - b.sort_order);
  }, [products, selectedCategory]);

  // Sync when filter or data changes
  useMemo(() => {
    setOrderedProducts(filtered);
    setHasChanges(false);
  }, [filtered]);

  const handleDragStart = (index: number) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const items = [...orderedProducts];
    const draggedItem = items[dragItem.current];
    items.splice(dragItem.current, 1);
    items.splice(dragOverItem.current, 0, draggedItem);
    dragItem.current = null;
    dragOverItem.current = null;
    setOrderedProducts(items);
    setHasChanges(true);
  };

  // Touch drag support
  const touchStart = useRef<{ index: number; y: number } | null>(null);
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    touchStart.current = { index, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const touch = e.touches[0];
    const elements = document.querySelectorAll("[data-order-item]");
    for (let i = 0; i < elements.length; i++) {
      const rect = elements[i].getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        dragOverItem.current = i;
        break;
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStart.current === null || dragOverItem.current === null) return;
    dragItem.current = touchStart.current.index;
    handleDragEnd();
    touchStart.current = null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = orderedProducts.map((p, index) => ({
        id: p.id,
        sort_order: index + 1,
      }));

      for (const u of updates) {
        const { error } = await supabase
          .from("products")
          .update({ sort_order: u.sort_order })
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products-order"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setHasChanges(false);
      toast.success("Ordem dos produtos salva com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao salvar a ordem.");
    },
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground">Ordenar Produtos</h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Arraste os produtos para definir a ordem de exibição na loja
          </p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Ordem
        </button>
      </div>

      {/* Category filter */}
      <div className="mb-4">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Todas as categorias</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />
          ))}
        </div>
      ) : orderedProducts.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <p className="text-muted-foreground font-body text-sm">Nenhum produto encontrado nesta categoria.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {orderedProducts.map((product, index) => (
              <div
                key={product.id}
                data-order-item
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                onTouchStart={(e) => handleTouchStart(index, e)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors cursor-grab active:cursor-grabbing select-none"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <GripVertical size={18} className="text-muted-foreground" />
                  <span className="font-body text-xs text-muted-foreground font-mono w-6 text-center">
                    {index + 1}
                  </span>
                </div>
                <img
                  src={getProductImage(product.image_url)}
                  alt={product.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-body text-sm font-medium text-foreground truncate">{product.name}</p>
                  <p className="font-body text-xs text-muted-foreground">{product.category}</p>
                </div>
                <span className="font-body text-sm font-medium text-foreground shrink-0">
                  R$ {Number(product.price).toFixed(2).replace(".", ",")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-full shadow-lg font-body text-sm font-medium flex items-center gap-2">
          <span>Alterações não salvas</span>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="underline hover:no-underline"
          >
            Salvar agora
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminProductOrder;
