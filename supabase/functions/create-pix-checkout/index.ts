import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function generatePixPayload(amount: number, txId: string): string {
  const pixKey = "63540052000170";
  const merchantName = "EDUARDA THAMMYRES DOS SANTOS";
  const merchantCity = "MESSIAS";

  const gui = tlv("00", "BR.GOV.BCB.PIX");
  const key = tlv("01", pixKey);
  const merchantAccount = tlv("26", gui + key);

  let payload = "";
  payload += tlv("00", "01");
  payload += merchantAccount;
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  payload += tlv("54", amount.toFixed(2));
  payload += tlv("58", "BR");
  payload += tlv("59", merchantName);
  payload += tlv("60", merchantCity);
  payload += tlv("62", tlv("05", txId));
  payload += "6304";

  const checksum = crc16(payload);
  payload += checksum;

  return payload;
}

function generateOrderCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const timestamp = Date.now().toString(36).toUpperCase();
  let random = "";
  for (let i = 0; i < 6; i++) random += chars[Math.floor(Math.random() * chars.length)];
  return `PIX${timestamp}${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

    // 1. Authenticate user
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { items, cep, shippingAddress, productCouponCode, shippingCouponCode } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Items inválidos.");
    }

    // 2. Fetch real prices from database
    const productIds = [...new Set(items.map((i: any) => i.product_id))];
    const variantIds = items.filter((i: any) => i.variant_id).map((i: any) => i.variant_id);

    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, name, price")
      .in("id", productIds);

    if (prodErr || !products) throw new Error("Erro ao buscar produtos.");

    const productMap: Record<string, any> = {};
    products.forEach((p: any) => { productMap[p.id] = p; });

    let variantMap: Record<string, any> = {};
    if (variantIds.length > 0) {
      const { data: variants, error: varErr } = await supabase
        .from("product_variants")
        .select("id, product_id, price, color, color_name, size, numbering")
        .in("id", variantIds);
      if (varErr) throw new Error("Erro ao buscar variantes.");
      (variants || []).forEach((v: any) => { variantMap[v.id] = v; });
    }

    // 3. Calculate subtotal with server-side prices
    let subtotal = 0;
    const orderItems: any[] = [];
    for (const item of items) {
      const product = productMap[item.product_id];
      if (!product) throw new Error(`Produto ${item.product_id} não encontrado.`);

      const variant = item.variant_id ? variantMap[item.variant_id] : null;
      const unitPrice = variant?.price ?? product.price;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));

      subtotal += unitPrice * quantity;
      orderItems.push({
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity,
        price: unitPrice,
      });
    }

    // 4. Calculate shipping server-side
    let shippingCost = 0;
    if (cep) {
      const cleanCep = String(cep).replace(/\D/g, "");
      if (cleanCep.length === 8) {
        const prefix = cleanCep.substring(0, 5);
        const { data: rules } = await supabase
          .from("shipping_rules")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        let matched = false;
        if (rules) {
          for (const rule of rules) {
            const start = rule.cep_start.padEnd(5, "0");
            const end = rule.cep_end.padEnd(5, "9");
            if (prefix >= start && prefix <= end) {
              shippingCost = rule.is_free ? 0 : Number(rule.price);
              matched = true;
              break;
            }
          }
        }
        if (!matched) shippingCost = 20;
      }
    }

    // 5. Validate product coupon server-side
    let productDiscount = 0;
    if (productCouponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", String(productCouponCode).toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (coupon) {
        const now = new Date();
        const valid =
          (!coupon.expires_at || new Date(coupon.expires_at) >= now) &&
          (!coupon.starts_at || new Date(coupon.starts_at) <= now) &&
          (coupon.usage_limit === null || coupon.usage_count < coupon.usage_limit) &&
          (!coupon.min_order_value || subtotal >= Number(coupon.min_order_value)) &&
          coupon.applies_to === "products";

        if (valid) {
          let discount = 0;
          if (coupon.discount_type === "percentage") {
            discount = subtotal * (Number(coupon.discount_value) / 100);
          } else {
            discount = Number(coupon.discount_value);
          }
          if (coupon.max_discount && discount > Number(coupon.max_discount)) {
            discount = Number(coupon.max_discount);
          }
          productDiscount = Math.min(discount, subtotal);
          await supabase.rpc('increment_coupon_usage', { coupon_id: coupon.id });
        }
      }
    }

    // 6. Validate shipping coupon server-side
    let shippingDiscount = 0;
    if (shippingCouponCode && shippingCost > 0) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", String(shippingCouponCode).toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (coupon) {
        const now = new Date();
        const valid =
          (!coupon.expires_at || new Date(coupon.expires_at) >= now) &&
          (!coupon.starts_at || new Date(coupon.starts_at) <= now) &&
          (coupon.usage_limit === null || coupon.usage_count < coupon.usage_limit) &&
          coupon.applies_to === "shipping";

        if (valid) {
          let discount = 0;
          if (coupon.discount_type === "percentage") {
            discount = shippingCost * (Number(coupon.discount_value) / 100);
          } else {
            discount = Number(coupon.discount_value);
          }
          if (coupon.max_discount && discount > Number(coupon.max_discount)) {
            discount = Number(coupon.max_discount);
          }
          shippingDiscount = Math.min(discount, shippingCost);
          await supabase.rpc('increment_coupon_usage', { coupon_id: coupon.id });
        }
      }
    }

    // 7. Calculate final amount
    const finalShipping = Math.max(0, shippingCost - shippingDiscount);
    const totalAmount = Math.max(0, subtotal - productDiscount + finalShipping);

    // 8. Generate order code and PIX payload SERVER-SIDE
    const code = generateOrderCode();
    const pixPayload = generatePixPayload(totalAmount, code);

    // 9. Create order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        total: totalAmount,
        status: "pending",
        payment_method: "pix",
        shipping_address: shippingAddress,
        shipping_cost: finalShipping,
      })
      .select("id")
      .single();

    if (orderErr) throw orderErr;

    // 10. Create order items
    const dbOrderItems = orderItems.map((i) => ({ ...i, order_id: order.id }));
    await supabase.from("order_items").insert(dbOrderItems);

    // 11. Create pix payment record
    await supabase.from("pix_payments").insert({
      order_id: order.id,
      user_id: user.id,
      code,
      amount: totalAmount,
      status: "pending",
    });

    // 12. Timeline entry
    await supabase.from("order_timeline").insert({
      order_id: order.id,
      status: "pending",
      note: `Pedido criado via PIX. Código: ${code}`,
    });

    return new Response(
      JSON.stringify({
        orderId: order.id,
        pixCode: code,
        pixPayload,
        amount: totalAmount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("PIX checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
