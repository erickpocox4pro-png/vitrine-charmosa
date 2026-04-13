import { supabase } from "@/integrations/supabase/client";

// Shipping calculation based on CEP (Brazilian postal code)
export interface ShippingResult {
  region: string;
  price: number;
  isFree: boolean;
  deliveryDaysMin?: number;
  deliveryDaysMax?: number;
}

// Cache for shipping rules
let cachedRules: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 1 minute

async function getShippingRules() {
  if (cachedRules && Date.now() - cacheTime < CACHE_TTL) {
    return cachedRules;
  }
  const { data } = await supabase
    .from("shipping_rules")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  cachedRules = data || [];
  cacheTime = Date.now();
  return cachedRules;
}

export async function calculateShippingAsync(cep: string): Promise<ShippingResult | null> {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  const prefix = cleanCep.substring(0, 5);

  try {
    const rules = await getShippingRules();
    for (const rule of rules) {
      const start = rule.cep_start.padEnd(5, "0");
      const end = rule.cep_end.padEnd(5, "9");
      if (prefix >= start && prefix <= end) {
        return {
          region: rule.region_name,
          price: rule.is_free ? 0 : Number(rule.price),
          isFree: rule.is_free,
          deliveryDaysMin: rule.delivery_days_min,
          deliveryDaysMax: rule.delivery_days_max,
        };
      }
    }
  } catch {
    // Fallback to hardcoded if DB fails
    return calculateShipping(cep);
  }

  return { region: "Brasil", price: 20, isFree: false, deliveryDaysMin: 7, deliveryDaysMax: 14 };
}

// Synchronous fallback (hardcoded rules)
export function calculateShipping(cep: string): ShippingResult | null {
  const cleanCep = cep.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  const prefix = parseInt(cleanCep.substring(0, 5));
  const prefix2 = parseInt(cleanCep.substring(0, 2));

  if (prefix >= 57990 && prefix <= 57999) return { region: "Messias - AL", price: 0, isFree: true };
  if (prefix2 === 57) return { region: "Alagoas", price: 10, isFree: false };
  if (prefix2 >= 50 && prefix2 <= 56) return { region: "Pernambuco", price: 11, isFree: false };
  if (prefix2 >= 40 && prefix2 <= 48) return { region: "Bahia", price: 13, isFree: false };
  if (prefix2 === 49) return { region: "Sergipe", price: 12, isFree: false };
  if (prefix2 === 58) return { region: "Paraíba", price: 12, isFree: false };
  if (prefix2 === 59) return { region: "Rio Grande do Norte", price: 13, isFree: false };
  if (prefix2 >= 60 && prefix2 <= 63) return { region: "Ceará", price: 14, isFree: false };
  if (prefix2 === 64) return { region: "Piauí", price: 15, isFree: false };
  if (prefix2 === 65) return { region: "Maranhão", price: 16, isFree: false };
  if (prefix2 >= 1 && prefix2 <= 9) return { region: "São Paulo - Capital", price: 15, isFree: false };
  if (prefix2 >= 10 && prefix2 <= 19) return { region: "São Paulo - Interior", price: 17, isFree: false };
  if (prefix2 >= 20 && prefix2 <= 28) return { region: "Rio de Janeiro", price: 25, isFree: false };
  if (prefix2 >= 29 && prefix2 <= 39) return { region: "Minas Gerais / Espírito Santo", price: 22, isFree: false };
  if (prefix2 >= 66 && prefix2 <= 69) return { region: "Norte", price: 28, isFree: false };
  if (prefix2 >= 70 && prefix2 <= 87) return { region: "Centro-Oeste / Paraná", price: 25, isFree: false };
  if (prefix2 >= 88 && prefix2 <= 99) return { region: "Sul", price: 25, isFree: false };

  return { region: "Brasil", price: 20, isFree: false };
}
