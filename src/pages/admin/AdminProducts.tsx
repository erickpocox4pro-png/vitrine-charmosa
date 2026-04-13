import { useState, useMemo } from "react";
import { Package as PackageIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Filter, MoreHorizontal, Copy, Star, ChevronLeft, ChevronRight, Palette, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getProductImage } from "@/data/products";
import { logAuditAction } from "@/lib/auditLog";
import ProductFormModal from "@/components/admin/ProductFormModal";

const ITEMS_PER_PAGE = 15;

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-green-500/15 text-green-400" },
  draft: { label: "Rascunho", className: "bg-yellow-500/15 text-yellow-400" },
  hidden: { label: "Oculto", className: "bg-muted text-muted-foreground" },
  out_of_stock: { label: "Esgotado", className: "bg-destructive/15 text-destructive" },
};

const AdminProducts = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const [analyzingBgs, setAnalyzingBgs] = useState(false);

  const analyzeAllBackgrounds = async () => {
    // Re-fetch all products directly to ensure we have the latest list
    const { data: allProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, image_url")
      .order("created_at", { ascending: false });

    if (fetchError || !allProducts || allProducts.length === 0) {
      toast.error("Nenhum produto encontrado para analisar.");
      return;
    }

    const toAnalyze = allProducts.filter((p) => p.image_url);
    if (toAnalyze.length === 0) {
      toast.error("Nenhum produto com imagem para analisar.");
      return;
    }

    setAnalyzingBgs(true);
    let done = 0;
    let errors = 0;
    toast.info(`Analisando ${toAnalyze.length} produto(s)...`);
    for (const p of toAnalyze) {
      try {
        const { error } = await supabase.functions.invoke("analyze-product-bg", {
          body: { imageUrl: p.image_url, productId: p.id },
        });
        if (error) {
          errors++;
        } else {
          done++;
        }
      } catch {
        errors++;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success(`${done} produto(s) analisado(s)!${errors > 0 ? ` ${errors} erro(s).` : ""}`);
    setAnalyzingBgs(false);
  };

  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories:categories!products_category_id_fkey(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (!products) return [];
    return products.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p as any).sku?.toLowerCase().includes(search.toLowerCase());
      const matchCategory = !filterCategory || p.category_id === filterCategory;
      const matchStatus = !filterStatus || (p as any).status === filterStatus;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [products, search, filterCategory, filterStatus]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active, name }: { id: string; is_active: boolean; name: string }) => {
      const { error } = await supabase.from("products").update({ is_active }).eq("id", id);
      if (error) throw error;
      await logAuditAction("update", "product", id, name, { campo: is_active ? "Ativado" : "Desativado" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      // If product has order items, archive instead of hard-delete (preserve order history)
      const { count: orderItemsCount, error: orderCountError } = await supabase
        .from("order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id);

      if (orderCountError) throw orderCountError;

      if ((orderItemsCount || 0) > 0) {
        const { error: archiveError } = await supabase
          .from("products")
          .update({ is_active: false, status: "hidden" })
          .eq("id", id);

        if (archiveError) throw archiveError;

        await logAuditAction("update", "product", id, name, {
          motivo: "Produto possui pedidos e foi ocultado em vez de excluído",
          action: "archived",
        });

        return { mode: "archived" as const };
      }

      // Fetch backup before deleting for rollback audit
      const { data: backup } = await supabase.from("products").select("*").eq("id", id).single();
      const { data: variants } = await supabase.from("product_variants").select("*").eq("product_id", id);
      const { data: images } = await supabase.from("product_images").select("*").eq("product_id", id);

      // Remove children first to avoid FK errors
      const { error: imagesDeleteError } = await supabase.from("product_images").delete().eq("product_id", id);
      if (imagesDeleteError) throw imagesDeleteError;

      const { error: variantsDeleteError } = await supabase.from("product_variants").delete().eq("product_id", id);
      if (variantsDeleteError) throw variantsDeleteError;

      const { error: productDeleteError } = await supabase.from("products").delete().eq("id", id);
      if (productDeleteError) throw productDeleteError;

      await logAuditAction("delete", "product", id, name, {
        _backup: backup,
        _variants: variants || [],
        _images: images || [],
      });

      return { mode: "deleted" as const };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(result.mode === "archived" ? "Produto tem pedidos vinculados: foi ocultado." : "Produto removido!");
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (product: any) => {
      const { id, created_at, updated_at, categories: _, ...rest } = product;
      const { error } = await supabase.from("products").insert({
        ...rest,
        name: `${rest.name} (cópia)`,
        slug: rest.slug ? `${rest.slug}-copia-${Date.now()}` : null,
        sku: rest.sku ? `${rest.sku}-COPY` : null,
        status: "draft",
      });
      if (error) throw error;
      await logAuditAction("create", "product", undefined, `${rest.name} (cópia)`, { origem: "duplicação" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto duplicado como rascunho!");
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground">Produtos</h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={analyzeAllBackgrounds}
            disabled={analyzingBgs}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-body text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
            title="Analisar fundos das imagens para organizar visualmente"
          >
            {analyzingBgs ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />}
            Analisar Fundos
          </button>
          <button
            onClick={() => { setEditingProduct(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> Novo Produto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome ou SKU..."
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Todas categorias</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-lg border border-border bg-card font-body text-sm text-foreground outline-none focus:border-primary"
        >
          <option value="">Todos status</option>
          <option value="active">Ativo</option>
          <option value="draft">Rascunho</option>
          <option value="hidden">Oculto</option>
          <option value="out_of_stock">Esgotado</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card rounded-lg animate-pulse" />)}
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border">
          <PackageIcon size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-body text-sm">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produto</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">SKU</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Categoria</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preço</th>
                  <th className="text-left px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((product) => {
                  const status = statusLabels[(product as any).status || "active"] || statusLabels.active;
                  return (
                    <tr key={product.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={getProductImage(product.image_url)}
                            alt={product.name}
                            className="w-10 h-10 rounded-lg object-cover shrink-0 border border-border"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-body text-sm font-medium text-foreground truncate">{product.name}</p>
                              {(product as any).is_featured && <Star size={12} className="text-yellow-400 shrink-0 fill-yellow-400" />}
                              {product.is_new && <span className="text-[9px] font-body px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium shrink-0">NOVO</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-xs text-muted-foreground font-mono">{(product as any).sku || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-body text-sm text-muted-foreground">{(product as any).categories?.name || product.category}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-body text-sm font-medium text-foreground">
                            R$ {Number(product.price).toFixed(2).replace(".", ",")}
                          </span>
                          {product.original_price && (
                            <span className="font-body text-xs text-muted-foreground line-through ml-1.5">
                              R$ {Number(product.original_price).toFixed(2).replace(".", ",")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-body font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            onClick={() => toggleActiveMutation.mutate({ id: product.id, is_active: !product.is_active, name: product.name })}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title={product.is_active ? "Desativar" : "Ativar"}
                          >
                            {product.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                          </button>
                          <button
                            onClick={() => duplicateMutation.mutate(product)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Duplicar"
                          >
                            <Copy size={15} />
                          </button>
                          <button
                            onClick={() => { setEditingProduct(product); setShowForm(true); }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => { if (confirm("Remover este produto?")) deleteMutation.mutate({ id: product.id, name: product.name }); }}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-border">
            {paginated.map((product) => {
              const status = statusLabels[(product as any).status || "active"] || statusLabels.active;
              return (
                <div key={product.id} className="p-4 flex items-center gap-3">
                  <img src={getProductImage(product.image_url)} alt={product.name} className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border" />
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm font-medium text-foreground truncate">{product.name}</p>
                    <p className="font-body text-xs text-muted-foreground">{(product as any).categories?.name || product.category}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-body text-sm font-medium text-foreground">R$ {Number(product.price).toFixed(2).replace(".", ",")}</span>
                      <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-body font-medium ${status.className}`}>{status.label}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => { setEditingProduct(product); setShowForm(true); }} className="p-1.5 rounded text-muted-foreground hover:text-foreground">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => { if (confirm("Remover?")) deleteMutation.mutate({ id: product.id, name: product.name }); }} className="p-1.5 rounded text-muted-foreground hover:text-destructive">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="font-body text-xs text-muted-foreground">
            {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).slice(Math.max(0, page - 3), page + 2).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`w-8 h-8 rounded-lg font-body text-xs font-medium ${p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                {p}
              </button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
        />
      )}
    </div>
  );
};

export default AdminProducts;
