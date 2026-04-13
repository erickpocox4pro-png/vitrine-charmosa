import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Authentication required
    const authHeader = req.headers.get("Authorization") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      anonKey,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const customerEmail = user.email;

    const { items, cep, shippingAddress, productCouponCode, shippingCouponCode } = await req.json();

    // Validate items structure
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Items inválidos.");
    }

    // 1. Fetch real prices from database
    const productIds = [...new Set(items.map((i: any) => i.product_id))];
    const variantIds = items.filter((i: any) => i.variant_id).map((i: any) => i.variant_id);

    const { data: products, error: prodErr } = await supabaseClient
      .from("products")
      .select("id, name, price")
      .in("id", productIds);

    if (prodErr || !products) throw new Error("Erro ao buscar produtos.");

    const productMap: Record<string, any> = {};
    products.forEach((p: any) => { productMap[p.id] = p; });

    let variantMap: Record<string, any> = {};
    if (variantIds.length > 0) {
      const { data: variants, error: varErr } = await supabaseClient
        .from("product_variants")
        .select("id, product_id, price, color, color_name, size, numbering")
        .in("id", variantIds);
      if (varErr) throw new Error("Erro ao buscar variantes.");
      (variants || []).forEach((v: any) => { variantMap[v.id] = v; });
    }

    // Build line items with server-side prices
    let subtotal = 0;
    const lineItems = items.map((item: any) => {
      const product = productMap[item.product_id];
      if (!product) throw new Error(`Produto ${item.product_id} não encontrado.`);

      const variant = item.variant_id ? variantMap[item.variant_id] : null;
      const unitPrice = variant?.price ?? product.price;
      const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitAmountCents = Math.round(unitPrice * 100);

      subtotal += unitPrice * quantity;

      let itemName = product.name;
      if (variant) {
        if (variant.color_name || variant.color) itemName += ` - ${variant.color_name || variant.color}`;
        if (variant.size) itemName += ` - ${variant.size}`;
        if (variant.numbering) itemName += ` - Nº ${variant.numbering}`;
      }

      return {
        price_data: {
          currency: "brl",
          product_data: { name: itemName },
          unit_amount: unitAmountCents,
        },
        quantity,
      };
    });

    // 2. Calculate shipping server-side from CEP
    let shippingCost = 0;
    if (cep) {
      const cleanCep = String(cep).replace(/\D/g, "");
      if (cleanCep.length === 8) {
        const prefix = cleanCep.substring(0, 5);
        const { data: rules } = await supabaseClient
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
        if (!matched) shippingCost = 20; // fallback
      }
    }

    // 3. Validate product coupon server-side
    let productDiscountCents = 0;
    if (productCouponCode) {
      const { data: coupon } = await supabaseClient
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
          (coupon.applies_to === "products");

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
          discount = Math.min(discount, subtotal);
          productDiscountCents = Math.round(discount * 100);
          // Increment usage_count atomically
          await supabaseClient.rpc('increment_coupon_usage', { coupon_id: coupon.id });
        }
      }
    }

    // 4. Validate shipping coupon server-side
    let shippingDiscountCents = 0;
    if (shippingCouponCode && shippingCost > 0) {
      const { data: coupon } = await supabaseClient
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
          (coupon.applies_to === "shipping");

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
          discount = Math.min(discount, shippingCost);
          shippingDiscountCents = Math.round(discount * 100);
          await supabaseClient.rpc('increment_coupon_usage', { coupon_id: coupon.id });
        }
      }
    }

    // Add shipping line item
    const finalShippingCents = Math.round(shippingCost * 100) - shippingDiscountCents;
    if (finalShippingCents > 0) {
      lineItems.push({
        price_data: {
          currency: "brl",
          product_data: { name: "Frete" },
          unit_amount: finalShippingCents,
        },
        quantity: 1,
      });
    }

    // Apply product discount via Stripe coupon
    const sessionParams: any = {
      line_items: lineItems,
      mode: "payment",
      payment_method_types: ["card"],
      success_url: `${req.headers.get("origin")}/`,
      cancel_url: `${req.headers.get("origin")}/checkout`,
      metadata: {
        shipping_address: JSON.stringify(shippingAddress),
      },
    };

    // Apply product discount as a Stripe coupon
    if (productDiscountCents > 0) {
      const stripeCoupon = await stripe.coupons.create({
        amount_off: productDiscountCents,
        currency: "brl",
        duration: "once",
        name: productCouponCode ? `Cupom ${productCouponCode}` : "Desconto",
      });
      sessionParams.discounts = [{ coupon: stripeCoupon.id }];
    }

    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        sessionParams.customer = customers.data[0].id;
      } else {
        sessionParams.customer_email = customerEmail;
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
