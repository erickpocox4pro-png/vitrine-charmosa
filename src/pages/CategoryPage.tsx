import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProducts } from "@/data/products";
import SEO, { SITE_URL, DEFAULT_DESCRIPTION } from "@/components/SEO";
import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import ProductCard from "@/components/store/ProductCard";
import { Home, ChevronRight } from "lucide-react";

interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
}

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: category, isLoading: catLoading } = useQuery({
    queryKey: ["category-detail", slug],
    queryFn: async (): Promise<CategoryDetail | null> => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, description, image_url, meta_title, meta_description")
        .eq("slug", slug!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) return null;
      return data as CategoryDetail | null;
    },
    enabled: !!slug,
  });

  const { data: products = [], isLoading: prodLoading } = useProducts();

  const filteredProducts = category
    ? products.filter(
        (p) => p.category_id === category.id || p.category === category.name
      )
    : [];

  const isLoading = catLoading || prodLoading;
  const notFound = !catLoading && !category;

  const seoTitle =
    category?.meta_title ||
    (category ? `${category.name} | Moda Feminina` : "Categoria");
  const seoDescription =
    category?.meta_description ||
    category?.description ||
    (category
      ? `Confira nossa coleção de ${category.name.toLowerCase()} na Vitrine Charmosa. Qualidade e elegância para valorizar seu estilo.`
      : DEFAULT_DESCRIPTION);

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${SITE_URL}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: category?.name || slug || "Categoria",
        item: `${SITE_URL}/categoria/${slug}`,
      },
    ],
  };

  const itemListJsonLd =
    filteredProducts.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: category?.name,
          numberOfItems: filteredProducts.length,
          itemListElement: filteredProducts.slice(0, 30).map((p, idx) => ({
            "@type": "ListItem",
            position: idx + 1,
            url: `${SITE_URL}/produto/${p.id}`,
            name: p.name,
          })),
        }
      : null;

  const jsonLd = itemListJsonLd
    ? [breadcrumbJsonLd, itemListJsonLd]
    : breadcrumbJsonLd;

  return (
    <>
      <SEO
        title={seoTitle}
        description={seoDescription}
        path={`/categoria/${slug}`}
        jsonLd={jsonLd}
        noindex={notFound}
        {...(category?.image_url ? { image: category.image_url } : {})}
      />
      <Header />
      <main className="min-h-screen pt-[52px] lg:pt-[68px] pb-16 bg-background">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs font-body text-muted-foreground px-4 lg:px-8 py-4 max-w-7xl mx-auto">
          <Link
            to="/"
            className="hover:text-foreground transition-colors flex items-center gap-1"
          >
            <Home size={12} /> Home
          </Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">
            {category?.name || slug}
          </span>
        </nav>

        {/* Category hero with image */}
        {category?.image_url && (
          <div className="relative h-44 lg:h-64 w-full overflow-hidden mb-6">
            <img
              src={category.image_url}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center px-4">
              <div className="text-center">
                <h1 className="text-white text-3xl lg:text-5xl font-display font-semibold tracking-wide">
                  {category.name}
                </h1>
                {category.description && (
                  <p className="mt-2 text-white/90 text-sm lg:text-base max-w-2xl mx-auto">
                    {category.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Heading when no hero image */}
          {!category?.image_url && category && (
            <div className="pt-2 pb-6">
              <h1 className="text-2xl lg:text-3xl font-display font-semibold text-foreground">
                {category.name}
              </h1>
              {category.description && (
                <p className="mt-2 text-muted-foreground text-sm lg:text-base max-w-2xl">
                  {category.description}
                </p>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] rounded-xl bg-secondary/30" />
                  <div className="mt-2 h-3 bg-secondary/30 rounded w-3/4 mx-auto" />
                  <div className="mt-1 h-3 bg-secondary/30 rounded w-1/2 mx-auto" />
                </div>
              ))}
            </div>
          ) : notFound ? (
            <div className="text-center py-20">
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Categoria não encontrada
              </h1>
              <p className="text-muted-foreground mb-4">
                A categoria que você procura não existe ou foi removida.
              </p>
              <Link
                to="/"
                className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
              >
                Voltar à Home
              </Link>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground text-lg">
                Nenhum produto encontrado nesta categoria no momento.
              </p>
              <Link
                to="/"
                className="mt-4 inline-block text-primary hover:underline"
              >
                Ver todos os produtos
              </Link>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-4">
                {filteredProducts.length}{" "}
                {filteredProducts.length === 1 ? "produto" : "produtos"}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
};

export default CategoryPage;
