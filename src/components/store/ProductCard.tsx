import { ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import type { Product } from "@/data/products";
import { getProductImage } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  product: Product;
}

const ProductCard = ({ product }: Props) => {
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleAdd = async () => {
    if (!isAuthenticated) {
      toast.error("Faça login para adicionar ao carrinho.");
      navigate("/login");
      return;
    }
    await addToCart(product.id);
    toast.success(`${product.name} adicionado!`);
  };

  const productUrl = `/produto/${product.slug || product.id}`;
  const discount = product.original_price
    ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4 }}
      className="group cursor-pointer"
      onClick={() => navigate(productUrl)}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary/20">
        <img
          src={getProductImage(product.image_url)}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
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
        <button
          onClick={(e) => { e.stopPropagation(); handleAdd(); }}
          className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-card/90 backdrop-blur-sm shadow-md flex items-center justify-center text-foreground md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 hover:bg-primary hover:text-primary-foreground active:scale-95"
          aria-label="Adicionar ao carrinho"
        >
          <ShoppingBag size={18} />
        </button>
      </div>
      <div className="mt-2.5 px-0.5 text-center">
        <p className="font-body text-[13px] sm:text-sm font-medium text-foreground line-clamp-2 leading-snug">{product.name}</p>
        <div className="flex items-baseline justify-center gap-2 mt-1">
          <span className="font-body text-[15px] sm:text-base font-bold text-foreground">
            R$ {product.price.toFixed(2).replace(".", ",")}
          </span>
          {product.original_price && (
            <span className="font-body text-[11px] sm:text-xs text-muted-foreground line-through">
              R$ {product.original_price.toFixed(2).replace(".", ",")}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProductCard;
