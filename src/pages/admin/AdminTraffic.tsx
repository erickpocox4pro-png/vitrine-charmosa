import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3, Globe, TrendingUp, Users, Calendar, ExternalLink,
  DollarSign, ShoppingBag, Zap, Smartphone, Monitor, Clock,
  Activity, Download, ArrowUp, ArrowDown, Minus,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const SOURCE_LABELS: Record<string, { label: string; color: string; paid?: boolean }> = {
  direto: { label: "Acesso Direto", color: "hsl(var(--primary))" },
  google: { label: "Google (Orgânico)", color: "#4285F4" },
  "google-ads": { label: "Google Ads 💰", color: "#FBBC05", paid: true },
  instagram: { label: "Instagram", color: "#E1306C" },
  facebook: { label: "Facebook", color: "#1877F2" },
  "facebook-ads": { label: "Facebook Ads 💰", color: "#1877F2", paid: true },
  "instagram-ads": { label: "Instagram Ads 💰", color: "#E1306C", paid: true },
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  tiktok: { label: "TikTok", color: "#010101" },
  "tiktok-ads": { label: "TikTok Ads 💰", color: "#010101", paid: true },
  twitter: { label: "Twitter/X", color: "#1DA1F2" },
  pinterest: { label: "Pinterest", color: "#E60023" },
  youtube: { label: "YouTube", color: "#FF0000" },
  bing: { label: "Bing", color: "#008373" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  referencia: { label: "Link Externo", color: "#6B7280" },
};

const PIE_COLORS = ["#E1306C", "#4285F4", "#25D366", "#FBBC05", "#FF0000", "#1877F2", "#0A66C2", "#E60023", "#6B7280", "#010101"];

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// --- Helpers ---
const pctChange = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
};

const Trend = ({ delta, suffix = "" }: { delta: number; suffix?: string }) => {
  const abs = Math.abs(delta).toFixed(0);
  if (Math.abs(delta) < 1) {
    return <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Minus size={11} />0%{suffix}</span>;
  }
  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-success"><ArrowUp size={11} />{abs}%{suffix}</span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-destructive"><ArrowDown size={11} />{abs}%{suffix}</span>
  );
};

const downloadCSV = (filename: string, rows: Record<string, any>[]) => {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AdminTraffic = () => {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;

  const { since, sincePrev } = useMemo(() => {
    const now = new Date();
    const s = new Date(now);
    s.setDate(now.getDate() - periodDays);
    const sp = new Date(now);
    sp.setDate(now.getDate() - periodDays * 2);
    return { since: s.toISOString(), sincePrev: sp.toISOString() };
  }, [periodDays]);

  // Visitas (período atual + anterior pra comparação)
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["admin-traffic", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_visits")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      return data || [];
    },
  });

  const { data: visitsPrev = [] } = useQuery({
    queryKey: ["admin-traffic-prev", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("page_visits")
        .select("session_id, created_at, source_label")
        .gte("created_at", sincePrev)
        .lt("created_at", since)
        .limit(5000);
      return data || [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-traffic-orders", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, source_first, source_last, utm_source, utm_campaign, fbclid, gclid, created_at")
        .gte("created_at", since);
      return data || [];
    },
  });

  const { data: ordersPrev = [] } = useQuery({
    queryKey: ["admin-traffic-orders-prev", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, total, source_first, created_at")
        .gte("created_at", sincePrev)
        .lt("created_at", since);
      return data || [];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["admin-traffic-sessions", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("attribution_sessions")
        .select("session_id, first_source, last_source, first_seen_at")
        .gte("first_seen_at", since)
        .limit(5000);
      return data || [];
    },
  });

  const { data: convEvents = [] } = useQuery({
    queryKey: ["admin-traffic-events", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversion_events")
        .select("event_name, event_value, source_label, session_id, product_id, created_at, meta")
        .gte("created_at", since)
        .limit(10000);
      return data || [];
    },
  });

  // Live: visitantes ativos nos últimos 5 minutos
  const [liveCount, setLiveCount] = useState(0);
  useEffect(() => {
    const fetchLive = async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("page_visits")
        .select("session_id")
        .gte("created_at", fiveMinAgo);
      const unique = new Set((data || []).map((r: any) => r.session_id).filter(Boolean));
      setLiveCount(unique.size);
    };
    fetchLive();
    const id = setInterval(fetchLive, 30000); // refresh 30s
    return () => clearInterval(id);
  }, []);

  // Top produtos do catálogo (pra resolver nomes em ViewContent)
  const { data: products = [] } = useQuery({
    queryKey: ["admin-traffic-products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id, name, image_url");
      return data || [];
    },
  });
  const productMap = useMemo(() => {
    const m: Record<string, { name: string; image_url: string }> = {};
    for (const p of products as any[]) m[p.id] = { name: p.name, image_url: p.image_url };
    return m;
  }, [products]);

  // ===== Aggregations =====

  const uniqueSessions = useMemo(() => {
    const s = new Set(visits.map((v: any) => v.session_id).filter(Boolean));
    return s.size;
  }, [visits]);

  const uniqueSessionsPrev = useMemo(() => {
    const s = new Set(visitsPrev.map((v: any) => v.session_id).filter(Boolean));
    return s.size;
  }, [visitsPrev]);

  const totalRevenue = useMemo(() => orders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0), [orders]);
  const totalRevenuePrev = useMemo(() => ordersPrev.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0), [ordersPrev]);

  const sourceStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const src = (v as any).source_label || "direto";
      map[src] = (map[src] || 0) + 1;
    }
    return Object.entries(map)
      .map(([key, count]) => ({
        key,
        label: SOURCE_LABELS[key]?.label || key,
        count,
        color: SOURCE_LABELS[key]?.color || "#6B7280",
        percent: visits.length > 0 ? ((count / visits.length) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.count - a.count);
  }, [visits]);

  const dailyStats = useMemo(() => {
    const map: Record<string, { visits: number; orders: number }> = {};
    for (const v of visits) {
      const day = (v as any).created_at?.slice(0, 10);
      if (!day) continue;
      if (!map[day]) map[day] = { visits: 0, orders: 0 };
      map[day].visits++;
    }
    for (const o of orders as any[]) {
      const day = o.created_at?.slice(0, 10);
      if (!day) continue;
      if (!map[day]) map[day] = { visits: 0, orders: 0 };
      map[day].orders++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, d]) => ({ day: day.slice(5), visitas: d.visits, pedidos: d.orders }));
  }, [visits, orders]);

  const topPages = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const path = (v as any).page_path || "/";
      map[path] = (map[path] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([path, count]) => ({ path, count }));
  }, [visits]);

  const topReferrers = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const ref = (v as any).referrer;
      if (ref) {
        try {
          const host = new URL(ref).hostname;
          map[host] = (map[host] || 0) + 1;
        } catch {
          if (ref.length > 3) map[ref] = (map[ref] || 0) + 1;
        }
      }
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([host, count]) => ({ host, count }));
  }, [visits]);

  const campaigns = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const c = (v as any).utm_campaign;
      if (c) map[c] = (map[c] || 0) + 1;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, count]) => ({ name, count }));
  }, [visits]);

  const paidVsOrganic = useMemo(() => {
    let paid = 0, organic = 0;
    for (const v of visits as any[]) {
      const lbl = (v.source_label || "").toString();
      if (SOURCE_LABELS[lbl]?.paid || v.fbclid || v.gclid) paid++;
      else organic++;
    }
    return { paid, organic, total: paid + organic };
  }, [visits]);

  const funnel = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of convEvents as any[]) counts[e.event_name] = (counts[e.event_name] || 0) + 1;
    return [
      { stage: "Visitas", count: visits.length, color: "#6B7280" },
      { stage: "Viu produto", count: counts.ViewContent || 0, color: "#3B82F6" },
      { stage: "Adicionou ao carrinho", count: counts.AddToCart || 0, color: "#F59E0B" },
      { stage: "Iniciou checkout", count: counts.InitiateCheckout || 0, color: "#EC4899" },
      { stage: "Comprou", count: orders.length, color: "#10B981" },
    ];
  }, [convEvents, visits, orders]);

  const conversionBySource = useMemo(() => {
    const sessionsBySource: Record<string, number> = {};
    for (const s of sessions as any[]) {
      const src = s.first_source || "direto";
      sessionsBySource[src] = (sessionsBySource[src] || 0) + 1;
    }
    const ordersBySource: Record<string, { count: number; revenue: number }> = {};
    for (const o of orders as any[]) {
      const src = (o.source_first || o.source_last || "direto") as string;
      if (!ordersBySource[src]) ordersBySource[src] = { count: 0, revenue: 0 };
      ordersBySource[src].count++;
      ordersBySource[src].revenue += Number(o.total) || 0;
    }
    const allKeys = new Set([...Object.keys(sessionsBySource), ...Object.keys(ordersBySource)]);
    return Array.from(allKeys)
      .map((src) => {
        const sess = sessionsBySource[src] || 0;
        const ord = ordersBySource[src]?.count || 0;
        const rev = ordersBySource[src]?.revenue || 0;
        return {
          key: src,
          label: SOURCE_LABELS[src]?.label || src,
          color: SOURCE_LABELS[src]?.color || "#6B7280",
          sessions: sess,
          orders: ord,
          revenue: rev,
          conversion: sess > 0 ? (ord / sess) * 100 : 0,
        };
      })
      .filter((r) => r.sessions > 0 || r.orders > 0)
      .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || b.sessions - a.sessions);
  }, [sessions, orders]);

  const abandoned = useMemo(() => {
    const checkout = new Set((convEvents as any[]).filter((e) => e.event_name === "InitiateCheckout").map((e) => e.session_id).filter(Boolean));
    const purchased = new Set((convEvents as any[]).filter((e) => e.event_name === "Purchase").map((e) => e.session_id).filter(Boolean));
    let count = 0;
    checkout.forEach((s) => { if (!purchased.has(s)) count++; });
    return { initiated: checkout.size, abandoned: count, completed: purchased.size };
  }, [convEvents]);

  // Mobile vs Desktop
  const deviceBreakdown = useMemo(() => {
    const map: Record<string, number> = { mobile: 0, desktop: 0, tablet: 0 };
    for (const v of visits as any[]) {
      const d = (v.device_type || "desktop").toLowerCase();
      if (d in map) map[d]++;
      else map.desktop++;
    }
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return [
      { device: "Mobile", count: map.mobile, pct: total ? (map.mobile / total) * 100 : 0, icon: Smartphone, color: "#10B981" },
      { device: "Desktop", count: map.desktop, pct: total ? (map.desktop / total) * 100 : 0, icon: Monitor, color: "#3B82F6" },
      { device: "Tablet", count: map.tablet, pct: total ? (map.tablet / total) * 100 : 0, icon: Smartphone, color: "#F59E0B" },
    ];
  }, [visits]);

  // Heatmap hora x dia da semana
  const hourlyHeatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const v of visits as any[]) {
      const d = new Date(v.created_at);
      grid[d.getDay()][d.getHours()]++;
    }
    let max = 0;
    for (const row of grid) for (const v of row) if (v > max) max = v;
    return { grid, max };
  }, [visits]);

  // Melhor hora e dia (pra anúncios)
  const bestTimes = useMemo(() => {
    const byHour: Record<number, number> = {};
    const byDow: Record<number, number> = {};
    for (const o of orders as any[]) {
      const d = new Date(o.created_at);
      byHour[d.getHours()] = (byHour[d.getHours()] || 0) + 1;
      byDow[d.getDay()] = (byDow[d.getDay()] || 0) + 1;
    }
    const topHour = Object.entries(byHour).sort(([, a], [, b]) => b - a)[0];
    const topDow = Object.entries(byDow).sort(([, a], [, b]) => b - a)[0];
    return {
      hour: topHour ? `${topHour[0]}h–${(parseInt(topHour[0]) + 1) % 24}h` : "—",
      hourCount: topHour ? topHour[1] : 0,
      dow: topDow ? WEEKDAYS[parseInt(topDow[0])] : "—",
      dowCount: topDow ? topDow[1] : 0,
    };
  }, [orders]);

  // Top produtos vistos (ViewContent events)
  const topViewedProducts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of convEvents as any[]) {
      if (e.event_name !== "ViewContent" || !e.product_id) continue;
      map[e.product_id] = (map[e.product_id] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([id, count]) => ({
        id,
        name: productMap[id]?.name || id.slice(0, 8),
        image: productMap[id]?.image_url,
        count,
      }));
  }, [convEvents, productMap]);

  const visitDelta = pctChange(visits.length, visitsPrev.length);
  const sessionDelta = pctChange(uniqueSessions, uniqueSessionsPrev);
  const orderDelta = pctChange(orders.length, ordersPrev.length);
  const revenueDelta = pctChange(totalRevenue, totalRevenuePrev);

  const handleExport = () => {
    const rows = (visits as any[]).map((v) => ({
      data: v.created_at,
      pagina: v.page_path,
      fonte: v.source_label,
      utm_source: v.utm_source || "",
      utm_campaign: v.utm_campaign || "",
      fbclid: v.fbclid || "",
      gclid: v.gclid || "",
      device: v.device_type || "",
      session_id: v.session_id || "",
      referrer: v.referrer || "",
    }));
    downloadCSV(`trafego-${period}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  // === Render ===
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
              <BarChart3 size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-2xl font-semibold text-foreground tracking-tight">Tráfego</h2>
              <p className="text-[13px] text-muted-foreground -mt-0.5">
                Visitantes, conversão e atribuição
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 bg-success/15 border border-success/30 px-3 py-1.5 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            <span className="text-[13px] font-semibold text-success">{liveCount} ao vivo</span>
          </div>
          {/* Period switcher */}
          <div className="flex gap-0.5 bg-secondary/60 backdrop-blur rounded-lg p-1 border border-border/40">
            {([["7d", "7d"], ["30d", "30d"], ["90d", "90d"]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`px-3 py-1 rounded-md text-[13px] font-medium transition-all ${
                  period === val
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-secondary/60 hover:bg-secondary border border-border/40 px-3 py-1.5 rounded-lg text-[13px] font-medium text-foreground transition-colors"
            title="Baixar CSV"
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-secondary rounded-xl" />)}
          </div>
          <div className="h-64 bg-secondary rounded-xl" />
        </div>
      ) : visits.length === 0 && orders.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <Activity size={32} className="text-muted-foreground/50 mx-auto mb-3" />
          <p className="font-body text-sm font-semibold text-foreground mb-1">Sem dados ainda</p>
          <p className="font-body text-xs text-muted-foreground">
            Os dados de tráfego aparecerão aqui assim que os visitantes navegarem na loja.
          </p>
        </div>
      ) : (
        <>
          {/* KPIs — visual mais distinto, com accent vertical e gradiente */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                icon: TrendingUp, label: "Visitas", value: visits.length, accent: "primary",
                sub: `${uniqueSessions} sessões únicas`, delta: visitDelta,
              },
              {
                icon: ShoppingBag, label: "Pedidos", value: orders.length, accent: "success",
                sub: `${uniqueSessions > 0 ? ((orders.length / uniqueSessions) * 100).toFixed(2) : "0"}% de conversão`, delta: orderDelta,
              },
              {
                icon: DollarSign, label: "Receita", value: `R$ ${totalRevenue.toFixed(0)}`, accent: "info",
                sub: `Ticket médio R$ ${orders.length > 0 ? (totalRevenue / orders.length).toFixed(0) : "0"}`, delta: revenueDelta,
              },
              {
                icon: Zap, label: "Tráfego Pago", value: paidVsOrganic.paid, accent: "warning",
                sub: `${paidVsOrganic.total > 0 ? ((paidVsOrganic.paid / paidVsOrganic.total) * 100).toFixed(0) : "0"}% das visitas`,
              },
            ].map((kpi) => {
              const Icon = kpi.icon;
              const accentMap: Record<string, string> = {
                primary: "before:bg-primary text-primary",
                success: "before:bg-success text-success",
                info: "before:bg-[hsl(var(--info))] text-[hsl(var(--info))]",
                warning: "before:bg-warning text-warning",
              };
              return (
                <div
                  key={kpi.label}
                  className={`relative overflow-hidden rounded-xl bg-card border border-border/60 p-4 transition-all hover:border-border hover:shadow-lg before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${accentMap[kpi.accent]}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md bg-current/10 ${accentMap[kpi.accent].split(" ").pop()}`}>
                        <Icon size={14} className="opacity-90" />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground tracking-tight">{kpi.label}</span>
                    </div>
                    {kpi.delta !== undefined && (
                      <span className="text-[11px] font-semibold"><Trend delta={kpi.delta} /></span>
                    )}
                  </div>
                  <p className="font-heading text-3xl font-bold text-foreground tabular-nums tracking-tight">{kpi.value}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Funil */}
          <div className="bg-card border border-border/60 rounded-xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-foreground">Funil de Conversão</h3>
              <span className="text-[11.5px] text-muted-foreground">Visitas → Compra</span>
            </div>
            <div className="space-y-3">
              {funnel.map((step, i) => {
                const top = funnel[0].count || 1;
                const pctTop = (step.count / top) * 100;
                const prev = i > 0 ? funnel[i - 1].count : step.count;
                const dropoff = i > 0 && prev > 0 ? ((prev - step.count) / prev) * 100 : 0;
                return (
                  <div key={step.stage}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[13px] font-medium text-foreground">{step.stage}</span>
                      <span className="text-[12px] text-muted-foreground tabular-nums">
                        <span className="text-foreground font-semibold">{step.count}</span>
                        {i > 0 && dropoff > 0 && <span className="ml-2 text-destructive/80">−{dropoff.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="h-2.5 bg-secondary/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pctTop}%`, backgroundColor: step.color, minWidth: step.count > 0 ? "6px" : "0" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {abandoned.initiated > 0 && (
              <div className="mt-5 p-3.5 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-[12.5px] text-foreground leading-relaxed">
                  <span className="text-warning font-semibold">🛒 Carrinhos abandonados:</span> {abandoned.abandoned} de {abandoned.initiated}
                  {" "}({((abandoned.abandoned / abandoned.initiated) * 100).toFixed(0)}%) iniciaram checkout mas não compraram.
                  Use no Facebook Ads pra remarketing.
                </p>
              </div>
            )}
          </div>

          {/* Performance por fonte */}
          {conversionBySource.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-5 overflow-x-auto">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Performance por Fonte</h3>
                <span className="text-[11.5px] text-muted-foreground">first-touch</span>
              </div>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left text-[11.5px] font-semibold py-2.5 uppercase tracking-wide">Fonte</th>
                    <th className="text-right text-[11.5px] font-semibold py-2.5 uppercase tracking-wide">Sessões</th>
                    <th className="text-right text-[11.5px] font-semibold py-2.5 uppercase tracking-wide">Pedidos</th>
                    <th className="text-right text-[11.5px] font-semibold py-2.5 uppercase tracking-wide">Conv.</th>
                    <th className="text-right text-[11.5px] font-semibold py-2.5 uppercase tracking-wide">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {conversionBySource.map((r) => (
                    <tr key={r.key} className="border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full ring-2 ring-card" style={{ backgroundColor: r.color, boxShadow: `0 0 8px ${r.color}40` }} />
                          <span className="font-medium text-foreground">{r.label}</span>
                        </span>
                      </td>
                      <td className="text-right text-muted-foreground py-3 tabular-nums">{r.sessions}</td>
                      <td className="text-right text-foreground font-semibold py-3 tabular-nums">{r.orders}</td>
                      <td className={`text-right py-3 font-semibold tabular-nums ${r.conversion >= 2 ? "text-success" : r.conversion >= 1 ? "text-foreground" : "text-muted-foreground"}`}>
                        {r.conversion.toFixed(2)}%
                      </td>
                      <td className="text-right text-foreground font-semibold py-3 tabular-nums">R$ {r.revenue.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Dispositivo + Melhores horários */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Devices */}
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Dispositivo</h3>
              <div className="space-y-3.5">
                {deviceBreakdown.map((d) => {
                  const Icon = d.icon;
                  return (
                    <div key={d.device}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[13px] text-foreground inline-flex items-center gap-2">
                          <Icon size={14} className="text-muted-foreground" />
                          <span className="font-medium">{d.device}</span>
                        </span>
                        <span className="text-[12px] text-muted-foreground tabular-nums">
                          <span className="text-foreground font-semibold">{d.count}</span> · {d.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${d.pct}%`, backgroundColor: d.color, minWidth: d.count > 0 ? "6px" : "0" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Melhores horários pra vender */}
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <Clock size={15} className="text-muted-foreground" /> Quando seu cliente compra
              </h3>
              {orders.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-6 text-center">
                  Sem pedidos no período pra calcular.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-success/15 to-success/5 border border-success/30">
                    <div>
                      <p className="text-[11px] font-semibold text-success uppercase tracking-wider">Melhor horário</p>
                      <p className="font-heading text-xl font-bold text-foreground mt-0.5">{bestTimes.hour}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-success bg-success/15 px-2.5 py-1 rounded-md">{bestTimes.hourCount} pedidos</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30">
                    <div>
                      <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">Melhor dia</p>
                      <p className="font-heading text-xl font-bold text-foreground mt-0.5">{bestTimes.dow}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-primary bg-primary/15 px-2.5 py-1 rounded-md">{bestTimes.dowCount} pedidos</span>
                  </div>
                  <p className="text-[12px] text-muted-foreground/90 italic leading-relaxed pt-1">
                    💡 Use no Facebook Ads em "Programação de anúncios" pra concentrar verba nesses horários.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap hora x dia */}
          {visits.length > 50 && (
            <div className="bg-card border border-border/60 rounded-xl p-5 overflow-x-auto">
              <h3 className="text-sm font-semibold text-foreground mb-4">Mapa de Calor — Visitas por Hora/Dia</h3>
              <div className="min-w-[600px]">
                <div className="flex">
                  <div className="w-10" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center font-body text-[9px] text-muted-foreground">
                      {h}
                    </div>
                  ))}
                </div>
                {hourlyHeatmap.grid.map((row, dow) => (
                  <div key={dow} className="flex items-center">
                    <div className="w-10 font-body text-[10px] text-muted-foreground">{WEEKDAYS[dow]}</div>
                    {row.map((count, h) => {
                      const intensity = hourlyHeatmap.max > 0 ? count / hourlyHeatmap.max : 0;
                      return (
                        <div
                          key={h}
                          className="flex-1 aspect-square m-[1px] rounded-sm"
                          style={{ backgroundColor: count === 0 ? "hsl(var(--secondary))" : `hsl(var(--primary) / ${0.15 + intensity * 0.85})` }}
                          title={`${WEEKDAYS[dow]} ${h}h: ${count} visitas`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily chart */}
          {dailyStats.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-5">Visitas e Pedidos por Dia</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pedidos" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Fontes barra + Pie */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Fontes de Tráfego</h3>
              {sourceStats.length === 0 ? (
                <p className="text-muted-foreground text-[13px] py-10 text-center">Sem dados.</p>
              ) : (
                <div className="space-y-3.5">
                  {sourceStats.map((s) => (
                    <div key={s.key}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[13px] font-medium text-foreground inline-flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.label}
                        </span>
                        <span className="text-[12px] text-muted-foreground tabular-nums">
                          <span className="text-foreground font-semibold">{s.count}</span> · {s.percent}%
                        </span>
                      </div>
                      <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.percent}%`, backgroundColor: s.color, minWidth: "6px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Distribuição</h3>
              {sourceStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={sourceStats.slice(0, 8)} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label={({ label, percent }) => `${label} ${percent}%`} labelLine={false}>
                      {sourceStats.slice(0, 8).map((entry, i) => (
                        <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground font-body text-xs py-8 text-center">Sem dados.</p>
              )}
            </div>
          </div>

          {/* Top produtos vistos */}
          {topViewedProducts.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Produtos Mais Vistos</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {topViewedProducts.map((p) => (
                  <div key={p.id} className="bg-secondary/40 hover:bg-secondary/60 transition-colors rounded-lg p-3 border border-border/30">
                    {p.image && (
                      <div className="aspect-square rounded-md overflow-hidden bg-secondary mb-2.5">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <p className="text-[12px] font-medium text-foreground line-clamp-2 leading-snug">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{p.count} visualizações</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top pages + referrers */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Páginas Mais Visitadas</h3>
              {topPages.length === 0 ? (
                <p className="text-muted-foreground text-[13px] py-6 text-center">Sem dados.</p>
              ) : (
                <div className="space-y-0">
                  {topPages.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-border/40 last:border-0">
                      <span className="text-[13px] text-foreground truncate max-w-[70%] font-medium">{p.path}</span>
                      <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <ExternalLink size={15} className="text-muted-foreground" /> Referências Externas
              </h3>
              {topReferrers.length === 0 ? (
                <p className="text-muted-foreground text-[13px] py-6 text-center">Nenhuma.</p>
              ) : (
                <div className="space-y-0">
                  {topReferrers.map((r, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 border-b border-border/40 last:border-0">
                      <span className="text-[13px] text-foreground truncate max-w-[70%] font-medium">{r.host}</span>
                      <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Campanhas (UTM)</h3>
              <div className="space-y-0">
                {campaigns.map((c, i) => (
                  <div key={i} className="flex justify-between items-center py-2.5 border-b border-border/40 last:border-0">
                    <span className="text-[13px] text-foreground font-medium">{c.name}</span>
                    <span className="text-[12px] font-semibold text-muted-foreground tabular-nums">{c.count} visitas</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminTraffic;
