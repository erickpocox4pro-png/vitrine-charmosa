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
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, status, payment_method, shipping_cost, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: manualSales } = await supabase
      .from("manual_sales")
      .select("total, payment_method, sale_date, quantity, product_name")
      .order("sale_date", { ascending: false })
      .limit(500);

    const { data: coupons } = await supabase
      .from("coupons")
      .select("code, discount_type, discount_value, usage_count, usage_limit, is_active");

    const { data: products } = await supabase
      .from("products")
      .select("name, price, original_price, is_active, category")
      .eq("is_active", true)
      .limit(200);

    const { data: productCosts } = await supabase
      .from("product_costs")
      .select("product_id, cost");

    // === DADOS DE TRÁFEGO ===
    const last30 = new Date();
    last30.setDate(last30.getDate() - 30);
    const last30iso = last30.toISOString();

    const [
      { data: visits30 },
      { data: sessions30 },
      { data: convEvents30 },
      { data: ordersAttr30 },
    ] = await Promise.all([
      supabase.from("page_visits").select("session_id, source_label, device_type, created_at, fbclid, gclid").gte("created_at", last30iso).limit(5000),
      supabase.from("attribution_sessions").select("session_id, first_source, first_seen_at").gte("first_seen_at", last30iso).limit(5000),
      supabase.from("conversion_events").select("event_name, session_id, created_at").gte("created_at", last30iso).limit(10000),
      supabase.from("orders").select("id, total, source_first, source_last, fbclid, gclid, created_at, status, payment_method").gte("created_at", last30iso).limit(1000),
    ]);

    const totalVisits = (visits30 || []).length;
    const uniqueSess = new Set((visits30 || []).map((v: any) => v.session_id).filter(Boolean)).size;
    const sessionsBySource: Record<string, number> = {};
    (sessions30 || []).forEach((s: any) => {
      const k = s.first_source || "direto";
      sessionsBySource[k] = (sessionsBySource[k] || 0) + 1;
    });
    const ordersBySource: Record<string, { count: number; revenue: number }> = {};
    (ordersAttr30 || []).filter((o: any) => ["paid","delivered","shipped","processing"].includes(o.status)).forEach((o: any) => {
      const k = o.source_first || o.source_last || "direto";
      if (!ordersBySource[k]) ordersBySource[k] = { count: 0, revenue: 0 };
      ordersBySource[k].count++;
      ordersBySource[k].revenue += Number(o.total) || 0;
    });
    const conversionBySource = Array.from(new Set([...Object.keys(sessionsBySource), ...Object.keys(ordersBySource)])).map((src) => ({
      source: src,
      sessions: sessionsBySource[src] || 0,
      orders: ordersBySource[src]?.count || 0,
      revenue: ordersBySource[src]?.revenue || 0,
      conv_rate: sessionsBySource[src] > 0 ? ((ordersBySource[src]?.count || 0) / sessionsBySource[src]) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    const initiateCheckoutSess = new Set((convEvents30 || []).filter((e: any) => e.event_name === "InitiateCheckout").map((e: any) => e.session_id).filter(Boolean));
    const purchaseSess = new Set((convEvents30 || []).filter((e: any) => e.event_name === "Purchase").map((e: any) => e.session_id).filter(Boolean));
    let abandonedCarts = 0;
    initiateCheckoutSess.forEach((s) => { if (!purchaseSess.has(s)) abandonedCarts++; });

    const deviceCount: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
    (visits30 || []).forEach((v: any) => {
      const d = (v.device_type || "desktop").toLowerCase();
      if (d in deviceCount) deviceCount[d]++; else deviceCount.desktop++;
    });

    const paidVisits = (visits30 || []).filter((v: any) => v.fbclid || v.gclid || ["facebook-ads","google-ads","instagram-ads","tiktok-ads"].includes(v.source_label)).length;
    const paidOrdersAttr = (ordersAttr30 || []).filter((o: any) => o.fbclid || o.gclid || ["facebook-ads","google-ads","instagram-ads","tiktok-ads"].includes(o.source_first || o.source_last));
    const paidRevenue = paidOrdersAttr.reduce((s: number, o: any) => s + Number(o.total || 0), 0);

    // Melhor hora/dia (pra programação de anúncios)
    const ordersByHour: Record<number, number> = {};
    const ordersByDow: Record<number, number> = {};
    (ordersAttr30 || []).forEach((o: any) => {
      const d = new Date(o.created_at);
      ordersByHour[d.getHours()] = (ordersByHour[d.getHours()] || 0) + 1;
      ordersByDow[d.getDay()] = (ordersByDow[d.getDay()] || 0) + 1;
    });
    const topHour = Object.entries(ordersByHour).sort(([,a],[,b]) => (b as number)-(a as number))[0];
    const topDow = Object.entries(ordersByDow).sort(([,a],[,b]) => (b as number)-(a as number))[0];
    const WEEKDAYS_PT = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

    const trafficContext = {
      period_days: 30,
      total_visits: totalVisits,
      unique_sessions: uniqueSess,
      conversion_rate_pct: uniqueSess > 0 ? ((purchaseSess.size / uniqueSess) * 100).toFixed(2) : "0",
      abandoned_carts: abandonedCarts,
      cart_abandonment_rate_pct: initiateCheckoutSess.size > 0 ? ((abandonedCarts / initiateCheckoutSess.size) * 100).toFixed(0) : "0",
      sources_top5: conversionBySource.slice(0, 5),
      device_breakdown: deviceCount,
      paid_traffic: {
        visits: paidVisits,
        orders: paidOrdersAttr.length,
        revenue: paidRevenue,
        roas_estimate: "depende do investimento — admin precisa informar",
      },
      best_sales_hour: topHour ? `${topHour[0]}h (${topHour[1]} pedidos)` : "sem dados",
      best_sales_dow: topDow ? `${WEEKDAYS_PT[parseInt(topDow[0])]} (${topDow[1]} pedidos)` : "sem dados",
    };

    // Threshold de "dados insuficientes": <100 visitas E <5 pedidos
    const insufficientData = totalVisits < 100 && (orders || []).filter((o: any) =>
      ["paid","delivered","shipped","processing"].includes(o.status)
    ).length < 5;

    if (insufficientData) {
      const insufMsg = `## ⚠️ Dados Insuficientes

Ainda não temos dados suficientes para gerar uma análise consultiva confiável.

**Estado atual (últimos 30 dias):**
- Visitas: **${totalVisits}** (mínimo recomendado: 100)
- Sessões únicas: **${uniqueSess}**
- Pedidos pagos: **${(orders || []).filter((o: any) => ["paid","delivered","shipped","processing"].includes(o.status)).length}** (mínimo recomendado: 5)

## 📋 O que você pode fazer agora

1. **Subir tráfego pra loja** — divulga nas redes sociais, WhatsApp, Instagram orgânico, ou rode um anúncio teste pequeno (R$ 10–20/dia)
2. **Garantir que o checkout funciona** — faça uma compra de teste pra validar o fluxo completo
3. **Aguardar pelo menos 7 dias** após começar a divulgar pra gente ter base estatística

Quando você tiver pelo menos **100 visitas e 5 pedidos** nos últimos 30 dias, volte aqui que eu monto uma análise completa cobrindo finanças, tráfego, conversão por fonte, melhores horários pra anunciar, abandono de carrinho, ticket médio e estratégias de cupons.`;

      // Retorna SSE com a mensagem fixa (mesmo formato que o stream do Gemini)
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Quebra em chunks pra simular streaming natural
          const chunks = insufMsg.match(/.{1,40}/gs) || [insufMsg];
          let i = 0;
          const sendNext = () => {
            if (i >= chunks.length) {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }
            const out = `data: ${JSON.stringify({ choices: [{ delta: { content: chunks[i] } }] })}\n\n`;
            controller.enqueue(encoder.encode(out));
            i++;
            setTimeout(sendNext, 15);
          };
          sendNext();
        },
      });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

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
      traffic: trafficContext, // <-- novo
    });

    const systemPrompt = `Você é um consultor de e-commerce de moda feminina no Brasil — combina papel de CFO + Growth Manager + Mídia Paga.
Analise os dados financeiros E de tráfego/atribuição da loja e forneça recomendações detalhadas, acionáveis e baseadas em números reais.
Responda SEMPRE em português brasileiro. Use formatação markdown com headers ##, listas e **negrito**.
Seja direto, prático, e cite os números exatos dos dados fornecidos.

REGRA IMPORTANTE: se algum bloco de dados estiver vazio ou insuficiente (ex: 0 pedidos, 0 visitas em uma fonte), declare explicitamente "dados insuficientes para esta análise" naquela seção, em vez de inventar recomendações genéricas.

Estruture sua resposta EXATAMENTE nestas seções (mantenha os emojis e títulos):
## 💰 Caixa Bruto e Receita Líquida
## 🏦 Reserva de Caixa Pessoal
## 📊 Análise de Pagamentos
## 🚦 Diagnóstico de Tráfego (últimos 30d)
  - Comente: total de visitas, taxa de conversão geral, % de tráfego pago vs orgânico
  - Aponte qual fonte traz MAIS RECEITA e qual tem MELHOR taxa de conversão (pode ser fontes diferentes)
  - Se o cliente compra mais via mobile ou desktop
## 🛒 Carrinho Abandonado
  - Quantos sessions iniciaram checkout sem comprar e o % de abandono
  - Recomende ação concreta (remarketing, WhatsApp, cupom de recuperação)
## 📢 Investimento em Tráfego Pago
  - Se a loja JÁ recebe tráfego pago: comente o volume e se está convertendo
  - Se NÃO recebe: oriente como começar (orçamento inicial, otimizar por evento Purchase, públicos lookalike)
## ⏰ Quando Anunciar
  - Use o melhor horário e melhor dia da semana de pedidos pra recomendar programação de anúncios
## 🛍️ Reinvestimento em Novas Peças
## 📈 Tendências de Mercado (moda feminina BR — sazonalidade do mês atual)
## ⚠️ Pontos a Melhorar
  - Liste 3 a 5 problemas concretos detectados nos números, em ordem de prioridade
## 🎟️ Estratégias de Cupons
## 🎯 Aumento do Ticket Médio
## 📅 Descontos em Datas Especiais`;

    const userContent = `Aqui estão os dados completos da loja (financeiros + tráfego/atribuição):\n\n${financialContext}\n\nForneça uma análise completa, prática e específica. Use SEMPRE os números reais. Se algum dado estiver vazio, declare "dados insuficientes" naquela seção em vez de inventar.`;

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("Gemini API error:", upstream.status, t);
      throw new Error("Gemini API error");
    }

    // Transform Gemini SSE -> OpenAI-style SSE (frontend espera esse formato)
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let buffer = "";

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const out = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
              controller.enqueue(encoder.encode(out));
            }
          } catch {
            // ignora chunks incompletos
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      },
    });

    return new Response(upstream.body!.pipeThrough(transform), {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
