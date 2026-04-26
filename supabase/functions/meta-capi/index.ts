/**
 * Meta Conversions API (CAPI) — envia eventos server-side pro Facebook.
 *
 * Por que: o Pixel client-side é bloqueado por ad blockers (~30% dos usuários)
 * e iOS 14+ limita o tracking. Enviar do servidor garante que o Facebook
 * receba os eventos importantes (Purchase, Lead) sempre.
 *
 * Como funciona:
 *   1. Recebe POST com { event_name, event_value, fbclid, user_data, custom_data }
 *   2. Hasheia email/telefone com SHA-256 (exigência da Meta)
 *   3. POSTa pra graph.facebook.com/v18.0/<PIXEL_ID>/events
 *   4. Usa eventID = order_id pra dedupe com o Pixel client-side
 *
 * Secrets necessárias (no Supabase Dashboard → Edge Functions → Secrets):
 *   META_PIXEL_ID            = 799756736248413
 *   META_CAPI_ACCESS_TOKEN   = (gerado em Events Manager → API de Conversões)
 *   META_TEST_EVENT_CODE     = TEST79745  (opcional, só pra debug)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PIXEL_ID = Deno.env.get("META_PIXEL_ID") || "";
const ACCESS_TOKEN = Deno.env.get("META_CAPI_ACCESS_TOKEN") || "";
const TEST_EVENT_CODE = Deno.env.get("META_TEST_EVENT_CODE") || "";

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildUserData(input: any, ip: string, ua: string) {
  const u: Record<string, any> = {};
  if (input?.email) u.em = [await sha256(input.email)];
  if (input?.phone) u.ph = [await sha256(input.phone.replace(/\D/g, ""))];
  if (input?.first_name) u.fn = [await sha256(input.first_name)];
  if (input?.last_name) u.ln = [await sha256(input.last_name)];
  if (input?.city) u.ct = [await sha256(input.city)];
  if (input?.state) u.st = [await sha256(input.state)];
  if (input?.zip) u.zp = [await sha256(input.zip.replace(/\D/g, ""))];
  if (input?.country) u.country = [await sha256(input.country || "br")];
  if (input?.fbp) u.fbp = input.fbp;       // _fbp cookie
  if (input?.fbc) u.fbc = input.fbc;       // _fbc cookie ou fbclid → "fb.1.<ts>.<fbclid>"
  if (input?.external_id) u.external_id = [await sha256(String(input.external_id))];
  if (ip) u.client_ip_address = ip;
  if (ua) u.client_user_agent = ua;
  return u;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({ error: "META_PIXEL_ID ou META_CAPI_ACCESS_TOKEN não configurado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const {
      event_name,           // PageView, ViewContent, AddToCart, InitiateCheckout, Lead, Purchase
      event_id,             // ideal: order_id (pra dedupe com Pixel client)
      event_source_url,     // URL onde rolou
      event_time,           // unix seconds (default: agora)
      action_source = "website",
      user_data = {},       // { email, phone, fbclid, fbp, fbc, ... }
      custom_data = {},     // { value, currency, content_ids, content_type, num_items, ... }
      fbclid,               // shortcut
    } = body;

    if (!event_name) throw new Error("event_name é obrigatório");

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "";
    const ua = req.headers.get("user-agent") || "";

    // fbclid → fbc (formato fb.1.<ts>.<fbclid>)
    if (fbclid && !user_data.fbc) {
      user_data.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
    }

    const userData = await buildUserData(user_data, ip, ua);

    const event = {
      event_name,
      event_time: event_time || Math.floor(Date.now() / 1000),
      event_id: event_id || `${event_name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event_source_url,
      action_source,
      user_data: userData,
      custom_data,
    };

    const payload: any = { data: [event] };
    if (TEST_EVENT_CODE) payload.test_event_code = TEST_EVENT_CODE;

    const url = `https://graph.facebook.com/v18.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();

    if (!res.ok) {
      console.error("[meta-capi] Facebook respondeu erro:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, fb: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[meta-capi]", err);
    return new Response(JSON.stringify({ error: err.message || "Erro" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
