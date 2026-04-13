import { useProducts } from "@/data/products";
import { useCategories } from "@/data/categories";
import ProductCard from "./ProductCard";
import { motion } from "framer-motion";
import { useMemo, useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const AllProducts = () => {
  const { data: products, isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);

  // Get category filter from URL hash (e.g., #categoria-vestidos)
  const hashCategory = useMemo(() => {
    const hash = location.hash;
    if (hash.startsWith("#categoria-")) {
      return hash.replace("#categoria-", "");
    }
    return "";
  }, [location.hash]);

  const [selectedCategory, setSelectedCategory] = useState(hashCategory);

  // Sync hash changes and scroll into view
  useEffect(() => {
    if (hashCategory) {
      setSelectedCategory(hashCategory);
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [hashCategory]);

  const filteredProducts = useMemo(() => {
    const all = products || [];
    if (!selectedCategory) return all;
    const cat = categories.find((c) => c.slug === selectedCategory);
    if (!cat) return all;
    return all.filter((p) => p.category_id === cat.id || p.category === cat.name);
  }, [products, selectedCategory, categories]);

  // Products already come sorted by sort_order from the query
  const sortedProducts = filteredProducts;

  // Debug: log product order
  useEffect(() => {
    if (sortedProducts.length > 0) {
      console.log("[AllProducts] Product order:", sortedProducts.slice(0, 5).map(p => `${p.name} (sort_order: ${p.sort_order})`));
    }
  }, [sortedProducts]);

  if (isLoading) {
    return (
      <section className="py-10 md:py-20 bg-secondary/20">
        <div className="container px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-7 bg-secondary rounded w-40 mx-auto" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mt-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-secondary rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const activeCategory = categories.find((c) => c.slug === selectedCategory);

  return (
    <section id="produtos" ref={sectionRef} className="py-10 md:py-20 bg-secondary/20">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-6 md:mb-10"
        >
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl text-foreground font-bold">
            {activeCategory ? activeCategory.name : "Nossos Produtos"}
          </h2>
          <p className="font-body text-muted-foreground mt-1.5 text-xs md:text-sm">
            {activeCategory ? `${sortedProducts.length} produto${sortedProducts.length !== 1 ? "s" : ""}` : "Explore toda a nossa coleção"}
          </p>
        </motion.div>

        {/* Category filter chips */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 md:mb-8">
          <button
            onClick={() => setSelectedCategory("")}
            className={`px-3.5 py-1.5 rounded-full font-body text-xs font-medium transition-colors ${
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug === selectedCategory ? "" : cat.slug)}
              className={`px-3.5 py-1.5 rounded-full font-body text-xs font-medium transition-colors ${
                selectedCategory === cat.slug
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {sortedProducts.length === 0 ? (
          <p className="text-center text-muted-foreground font-body py-12">
            Nenhum produto encontrado nesta categoria.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {sortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default AllProducts;
