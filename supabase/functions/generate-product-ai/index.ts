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

async function fetchImageAsInlineData(url: string): Promise<{ mimeType: string; data: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const mimeType = resp.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const buf = await resp.arrayBuffer();
    return { mimeType, data: bufferToBase64(buf) };
  } catch {
    return null;
  }
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

    const { productName, category, brand, field, imageUrl } = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: "Nome do produto é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageDisclaimer = `REGRAS IMPORTANTES:
- NÃO invente informações sobre materiais, composição, medidas ou especificações técnicas que você não tem certeza.
- Se não souber um detalhe específico, use termos genéricos como "tecido de alta qualidade" em vez de inventar "100% algodão".
- Foque em benefícios visuais e estilo que podem ser inferidos do nome e categoria.
- Nunca invente certificações, prêmios ou características técnicas fictícias.
- NUNCA mencione cores específicas do produto (ex: "preto", "vermelho", "azul"). O mesmo produto pode ter diversas variantes de cor, então a descrição deve ser genérica e aplicável a TODAS as variantes. Use termos neutros como "tons versáteis", "diversas opções de cores" ou simplesmente não mencione cores.`;

    const imageAnalysisNote = imageUrl
      ? `\nUma imagem do produto foi fornecida para análise. Use as informações visuais (cores, estilo, modelagem, detalhes visíveis) para enriquecer a descrição com dados reais do produto. Descreva APENAS o que é visível na imagem.`
      : "";

    const prompts: Record<string, string> = {
      short_description: `${imageDisclaimer}\n\nGere uma descrição curta (máximo 2 frases, ~150 caracteres) para o produto "${productName}"${category ? ` da categoria "${category}"` : ""}${brand ? ` da marca "${brand}"` : ""}.${imageAnalysisNote}\nSeja persuasivo e direto. Responda APENAS com a descrição, sem aspas.`,
      description: `${imageDisclaimer}\n\nGere uma descrição completa e detalhada para o produto "${productName}"${category ? ` da categoria "${category}"` : ""}${brand ? ` da marca "${brand}"` : ""}.${imageAnalysisNote}\nInclua benefícios visuais, estilo, ocasiões de uso e como combinar. Use parágrafos curtos. Não use markdown. NÃO invente materiais, composição ou medidas específicas. Responda APENAS com a descrição.`,
      slug: `Gere um slug SEO-friendly para o produto "${productName}". O slug deve ser em português, sem acentos, apenas letras minúsculas, números e hífens. Responda APENAS com o slug, sem explicação. Exemplo: vestido-midi-floral-verao`,
      sku: `Gere um código SKU para o produto "${productName}"${category ? ` da categoria "${category}"` : ""}. O SKU deve ter 6-10 caracteres, usando letras maiúsculas e números. Formato: 3 letras da categoria + números sequenciais. Responda APENAS com o SKU. Exemplo: VES-001, CAL-042`,
      tags: `Gere 6-10 tags relevantes para o produto "${productName}"${category ? ` da categoria "${category}"` : ""}${brand ? ` da marca "${brand}"` : ""}.${imageAnalysisNote}\nAs tags devem ser palavras ou expressões curtas em português, úteis para busca e filtros na loja. Responda APENAS com as tags separadas por vírgula, sem numeração. Exemplo: verão, casual, elegante, festa`,
      seo: `${imageDisclaimer}\n\nPara o produto "${productName}"${category ? ` da categoria "${category}"` : ""}${brand ? ` da marca "${brand}"` : ""}, gere:
1. Meta título (máximo 60 caracteres, otimizado para SEO)
2. Meta descrição (máximo 160 caracteres, persuasiva com call-to-action)
3. Palavras-chave (5-8 palavras separadas por vírgula)

Responda EXATAMENTE neste formato JSON (sem markdown, sem \`\`\`):
{"meta_title": "...", "meta_description": "...", "keywords": "..."}`,
      all: `${imageDisclaimer}\n\nPara o produto "${productName}"${category ? ` da categoria "${category}"` : ""}${brand ? ` da marca "${brand}"` : ""}, gere todos os campos abaixo:${imageAnalysisNote}

1. Descrição curta (máximo 2 frases, ~150 caracteres)
2. Descrição completa (3-4 parágrafos detalhados sem markdown, NÃO invente materiais ou medidas)
3. Slug SEO-friendly (sem acentos, minúsculas, hífens)
4. SKU (6-10 caracteres, letras maiúsculas + números)
5. Meta título (máximo 60 caracteres)
6. Meta descrição (máximo 160 caracteres)
7. Palavras-chave (5-8 palavras separadas por vírgula)
8. Tags (6-10 tags relevantes separadas por vírgula)

Responda EXATAMENTE neste formato JSON (sem markdown, sem \`\`\`):
{"short_description": "...", "description": "...", "slug": "...", "sku": "...", "meta_title": "...", "meta_description": "...", "keywords": "...", "tags": "..."}`,
      variants: `O usuário descreveu as variantes de um produto assim: "${productName}".
Analise o texto e extraia as variantes. Para cada variante, identifique:
- color: nome da cor (ex: "Preto", "Vermelho", "Azul Marinho"). Se não mencionada, deixe vazio.
- color_hex: código hex aproximado da cor (ex: "#000000" para Preto). Se não souber, use "#808080".
- size: tamanho (ex: "P", "M", "G", "GG", "Único"). Se não mencionado, deixe vazio.
- numbering: numeração (ex: "34", "36", "38"). Se não mencionada, deixe vazio.

Responda EXATAMENTE neste formato JSON (sem markdown, sem \`\`\`):
{"variants": [{"color": "...", "color_hex": "...", "size": "...", "numbering": "..."}, ...]}

Se o texto for confuso, faça o melhor possível para extrair as variantes.`,
    };

    const prompt = prompts[field];
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Campo inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parts: any[] = [{ text: prompt }];
    const visionFields = ["description", "short_description", "tags", "all"];
    if (imageUrl && visionFields.includes(field)) {
      const inline = await fetchImageAsInlineData(imageUrl);
      if (inline) parts.push({ inlineData: inline });
    }

    const systemInstruction = {
      parts: [{ text: "Você é um especialista em e-commerce e copywriting para lojas de moda feminina no Brasil. Gere conteúdo persuasivo, profissional e otimizado para SEO. Sempre responda em português brasileiro. NUNCA invente informações técnicas fictícias sobre produtos." }],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction,
          contents: [{ role: "user", parts }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Aguarde um momento e tente novamente." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Gemini API error:", response.status, t);
      throw new Error("Erro ao gerar conteúdo com IA");
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    // Remove markdown fences se vierem
    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    return new Response(JSON.stringify({ content, field }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-product-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
