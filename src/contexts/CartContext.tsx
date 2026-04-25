import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { metaPixel } from "@/lib/metaPixel";

export interface CartProduct {
  id: string;
  name: string;
  price: number;
  image_url: string;
}

export interface CartVariant {
  id: string;
  color: string | null;
  color_name: string | null;
  size: string | null;
  numbering: string | null;
  price: number | null;
}

export interface CartItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  product: CartProduct;
  variant?: CartVariant | null;
  variantImage?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (productId: string, variantId?: string | null) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchCart = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { setItems([]); return; }

    setLoading(true);
    const { data } = await supabase
      .from("cart_items")
      .select("id, product_id, variant_id, quantity, products(id, name, price, image_url), product_variants(id, color, color_name, size, numbering, price)")
      .order("created_at", { ascending: true });

    if (data) {
      const mappedItems = data.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        product: item.products,
        variant: item.product_variants || null,
      }));

      // Fetch variant images for items with variants
      const variantIds = mappedItems.filter(i => i.variant_id).map(i => i.variant_id);
      let variantImageMap: Record<string, string> = {};
      if (variantIds.length > 0) {
        const { data: vImages } = await supabase
          .from("product_images")
          .select("variant_id, image_url")
          .in("variant_id", variantIds)
          .order("sort_order", { ascending: true });
        if (vImages) {
          vImages.forEach((vi: any) => {
            if (!variantImageMap[vi.variant_id]) {
              variantImageMap[vi.variant_id] = vi.image_url;
            }
          });
        }
      }

      // Attach variant image to items
      mappedItems.forEach(item => {
        if (item.variant_id && variantImageMap[item.variant_id]) {
          (item as any).variantImage = variantImageMap[item.variant_id];
        }
      });

      setItems(mappedItems);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCart();
  }, [isAuthenticated, fetchCart]);

  const addToCart = useCallback(async (productId: string, variantId?: string | null) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;

    // Check if same product+variant already in cart
    const existing = items.find((i) => i.product_id === productId && (i.variant_id || null) === (variantId || null));
    if (existing) {
      await supabase
        .from("cart_items")
        .update({ quantity: existing.quantity + 1 })
        .eq("id", existing.id);
    } else {
      const insertData: any = { user_id: session.session.user.id, product_id: productId, quantity: 1 };
      if (variantId) insertData.variant_id = variantId;
      await supabase
        .from("cart_items")
        .insert(insertData);
    }
    await fetchCart();

    // Pixel: AddToCart
    try {
      const { data: prod } = await supabase
        .from("products")
        .select("id, name, price")
        .eq("id", productId)
        .maybeSingle();
      if (prod) {
        metaPixel.addToCart({
          product_id: prod.id,
          name: prod.name,
          price: Number(prod.price) || 0,
          quantity: 1,
        });
      }
    } catch {
      /* silent */
    }
  }, [items, fetchCart]);

  const removeFromCart = useCallback(async (itemId: string) => {
    await supabase.from("cart_items").delete().eq("id", itemId);
    await fetchCart();
  }, [fetchCart]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }
    await supabase.from("cart_items").update({ quantity }).eq("id", itemId);
    await fetchCart();
  }, [removeFromCart, fetchCart]);

  const clearCart = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    await supabase.from("cart_items").delete().eq("user_id", session.session.user.id);
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => {
    const price = i.variant?.price || i.product.price;
    return sum + price * i.quantity;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice, loading }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
