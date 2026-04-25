import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Plus, Trash2, Upload, GripVertical, Tag, Image, Sparkles, Loader2, Wand2, Undo2 } from "lucide-react";
import { STORE_COLOR_PRESETS } from "@/data/colorPresets";

const resolveColorToCSS = (color: string): string => {
  if (color.startsWith("#")) return color;
  const preset = STORE_COLOR_PRESETS.find(p => p.name.toLowerCase() === color.toLowerCase());
  if (preset && preset.hex !== "#MULTI") return preset.hex;
  return color.toLowerCase();
};
import { toast } from "sonner";
import { logAuditAction } from "@/lib/auditLog";
import { compressImage } from "@/lib/imageCompression";

interface Props {
  product: any | null;
  onClose: () => void;
}

const tabs = [
  { id: "geral", label: "Geral" },
  { id: "precos", label: "Preços" },
  { id: "imagens", label: "Imagens" },
  { id: "variacoes", label: "Variações" },
  { id: "seo", label: "SEO" },
  { id: "avancado", label: "Avançado" },
];

// ---- Variant Card with per-variant images ----
const VariantCard = ({ variant, productId, onDelete, queryClient }: {
  variant: any; productId: string; onDelete: () => void; queryClient: any;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [editingStock, setEditingStock] = useState(false);
  const [stockValue, setStockValue] = useState(String(variant.stock ?? 0));
  const variantFileRef = useRef<HTMLInputElement>(null);

  const updateStock = async () => {
    const newStock = parseInt(stockValue, 10);
    if (isNaN(newStock) || newStock < 0) { setStockValue(String(variant.stock ?? 0)); setEditingStock(false); return; }
    if (newStock === variant.stock) { setEditingStock(false); return; }
    const { error } = await supabase.from("product_variants").update({ stock: newStock }).eq("id", variant.id);
    if (error) { toast.error("Erro ao atualizar estoque"); } else {
      queryClient.invalidateQueries({ queryKey: ["admin-variants", productId] });
      toast.success("Estoque atualizado!");
    }
    setEditingStock(false);
  };

  const { data: variantImages = [] } = useQuery({
    queryKey: ["variant-images", variant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_images")
        .select("*")
        .eq("variant_id", variant.id)
        .order("sort_order");
      return data || [];
    },
  });

  const handleUploadVariantImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !productId) return;
    const remaining = 3 - variantImages.length;
    if (remaining <= 0) { toast.error("Máximo de 3 imagens por variante."); e.target.value = ""; return; }
    const toUpload = Array.from(files).slice(0, remaining);
    for (const file of toUpload) {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop();
      const path = `variants/${variant.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: compressed.type });
      if (error) continue;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
      await supabase.from("product_images").insert({
        product_id: productId,
        variant_id: variant.id,
        image_url: publicUrl,
        sort_order: variantImages.length,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["variant-images", variant.id] });
    toast.success("Imagens da variante adicionadas!");
    e.target.value = "";
  };

  const deleteVariantImage = async (imageId: string) => {
    await supabase.from("product_images").delete().eq("id", imageId);
    queryClient.invalidateQueries({ queryKey: ["variant-images", variant.id] });
  };

  return (
    <div className="rounded-lg bg-secondary border border-border overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 flex flex-wrap gap-2 text-xs font-body">
          {variant.color && (
            <span className="px-2 py-1 rounded-md bg-background border border-border flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: resolveColorToCSS(variant.color) }} />
              {(variant as any).color_name || variant.color}
            </span>
          )}
          {variant.size && <span className="px-2 py-1 rounded-md bg-background border border-border">Tam: {variant.size}</span>}
          {variant.numbering && <span className="px-2 py-1 rounded-md bg-background border border-border">Nº: {variant.numbering}</span>}
          {variant.estampa && <span className="px-2 py-1 rounded-md bg-background border border-border">🎨 {variant.estampa}</span>}
          {variant.price && <span className="px-2 py-1 rounded-md bg-background border border-border">R$ {Number(variant.price).toFixed(2).replace(".", ",")}</span>}
          {editingStock ? (
            <input
              type="number"
              min="0"
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value)}
              onBlur={updateStock}
              onKeyDown={(e) => { if (e.key === "Enter") updateStock(); if (e.key === "Escape") { setStockValue(String(variant.stock ?? 0)); setEditingStock(false); } }}
              autoFocus
              className="w-16 px-2 py-1 rounded-md bg-background border border-primary text-foreground text-xs font-body outline-none"
            />
          ) : (
            <button
              onClick={() => { setStockValue(String(variant.stock ?? 0)); setEditingStock(true); }}
              className="px-2 py-1 rounded-md bg-background border border-border hover:border-primary hover:text-primary transition-colors cursor-pointer"
              title="Clique para editar estoque"
            >
              Estoque: {variant.stock}
            </button>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`p-1.5 rounded transition-colors ${expanded ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
          title="Imagens da variante"
        >
          <Image size={14} />
          {variantImages.length > 0 && (
            <span className="ml-0.5 text-[9px] font-mono">{variantImages.length}</span>
          )}
        </button>
        <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
      </div>

      {expanded && (
        <div className="border-t border-border p-3 bg-background/50">
          <div className="flex items-center justify-between mb-2">
            <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Imagens desta variante {variant.color ? `(${(variant as any).color_name || variant.color})` : variant.estampa ? `(${variant.estampa})` : ""} — máx. 3
            </p>
            <button
              onClick={() => { if (variantImages.length >= 3) { toast.error("Máximo de 3 imagens por variante."); return; } variantFileRef.current?.click(); }}
              className={`flex items-center gap-1 text-primary font-body text-xs font-medium hover:underline ${variantImages.length >= 3 ? "opacity-40 pointer-events-none" : ""}`}
            >
              <Upload size={12} /> Adicionar
            </button>
            <input ref={variantFileRef} type="file" accept="image/*" multiple onChange={handleUploadVariantImage} className="hidden" />
          </div>

          {variantImages.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground font-body text-xs">
              Sem imagens. A imagem principal do produto será usada.
            </p>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {variantImages.map((img: any) => (
                <div key={img.id} className="relative group">
                  <img src={img.image_url} alt="" className="w-full aspect-square rounded-lg object-cover border border-border" />
                  <button
                    onClick={() => deleteVariantImage(img.id)}
                    className="absolute top-1 right-1 p-0.5 rounded bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ProductFormModal = ({ product, onClose }: Props) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const isEditing = !!product;
  const [activeTab, setActiveTab] = useState("geral");

  // General
  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [sku, setSku] = useState(product?.sku || "");
  const [shortDescription, setShortDescription] = useState(product?.short_description || "");
  const [description, setDescription] = useState(product?.description || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || "");
  const [category, setCategory] = useState(product?.category || "");
  const [brand, setBrand] = useState(product?.brand || "");
  const [tagsInput, setTagsInput] = useState((product?.tags || []).join(", "));
  const [status, setStatus] = useState(product?.status || "active");

  // Pricing
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [originalPrice, setOriginalPrice] = useState(product?.original_price?.toString() || "");
  const [cost, setCost] = useState("");

  // Load cost from product_costs table
  useEffect(() => {
    if (product?.id) {
      supabase.from("product_costs" as any).select("cost").eq("product_id", product.id).maybeSingle()
        .then(({ data }: any) => {
          if (data?.cost) setCost(String(data.cost));
        });
    }
  }, [product?.id]);

  // Images - up to 4 (first is principal)
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [videoUrl, setVideoUrl] = useState(product?.video_url || "");
  const [uploading, setUploading] = useState(false);
  const [extraImages, setExtraImages] = useState<string[]>([]);
  const [uploadingExtra, setUploadingExtra] = useState(false);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // Flags
  const [isNew, setIsNew] = useState(product?.is_new || false);
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isFeatured, setIsFeatured] = useState(product?.is_featured || false);
  const [isBestseller, setIsBestseller] = useState(product?.is_bestseller || false);

  // Physical
  const [weight, setWeight] = useState(product?.weight?.toString() || "");
  const [width, setWidth] = useState(product?.width?.toString() || "");
  const [height, setHeight] = useState(product?.height?.toString() || "");
  const [length, setLength] = useState(product?.length?.toString() || "");

  // SEO
  const [metaTitle, setMetaTitle] = useState(product?.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(product?.meta_description || "");
  const [keywords, setKeywords] = useState(product?.keywords || "");

  // Variants
  const [variants, setVariants] = useState<any[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantColor, setVariantColor] = useState("");
  const [variantColorName, setVariantColorName] = useState("");
  const [variantSize, setVariantSize] = useState("");
  const [variantNumbering, setVariantNumbering] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [variantEstampa, setVariantEstampa] = useState("");
  const [variantStock, setVariantStock] = useState("0");

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("*").order("sort_order");
      return data || [];
    },
  });

  // AI Generation
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiPreviousValues, setAiPreviousValues] = useState<Record<string, string>>({});
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [loadingTagSuggestions, setLoadingTagSuggestions] = useState(false);
  const tagSuggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-suggest tags when name changes (debounced)
  const autoSuggestTags = useCallback(async (productName: string) => {
    if (!productName || productName.length < 3) {
      setSuggestedTags([]);
      setShowTagSuggestions(false);
      return;
    }
    setLoadingTagSuggestions(true);
    try {
      const selectedCategory = categories?.find((c) => c.id === categoryId);
      const { data, error } = await supabase.functions.invoke("generate-product-ai", {
        body: { productName, category: selectedCategory?.name || category || "", brand: brand || "", field: "tags" },
      });
      if (!error && data?.content) {
        const tags = data.content.trim().split(",").map((t: string) => t.trim()).filter(Boolean);
        setSuggestedTags(tags);
        setShowTagSuggestions(true);
      }
    } catch { /* silent */ }
    setLoadingTagSuggestions(false);
  }, [categories, categoryId, category, brand]);

  useEffect(() => {
    if (tagSuggestTimer.current) clearTimeout(tagSuggestTimer.current);
    if (name.length >= 3 && !isEditing) {
      tagSuggestTimer.current = setTimeout(() => autoSuggestTags(name), 1500);
    }
    return () => { if (tagSuggestTimer.current) clearTimeout(tagSuggestTimer.current); };
  }, [name, autoSuggestTags, isEditing]);

  const addSuggestedTag = (tag: string) => {
    const currentTags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      setTagsInput(currentTags.length > 0 ? `${tagsInput}, ${tag}` : tag);
    }
  };

  const addAllSuggestedTags = () => {
    const currentTags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
    const newTags = suggestedTags.filter(t => !currentTags.includes(t));
    const merged = [...currentTags, ...newTags].join(", ");
    setTagsInput(merged);
    setShowTagSuggestions(false);
  };

  const saveAndSet = (field: string, setter: (v: string) => void, currentValue: string, newValue: string) => {
    setAiPreviousValues((prev) => ({ ...prev, [field]: currentValue }));
    setter(newValue);
  };

  const undoAI = (field: string) => {
    const prev = aiPreviousValues[field];
    if (prev === undefined) return;
    if (field === "short_description") setShortDescription(prev);
    else if (field === "description") setDescription(prev);
    else if (field === "slug") setSlug(prev);
    else if (field === "sku") setSku(prev);
    else if (field === "tags") setTagsInput(prev);
    else if (field === "meta_title") setMetaTitle(prev);
    else if (field === "meta_description") setMetaDescription(prev);
    else if (field === "keywords") setKeywords(prev);
    setAiPreviousValues((prev) => { const n = { ...prev }; delete n[field]; return n; });
    toast.success("Valor anterior restaurado!");
  };

  const generateWithAI = async (field: string) => {
    if (!name.trim()) {
      toast.error("Preencha o nome do produto antes de gerar com IA.");
      return;
    }
    setAiLoading((prev) => ({ ...prev, [field]: true }));
    try {
      const selectedCategory = categories?.find((c) => c.id === categoryId);
      const { data, error } = await supabase.functions.invoke("generate-product-ai", {
        body: {
          productName: name,
          category: selectedCategory?.name || category || "",
          brand: brand || "",
          field,
          imageUrl: imageUrl || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const content = data.content?.trim() || "";

      if (field === "short_description") {
        saveAndSet("short_description", setShortDescription, shortDescription, content);
      } else if (field === "description") {
        saveAndSet("description", setDescription, description, content);
      } else if (field === "slug") {
        saveAndSet("slug", setSlug, slug, content.replace(/[^a-z0-9-]/g, ""));
      } else if (field === "sku") {
        saveAndSet("sku", setSku, sku, content.replace(/[^A-Z0-9-]/g, ""));
      } else if (field === "tags") {
        saveAndSet("tags", setTagsInput, tagsInput, content);
      } else if (field === "seo" || field === "all") {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            // Save previous values for undo
            if (parsed.meta_title) { setAiPreviousValues((p) => ({ ...p, meta_title: metaTitle })); setMetaTitle(parsed.meta_title); }
            if (parsed.meta_description) { setAiPreviousValues((p) => ({ ...p, meta_description: metaDescription })); setMetaDescription(parsed.meta_description); }
            if (parsed.keywords) { setAiPreviousValues((p) => ({ ...p, keywords })); setKeywords(parsed.keywords); }
            if (field === "all") {
              if (parsed.short_description) { setAiPreviousValues((p) => ({ ...p, short_description: shortDescription })); setShortDescription(parsed.short_description); }
              if (parsed.description) { setAiPreviousValues((p) => ({ ...p, description })); setDescription(parsed.description); }
              if (parsed.slug) { setAiPreviousValues((p) => ({ ...p, slug })); setSlug(parsed.slug.replace(/[^a-z0-9-]/g, "")); }
              if (parsed.sku) { setAiPreviousValues((p) => ({ ...p, sku })); setSku(parsed.sku.replace(/[^A-Z0-9-]/g, "")); }
              if (parsed.tags) { setAiPreviousValues((p) => ({ ...p, tags: tagsInput })); setTagsInput(parsed.tags); }
            }
          }
        } catch {
          toast.error("Erro ao processar resposta da IA.");
          return;
        }
      }
      toast.success("Conteúdo gerado com IA!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar com IA.");
    } finally {
      setAiLoading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const AIButton = ({ field, label = "Gerar com IA" }: { field: string; label?: string }) => (
    <div className="flex items-center gap-1.5 mt-1.5">
      <button
        type="button"
        onClick={() => generateWithAI(field)}
        disabled={aiLoading[field] || !name.trim()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary font-body text-[11px] font-medium hover:bg-primary/20 disabled:opacity-40 transition-colors"
      >
        {aiLoading[field] ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {label}
      </button>
      {aiPreviousValues[field] !== undefined && (
        <button
          type="button"
          onClick={() => undoAI(field)}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md bg-muted text-muted-foreground font-body text-[11px] font-medium hover:bg-muted/80 transition-colors"
          title="Desfazer geração"
        >
          <Undo2 size={11} /> Desfazer
        </button>
      )}
    </div>
  );


  const { data: existingVariants } = useQuery({
    queryKey: ["admin-variants", product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data } = await supabase.from("product_variants").select("*").eq("product_id", product.id).order("created_at");
      return data || [];
    },
    enabled: !!product?.id,
  });

  const { data: productImages } = useQuery({
    queryKey: ["admin-product-images", product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data } = await supabase.from("product_images").select("*").eq("product_id", product.id).is("variant_id", null).order("sort_order");
      return data || [];
    },
    enabled: !!product?.id,
  });

  // Load existing extra images into state
  useState(() => {
    if (productImages && productImages.length > 0 && extraImages.length === 0) {
      setExtraImages(productImages.map((img) => img.image_url));
    }
  });

  // Sync extra images when productImages loads
  const [syncedImages, setSyncedImages] = useState(false);
  if (productImages && productImages.length > 0 && !syncedImages) {
    setExtraImages(productImages.map((img) => img.image_url));
    setSyncedImages(true);
  }

  const generateSlug = (text: string) => {
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (!isEditing && !slug) {
      setSlug(generateSlug(val));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const compressed = await compressImage(file);
    const ext = compressed.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: compressed.type });
    if (error) { toast.error("Erro ao enviar imagem."); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    setImageUrl(publicUrl);
    setUploading(false);
    toast.success("Imagem principal enviada!");
  };

  const handleExtraImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = 3 - extraImages.length;
    if (remaining <= 0) { toast.error("Máximo de 3 imagens extras (4 no total)."); return; }
    setUploadingExtra(true);
    const toUpload = Array.from(files).slice(0, remaining);
    const newUrls: string[] = [];
    for (const file of toUpload) {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop();
      const path = `extras/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: compressed.type });
      if (error) continue;
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
      newUrls.push(publicUrl);
    }
    setExtraImages((prev) => [...prev, ...newUrls]);
    setUploadingExtra(false);
    toast.success("Imagens adicionadas!");
    e.target.value = "";
  };

  const removeExtraImage = (index: number) => {
    setExtraImages((prev) => prev.filter((_, i) => i !== index));
  };

  const promoteToMain = (index: number) => {
    const newMain = extraImages[index];
    const oldMain = imageUrl;
    setImageUrl(newMain);
    setExtraImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (oldMain) next.unshift(oldMain);
      return next;
    });
    toast.success("Imagem definida como principal!");
  };

  const margin = price && cost ? (((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100).toFixed(1) : null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedCategory = categories?.find((c) => c.id === categoryId);
      const tagsArray = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const productData: Record<string, any> = {
        name,
        slug: slug || generateSlug(name),
        sku: sku || null,
        short_description: shortDescription,
        description,
        price: parseFloat(price),
        original_price: originalPrice ? parseFloat(originalPrice) : null,
        
        category_id: categoryId || null,
        category: selectedCategory?.name || category,
        image_url: imageUrl || "/products/placeholder.jpg",
        video_url: videoUrl || "",
        brand,
        tags: tagsArray,
        status,
        is_new: isNew,
        is_active: isActive,
        is_featured: isFeatured,
        is_bestseller: isBestseller,
        weight: weight ? parseFloat(weight) : null,
        width: width ? parseFloat(width) : null,
        height: height ? parseFloat(height) : null,
        length: length ? parseFloat(length) : null,
        meta_title: metaTitle,
        meta_description: metaDescription,
        keywords,
      };

      let productId = product?.id;

      if (isEditing) {
        const { error } = await supabase.from("products").update(productData as any).eq("id", product.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("products").insert(productData as any).select().single();
        if (error) throw error;
        productId = data.id;
      }

      // Save cost to product_costs table
      if (productId) {
        const costValue = cost ? parseFloat(cost) : null;
        if (costValue !== null) {
          await supabase.from("product_costs" as any).upsert({
            product_id: productId,
            cost: costValue,
          } as any, { onConflict: "product_id" });
        }
      }

      if (variants.length > 0 && productId) {
      const variantsToInsert = variants.map((v) => ({
          product_id: productId,
          color: v.color || null,
          color_name: v.color_name || v.color || null,
          size: v.size || null,
          numbering: v.numbering || null,
          estampa: v.estampa || null,
          price: v.price ? parseFloat(v.price) : null,
          stock: parseInt(v.stock) || 0,
        }));
        const { error } = await supabase.from("product_variants").insert(variantsToInsert);
        if (error) throw error;
      }

      // Save extra images to product_images table
      if (productId) {
        // Delete old non-variant images
        await supabase.from("product_images").delete().eq("product_id", productId).is("variant_id", null);
        // Insert new extra images
        if (extraImages.length > 0) {
          const imagesToInsert = extraImages.map((url, idx) => ({
            product_id: productId,
            image_url: url,
            sort_order: idx,
          }));
          await supabase.from("product_images").insert(imagesToInsert);
        }
      }

      return productId;
    },
    onSuccess: (savedProductId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      logAuditAction(isEditing ? "update" : "create", "product", product?.id, name, { preço: price, categoria: categories?.find((c) => c.id === categoryId)?.name || category });
      toast.success(isEditing ? "Produto atualizado!" : "Produto criado!");

      // Analyze background color asynchronously (fire and forget)
      if (imageUrl && savedProductId) {
        supabase.functions.invoke("analyze-product-bg", {
          body: { imageUrl, productId: savedProductId },
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }).catch(() => { /* silent - non-critical */ });
      }

      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar produto."),
  });

  const addVariant = () => {
    if (!variantColor && !variantSize && !variantNumbering && !variantEstampa) {
      toast.error("Preencha ao menos um campo da variante.");
      return;
    }
    setVariants([...variants, { color: variantColor, color_name: variantColorName || variantColor, size: variantSize, numbering: variantNumbering, estampa: variantEstampa, price: variantPrice, stock: variantStock }]);
    setVariantColor(""); setVariantColorName(""); setVariantSize(""); setVariantNumbering(""); setVariantEstampa(""); setVariantPrice(""); setVariantStock("0");
    setShowVariantForm(false);
  };

  // AI Variant Generation
  const [showAIVariantForm, setShowAIVariantForm] = useState(false);
  const [aiVariantText, setAIVariantText] = useState("");
  const [aiVariantLoading, setAIVariantLoading] = useState(false);

  const generateVariantsWithAI = async () => {
    if (!aiVariantText.trim()) {
      toast.error("Descreva as variantes do produto.");
      return;
    }
    setAIVariantLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-product-ai", {
        body: { productName: aiVariantText, category: "", brand: "", field: "variants" },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      const content = data.content?.trim() || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) { toast.error("Não foi possível interpretar as variantes."); return; }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.variants || !Array.isArray(parsed.variants)) { toast.error("Formato inválido."); return; }

      const newVariants = parsed.variants.map((v: any) => ({
        color: v.color_hex || v.color || "",
        color_name: v.color || "",
        size: v.size || "",
        numbering: v.numbering || "",
        estampa: v.estampa || "",
        price: "",
        stock: "0",
      }));

      setVariants((prev) => [...prev, ...newVariants]);
      setAIVariantText("");
      setShowAIVariantForm(false);
      toast.success(`${newVariants.length} variante${newVariants.length > 1 ? "s" : ""} gerada${newVariants.length > 1 ? "s" : ""} com IA!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar variantes.");
    } finally {
      setAIVariantLoading(false);
    }
  };

  const deleteVariantFromDb = async (variantId: string) => {
    await supabase.from("product_variants").delete().eq("id", variantId);
    queryClient.invalidateQueries({ queryKey: ["admin-variants", product?.id] });
    toast.success("Variante removida!");
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground transition-colors";
  const labelClass = "block font-body text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[80] bg-background/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6">
      <div className="bg-card rounded-xl shadow-card-hover w-full max-w-3xl mx-4 border border-border" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-body text-lg font-bold text-foreground">
            {isEditing ? "Editar Produto" : "Novo Produto"}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border px-5 flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 font-body text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {activeTab === "geral" && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span />
                <button
                  type="button"
                  onClick={() => generateWithAI("all")}
                  disabled={aiLoading["all"] || !name.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {aiLoading["all"] ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  Gerar Tudo com IA
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Nome do produto *</label>
                  <input value={name} onChange={(e) => handleNameChange(e.target.value)} className={inputClass} placeholder="Ex: Vestido Midi Floral" />
                </div>
                <div>
                  <label className={labelClass}>Slug / URL</label>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} placeholder="vestido-midi-floral" />
                  <AIButton field="slug" label="Gerar slug" />
                </div>
                <div>
                  <label className={labelClass}>SKU</label>
                  <input value={sku} onChange={(e) => setSku(e.target.value)} className={inputClass} placeholder="VES-001" />
                  <AIButton field="sku" label="Gerar SKU" />
                </div>
              </div>

              <div>
                <label className={labelClass}>Descrição curta</label>
                <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} rows={2} className={inputClass + " resize-none"} placeholder="Resumo breve do produto..." />
                <AIButton field="short_description" label="Gerar descrição curta" />
              </div>

              <div>
                <label className={labelClass}>Descrição completa</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={inputClass + " resize-none"} placeholder="Descrição detalhada do produto..." />
                <AIButton field="description" label="Gerar descrição completa" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Categoria</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                    <option value="">Selecione...</option>
                    {categories?.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Marca</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} className={inputClass} placeholder="Ex: Marca X" />
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                    <option value="active">Ativo</option>
                    <option value="draft">Rascunho</option>
                    <option value="hidden">Oculto</option>
                    <option value="out_of_stock">Esgotado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Tags (separadas por vírgula)</label>
                <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className={inputClass} placeholder="verão, casual, promoção" />
                <AIButton field="tags" label="Gerar tags com IA" />

                {/* Auto-suggested tags */}
                {(showTagSuggestions && suggestedTags.length > 0) && (
                  <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-body text-[11px] text-muted-foreground flex items-center gap-1">
                        <Sparkles size={11} className="text-primary" /> Tags sugeridas pela IA
                      </p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={addAllSuggestedTags}
                          className="px-2 py-1 rounded text-[10px] font-body font-medium bg-primary text-primary-foreground hover:opacity-90"
                        >
                          Adicionar todas
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTagSuggestions(false)}
                          className="px-2 py-1 rounded text-[10px] font-body text-muted-foreground hover:text-foreground"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTags.map((tag) => {
                        const alreadyAdded = tagsInput.split(",").map(t => t.trim()).includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => !alreadyAdded && addSuggestedTag(tag)}
                            disabled={alreadyAdded}
                            className={`px-2 py-1 rounded-md text-[11px] font-body transition-colors ${
                              alreadyAdded
                                ? "bg-primary/20 text-primary/60 cursor-default"
                                : "bg-background border border-border text-foreground hover:border-primary hover:bg-primary/10 cursor-pointer"
                            }`}
                          >
                            {alreadyAdded ? "✓ " : "+ "}{tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {loadingTagSuggestions && (
                  <p className="flex items-center gap-1.5 mt-1.5 font-body text-[11px] text-muted-foreground">
                    <Loader2 size={11} className="animate-spin" /> Sugerindo tags...
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-4">
                {[
                  { label: "Novidade", checked: isNew, onChange: setIsNew },
                  { label: "Ativo", checked: isActive, onChange: setIsActive },
                  { label: "Destaque", checked: isFeatured, onChange: setIsFeatured },
                  { label: "Mais vendido", checked: isBestseller, onChange: setIsBestseller },
                ].map((flag) => (
                  <label key={flag.label} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={flag.checked} onChange={(e) => flag.onChange(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4" />
                    <span className="font-body text-sm text-foreground">{flag.label}</span>
                  </label>
                ))}
              </div>
            </>
          )}

          {activeTab === "precos" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Preço de venda *</label>
                  <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="0,00" />
                </div>
                <div>
                  <label className={labelClass}>Preço original</label>
                  <input type="number" step="0.01" value={originalPrice} onChange={(e) => setOriginalPrice(e.target.value)} className={inputClass} placeholder="Opcional" />
                </div>
                <div>
                  <label className={labelClass}>Custo</label>
                  <input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={inputClass} placeholder="0,00" />
                </div>
              </div>

              {margin && (
                <div className="bg-secondary rounded-lg p-4">
                  <p className="font-body text-xs text-muted-foreground">Margem de lucro estimada</p>
                  <p className="font-body text-2xl font-bold text-foreground mt-1">{margin}%</p>
                </div>
              )}

              {originalPrice && price && parseFloat(originalPrice) > parseFloat(price) && (
                <div className="bg-primary/10 rounded-lg p-4">
                  <p className="font-body text-xs text-muted-foreground">Desconto</p>
                  <p className="font-body text-2xl font-bold text-primary mt-1">
                    {(((parseFloat(originalPrice) - parseFloat(price)) / parseFloat(originalPrice)) * 100).toFixed(0)}% OFF
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === "imagens" && (
            <>
              <p className="font-body text-xs text-muted-foreground">Adicione até 4 imagens. A primeira é a imagem principal exibida na loja.</p>

              {/* Main image */}
              <div>
                <label className={labelClass}>Imagem principal</label>
                <div className="flex items-start gap-4">
                  {imageUrl ? (
                    <div className="relative group">
                      <img src={imageUrl} alt="Principal" className="w-28 h-28 rounded-lg object-cover border-2 border-primary" />
                      <span className="absolute bottom-1 left-1 bg-primary text-primary-foreground text-[9px] font-body font-bold px-1.5 py-0.5 rounded">PRINCIPAL</span>
                      <button
                        onClick={() => setImageUrl("")}
                        className="absolute top-1 right-1 p-1 rounded bg-background/80 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                      className="w-28 h-28 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors">
                      {uploading ? <span className="text-xs font-body">Enviando...</span> : <><Upload size={18} /><span className="text-[10px] font-body">Principal</span></>}
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

                  {/* Extra images */}
                  <div className="flex-1">
                    <label className={labelClass}>Imagens extras ({extraImages.length}/3)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {extraImages.map((url, i) => (
                        <div key={i} className="relative group">
                          <img src={url} alt={`Extra ${i + 1}`} className="w-full aspect-square rounded-lg object-cover border border-border" />
                          <div className="absolute inset-0 rounded-lg bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button
                              onClick={() => promoteToMain(i)}
                              className="p-1.5 rounded-md bg-primary text-primary-foreground text-[9px] font-body font-medium"
                              title="Definir como principal"
                            >
                              ★
                            </button>
                            <button
                              onClick={() => removeExtraImage(i)}
                              className="p-1.5 rounded-md bg-destructive text-destructive-foreground"
                              title="Remover"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {extraImages.length < 3 && (
                        <button
                          onClick={() => extraInputRef.current?.click()}
                          disabled={uploadingExtra}
                          className="aspect-square rounded-lg border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary flex flex-col items-center justify-center gap-1 transition-colors"
                        >
                          {uploadingExtra ? <span className="text-[10px] font-body">...</span> : <><Plus size={16} /><span className="text-[9px] font-body">Adicionar</span></>}
                        </button>
                      )}
                    </div>
                    <input ref={extraInputRef} type="file" accept="image/*" multiple onChange={handleExtraImageUpload} className="hidden" />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>URL do vídeo</label>
                <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={inputClass} placeholder="https://youtube.com/watch?v=..." />
              </div>
            </>
          )}

          {activeTab === "variacoes" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-body text-sm font-semibold text-foreground">Variações do produto</h4>
                  <p className="font-body text-xs text-muted-foreground mt-0.5">Controle estoque e imagens por variação</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowAIVariantForm(true); setShowVariantForm(false); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary font-body text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <Sparkles size={14} /> Gerar com IA
                  </button>
                  <button onClick={() => { setShowVariantForm(true); setShowAIVariantForm(false); }} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium">
                    <Plus size={14} /> Nova Variante
                  </button>
                </div>
              </div>

              {/* AI Variant Form */}
              {showAIVariantForm && (
                <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-primary" />
                    <h5 className="font-body text-sm font-semibold text-foreground">Gerar variantes com IA</h5>
                  </div>
                  <p className="font-body text-xs text-muted-foreground">
                    Descreva as variantes do produto em texto livre. Exemplo: "4 variantes nas cores: Preto tamanho único, Vermelho P e M, Azul Marinho G e GG"
                  </p>
                  <textarea
                    value={aiVariantText}
                    onChange={(e) => setAIVariantText(e.target.value)}
                    rows={3}
                    className={inputClass + " resize-none"}
                    placeholder="Ex: Esse produto tem 3 cores: Preto nos tamanhos P, M e G. Branco nos tamanhos P e M. Rosa apenas no tamanho G."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={generateVariantsWithAI}
                      disabled={aiVariantLoading || !aiVariantText.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {aiVariantLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                      {aiVariantLoading ? "Gerando..." : "Gerar Variantes"}
                    </button>
                    <button
                      onClick={() => { setShowAIVariantForm(false); setAIVariantText(""); }}
                      className="px-4 py-2 rounded-lg border border-border font-body text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {existingVariants?.map((v) => (
                <VariantCard
                  key={v.id}
                  variant={v}
                  productId={product?.id}
                  onDelete={() => deleteVariantFromDb(v.id)}
                  queryClient={queryClient}
                />
              ))}

              {variants.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex-1 flex flex-wrap gap-2 text-xs font-body">
                    {v.color && (
                      <span className="px-2 py-1 rounded-md bg-background border border-border flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: v.color.startsWith("#") ? v.color : resolveColorToCSS(v.color) }} />
                        {v.color_name || v.color}
                      </span>
                    )}
                    {v.size && <span className="px-2 py-1 rounded-md bg-background border border-border">Tam: {v.size}</span>}
                    {v.numbering && <span className="px-2 py-1 rounded-md bg-background border border-border">Nº: {v.numbering}</span>}
                    {v.estampa && <span className="px-2 py-1 rounded-md bg-background border border-border">🎨 {v.estampa}</span>}
                    {v.price && <span className="px-2 py-1 rounded-md bg-background border border-border">R$ {v.price}</span>}
                    <span className="px-2 py-1 rounded-md bg-background border border-border">Estoque: {v.stock}</span>
                  </div>
                  <p className="font-body text-[10px] text-muted-foreground italic">Salve o produto para adicionar imagens</p>
                  <button onClick={() => setVariants(variants.filter((_, idx) => idx !== i))} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                </div>
              ))}

              {showVariantForm && (
                <div className="p-4 rounded-lg border border-border bg-secondary space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3">
                      <label className={labelClass}>Cor (hex ou preset)</label>
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="color"
                          value={variantColor.startsWith("#") ? variantColor : "#FF0000"}
                          onChange={(e) => { setVariantColor(e.target.value.toUpperCase()); }}
                          className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent shrink-0"
                        />
                        <input
                          value={variantColor}
                          onChange={(e) => setVariantColor(e.target.value)}
                          className={inputClass}
                          placeholder="Ex: #FF0000 ou selecione abaixo"
                        />
                      </div>
                      <div className="mb-3">
                        <label className={labelClass}>Nome da cor (exibido para o cliente)</label>
                        <input
                          value={variantColorName}
                          onChange={(e) => setVariantColorName(e.target.value)}
                          className={inputClass}
                          placeholder="Ex: Vermelho, Rosa Bebê, Preto..."
                        />
                      </div>
                      <p className="font-body text-[10px] text-muted-foreground mb-1.5">Cores pré-definidas (preenche cor e nome):</p>
                      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                        {STORE_COLOR_PRESETS.filter(c => c.hex !== "#MULTI").map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => { setVariantColor(preset.hex); setVariantColorName(preset.name); }}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-body transition-all hover:border-primary ${
                              variantColorName === preset.name ? "border-primary bg-primary/10 font-semibold" : "border-border"
                            }`}
                          >
                            <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: preset.hex }} />
                            {preset.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => { setVariantColor("Estampado"); setVariantColorName("Estampado"); }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-body transition-all hover:border-primary ${
                            variantColorName === "Estampado" ? "border-primary bg-primary/10 font-semibold" : "border-border"
                          }`}
                        >
                          🎨 Estampado
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Tamanho</label>
                      <input value={variantSize} onChange={(e) => setVariantSize(e.target.value)} className={inputClass} placeholder="P, M, G..." />
                    </div>
                    <div>
                      <label className={labelClass}>Numeração</label>
                      <input value={variantNumbering} onChange={(e) => setVariantNumbering(e.target.value)} className={inputClass} placeholder="34, 36..." />
                    </div>
                    <div>
                      <label className={labelClass}>Estampa</label>
                      <input value={variantEstampa} onChange={(e) => setVariantEstampa(e.target.value)} className={inputClass} placeholder="Floral, Listrado..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Preço variante</label>
                      <input type="number" step="0.01" value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} className={inputClass} placeholder="Opcional" />
                    </div>
                    <div>
                      <label className={labelClass}>Estoque</label>
                      <input type="number" value={variantStock} onChange={(e) => setVariantStock(e.target.value)} className={inputClass} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addVariant} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium">Adicionar</button>
                    <button onClick={() => setShowVariantForm(false)} className="px-4 py-2 rounded-lg border border-border font-body text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                  </div>
                </div>
              )}

              {!showVariantForm && !existingVariants?.length && variants.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Tag size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="font-body text-sm">Nenhuma variante cadastrada.</p>
                  <p className="font-body text-xs text-muted-foreground mt-1">Crie variantes para adicionar imagens por cor/tamanho.</p>
                </div>
              )}
            </>
          )}

          {activeTab === "seo" && (
            <>
              <div className="flex items-center justify-between mb-1">
                <span />
                <button
                  type="button"
                  onClick={() => generateWithAI("seo")}
                  disabled={aiLoading["seo"] || !name.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {aiLoading["seo"] ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  Gerar SEO com IA
                </button>
              </div>
              <div>
                <label className={labelClass}>Meta título</label>
                <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} className={inputClass} placeholder="Título para mecanismos de busca" />
                <div className="flex items-center justify-between mt-1">
                  <p className="font-body text-[10px] text-muted-foreground">{metaTitle.length}/60 caracteres</p>
                  {aiPreviousValues["meta_title"] !== undefined && (
                    <button type="button" onClick={() => undoAI("meta_title")} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground font-body text-[10px] hover:bg-muted/80"><Undo2 size={10} /> Desfazer</button>
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass}>Meta descrição</label>
                <textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={3} className={inputClass + " resize-none"} placeholder="Descrição para mecanismos de busca" />
                <div className="flex items-center justify-between mt-1">
                  <p className="font-body text-[10px] text-muted-foreground">{metaDescription.length}/160 caracteres</p>
                  {aiPreviousValues["meta_description"] !== undefined && (
                    <button type="button" onClick={() => undoAI("meta_description")} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground font-body text-[10px] hover:bg-muted/80"><Undo2 size={10} /> Desfazer</button>
                  )}
                </div>
              </div>
              <div>
                <label className={labelClass}>Palavras-chave</label>
                <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={inputClass} placeholder="vestido, floral, moda feminina" />
                {aiPreviousValues["keywords"] !== undefined && (
                  <button type="button" onClick={() => undoAI("keywords")} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-muted-foreground font-body text-[10px] hover:bg-muted/80 mt-1"><Undo2 size={10} /> Desfazer</button>
                )}
              </div>

              {/* SEO Preview */}
              <div className="bg-secondary rounded-lg p-4 border border-border">
                <p className="font-body text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Preview do Google</p>
                <p className="font-body text-base text-primary truncate">{metaTitle || name || "Título do produto"}</p>
                <p className="font-body text-xs text-muted-foreground truncate">vitrinecharmosa.com/{slug || "produto"}</p>
                <p className="font-body text-xs text-muted-foreground mt-1 line-clamp-2">{metaDescription || shortDescription || "Descrição do produto..."}</p>
              </div>
            </>
          )}

          {activeTab === "avancado" && (
            <>
              <div>
                <h4 className="font-body text-sm font-semibold text-foreground mb-3">Peso e Dimensões</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className={labelClass}>Peso (kg)</label>
                    <input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} className={inputClass} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={labelClass}>Largura (cm)</label>
                    <input type="number" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} className={inputClass} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelClass}>Altura (cm)</label>
                    <input type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} className={inputClass} placeholder="0" />
                  </div>
                  <div>
                    <label className={labelClass}>Comprimento (cm)</label>
                    <input type="number" step="0.1" value={length} onChange={(e) => setLength(e.target.value)} className={inputClass} placeholder="0" />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex items-center justify-between">
          <p className="font-body text-xs text-muted-foreground">* Campos obrigatórios</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-border font-body text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => saveMutation.mutate()}
              disabled={!name.trim() || !price || saveMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saveMutation.isPending ? "Salvando..." : isEditing ? "Atualizar" : "Criar Produto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductFormModal;
