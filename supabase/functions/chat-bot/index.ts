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

# Catálogo (consulta dinâmica)
Quando cliente pergunta sobre produto específico, você verá um bloco \`[CATALOG_INFO]\` na mensagem com produtos relevantes. Use só essas informações.`;

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

async function searchCatalog(supabase: any, query: string): Promise<string> {
  if (!query || query.length < 3) return "";
  // Busca simples por nome/descrição
  const { data } = await supabase
    .from("products")
    .select("name, price, original_price, slug, stock, description")
    .eq("is_active", true)
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(5);
  if (!data || data.length === 0) return "";
  return data
    .map((p: any) => {
      const hasDiscount = p.original_price && Number(p.original_price) > Number(p.price);
      const discountTxt = hasDiscount ? ` (de R$${p.original_price} por R$${p.price})` : ` (R$${p.price})`;
      const stockTxt = p.stock > 0 ? `${p.stock} em estoque` : "esgotado";
      return `- ${p.name}${discountTxt} — ${stockTxt} — link: /produto/${p.slug}`;
    })
    .join("\n");
}

async function callGemini(apiKey: string, history: ChatMessage[], catalogInfo: string, withinHours: boolean): Promise<string> {
  const lastUserMsg = history[history.length - 1];
  let augmentedContent = lastUserMsg.content;
  if (catalogInfo) {
    augmentedContent = `[CATALOG_INFO]\n${catalogInfo}\n[/CATALOG_INFO]\n\n${augmentedContent}`;
  }
  augmentedContent += `\n\n[CONTEXT] Horário humano agora: ${withinHours ? "DENTRO" : "FORA"} do expediente.`;

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
    const catalogInfo = await searchCatalog(supabase, message);
    const withinHours = isWithinSupportHours();

    let botReply: string;
    try {
      botReply = await callGemini(GEMINI_API_KEY, recentHistory, catalogInfo, withinHours);
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
