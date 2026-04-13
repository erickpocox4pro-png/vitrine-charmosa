import { useProducts } from "@/data/products";
import ProductCard from "./ProductCard";
import { motion } from "framer-motion";
import { sortProductsByBackground } from "@/lib/sortByBackground";
import { useMemo } from "react";

const FeaturedProducts = () => {
  const { data: products, isLoading } = useProducts();
  const newProducts = useMemo(() => {
    const filtered = (products || []).filter((p) => p.is_new).slice(0, 5);
    return sortProductsByBackground(filtered);
  }, [products]);

  if (isLoading) {
    return (
      <section className="py-10 md:py-20 bg-background">
        <div className="container px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-7 bg-secondary rounded w-40 mx-auto" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mt-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-secondary rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (newProducts.length === 0) return null;

  return (
    <section id="novidades" className="py-10 md:py-20 bg-background">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 md:mb-12"
        >
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl text-foreground font-bold">Novidades</h2>
          <p className="font-body text-muted-foreground mt-1.5 text-xs md:text-sm">As peças mais recentes da coleção</p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {newProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
