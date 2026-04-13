import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { getProductImage } from "@/data/products";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

const CartDrawer = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const { items, removeFromCart, updateQuantity, totalPrice } = useCart();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-foreground/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:max-w-md z-[70] bg-card shadow-card-hover flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-heading text-lg text-foreground">Carrinho</h2>
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground active:bg-secondary/40 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.length === 0 ? (
                <p className="text-muted-foreground font-body text-sm text-center py-16">Seu carrinho está vazio.</p>
              ) : (
                items.map((item) => {
                  const itemPrice = item.variant?.price || item.product.price;
                  return (
                    <div key={item.id} className="flex gap-3.5 p-3 rounded-xl bg-secondary/30">
                      <img src={item.variantImage || getProductImage(item.product.image_url)} alt={item.product.name} className="w-20 h-24 object-cover rounded-lg" loading="lazy" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium text-foreground truncate">{item.product.name}</p>
                        {/* Variant details */}
                        {item.variant && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.variant.color && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-body text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                                <span className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: item.variant.color.startsWith("#") ? item.variant.color : item.variant.color.toLowerCase() }} />
                                {item.variant.color_name || item.variant.color}
                              </span>
                            )}
                            {item.variant.size && (
                              <span className="text-[10px] font-body text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                                Tam: {item.variant.size}
                              </span>
                            )}
                            {item.variant.numbering && (
                              <span className="text-[10px] font-body text-muted-foreground bg-background px-1.5 py-0.5 rounded">
                                Nº {item.variant.numbering}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-sm font-body font-bold text-primary mt-1">
                          R$ {itemPrice.toFixed(2).replace(".", ",")}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary/40"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-body font-semibold w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground active:bg-secondary/40"
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="ml-auto w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive active:scale-95 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="px-5 py-4 border-t border-border space-y-3.5 safe-area-bottom">
                <div className="flex items-center justify-between">
                  <span className="font-body font-medium text-foreground">Total</span>
                  <span className="font-heading text-xl font-bold text-foreground">
                    R$ {totalPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <button
                  onClick={() => { onClose(); navigate("/checkout"); }}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-body font-bold text-[15px] hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  Finalizar Compra
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
