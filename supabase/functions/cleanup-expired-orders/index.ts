import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

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

    // Find orders pending for more than 75 hours
    const cutoff = new Date(Date.now() - 75 * 60 * 60 * 1000).toISOString();

    const { data: expiredOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", cutoff);

    if (fetchError) throw fetchError;

    if (!expiredOrders || expiredOrders.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum pedido expirado", removed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderIds = expiredOrders.map((o) => o.id);

    await supabase.from("pix_payments").update({ status: "expired" }).in("order_id", orderIds).eq("status", "pending");
    await supabase.from("order_items").delete().in("order_id", orderIds);
    await supabase.from("order_timeline").delete().in("order_id", orderIds);
    await supabase.from("orders").delete().in("id", orderIds);

    console.log(`Removed ${orderIds.length} expired orders`);

    return new Response(
      JSON.stringify({ message: `${orderIds.length} pedidos expirados removidos`, removed: orderIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error cleaning up expired orders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
