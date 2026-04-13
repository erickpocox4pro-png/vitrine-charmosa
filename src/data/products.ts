import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  price: number;
  original_price: number | null;
  image_url: string;
  category: string;
  category_id: string | null;
  is_new: boolean;
  bg_color_group: string | null;
  sort_order?: number;
}

export const useProducts = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("store-products-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["products"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, original_price, image_url, category, category_id, is_new, is_active, bg_color_group, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
};

// Keep static imports for fallback images
import vestidoPreto from "@/assets/products/vestido-preto.jpg";
import blusaChampagne from "@/assets/products/blusa-champagne.jpg";
import calcaBege from "@/assets/products/calca-bege.jpg";
import vestidoFloral from "@/assets/products/vestido-floral.jpg";
import croppedBranco from "@/assets/products/cropped-branco.jpg";
import acessoriosDourado from "@/assets/products/acessorios-dourado.jpg";
import jaquetaJeans from "@/assets/products/jaqueta-jeans.jpg";
import saiaMidi from "@/assets/products/saia-midi.jpg";

const imageMap: Record<string, string> = {
  "/products/vestido-preto.jpg": vestidoPreto,
  "/products/blusa-champagne.jpg": blusaChampagne,
  "/products/calca-bege.jpg": calcaBege,
  "/products/vestido-floral.jpg": vestidoFloral,
  "/products/cropped-branco.jpg": croppedBranco,
  "/products/acessorios-dourado.jpg": acessoriosDourado,
  "/products/jaqueta-jeans.jpg": jaquetaJeans,
  "/products/saia-midi.jpg": saiaMidi,
};

export const getProductImage = (imageUrl: string): string => {
  return imageMap[imageUrl] || imageUrl;
};
