import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare, Send, UserCheck, Bot, X, Loader2,
  Filter, Search, Volume2, VolumeX, Inbox, Clock,
} from "lucide-react";

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
  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  human_requested: boolean;
  unread_admin_count: number;
  message_count: number;
  page_path: string | null;
  source_label: string | null;
  utm_source: string | null;
  fbclid: string | null;
  created_at: string;
  last_message_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  lead_qualified: boolean;
}

type FilterMode = "all" | "human_requested" | "active_human" | "bot" | "closed";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

const formatFullTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function AdminChatbot() {
  const { user } = useAuth();
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("vc_chatbot_sound") !== "0");
  const scrollRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTotalUnreadRef = useRef(0);

  // Carrega lista
  const fetchConvos = async () => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);
    setConvos((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchConvos();
  }, []);

  // Realtime: atualiza lista quando qualquer conversa muda
  useEffect(() => {
    const channel = supabase
      .channel("admin-chat-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_conversations" },
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            setConvos((prev) => {
              const newConvo = payload.new as any;
              const idx = prev.findIndex((c) => c.id === newConvo.id);
              if (idx === -1) {
                return [newConvo, ...prev];
              }
              const copy = [...prev];
              copy[idx] = newConvo;
              return copy.sort(
                (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
              );
            });
          } else if (payload.eventType === "DELETE") {
            setConvos((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Som de notificação quando aumenta total de não-lidas
  useEffect(() => {
    const totalUnread = convos.reduce((s, c) => s + (c.unread_admin_count || 0), 0);
    if (totalUnread > lastTotalUnreadRef.current && soundOn && lastTotalUnreadRef.current !== 0) {
      try {
        if (!audioRef.current) {
          // beep simples gerado via WebAudio (sem precisar arquivo)
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = 880;
          g.gain.value = 0.1;
          o.start();
          setTimeout(() => o.stop(), 150);
        }
      } catch {
        /* */
      }
    }
    lastTotalUnreadRef.current = totalUnread;
  }, [convos, soundOn]);

  // Auto-scroll do chat aberto
  useEffect(() => {
    if (selectedId && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedId, convos]);

  // Marca como lida ao selecionar
  useEffect(() => {
    if (!selectedId) return;
    const c = convos.find((x) => x.id === selectedId);
    if (c && c.unread_admin_count > 0) {
      callAdminAction("mark_read", c.session_id);
    }
  }, [selectedId, convos]);

  const filtered = useMemo(() => {
    let list = convos;
    if (filter === "human_requested") {
      list = list.filter((c) => c.human_requested && c.status === "bot");
    } else if (filter === "active_human") {
      list = list.filter((c) => c.status === "human");
    } else if (filter === "bot") {
      list = list.filter((c) => c.status === "bot" && !c.human_requested);
    } else if (filter === "closed") {
      list = list.filter((c) => c.status === "closed");
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((c) =>
        c.session_id.toLowerCase().includes(s) ||
        c.messages.some((m) => m.content.toLowerCase().includes(s))
      );
    }
    return list;
  }, [convos, filter, search]);

  const selected = convos.find((c) => c.id === selectedId) || null;

  const totalHumanReq = convos.filter((c) => c.human_requested && c.status === "bot").length;
  const totalActive = convos.filter((c) => c.status === "human").length;
  const totalBot = convos.filter((c) => c.status === "bot" && !c.human_requested).length;

  const callAdminAction = async (
    action: "takeover" | "release" | "close" | "send" | "mark_read",
    session_id: string,
    message?: string
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`${FUNCTIONS_URL}/chat-admin-reply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        action,
        session_id,
        message,
        admin_name: user?.email?.includes("edwarda") ? "Edwarda" : user?.email?.includes("erick") ? "Erick" : "Atendente",
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("admin action failed", err);
    }
  };

  const handleSendReply = async () => {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    const text = reply;
    setReply("");
    await callAdminAction("send", selected.session_id, text);
    setSending(false);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem("vc_chatbot_sound", next ? "1" : "0");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <MessageSquare className="text-primary" size={22} /> Chatbot Sofia
          </h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Atendimento automatizado + takeover humano em tempo real
          </p>
        </div>
        <button
          onClick={toggleSound}
          className="text-xs px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5"
        >
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />} Som {soundOn ? "ligado" : "mudo"}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-3 border border-border/60 relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-warning">
          <div className="flex items-center gap-2 mb-1">
            <Inbox size={14} className="text-warning" />
            <span className="text-[11px] text-muted-foreground">Aguardando humano</span>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground tabular-nums">{totalHumanReq}</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border/60 relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-success">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck size={14} className="text-success" />
            <span className="text-[11px] text-muted-foreground">Em atendimento</span>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground tabular-nums">{totalActive}</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border/60 relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={14} className="text-primary" />
            <span className="text-[11px] text-muted-foreground">Bot ativo</span>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground tabular-nums">{totalBot}</p>
        </div>
        <div className="bg-card rounded-xl p-3 border border-border/60 relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={14} className="text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Total conversas</span>
          </div>
          <p className="font-heading text-2xl font-bold text-foreground tabular-nums">{convos.length}</p>
        </div>
      </div>

      {/* Layout: lista + chat */}
      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3 h-[calc(100vh-340px)] min-h-[500px]">
        {/* Lista de conversas */}
        <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden">
          {/* Filtros */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-2 py-1.5 rounded-md bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {[
                { v: "all" as FilterMode, l: "Todas" },
                { v: "human_requested" as FilterMode, l: `🔴 ${totalHumanReq}` },
                { v: "active_human" as FilterMode, l: `🟢 ${totalActive}` },
                { v: "bot" as FilterMode, l: `🤖 ${totalBot}` },
                { v: "closed" as FilterMode, l: "Encerradas" },
              ].map((f) => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition ${
                    filter === f.v
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-secondary text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {f.l}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8 px-4">Nenhuma conversa encontrada.</p>
            ) : (
              filtered.map((c) => {
                const lastMsg = c.messages[c.messages.length - 1];
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-border/50 transition relative ${
                      isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {c.status === "human" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        ) : c.human_requested ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                        ) : c.status === "closed" ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        )}
                        <span className="text-xs font-medium text-foreground truncate max-w-[140px]">
                          {c.customer_name || `#${c.session_id.slice(-8)}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {formatTime(c.last_message_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {lastMsg?.from === "client" ? "" : lastMsg?.from === "human" ? "Você: " : "Sofia: "}
                      {lastMsg?.content?.slice(0, 60)}
                    </p>
                    {c.source_label && (
                      <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {c.source_label}
                      </span>
                    )}
                    {c.unread_admin_count > 0 && (
                      <span className="absolute right-2 top-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {c.unread_admin_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Painel de chat */}
        <div className="bg-card rounded-xl border border-border flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground p-6">
              <div>
                <MessageSquare size={36} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Selecione uma conversa pra começar</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selected.customer_name || `Sessão #${selected.session_id.slice(-8)}`}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <Clock size={10} /> {formatFullTime(selected.created_at)}
                    {selected.source_label && <span>• {selected.source_label}</span>}
                    {selected.page_path && <span>• {selected.page_path}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {selected.status === "bot" && (
                    <button
                      onClick={() => callAdminAction("takeover", selected.session_id)}
                      className="text-xs px-3 py-1.5 rounded-md bg-success/15 text-success hover:bg-success/25 font-medium flex items-center gap-1.5 border border-success/30"
                    >
                      <UserCheck size={13} /> Assumir
                    </button>
                  )}
                  {selected.status === "human" && (
                    <button
                      onClick={() => callAdminAction("release", selected.session_id)}
                      className="text-xs px-3 py-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 font-medium flex items-center gap-1.5 border border-primary/30"
                    >
                      <Bot size={13} /> Devolver pro bot
                    </button>
                  )}
                  {selected.status !== "closed" && (
                    <button
                      onClick={() => {
                        if (confirm("Encerrar este atendimento?")) callAdminAction("close", selected.session_id);
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-md bg-secondary text-muted-foreground hover:text-destructive flex items-center gap-1"
                      title="Encerrar"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Status banner */}
              {selected.status === "human" && (
                <div className="px-3 py-1.5 bg-success/10 border-b border-success/20 text-success text-[11px] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  Atendimento humano com {selected.assigned_admin_name}
                </div>
              )}
              {selected.human_requested && selected.status === "bot" && (
                <div className="px-3 py-1.5 bg-warning/10 border-b border-warning/20 text-warning text-[11px] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                  Cliente está esperando atendimento humano
                </div>
              )}
              {selected.status === "closed" && (
                <div className="px-3 py-1.5 bg-muted/30 border-b border-border text-muted-foreground text-[11px]">
                  Atendimento encerrado
                </div>
              )}

              {/* Mensagens */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-background/40">
                {selected.messages.map((m, i) => {
                  if (m.role === "system") {
                    return (
                      <div key={i} className="text-center my-2">
                        <span className="inline-block text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                          {m.content}
                        </span>
                      </div>
                    );
                  }
                  const isClient = m.from === "client" || m.role === "user";
                  return (
                    <div key={i} className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${
                          isClient
                            ? "bg-secondary text-foreground rounded-tl-sm"
                            : m.from === "human"
                            ? "bg-success/15 text-foreground rounded-tr-sm border border-success/30"
                            : "bg-primary/15 text-foreground rounded-tr-sm border border-primary/20"
                        }`}
                      >
                        {!isClient && (
                          <p className="text-[9px] font-semibold opacity-70 mb-0.5 uppercase tracking-wide">
                            {m.from === "human" ? m.admin_name || "Atendente" : "Sofia"}
                          </p>
                        )}
                        {m.content}
                        <p className="text-[9px] opacity-50 mt-0.5 text-right">
                          {new Date(m.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              {selected.status !== "closed" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendReply();
                  }}
                  className="px-3 py-2 border-t border-border flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      selected.status === "bot"
                        ? "Enviar (assume conversa automaticamente)..."
                        : "Mensagem como atendente..."
                    }
                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                    disabled={sending}
                    maxLength={1500}
                  />
                  <button
                    type="submit"
                    disabled={sending || !reply.trim()}
                    className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90"
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
