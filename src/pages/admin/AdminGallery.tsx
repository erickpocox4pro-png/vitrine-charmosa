import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";
import {
  ImageIcon, Upload, Trash2, Link2, Check, X, Search,
  Loader2, CheckSquare, Square, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface StorageFile {
  name: string;
  url: string;
  created_at: string;
  size: number;
}

const AdminGallery = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  // Fetch all images from storage
  const { data: images = [], isLoading } = useQuery({
    queryKey: ["gallery-images"],
    queryFn: async () => {
      const allImages: StorageFile[] = [];

      const listFolder = async (folder: string) => {
        const { data, error } = await supabase.storage.from("product-images").list(folder, {
          limit: 1000,
          sortBy: { column: "created_at", order: "desc" },
        });
        if (error || !data) return;

        for (const item of data) {
          const fullPath = folder ? `${folder}/${item.name}` : item.name;
          if (item.id && item.metadata) {
            // It's a file
            const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(fullPath);
            allImages.push({
              name: fullPath,
              url: urlData.publicUrl,
              created_at: item.created_at || "",
              size: item.metadata?.size || 0,
            });
          } else if (!item.id) {
            // It's a folder
            await listFolder(fullPath);
          }
        }
      };

      await listFolder("");
      return allImages;
    },
  });

  // Fetch products for linking
  const { data: products = [] } = useQuery({
    queryKey: ["gallery-products", productSearch],
    queryFn: async () => {
      let q = supabase.from("products").select("id, name, slug, image_url").order("name").limit(20);
      if (productSearch) q = q.ilike("name", `%${productSearch}%`);
      const { data } = await q;
      return data || [];
    },
    enabled: linkModalOpen,
  });

  // Fetch variants for selected product
  const { data: variants = [] } = useQuery({
    queryKey: ["gallery-variants", selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return [];
      const { data } = await supabase
        .from("product_variants")
        .select("id, name, size, color")
        .eq("product_id", selectedProductId)
        .order("name");
      return data || [];
    },
    enabled: !!selectedProductId,
  });

  // Upload handler
  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    let count = 0;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const compressed = await compressImage(file);
      const safeName = compressed.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `gallery/${Date.now()}_${safeName}`;
      try {
        const { error } = await supabase.storage.from("product-images").upload(path, compressed, {
          cacheControl: "3600",
          upsert: true,
          contentType: compressed.type,
        });
        if (!error) count++;
      } catch (err) {
        console.error(err);
      }
    }

    setUploading(false);
    if (count > 0) {
      toast.success(`${count} imagens enviadas`);
      qc.invalidateQueries({ queryKey: ["gallery-images"] });
    }
    e.target.value = "";
  }, [qc]);

  // Delete selected
  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} imagem(ns)?`)) return;

    const paths = Array.from(selected);
    const { error } = await supabase.storage.from("product-images").remove(paths);
    if (error) {
      toast.error("Erro ao excluir: " + error.message);
    } else {
      toast.success(`${paths.length} imagens excluídas`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["gallery-images"] });
    }
  };

  // Link images to product
  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProductId || selected.size === 0) throw new Error("Selecione produto e imagens");

      const selectedUrls = images
        .filter((img) => selected.has(img.name))
        .map((img) => img.url);

      // Get current max sort_order
      const { data: existingImages } = await supabase
        .from("product_images")
        .select("sort_order")
        .eq("product_id", selectedProductId)
        .order("sort_order", { ascending: false })
        .limit(1);

      let sortOrder = (existingImages?.[0]?.sort_order || 0) + 1;

      for (const url of selectedUrls) {
        await supabase.from("product_images").insert({
          product_id: selectedProductId,
          variant_id: selectedVariantId || null,
          image_url: url,
          sort_order: sortOrder++,
        });
      }

      // Also update main image if product has placeholder
      const { data: prod } = await supabase
        .from("products")
        .select("image_url")
        .eq("id", selectedProductId)
        .single();

      if (prod && (prod.image_url === "/placeholder.svg" || !prod.image_url) && selectedUrls.length > 0) {
        await supabase
          .from("products")
          .update({ image_url: selectedUrls[0] })
          .eq("id", selectedProductId);
      }
    },
    onSuccess: () => {
      toast.success(`${selected.size} imagens vinculadas ao produto!`);
      setLinkModalOpen(false);
      setSelected(new Set());
      setSelectedProductId(null);
      setSelectedVariantId(null);
      qc.invalidateQueries({ queryKey: ["gallery-images"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.name)));
    }
  };

  const filtered = images.filter((img) =>
    !search || img.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ImageIcon size={16} className="text-primary" /> Galeria de Imagens
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {images.length} imagens no storage • {selected.size} selecionadas
          </p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            <Upload size={14} /> {uploading ? "Enviando..." : "Upload"}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
          </label>
          {selected.size > 0 && (
            <>
              <Button size="sm" onClick={() => setLinkModalOpen(true)} className="gap-1.5">
                <Link2 size={14} /> Vincular a Produto ({selected.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={deleteSelected} className="gap-1.5">
                <Trash2 size={14} /> Excluir ({selected.size})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search & Select All */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar imagens..."
            className="pl-9 h-9 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll} className="gap-1.5 text-xs">
          {selected.size === filtered.length && filtered.length > 0 ? (
            <><CheckSquare size={14} /> Desmarcar Todos</>
          ) : (
            <><Square size={14} /> Selecionar Todos</>
          )}
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ImageIcon size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma imagem encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {filtered.map((img) => {
            const isSelected = selected.has(img.name);
            return (
              <div
                key={img.name}
                onClick={() => toggleSelect(img.name)}
                className={`relative group aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/30 scale-[0.96]"
                    : "border-transparent hover:border-primary/40"
                }`}
              >
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Selection indicator */}
                <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground/40 text-background opacity-0 group-hover:opacity-100"
                }`}>
                  {isSelected ? <Check size={12} /> : <Square size={10} />}
                </div>
                {/* File name */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-foreground/60 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-[8px] text-background truncate font-mono">
                    {img.name.split("/").pop()}
                  </p>
                  <p className="text-[8px] text-background/70">
                    {(img.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link Modal */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 size={18} /> Vincular {selected.size} imagem(ns) a um produto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Selected images preview */}
            <div className="flex gap-1.5 overflow-x-auto pb-2">
              {images
                .filter((img) => selected.has(img.name))
                .slice(0, 8)
                .map((img) => (
                  <img
                    key={img.name}
                    src={img.url}
                    alt={img.name}
                    className="w-14 h-14 rounded-lg object-cover shrink-0 border border-border"
                  />
                ))}
              {selected.size > 8 && (
                <div className="w-14 h-14 rounded-lg bg-secondary flex items-center justify-center text-xs text-muted-foreground shrink-0">
                  +{selected.size - 8}
                </div>
              )}
            </div>

            {/* Product search */}
            <div>
              <Label className="text-xs mb-1.5">Buscar Produto</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Nome do produto..."
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            {/* Product list */}
            <div className="max-h-48 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto encontrado</p>
              ) : (
                products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProductId(p.id); setSelectedVariantId(null); }}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors ${
                      selectedProductId === p.id
                        ? "bg-primary/15 border border-primary/30"
                        : "hover:bg-secondary"
                    }`}
                  >
                    <img
                      src={p.image_url || "/placeholder.svg"}
                      alt={p.name}
                      className="w-10 h-10 rounded object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">/{p.slug}</p>
                    </div>
                    {selectedProductId === p.id && (
                      <Check size={16} className="text-primary ml-auto shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Variant selection (optional) */}
            {selectedProductId && variants.length > 0 && (
              <div>
                <Label className="text-xs mb-1.5">Variante (opcional)</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setSelectedVariantId(null)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                      !selectedVariantId
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todas (produto geral)
                  </button>
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                        selectedVariantId === v.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {v.name} {v.size && `(${v.size})`} {v.color && `- ${v.color}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setLinkModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!selectedProductId || linkMutation.isPending}
                onClick={() => linkMutation.mutate()}
                className="gap-1.5"
              >
                {linkMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Package size={14} />
                )}
                Vincular ao Produto
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGallery;
