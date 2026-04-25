import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProductImage } from "@/data/products";
import { useCategories } from "@/data/categories";
import ProductCard from "@/components/store/ProductCard";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ShoppingBag, Heart, ChevronLeft, ChevronRight, ZoomIn, Minus, Plus, Share2, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import SEO, { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/components/SEO";
import { STORE_COLOR_PRESETS } from "@/data/colorPresets";

const resolveColorToCSS = (color: string): string => {
  if (color.startsWith("#")) return color;
  const preset = STORE_COLOR_PRESETS.find(p => p.name.toLowerCase() === color.toLowerCase());
  if (preset && preset.hex !== "#MULTI") return preset.hex;
  return color.toLowerCase();
};

const ProductPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Zoom state
  const [zoomed, setZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Touch swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipe = 50;

  const { data: allCategories = [] } = useCategories();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .single();
      if (error) {
        const { data: byId, error: idErr } = await supabase
          .from("products")
          .select("*")
          .eq("id", slug)
          .eq("is_active", true)
          .single();
        if (idErr) throw idErr;
        return byId;
      }
      return data;
    },
  });

  const { data: variants } = useQuery({
    queryKey: ["product-variants", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", product!.id)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });

  // Auto-select first in-stock variant (fallback to first variant)
  useEffect(() => {
    if (variants && variants.length > 0 && !selectedVariant) {
      const inStockVariant = variants.find(v => v.stock > 0);
      setSelectedVariant(inStockVariant ? inStockVariant.id : variants[0].id);
    }
  }, [variants]);

  const { data: images } = useQuery({
    queryKey: ["product-images", product?.id],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_images")
        .select("*")
        .eq("product_id", product!.id)
        .order("sort_order");
      return data || [];
    },
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ["related-products", product?.id, product?.category],
    enabled: !!product?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .eq("category", product!.category)
        .neq("id", product!.id)
        .limit(4);
      return data || [];
    },
  });

  const variantImages = useMemo(() => {
    if (!images || !selectedVariant) return [];
    return images.filter((img) => img.variant_id === selectedVariant);
  }, [images, selectedVariant]);

  const allImages = useMemo(() => {
    const imgs: string[] = [];
    if (variantImages.length > 0) {
      imgs.push(...variantImages.map((i) => i.image_url));
    } else {
      if (product?.image_url) imgs.push(getProductImage(product.image_url));
      if (images) {
        const generalImages = images.filter((i) => !i.variant_id);
        imgs.push(...generalImages.map((i) => i.image_url));
      }
    }
    return imgs.length > 0 ? imgs : ["/placeholder.svg"];
  }, [product, images, variantImages]);

  useEffect(() => {
    setSelectedImage(0);
  }, [selectedVariant]);

  // Determine if product uses estampa or color (mutually exclusive)
  const hasEstampas = useMemo(() => {
    if (!variants) return false;
    return variants.some((v) => (v as any).estampa);
  }, [variants]);

  const hasColors = useMemo(() => {
    if (!variants) return false;
    return variants.some((v) => v.color);
  }, [variants]);

  const colors = useMemo(() => {
    if (!variants || hasEstampas) return []; // If product uses estampa, hide colors
    const unique = new Map<string, typeof variants[0]>();
    variants.forEach((v) => {
      if (v.color && !unique.has(v.color)) unique.set(v.color, v);
    });
    return Array.from(unique.entries());
  }, [variants, hasEstampas]);

  const estampas = useMemo(() => {
    if (!variants || !hasEstampas) return [];
    const unique = new Map<string, typeof variants[0]>();
    variants.forEach((v) => {
      const est = (v as any).estampa;
      if (est && !unique.has(est)) unique.set(est, v);
    });
    return Array.from(unique.entries());
  }, [variants, hasEstampas]);

  const sizes = useMemo(() => {
    if (!variants) return [];
    const currentVariant = variants.find((v) => v.id === selectedVariant);
    const groupKey = hasEstampas ? (currentVariant as any)?.estampa : currentVariant?.color;
    const filtered = groupKey
      ? variants.filter((v) => {
          const key = hasEstampas ? (v as any).estampa : v.color;
          return key === groupKey && v.size;
        })
      : variants.filter((v) => v.size);
    const unique = new Map<string, typeof variants[0]>();
    filtered.forEach((v) => {
      if (v.size && !unique.has(v.size)) unique.set(v.size, v);
    });
    return Array.from(unique.entries());
  }, [variants, selectedVariant, hasEstampas]);

  const activeVariant = variants?.find((v) => v.id === selectedVariant);
  const displayPrice = activeVariant?.price || product?.price || 0;
  const inStock = activeVariant ? activeVariant.stock > 0 : true;
  const discount = product?.original_price && product.original_price > displayPrice
    ? Math.round(((product.original_price - displayPrice) / product.original_price) * 100)
    : 0;

  const goNext = useCallback(() => {
    setSelectedImage((prev) => (prev + 1) % allImages.length);
  }, [allImages.length]);

  const goPrev = useCallback(() => {
    setSelectedImage((prev) => (prev - 1 + allImages.length) % allImages.length);
  }, [allImages.length]);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (Math.abs(distance) >= minSwipe) {
      distance > 0 ? goNext() : goPrev();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomPos({ x, y });
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      toast.error("Faça login para adicionar ao carrinho.");
      navigate("/login");
      return;
    }
    if (!product) return;
    for (let i = 0; i < quantity; i++) {
      await addToCart(product.id, selectedVariant);
    }
    toast.success(`${quantity}x ${product.name} adicionado ao carrinho!`);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product?.name, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copiado!");
    }
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="min-h-screen pt-24 flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Header />
        <div className="min-h-screen pt-24 flex flex-col items-center justify-center gap-4 bg-background">
          <p className="text-muted-foreground font-body">Produto não encontrado.</p>
          <Button onClick={() => navigate("/")} variant="outline">Voltar à loja</Button>
        </div>
      </>
    );
  }

  const productImage = getProductImage(product.image_url);
  const productPath = `/produto/${product.slug || product.id}`;
  const categorySlug = allCategories.find(
    (c) => c.id === product.category_id || c.name === product.category
  )?.slug;
  const productDesc =
    product.meta_description ||
    product.short_description ||
    (product.description ? product.description.replace(/<[^>]+>/g, "").slice(0, 160) : DEFAULT_DESCRIPTION);

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: productDesc,
    image: [productImage],
    sku: product.sku || product.id,
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}${productPath}`,
      priceCurrency: "BRL",
      price: product.price,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...(product.category && categorySlug
        ? [{ "@type": "ListItem", position: 2, name: product.category, item: `${SITE_URL}/categoria/${categorySlug}` }]
        : []),
      { "@type": "ListItem", position: product.category && categorySlug ? 3 : 2, name: product.name, item: `${SITE_URL}${productPath}` },
    ],
  };

  return (
    <>
      <SEO
        title={product.meta_title || product.name}
        description={productDesc}
        image={productImage}
        path={productPath}
        type="product"
        keywords={product.keywords || undefined}
        jsonLd={[productJsonLd, breadcrumbJsonLd]}
      />
      <Header />
      <main className="min-h-screen pt-[52px] lg:pt-[68px] pb-0 bg-background">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb - desktop only */}
          <nav className="hidden lg:flex items-center gap-2 text-xs font-body text-muted-foreground px-8 py-4">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <span>/</span>
            {product.category && categorySlug && (
              <>
                <Link to={`/categoria/${categorySlug}`} className="hover:text-foreground transition-colors">{product.category}</Link>
                <span>/</span>
              </>
            )}
            {product.category && !categorySlug && (
              <>
                <span className="text-muted-foreground">{product.category}</span>
                <span>/</span>
              </>
            )}
            <span className="text-foreground">{product.name}</span>
          </nav>

          <div className="lg:grid lg:grid-cols-2 lg:gap-10 lg:px-8">
            {/* ============= IMAGE GALLERY ============= */}
            <div className="lg:space-y-3">
              {/* Main Image */}
              <div
                ref={imageContainerRef}
                className="relative aspect-[3/4] lg:aspect-[3/4] overflow-hidden lg:rounded-2xl bg-secondary/10 cursor-zoom-in group select-none"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseMove={handleMouseMove}
                onMouseEnter={() => setZoomed(true)}
                onMouseLeave={() => setZoomed(false)}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={selectedImage}
                    src={allImages[selectedImage]}
                    alt={`${product.name} - Imagem ${selectedImage + 1}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full object-cover"
                    style={
                      zoomed
                        ? {
                            transform: "scale(2)",
                            transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                            transition: "transform-origin 0.1s ease",
                          }
                        : {}
                    }
                    loading={selectedImage === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                </AnimatePresence>

                {/* Zoom icon - desktop */}
                <div className="hidden lg:flex absolute top-4 right-4 w-8 h-8 rounded-full bg-card/60 backdrop-blur-sm items-center justify-center text-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <ZoomIn size={14} />
                </div>

                {/* Nav arrows - desktop */}
                {allImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      className="hidden lg:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 backdrop-blur-sm items-center justify-center text-foreground hover:bg-card transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); goNext(); }}
                      className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-card/70 backdrop-blur-sm items-center justify-center text-foreground hover:bg-card transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 lg:top-4 lg:left-4 flex flex-col gap-1.5">
                  {product.is_new && (
                    <span className="bg-primary text-primary-foreground text-[10px] font-body font-bold tracking-wider uppercase px-2.5 py-1 rounded-full">
                      Novo
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="text-[10px] font-body font-bold px-2.5 py-1 rounded-full"
                      style={{
                        backgroundColor: 'hsl(var(--discount-badge-bg, 0 84% 60%))',
                        color: 'hsl(var(--discount-badge-text, 0 0% 100%))',
                      }}
                    >
                      -{discount}%
                    </span>
                  )}
                </div>

                {/* Image counter (mobile) */}
                {allImages.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 lg:hidden">
                    {allImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(i)}
                        className={`rounded-full transition-all duration-300 ${
                          i === selectedImage ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-card/60"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Thumbnails strip (mobile - horizontal scroll) */}
              {allImages.length > 1 && (
                <div className="flex lg:hidden gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        selectedImage === i
                          ? "border-primary ring-1 ring-primary/20"
                          : "border-transparent opacity-60"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
                    </button>
                  ))}
                </div>
              )}

              {/* Thumbnails (desktop) */}
              {allImages.length > 1 && (
                <div className="hidden lg:flex gap-2 overflow-x-auto pb-1">
                  {allImages.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                        selectedImage === i
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-transparent hover:border-border opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" draggable={false} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ============= PRODUCT INFO ============= */}
            <div className="px-5 lg:px-0 pt-5 lg:pt-2 pb-28 lg:pb-8 space-y-5">
              {/* Category + Title */}
              <div>
                {product.category && (
                  <p className="font-body text-[11px] text-primary uppercase tracking-widest font-semibold mb-1.5">{product.category}</p>
                )}
                <h1 className="font-heading text-xl sm:text-2xl lg:text-3xl text-foreground leading-tight font-semibold">{product.name}</h1>
                {product.short_description && (
                  <p className="font-body text-sm text-muted-foreground mt-2 leading-relaxed">{product.short_description}</p>
                )}
              </div>

              {/* Price block */}
              <div className="bg-secondary/40 rounded-2xl p-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                    R$ {displayPrice.toFixed(2).replace(".", ",")}
                  </span>
                  {product.original_price && product.original_price > displayPrice && (
                    <span className="font-body text-sm text-muted-foreground line-through">
                      R$ {product.original_price.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  {discount > 0 && (
                    <span className="font-body text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'hsl(var(--discount-badge-bg, 0 84% 60%) / 0.1)',
                        color: 'hsl(var(--discount-badge-bg, 0 84% 60%))',
                      }}
                    >
                      -{discount}%
                    </span>
                  )}
                </div>
              </div>

              {/* Color selection */}
              {colors.length > 0 && (
                <div>
                  <p className="font-body text-sm font-semibold text-foreground mb-3">
                    Cor: <span className="text-muted-foreground font-normal">{(activeVariant as any)?.color_name || activeVariant?.color || "Selecione"}</span>
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    {colors.map(([color, variant]) => {
                      const isSelected = selectedVariant === variant.id;
                      return (
                        <button
                          key={color}
                          onClick={() => setSelectedVariant(isSelected ? null : variant.id)}
                          className={`relative w-11 h-11 rounded-full border-2 transition-all active:scale-95 ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/20 scale-110"
                              : "border-border hover:border-primary/50"
                          }`}
                          style={{ backgroundColor: resolveColorToCSS(color) }}
                          title={color}
                        >
                          {isSelected && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="w-2.5 h-2.5 rounded-full bg-card shadow-sm" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size selection */}
              {sizes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-body text-sm font-semibold text-foreground">
                      Tamanho: <span className="text-muted-foreground font-normal">{activeVariant?.size || "Selecione"}</span>
                    </p>
                    <Link to="/guia-tamanhos" className="font-body text-xs text-primary underline underline-offset-2">
                      Guia de tamanhos
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map(([size, variant]) => {
                      const isOOS = variant.stock <= 0;
                      const isSelected = selectedVariant === variant.id;
                      return (
                        <button
                          key={size}
                          onClick={() => !isOOS && setSelectedVariant(variant.id)}
                          disabled={isOOS}
                          className={`min-w-[3.25rem] px-4 py-3 rounded-xl border font-body text-sm font-medium transition-all active:scale-95 ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : isOOS
                              ? "border-border/50 text-muted-foreground/30 cursor-not-allowed line-through"
                              : "border-border text-foreground hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Estampa selection */}
              {estampas.length > 0 && (
                <div>
                  <p className="font-body text-sm font-semibold text-foreground mb-3">
                    Estampa: <span className="text-muted-foreground font-normal">{(activeVariant as any)?.estampa || "Selecione"}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {estampas.map(([estampa, variant]) => {
                      const isOOS = variant.stock <= 0;
                      const isSelected = selectedVariant === variant.id;
                      return (
                        <button
                          key={estampa}
                          onClick={() => !isOOS && setSelectedVariant(variant.id)}
                          disabled={isOOS}
                          className={`px-4 py-3 rounded-xl border font-body text-sm font-medium transition-all active:scale-95 ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : isOOS
                              ? "border-border/50 text-muted-foreground/30 cursor-not-allowed line-through"
                              : "border-border text-foreground hover:border-primary hover:bg-primary/5"
                          }`}
                        >
                          {estampa}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity + Actions (desktop) */}
              <div className="hidden lg:flex gap-3 items-stretch pt-1">
                <div className="flex items-center border border-border rounded-xl overflow-hidden bg-card">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3.5 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-10 text-center font-body text-sm font-semibold text-foreground">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3.5 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <Button
                  onClick={handleAddToCart}
                  disabled={!inStock}
                  className="flex-1 py-6 text-base font-body font-bold gap-2 rounded-xl"
                  size="lg"
                >
                  <ShoppingBag size={20} />
                  {inStock ? "Adicionar ao Carrinho" : "Indisponível"}
                </Button>

                <Button variant="outline" size="lg" className="py-6 px-4 rounded-xl" onClick={handleShare}>
                  <Share2 size={18} />
                </Button>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-secondary/30">
                  <Truck size={18} className="text-primary mb-1.5" />
                  <p className="font-body text-[10px] font-semibold text-foreground leading-tight">Frete Grátis</p>
                  <p className="font-body text-[9px] text-muted-foreground">acima de R$299</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-secondary/30">
                  <ShieldCheck size={18} className="text-primary mb-1.5" />
                  <p className="font-body text-[10px] font-semibold text-foreground leading-tight">Compra Segura</p>
                  <p className="font-body text-[9px] text-muted-foreground">100% protegida</p>
                </div>
                <div className="flex flex-col items-center text-center p-3 rounded-xl bg-secondary/30">
                  <RotateCcw size={18} className="text-primary mb-1.5" />
                  <p className="font-body text-[10px] font-semibold text-foreground leading-tight">Troca Fácil</p>
                  <p className="font-body text-[9px] text-muted-foreground">em até 30 dias</p>
                </div>
              </div>

              {/* Description */}
              {product.description && (
                <div className="border-t border-border pt-5">
                  <h3 className="font-heading text-base lg:text-lg text-foreground mb-2.5 font-semibold">Descrição</h3>
                  <div className="font-body text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {product.description}
                  </div>
                </div>
              )}

              {/* Details */}
              {(product.brand || product.sku || product.weight) && (
                <div className="border-t border-border pt-5">
                  <h3 className="font-heading text-base lg:text-lg text-foreground mb-2.5 font-semibold">Detalhes</h3>
                  <div className="space-y-2">
                    {product.brand && (
                      <div className="flex justify-between py-1.5 border-b border-border/40">
                        <span className="font-body text-xs text-muted-foreground">Marca</span>
                        <span className="font-body text-xs text-foreground font-medium">{product.brand}</span>
                      </div>
                    )}
                    {product.sku && (
                      <div className="flex justify-between py-1.5 border-b border-border/40">
                        <span className="font-body text-xs text-muted-foreground">SKU</span>
                        <span className="font-body text-xs text-foreground font-mono">{product.sku}</span>
                      </div>
                    )}
                    {product.category && (
                      <div className="flex justify-between py-1.5 border-b border-border/40">
                        <span className="font-body text-xs text-muted-foreground">Categoria</span>
                        <span className="font-body text-xs text-foreground font-medium">{product.category}</span>
                      </div>
                    )}
                    {product.weight && (
                      <div className="flex justify-between py-1.5">
                        <span className="font-body text-xs text-muted-foreground">Peso</span>
                        <span className="font-body text-xs text-foreground font-medium">{product.weight}kg</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
        </div>

          {/* Related Products - Desktop only */}
          {relatedProducts && relatedProducts.length > 0 && (
            <div className="hidden lg:block px-8 py-12 border-t border-border">
              <h2 className="font-heading text-2xl text-foreground font-bold mb-6">Produtos Relacionados</h2>
              <div className="grid grid-cols-4 gap-6">
                {relatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Sticky CTA Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border/60 px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-2.5">
          {/* Quantity */}
          <div className="flex items-center border border-border rounded-xl overflow-hidden bg-background">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-11 flex items-center justify-center text-muted-foreground active:bg-secondary/40"
            >
              <Minus size={16} />
            </button>
            <span className="w-8 text-center font-body text-sm font-bold text-foreground">{quantity}</span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-11 flex items-center justify-center text-muted-foreground active:bg-secondary/40"
            >
              <Plus size={16} />
            </button>
          </div>

          <Button
            onClick={handleAddToCart}
            disabled={!inStock}
            className="flex-1 h-11 text-[15px] font-body font-bold gap-2 rounded-xl active:scale-[0.98] transition-transform"
          >
            <ShoppingBag size={18} />
            {inStock ? "Comprar" : "Indisponível"}
          </Button>

          <button
            onClick={handleShare}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-border text-muted-foreground active:bg-secondary/40 transition-colors"
          >
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <Footer />
    </>
  );
};

export default ProductPage;
