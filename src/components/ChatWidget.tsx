import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X, Send, ExternalLink, Instagram, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSessionId, detectSource } from "@/lib/visitTracker";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  from?: "bot" | "human" | "client";
  admin_name?: string;
}

interface Conversation {
  id: string;
  session_id: string;
  messages: ChatMessage[];
  status: "bot" | "human" | "closed";
  assigned_admin_name: string | null;
  unread_client_count: number;
}

const WHATSAPP_NUMBER = "5582987779225";
const INSTAGRAM_URL = "https://www.instagram.com/vitrinecharmosaa/";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const CHAT_POSITION_KEY = "vc_chat_position";
const CHAT_DISMISSED_KEY = "vc_chat_dismissed_session";

const QUICK_REPLIES = [
  "Quanto demora a entrega?",
  "Formas de pagamento",
  "Como funciona troca?",
  "Tem desconto?",
  "Falar com atendente",
];

export default function ChatWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(CHAT_DISMISSED_KEY) === "1");
  const [convo, setConvo] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isTypingBot, setIsTypingBot] = useState(false);
  const sessionId = useRef<string>(getSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenLengthRef = useRef(0);

  // Posição arrastável
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem(CHAT_POSITION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean; pointerId: number } | null>(null);

  // Não exibir em /admin nem /checkout
  const hidden =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/checkout");

  // Carrega conversa existente
  useEffect(() => {
    if (hidden) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("session_id", sessionId.current)
        .maybeSingle();
      if (mounted && data) setConvo(data as any);
    })();
    return () => {
      mounted = false;
    };
  }, [hidden]);

  // Realtime: escuta updates da própria conversa
  useEffect(() => {
    if (hidden) return;
    const channel = supabase
      .channel(`chat-${sessionId.current}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_conversations",
          filter: `session_id=eq.${sessionId.current}`,
        },
        (payload) => {
          if (payload.new) setConvo(payload.new as any);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [hidden]);

  // Auto-scroll
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [convo?.messages?.length, open, isTypingBot]);

  // Marca mensagens como lidas quando abre
  useEffect(() => {
    if (open && convo) lastSeenLengthRef.current = convo.messages.length;
  }, [open, convo]);

  const unreadByClient =
    convo && !open
      ? Math.max(0, convo.messages.length - lastSeenLengthRef.current)
      : 0;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      setSending(true);
      setInput("");
      // Adiciona localmente pra UX instantânea
      setConvo((c) => {
        const userMsg: ChatMessage = {
          role: "user",
          content: text,
          timestamp: new Date().toISOString(),
          from: "client",
        };
        if (!c) {
          return {
            id: "tmp",
            session_id: sessionId.current,
            messages: [
              {
                role: "assistant",
                content: "Oi! Eu sou a Sofia 💕 Como posso te ajudar?",
                timestamp: new Date().toISOString(),
                from: "bot",
              },
              userMsg,
            ],
            status: "bot",
            assigned_admin_name: null,
            unread_client_count: 0,
          };
        }
        return { ...c, messages: [...c.messages, userMsg] };
      });

      const isBotMode = !convo || convo.status === "bot";
      if (isBotMode) setIsTypingBot(true);

      try {
        const src = detectSource();
        const res = await fetch(`${FUNCTIONS_URL}/chat-bot`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
          },
          body: JSON.stringify({
            session_id: sessionId.current,
            message: text,
            page_path: location.pathname,
            user_agent: navigator.userAgent,
            source_label: src.source_label,
            fbclid: src.fbclid,
            utm_source: src.utm_source,
            utm_campaign: src.utm_campaign,
          }),
        });
        await res.json();
        // realtime vai sincronizar a conversa atualizada
      } catch (e) {
        console.error(e);
      } finally {
        setIsTypingBot(false);
        setSending(false);
      }
    },
    [convo, location.pathname, sending]
  );

  const handleQuickReply = (q: string) => {
    if (q === "Falar com atendente") {
      const phoneText = encodeURIComponent(
        `Oi! Vim do site da Vitrine Charmosa e gostaria de falar com um atendente.`
      );
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${phoneText}`, "_blank");
      return;
    }
    sendMessage(q);
  };

  const openWhatsApp = () => {
    // Junta últimas 4 mensagens da conversa pra dar contexto ao atendente
    const tail =
      convo?.messages?.slice(-4)?.map((m) => `${m.from === "client" ? "Eu" : "Sofia"}: ${m.content}`).join("\n") || "";
    const txt = encodeURIComponent(
      `Oi! Vim do site da Vitrine Charmosa.${tail ? `\n\nResumo da conversa com a Sofia:\n${tail}` : ""}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${txt}`, "_blank");
  };

  const dismissWidget = () => {
    sessionStorage.setItem(CHAT_DISMISSED_KEY, "1");
    setDismissed(true);
    setOpen(false);
  };

  // Drag handlers (pointer events — funciona mouse + touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    dragRef.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      moved: false,
      pointerId: e.pointerId,
    };
    target.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    const { dx, dy } = dragRef.current;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const size = 56;
    const margin = 8;
    const nx = Math.min(Math.max(margin, e.clientX - dx), w - size - margin);
    const ny = Math.min(Math.max(margin, e.clientY - dy), h - size - margin);
    if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) {
      dragRef.current.moved = true;
    }
    setPos({ x: nx, y: ny });
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return;
    const moved = dragRef.current.moved;
    if (moved && pos) {
      try {
        localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(pos));
      } catch {
        /* */
      }
    } else {
      // Click sem drag → abre/fecha
      setOpen((o) => !o);
    }
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  if (hidden || dismissed) return null;

  const messages = convo?.messages || [];
  const showWelcome = messages.length === 0 || (messages.length === 1 && messages[0].role === "assistant");
  const isHumanMode = convo?.status === "human";

  // Posição padrão: bottom-right
  const buttonStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, right: "auto", bottom: "auto" }
    : { position: "fixed", right: 16, bottom: 80 }; // bottom: 80 pra não sobrepor bottom-nav mobile

  // Painel: posição relativa à bolinha (acima dela)
  const panelStyle: React.CSSProperties = pos
    ? {
        position: "fixed",
        left: Math.min(pos.x, window.innerWidth - 360),
        top: Math.max(16, pos.y - 540),
      }
    : { position: "fixed", right: 16, bottom: 144 };

  return (
    <>
      {/* Painel do chat */}
      {open && (
        <div
          style={panelStyle}
          className="z-[60] w-[min(92vw,360px)] h-[min(70vh,520px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-rose-400 to-pink-400 text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-base font-semibold ring-2 ring-white/40">
              {isHumanMode ? "👤" : "S"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">
                {isHumanMode ? convo?.assigned_admin_name || "Atendente" : "Sofia"}
              </p>
              <p className="text-[11px] opacity-90 truncate">
                {isHumanMode ? "Atendimento humano" : "Assistente Vitrine Charmosa"}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Minimizar"
              className="p-1.5 rounded-md hover:bg-white/20 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Banner takeover */}
          {isHumanMode && (
            <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 text-emerald-800 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {convo?.assigned_admin_name || "Atendente"} entrou na conversa
            </div>
          )}

          {/* Mensagens */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {showWelcome && (
              <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-[85%]">
                <p className="text-sm text-gray-800">
                  Oi! Eu sou a Sofia 💕 Como posso te ajudar hoje?
                </p>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "system") {
                return (
                  <div key={i} className="text-center my-2">
                    <span className="inline-block text-[11px] text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                      {m.content}
                    </span>
                  </div>
                );
              }
              const isClient = m.from === "client" || m.role === "user";
              return (
                <div key={i} className={`flex ${isClient ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm whitespace-pre-wrap break-words text-sm ${
                      isClient
                        ? "bg-gradient-to-br from-rose-400 to-pink-400 text-white rounded-tr-sm"
                        : m.from === "human"
                        ? "bg-emerald-50 text-gray-800 rounded-tl-sm border border-emerald-100"
                        : "bg-white text-gray-800 rounded-tl-sm"
                    }`}
                  >
                    {m.from === "human" && m.admin_name && (
                      <p className="text-[10px] font-semibold text-emerald-700 mb-0.5">{m.admin_name}</p>
                    )}
                    {m.content}
                  </div>
                </div>
              );
            })}

            {isTypingBot && (
              <div className="flex justify-start">
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-2.5 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick replies */}
          {showWelcome && !isHumanMode && (
            <div className="px-3 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickReply(q)}
                  disabled={sending}
                  className="text-[11.5px] px-2.5 py-1.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 active:bg-rose-200 transition disabled:opacity-50 border border-rose-100"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="px-3 py-2 bg-white border-t border-gray-100 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isHumanMode ? "Mensagem pra atendente..." : "Pergunta pra Sofia..."}
              className="flex-1 text-sm px-3 py-2 rounded-full bg-gray-100 border-0 focus:outline-none focus:ring-2 focus:ring-rose-300 placeholder:text-gray-400"
              disabled={sending}
              maxLength={1500}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-400 text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition shrink-0"
              aria-label="Enviar"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>

          {/* Footer ações */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-600">
            <button
              onClick={openWhatsApp}
              className="flex items-center gap-1 hover:text-emerald-600 transition"
            >
              <ExternalLink size={11} /> WhatsApp
            </button>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-pink-600 transition"
            >
              <Instagram size={11} /> @vitrinecharmosaa
            </a>
            <button
              onClick={dismissWidget}
              className="hover:text-red-600 transition"
              title="Não quero ver mais nesta visita"
            >
              Fechar chat
            </button>
          </div>
        </div>
      )}

      {/* Bolinha flutuante (arrastável) */}
      <button
        style={buttonStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="z-[55] w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-lg hover:shadow-xl transition flex items-center justify-center touch-none select-none active:scale-95"
        aria-label={open ? "Fechar chat" : "Abrir chat"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unreadByClient > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadByClient > 9 ? "9+" : unreadByClient}
          </span>
        )}
        {!open && convo?.status === "human" && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
        )}
      </button>
    </>
  );
}
