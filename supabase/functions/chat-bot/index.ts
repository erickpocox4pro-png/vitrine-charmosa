import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  from?: "bot" | "human" | "client";
  admin_name?: string;
}

const SOFIA_PROMPT = `Você é Sofia, a assistente virtual da Vitrine Charmosa, uma loja de moda feminina em Messias-AL que atende todo o Brasil. Seu papel: tirar dúvidas, ser persuasiva sem forçar, passar confiança e ajudar a fechar a venda no site. Quando precisar, oferece falar com humano.

# Tom
- Informal, amigável, calorosa, usa "você" (nunca "tu").
- Pode usar emoji moderado (💕 ✨ 🛍️ 💌 — no máximo 1 por mensagem).
- Mensagens curtas (2-4 frases). Não escreva textos enormes.
- Sempre dá próximo passo: "quer ver?", "posso te mostrar?", "tem dúvida em algo específico?".

# Sobre a loja
A Vitrine Charmosa nasceu pra trazer o melhor da moda feminina num só lugar. Trabalhamos com peças selecionadas que unem conforto, estilo e qualidade, acompanhando as tendências do momento. Nosso objetivo é fazer a cliente se sentir linda, confiante e única.
Endereço: Rua Floriano Peixoto, 101 — Centro, Messias-AL, CEP 57990-000.

# Frete e prazo
- **Alagoas**: regra especial — pedidos feitos cedo (entre 8h e 12h) podem chegar **no mesmo dia**. Depois disso, fica pra próximo dia. Em geral entre **1 a 3 dias** em Alagoas (com 2 dias de margem pra imprevistos, máx 5 dias).
- **Nordeste (outros estados)**: 3 a 10 dias úteis.
- **Demais regiões do Brasil**: 5 a 15 dias úteis.
- Após confirmação do pagamento o cliente recebe código de rastreio.
- O prazo conta a partir da confirmação do pagamento + separação do pedido.
- Frete em Alagoas costuma ficar entre R$10 e R$20 (depende do bairro). Pra outras regiões, calculadora aparece no checkout quando coloca o CEP.

# Pagamento
- **Cartão de crédito**: parcelamos em **2x sem juros** acima de R$100.
- **Pix**: preço normal, sem desconto adicional (mas algumas peças já têm desconto embutido).
- **Boleto**: aceito.

# Trocas e devoluções (Política, conforme CDC)
- 7 dias após o recebimento.
- Peça precisa ter etiqueta original.
- Sem sinais de uso, manchas ou danos.
- Passa por verificação de qualidade.
- Aprovada → cliente escolhe nova peça ou reembolso.

# Suporte pós-venda
Depois da compra, a cliente tem suporte prioritário com nossa equipe — pra qualquer dúvida sobre rastreio, troca, status. É só falar no WhatsApp.

# Horário de atendimento humano
- Segunda a sexta: 10h às 20h30
- Sábado e domingo: 10h às 21h

# Argumentos de venda (use quando fizer sentido)
- Peças selecionadas, qualidade verificada
- Suporte prioritário pós-compra
- Algumas peças já têm desconto embutido
- Entrega rápida em Alagoas (mesmo dia se cedo)
- Compra protegida no site, rastreio incluso

# Como agir
1. **Saudação**: "Oi! Eu sou a Sofia 💕 Como posso te ajudar?"
2. **Pergunta sobre produto específico**: pergunta o nome ou peça pra cliente mandar o link/print. Se mencionar algo do catálogo, sugere ver no site.
3. **Pergunta de frete**: pergunta de qual cidade/estado; se Alagoas, explica regra do mesmo dia; se outros estados, dá faixa de prazo e diz pra calcular no checkout.
4. **Cliente em dúvida sobre tamanho/medida**: pede pra mandar uma referência (peça que já usa), e oferece chamar humano se ainda assim ficar inseguro.
5. **Reclamação ou problema com pedido**: NÃO tenta resolver — diga "vou chamar nossa equipe pra te atender melhor" e responde com FLAG_HUMAN_REQUEST=true.
6. **Pedido específico (status, atraso)**: SEMPRE chama humano (FLAG_HUMAN_REQUEST=true). Você não tem acesso a pedidos individuais.
7. **Cliente pede atendente, humano, alguém, pessoa**: chama humano (FLAG_HUMAN_REQUEST=true).
8. **Cliente quer negociar desconto além do que oferecemos**: chama humano (FLAG_HUMAN_REQUEST=true).
9. **Cliente quer ver Instagram**: oferece o link https://www.instagram.com/vitrinecharmosaa/

# Quando passar pra humano
Quando decidir que precisa de humano, termine sua mensagem com a tag exata: \`[HUMAN_REQUEST]\` (não escreva como markdown, escreva literal). O sistema vai detectar e marcar a conversa como aguardando humano. Sua mensagem antes da tag deve ser tipo "Vou chamar nossa equipe pra te atender melhor, só um momento... 💕".

# O que NÃO fazer
- Não invente preços, nomes de produtos, ou estoque que você não tem certeza.
- Não prometa frete grátis se não foi mencionado.
- Não dê informações sobre pedidos específicos (status, rastreio individual).
- Não use linguagem corporativa ("prezada", "atenciosamente").
- Não escreva listas longas ou textos enormes.
- Não saia do tom amigável e brasileiro.

# Catálogo e categorias — REGRA DURA (CRÍTICO)
A cada mensagem você recebe DOIS blocos com a verdade do banco:
- \`[CATEGORIES]\`: lista REAL de categorias com seus links
- \`[CATALOG]\`: TODOS os produtos ativos com preço, link e variantes (tamanhos/cores) com estoque atual

**NUNCA invente categoria, produto, preço ou estoque** — se não está nos blocos, NÃO existe. Esquece o que você "acha" que existe; só vale o que tá no contexto.

## Como usar o catálogo
1. Cliente pergunta "tem cropped?" → você procura nos nomes de produtos do [CATALOG] palavras como "cropped", e responde com o(s) que achou. Se achou: cita 1-3 produtos específicos com nome + preço + link, e indica a categoria pra ela ver mais. Se não achou nenhum: diga "no momento não tenho cropped no estoque, mas dá uma olhada em [Partes de cima] que pode ter algo parecido 💕".
2. Cliente pergunta "tem tamanho M?" de um produto específico → cheque as variantes daquele produto no [CATALOG]. Se M tem estoque > 0 → confirma. Se "M-cor:0esg" → diga ESGOTADO no M e ofereça outro tamanho disponível.
3. Cliente pergunta preço → cite o preço EXATO do [CATALOG]. Se tem desconto ("de R$X por R$Y"), mencione os dois pra valorizar.
4. Cliente quer recomendação → sugere 2-3 produtos do catálogo conforme o contexto (ex: "pra evento" → vestidos; "pro dia a dia" → partes de cima/baixo).
5. Cliente pergunta "tem na cor X?" → veja as variantes do produto no [CATALOG] e responde só as cores reais.

## Quando o catálogo NÃO tem
- Se buscou e não achou nada parecido → seja honesta: "Hmm, esse modelo específico não tô vendo no estoque agora. Quer que eu chame nossa equipe pra ver se chega em breve? 💌" (e sinaliza [HUMAN_REQUEST]).
- Não fale "vai chegar em breve" se não tem certeza.

## Links
SEMPRE que recomendar produto, inclua o link \`/produto/<slug>\` exatamente como aparece no [CATALOG]. Pra categoria, \`/categoria/<slug>\` do [CATEGORIES].`;

function isWithinSupportHours(): boolean {
  const now = new Date();
  // Brasília UTC-3
  const brHour = (now.getUTCHours() - 3 + 24) % 24;
  const brMinute = now.getUTCMinutes();
  const dow = now.getUTCDay(); // 0=dom, 6=sáb
  const totalMin = brHour * 60 + brMinute;
  if (dow === 0 || dow === 6) {
    // sáb/dom: 10h às 21h
    return totalMin >= 600 && totalMin < 1260;
  }
  // seg-sex: 10h às 20h30
  return totalMin >= 600 && totalMin < 1230;
}

// === MEMÓRIA ESTÁTICA DA SOFIA ===
// Cache em memória do edge runtime (vive enquanto a instância tá quente).
// TTL curto pra refletir mudanças de estoque/cadastro sem precisar redeploy.
interface MemoryCache {
  categories: string;
  catalog: string;
  loadedAt: number;
}
let SOFIA_MEMORY: MemoryCache | null = null;
const MEMORY_TTL_MS = 60_000; // 60s — equilibra freshness vs DB load

async function loadSofiaMemory(supabase: any, force = false): Promise<MemoryCache> {
  const now = Date.now();
  if (!force && SOFIA_MEMORY && now - SOFIA_MEMORY.loadedAt < MEMORY_TTL_MS) {
    return SOFIA_MEMORY;
  }
  const [categories, catalog] = await Promise.all([
    fetchCategories(supabase),
    fetchFullCatalog(supabase),
  ]);
  SOFIA_MEMORY = { categories, catalog, loadedAt: now };
  return SOFIA_MEMORY;
}

async function fetchCategories(supabase: any): Promise<string> {
  const { data } = await supabase
    .from("categories")
    .select("name, slug")
    .order("sort_order");
  if (!data || data.length === 0) return "(nenhuma categoria cadastrada)";
  return data.map((c: any) => `- ${c.name} → /categoria/${c.slug}`).join("\n");
}

async function fetchFullCatalog(supabase: any): Promise<string> {
  // Pega todos produtos ativos + suas variantes ativas. Formato compacto pra economizar tokens.
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, original_price, slug, stock, categories(name, slug), product_variants(size, color_name, numbering, stock, is_active, price)")
    .eq("is_active", true)
    .order("name")
    .limit(300);
  if (!products || products.length === 0) return "(catálogo vazio)";

  return products
    .map((p: any) => {
      const hasDiscount = p.original_price && Number(p.original_price) > Number(p.price);
      const priceTxt = hasDiscount ? `de R$${p.original_price} por R$${p.price}` : `R$${p.price}`;
      const cat = p.categories?.name ? `${p.categories.name}` : "sem categoria";
      const slug = `/produto/${p.slug}`;

      // Variantes ativas
      const vars = (p.product_variants || []).filter((v: any) => v.is_active !== false);
      let varsTxt = "";
      if (vars.length === 0) {
        // Sem variantes — usa estoque do produto
        varsTxt = p.stock > 0 ? `disponível (${p.stock} un)` : "ESGOTADO";
      } else {
        // Compacta variantes: "P-rosa:3 M-rosa:0esg G-preto:5"
        varsTxt = vars
          .map((v: any) => {
            const parts = [v.size, v.color_name, v.numbering].filter(Boolean).join("-");
            const stk = v.stock > 0 ? `${v.stock}` : "0esg";
            return `${parts || "única"}:${stk}`;
          })
          .join(" ");
      }

      return `• ${p.name} | ${cat} | ${priceTxt} | ${slug} | ${varsTxt}`;
    })
    .join("\n");
}

async function callGemini(apiKey: string, history: ChatMessage[], catalogInfo: string, categoriesInfo: string, withinHours: boolean): Promise<string> {
  const lastUserMsg = history[history.length - 1];
  let augmentedContent = lastUserMsg.content;
  // Prepara contexto: categorias + catálogo completo
  const contextHeader = `[CATEGORIES] (lista REAL — não invente outras)\n${categoriesInfo}\n[/CATEGORIES]\n\n[CATALOG] (todos os produtos ativos com variantes — formato: nome | categoria | preço | link | variantes:estoque)\nLegenda variantes: "P-rosa:3" = tamanho P cor rosa com 3 unidades; "0esg" = ESGOTADO; "única:5" = sem variantes, 5 un\n${catalogInfo}\n[/CATALOG]\n\n[CONTEXT] Horário humano agora: ${withinHours ? "DENTRO" : "FORA"} do expediente.\n\n--- MENSAGEM DA CLIENTE ---\n`;
  augmentedContent = contextHeader + augmentedContent;

  const contents = history.slice(0, -1).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  contents.push({ role: "user", parts: [{ text: augmentedContent }] });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SOFIA_PROMPT }] },
        contents,
        generationConfig: { temperature: 0.85, maxOutputTokens: 400 },
      }),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    console.error("Gemini error:", res.status, t);
    throw new Error("Gemini error");
  }
  const json = await res.json();
  return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Hmm, não consegui pensar agora 😅 Tenta de novo?";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { session_id, message, page_path, user_agent, source_label, fbclid, utm_source, utm_campaign } = body;

    if (!session_id || !message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "session_id e message obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 1500) {
      return new Response(JSON.stringify({ error: "Mensagem muito longa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pega ou cria conversa
    let { data: convo } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle();

    const userMsg: ChatMessage = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
      from: "client",
    };

    if (!convo) {
      const greeting: ChatMessage = {
        role: "assistant",
        content: "Oi! Eu sou a Sofia 💕 Como posso te ajudar?",
        timestamp: new Date().toISOString(),
        from: "bot",
      };
      const initial = [greeting, userMsg];
      const { data: newConvo, error } = await supabase
        .from("chat_conversations")
        .insert({
          session_id,
          messages: initial,
          page_path: page_path || null,
          user_agent: user_agent || null,
          source_label: source_label || null,
          fbclid: fbclid || null,
          utm_source: utm_source || null,
          utm_campaign: utm_campaign || null,
          message_count: initial.length,
          unread_admin_count: 1,
          last_message_at: new Date().toISOString(),
          status: "bot",
        })
        .select()
        .single();
      if (error) throw error;
      convo = newConvo;
    } else {
      const newMessages = [...(convo.messages as ChatMessage[]), userMsg];
      const { data: updated } = await supabase
        .from("chat_conversations")
        .update({
          messages: newMessages,
          message_count: newMessages.length,
          unread_admin_count: convo.unread_admin_count + 1,
          last_message_at: new Date().toISOString(),
        })
        .eq("session_id", session_id)
        .select()
        .single();
      convo = updated;
    }

    // Se humano assumiu → não chama Gemini, só salva e retorna
    if (convo.status === "human") {
      return new Response(
        JSON.stringify({
          status: "human",
          assigned_admin_name: convo.assigned_admin_name,
          message: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Status 'bot': chama Gemini
    const messages = convo.messages as ChatMessage[];
    const recentHistory = messages.slice(-12); // últimas 12 mensagens pra não estourar contexto
    const memory = await loadSofiaMemory(supabase);
    const catalogInfo = memory.catalog;
    const categoriesInfo = memory.categories;
    const withinHours = isWithinSupportHours();

    let botReply: string;
    try {
      botReply = await callGemini(GEMINI_API_KEY, recentHistory, catalogInfo, categoriesInfo, withinHours);
    } catch {
      botReply = "Tô com um probleminha técnico aqui 😅 Tenta de novo em instantes ou clica pra falar com nossa equipe no WhatsApp 💌";
    }

    // Detecta tag de pedido humano
    const wantsHuman = botReply.includes("[HUMAN_REQUEST]");
    const cleanReply = botReply.replace(/\[HUMAN_REQUEST\]/g, "").trim();

    const botMsg: ChatMessage = {
      role: "assistant",
      content: cleanReply,
      timestamp: new Date().toISOString(),
      from: "bot",
    };
    const finalMessages = [...messages, botMsg];

    await supabase
      .from("chat_conversations")
      .update({
        messages: finalMessages,
        message_count: finalMessages.length,
        last_message_at: new Date().toISOString(),
        human_requested: wantsHuman || convo.human_requested,
        lead_qualified: wantsHuman || convo.lead_qualified,
      })
      .eq("session_id", session_id);

    return new Response(
      JSON.stringify({
        status: "bot",
        message: cleanReply,
        human_requested: wantsHuman,
        within_hours: withinHours,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat-bot error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
