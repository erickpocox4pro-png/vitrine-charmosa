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
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={20} /> Tráfego
          </h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Análise completa: visitantes, conversão, anúncios e funil
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 bg-success/10 border border-success/20 px-2.5 py-1.5 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            <span className="font-body text-xs font-semibold text-success">{liveCount} ao vivo</span>
          </div>
          {/* Period switcher */}
          <div className="flex gap-1 bg-secondary rounded-lg p-1">
            {([["7d", "7d"], ["30d", "30d"], ["90d", "90d"]] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setPeriod(val)}
                className={`px-2.5 py-1 rounded-md font-body text-xs font-medium transition-colors ${
                  period === val ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-secondary hover:bg-secondary/80 px-3 py-1.5 rounded-lg font-body text-xs font-medium text-foreground transition-colors"
            title="Baixar CSV"
          >
            <Download size={13} /> CSV
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
          {/* Cards principais com comparação */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Visitas</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{visits.length}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-body text-[10px] text-muted-foreground">{uniqueSessions} sessões</span>
                <span className="font-body text-[10px]"><Trend delta={visitDelta} /></span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ShoppingBag size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Pedidos</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{orders.length}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-body text-[10px] text-muted-foreground">
                  {uniqueSessions > 0 ? ((orders.length / uniqueSessions) * 100).toFixed(2) : "0"}% conv
                </span>
                <span className="font-body text-[10px]"><Trend delta={orderDelta} /></span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Receita</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">R$ {totalRevenue.toFixed(0)}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="font-body text-[10px] text-muted-foreground">
                  Médio R$ {orders.length > 0 ? (totalRevenue / orders.length).toFixed(0) : "0"}
                </span>
                <span className="font-body text-[10px]"><Trend delta={revenueDelta} /></span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap size={14} className="text-amber-500" />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Tráfego Pago</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{paidVsOrganic.paid}</p>
              <p className="font-body text-[10px] text-muted-foreground mt-1">
                {paidVsOrganic.total > 0 ? ((paidVsOrganic.paid / paidVsOrganic.total) * 100).toFixed(0) : "0"}% das visitas
              </p>
            </div>
          </div>

          {/* Funil */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <h3 className="font-body text-sm font-semibold text-foreground mb-4">Funil de Conversão</h3>
            <div className="space-y-2">
              {funnel.map((step, i) => {
                const top = funnel[0].count || 1;
                const pctTop = (step.count / top) * 100;
                const prev = i > 0 ? funnel[i - 1].count : step.count;
                const dropoff = i > 0 && prev > 0 ? ((prev - step.count) / prev) * 100 : 0;
                return (
                  <div key={step.stage}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-body text-xs font-medium text-foreground">{step.stage}</span>
                      <span className="font-body text-xs text-muted-foreground">
                        {step.count}
                        {i > 0 && dropoff > 0 && <span className="ml-2 text-destructive/70">−{dropoff.toFixed(0)}%</span>}
                      </span>
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pctTop}%`, backgroundColor: step.color, minWidth: step.count > 0 ? "4px" : "0" }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {abandoned.initiated > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="font-body text-[11px] text-foreground">
                  <b>🛒 Carrinhos abandonados:</b> {abandoned.abandoned} de {abandoned.initiated} (
                  {((abandoned.abandoned / abandoned.initiated) * 100).toFixed(0)}%) iniciaram checkout
                  mas não compraram. Use no Facebook Ads pra remarketing.
                </p>
              </div>
            )}
          </div>

          {/* Performance por fonte */}
          {conversionBySource.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-6 overflow-x-auto">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3">Performance por Fonte (first-touch)</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/50">
                    <th className="text-left font-body font-semibold py-2">Fonte</th>
                    <th className="text-right font-body font-semibold py-2">Sessões</th>
                    <th className="text-right font-body font-semibold py-2">Pedidos</th>
                    <th className="text-right font-body font-semibold py-2">Conv.</th>
                    <th className="text-right font-body font-semibold py-2">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {conversionBySource.map((r) => (
                    <tr key={r.key} className="border-b border-border/30 last:border-0">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                          <span className="font-body font-medium text-foreground">{r.label}</span>
                        </span>
                      </td>
                      <td className="text-right font-body text-muted-foreground py-2">{r.sessions}</td>
                      <td className="text-right font-body text-foreground font-semibold py-2">{r.orders}</td>
                      <td className={`text-right font-body py-2 font-semibold ${r.conversion >= 2 ? "text-success" : r.conversion >= 1 ? "text-foreground" : "text-muted-foreground"}`}>
                        {r.conversion.toFixed(2)}%
                      </td>
                      <td className="text-right font-body text-foreground font-semibold py-2">R$ {r.revenue.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Linha: Mobile vs Desktop + Melhores horários */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Devices */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3">Dispositivo</h3>
              <div className="space-y-3">
                {deviceBreakdown.map((d) => {
                  const Icon = d.icon;
                  return (
                    <div key={d.device}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-body text-xs text-foreground inline-flex items-center gap-1.5">
                          <Icon size={12} />
                          {d.device}
                        </span>
                        <span className="font-body text-xs text-muted-foreground">
                          {d.count} ({d.pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${d.pct}%`, backgroundColor: d.color, minWidth: d.count > 0 ? "4px" : "0" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Melhores horários pra vender */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Clock size={14} /> Quando seu cliente compra
              </h3>
              {orders.length === 0 ? (
                <p className="font-body text-xs text-muted-foreground py-4 text-center">
                  Sem pedidos no período pra calcular.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-success/10 border border-success/20">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-wider font-semibold text-success">Melhor horário</p>
                      <p className="font-body text-lg font-bold text-foreground">{bestTimes.hour}</p>
                    </div>
                    <span className="font-body text-xs font-semibold text-success">{bestTimes.hourCount} pedidos</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-wider font-semibold text-primary">Melhor dia</p>
                      <p className="font-body text-lg font-bold text-foreground">{bestTimes.dow}</p>
                    </div>
                    <span className="font-body text-xs font-semibold text-primary">{bestTimes.dowCount} pedidos</span>
                  </div>
                  <p className="font-body text-[10px] text-muted-foreground italic mt-2">
                    Use no Facebook Ads na opção "Programação de anúncios" pra concentrar verba nesses horários.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Heatmap hora x dia */}
          {visits.length > 50 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-6 overflow-x-auto">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3">Mapa de Calor — Visitas por Hora/Dia</h3>
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
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <h3 className="font-body text-sm font-semibold text-foreground mb-4">Visitas e Pedidos por Dia</h3>
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

          {/* Linha: Fontes barra + Pie */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-4">Fontes de Tráfego</h3>
              {sourceStats.length === 0 ? (
                <p className="text-muted-foreground font-body text-xs py-8 text-center">Sem dados.</p>
              ) : (
                <div className="space-y-3">
                  {sourceStats.map((s) => (
                    <div key={s.key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-body text-xs font-medium text-foreground">{s.label}</span>
                        <span className="font-body text-xs text-muted-foreground">{s.count} ({s.percent}%)</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.percent}%`, backgroundColor: s.color, minWidth: "4px" }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-4">Distribuição</h3>
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
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3">Produtos Mais Vistos</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {topViewedProducts.map((p) => (
                  <div key={p.id} className="bg-secondary/30 rounded-lg p-2.5">
                    {p.image && (
                      <div className="aspect-square rounded-md overflow-hidden bg-secondary mb-2">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <p className="font-body text-[11px] font-medium text-foreground line-clamp-2">{p.name}</p>
                    <p className="font-body text-[10px] text-muted-foreground mt-0.5">{p.count} visualizações</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linha: Top pages + referrers */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3">Páginas Mais Visitadas</h3>
              {topPages.length === 0 ? (
                <p className="text-muted-foreground font-body text-xs py-4 text-center">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {topPages.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                      <span className="font-body text-xs text-foreground truncate max-w-[70%]">{p.path}</span>
                      <span className="font-body text-xs font-semibold text-muted-foreground">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <ExternalLink size={14} /> Referências Externas
              </h3>
              {topReferrers.length === 0 ? (
                <p className="text-muted-foreground font-body text-xs py-4 text-center">Nenhuma.</p>
              ) : (
                <div className="space-y-2">
                  {topReferrers.map((r, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                      <span className="font-body text-xs text-foreground truncate max-w-[70%]">{r.host}</span>
                      <span className="font-body text-xs font-semibold text-muted-foreground">{r.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mt-6">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3">Campanhas (UTM)</h3>
              <div className="space-y-2">
                {campaigns.map((c, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                    <span className="font-body text-xs text-foreground">{c.name}</span>
                    <span className="font-body text-xs font-semibold text-muted-foreground">{c.count} visitas</span>
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
