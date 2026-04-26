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
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, session_id, message, admin_name } = body as {
      action: "takeover" | "release" | "close" | "send" | "mark_read";
      session_id: string;
      message?: string;
      admin_name?: string;
    };

    if (!session_id || !action) {
      return new Response(JSON.stringify({ error: "session_id e action obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: convo } = await supabase
      .from("chat_conversations")
      .select("*")
      .eq("session_id", session_id)
      .maybeSingle();
    if (!convo) {
      return new Response(JSON.stringify({ error: "Conversa não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = (convo.messages || []) as ChatMessage[];
    const adminDisplayName = admin_name || user.email?.split("@")[0] || "Atendente";

    if (action === "takeover") {
      const sysMsg: ChatMessage = {
        role: "system",
        content: `${adminDisplayName} entrou na conversa 👋`,
        timestamp: new Date().toISOString(),
        from: "human",
        admin_name: adminDisplayName,
      };
      const newMessages = [...messages, sysMsg];
      await supabase.from("chat_conversations").update({
        status: "human",
        assigned_admin_id: user.id,
        assigned_admin_name: adminDisplayName,
        human_requested: false,
        lead_qualified: true,
        messages: newMessages,
        message_count: newMessages.length,
        unread_admin_count: 0,
        unread_client_count: convo.unread_client_count + 1,
        last_message_at: new Date().toISOString(),
      }).eq("session_id", session_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "release") {
      const sysMsg: ChatMessage = {
        role: "system",
        content: "Sofia voltou a atender 💕",
        timestamp: new Date().toISOString(),
        from: "bot",
      };
      const newMessages = [...messages, sysMsg];
      await supabase.from("chat_conversations").update({
        status: "bot",
        assigned_admin_id: null,
        assigned_admin_name: null,
        messages: newMessages,
        message_count: newMessages.length,
        unread_client_count: convo.unread_client_count + 1,
        last_message_at: new Date().toISOString(),
      }).eq("session_id", session_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "close") {
      const sysMsg: ChatMessage = {
        role: "system",
        content: "Atendimento encerrado. Volte sempre 💕",
        timestamp: new Date().toISOString(),
        from: "bot",
      };
      const newMessages = [...messages, sysMsg];
      await supabase.from("chat_conversations").update({
        status: "closed",
        messages: newMessages,
        message_count: newMessages.length,
        unread_client_count: convo.unread_client_count + 1,
        last_message_at: new Date().toISOString(),
      }).eq("session_id", session_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send") {
      if (!message || typeof message !== "string" || message.length > 1500) {
        return new Response(JSON.stringify({ error: "message inválida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const humanMsg: ChatMessage = {
        role: "assistant",
        content: message,
        timestamp: new Date().toISOString(),
        from: "human",
        admin_name: adminDisplayName,
      };
      const newMessages = [...messages, humanMsg];
      // Se ainda estava em 'bot' e o admin enviou direto, considera takeover automático
      const newStatus = convo.status === "bot" ? "human" : convo.status;
      await supabase.from("chat_conversations").update({
        messages: newMessages,
        message_count: newMessages.length,
        status: newStatus,
        assigned_admin_id: convo.assigned_admin_id || user.id,
        assigned_admin_name: convo.assigned_admin_name || adminDisplayName,
        unread_admin_count: 0,
        unread_client_count: convo.unread_client_count + 1,
        last_message_at: new Date().toISOString(),
        lead_qualified: true,
      }).eq("session_id", session_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mark_read") {
      await supabase.from("chat_conversations").update({
        unread_admin_count: 0,
      }).eq("session_id", session_id);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "action desconhecida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-admin-reply error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
