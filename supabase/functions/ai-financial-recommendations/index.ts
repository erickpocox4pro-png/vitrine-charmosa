import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not configured");

    // Auth check
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Fetch orders (paid/delivered)
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, status, payment_method, shipping_cost, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    // Fetch manual sales
    const { data: manualSales } = await supabase
      .from("manual_sales")
      .select("total, payment_method, sale_date, quantity, product_name")
      .order("sale_date", { ascending: false })
      .limit(500);

    // Fetch coupons
    const { data: coupons } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, usage_count, usage_limit, is_active");

    // Fetch products for avg price analysis
    const { data: products } = await supabase
      .from("products")
      .select("name, price, original_price, is_active, category")
      .eq("is_active", true)
      .limit(200);

    // Fetch costs from admin-only table
    const { data: productCosts } = await supabase
      .from("product_costs")
      .select("product_id, cost");

    // Build summary
    const paidOrders = (orders || []).filter((o) =>
      ["paid", "delivered", "shipped", "processing"].includes(o.status)
    );
    const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total), 0);
    const totalShipping = paidOrders.reduce((s, o) => s + Number(o.shipping_cost || 0), 0);
    const manualTotal = (manualSales || []).reduce((s, m) => s + Number(m.total), 0);
    const avgTicket = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
    const costMap: Record<string, number> = {};
    (productCosts || []).forEach((pc: any) => { if (pc.cost) costMap[pc.product_id] = Number(pc.cost); });
    const totalProductsCost = Object.values(costMap).reduce((s, c) => s + c, 0);
    const avgProductPrice = (products || []).length > 0
      ? (products || []).reduce((s, p) => s + Number(p.price), 0) / products!.length
      : 0;

    const paymentBreakdown: Record<string, number> = {};
    paidOrders.forEach((o) => {
      const method = o.payment_method || "não informado";
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + 1;
    });

    const monthlyRevenue: Record<string, number> = {};
    paidOrders.forEach((o) => {
      const month = o.created_at.substring(0, 7);
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + Number(o.total);
    });

    const financialContext = JSON.stringify({
      totalRevenue,
      totalShipping,
      manualSalesTotal: manualTotal,
      netRevenue: totalRevenue - totalShipping,
      avgTicket: avgTicket.toFixed(2),
      totalOrders: paidOrders.length,
      pendingOrders: (orders || []).filter((o) => o.status === "pending").length,
      cancelledOrders: (orders || []).filter((o) => o.status === "cancelled").length,
      paymentBreakdown,
      monthlyRevenue,
      activeCoupons: (coupons || []).filter((c) => c.is_active).length,
      couponsDetail: (coupons || []).slice(0, 10).map((c) => ({
        code: c.code, type: c.discount_type, value: c.discount_value, used: c.usage_count, limit: c.usage_limit,
      })),
      avgProductPrice: avgProductPrice.toFixed(2),
      totalActiveProducts: (products || []).length,
      productsWithCost: Object.keys(costMap).length,
      avgCost: Object.keys(costMap).length > 0
        ? (totalProductsCost / Object.keys(costMap).length).toFixed(2)
        : "não informado",
    });

    const systemPrompt = `Você é um consultor financeiro especializado em e-commerce de moda feminina no Brasil.
Analise os dados financeiros da loja e forneça recomendações detalhadas e práticas.
Responda SEMPRE em português brasileiro. Use formatação markdown com headers ##, listas e **negrito**.
Seja direto, prático e use números reais dos dados fornecidos.

Estruture sua resposta EXATAMENTE nestas seções:
## 💰 Caixa Bruto e Receita Líquida
## 🏦 Reserva de Caixa Pessoal
## 📢 Investimento em Tráfego Pago
## 🛍️ Reinvestimento em Novas Peças
## 📊 Análise de Pagamentos
## 📈 Tendências de Mercado
## ⚠️ Pontos a Melhorar
## 🎟️ Estratégias de Cupons
## 🎯 Aumento do Ticket Médio
## 📅 Descontos em Datas Especiais`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Aqui estão os dados financeiros atuais da loja:\n\n${financialContext}\n\nForneça uma análise completa com recomendações práticas e específicas baseadas nesses números reais.`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione fundos na sua conta." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
