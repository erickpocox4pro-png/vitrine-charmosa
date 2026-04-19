import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const { imageUrl, productId } = await req.json();

    if (!imageUrl || !productId) {
      return new Response(JSON.stringify({ error: "imageUrl e productId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch image and convert to inline base64
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) throw new Error("Não foi possível baixar a imagem");
    const mimeType = imgResp.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const imgBuf = await imgResp.arrayBuffer();
    const imgB64 = bufferToBase64(imgBuf);

    const systemText = `Você é um analisador de imagens de produtos de moda. Sua tarefa é classificar a COR PREDOMINANTE DO FUNDO da imagem do produto.

Classifique o fundo em UMA destas categorias:
- "white" — fundo branco ou quase branco
- "light" — fundo claro mas não branco
- "neutral" — fundo cinza médio, bege médio
- "dark" — fundo escuro
- "colored" — fundo com cor vibrante/saturada

Responda APENAS com a categoria, sem explicação.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [{
            role: "user",
            parts: [
              { text: "Qual é a cor predominante do fundo desta imagem de produto?" },
              { inlineData: { mimeType, data: imgB64 } },
            ],
          }],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      throw new Error("Erro ao analisar imagem");
    }

    const data = await response.json();
    const rawContent = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim().toLowerCase();

    const validGroups = ["white", "light", "neutral", "dark", "colored"];
    const bgGroup = validGroups.find((g) => rawContent.includes(g)) || "neutral";

    await supabase.from("products").update({ bg_color_group: bgGroup }).eq("id", productId);

    return new Response(JSON.stringify({ bg_color_group: bgGroup, productId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-product-bg error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
