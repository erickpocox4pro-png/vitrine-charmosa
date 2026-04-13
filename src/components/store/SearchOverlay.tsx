import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useProducts, getProductImage } from "@/data/products";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SearchOverlay = ({ open, onClose }: Props) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { data: products } = useProducts();

  const filtered = query.trim()
    ? (products || []).filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
      )
    : [];

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className="bg-card mx-auto mt-20 max-w-2xl rounded-lg shadow-card-hover p-6 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <Search size={20} className="text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar produtos..."
                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none font-body text-base"
              />
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            {query.trim() && (
              <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
                {filtered.length === 0 ? (
                  <p className="text-muted-foreground text-sm font-body py-4 text-center">Nenhum produto encontrado.</p>
                ) : (
                  filtered.map((product) => (
                    <div key={product.id} className="flex items-center gap-4 p-3 rounded-md hover:bg-secondary/50 transition-colors cursor-pointer">
                      <img src={getProductImage(product.image_url)} alt={product.name} className="w-14 h-14 object-cover rounded-md" loading="lazy" />
                      <div className="flex-1">
                        <p className="text-sm font-body font-medium text-foreground">{product.name}</p>
                        <p className="text-xs text-muted-foreground font-body">{product.category}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-body font-semibold text-foreground">
                          R$ {product.price.toFixed(2).replace(".", ",")}
                        </p>
                        {isAuthenticated && (
                          <button
                            onClick={() => { addToCart(product.id); toast.success("Adicionado ao carrinho!"); }}
                            className="text-xs text-primary font-body font-medium hover:underline mt-1"
                          >
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
