import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Globe, TrendingUp, Users, Calendar, ExternalLink, DollarSign, ShoppingBag, Zap } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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

const AdminTraffic = () => {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString();
  }, [periodDays]);

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["admin-traffic", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("page_visits")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  // Pedidos com atribuição (pra calcular taxa de conversão real por fonte)
  const { data: orders = [] } = useQuery({
    queryKey: ["admin-traffic-orders", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, status, source_first, source_last, utm_source, utm_campaign, fbclid, gclid, created_at")
        .gte("created_at", since);
      if (error) throw error;
      return data || [];
    },
  });

  // Sessões (pra contar leads únicos vs visitas)
  const { data: sessions = [] } = useQuery({
    queryKey: ["admin-traffic-sessions", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("attribution_sessions")
        .select("session_id, first_source, last_source, first_seen_at")
        .gte("first_seen_at", since)
        .limit(2000);
      return data || [];
    },
  });

  // Eventos de conversão (ViewContent, AddToCart, InitiateCheckout, Purchase)
  const { data: convEvents = [] } = useQuery({
    queryKey: ["admin-traffic-events", period],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversion_events")
        .select("event_name, event_value, source_label, session_id, created_at")
        .gte("created_at", since)
        .limit(5000);
      return data || [];
    },
  });

  // Aggregate by source
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

  // Aggregate by day for chart
  const dailyStats = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const day = (v as any).created_at?.slice(0, 10);
      if (day) map[day] = (map[day] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, count]) => ({
        day: day.slice(5), // MM-DD
        visitas: count,
      }));
  }, [visits]);

  // Unique sessions
  const uniqueSessions = useMemo(() => {
    const set = new Set(visits.map((v: any) => v.session_id).filter(Boolean));
    return set.size;
  }, [visits]);

  // Top pages
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

  // Top referrers
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

  // UTM campaigns
  const campaigns = useMemo(() => {
    const map: Record<string, number> = {};
    for (const v of visits) {
      const campaign = (v as any).utm_campaign;
      if (campaign) map[campaign] = (map[campaign] || 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [visits]);

  // Pago vs orgânico
  const paidVsOrganic = useMemo(() => {
    let paid = 0, organic = 0;
    for (const v of visits as any[]) {
      const lbl = (v.source_label || "").toString();
      if (SOURCE_LABELS[lbl]?.paid || v.fbclid || v.gclid) paid++;
      else organic++;
    }
    return { paid, organic, total: paid + organic };
  }, [visits]);

  // Funil global
  const funnel = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of convEvents as any[]) {
      counts[e.event_name] = (counts[e.event_name] || 0) + 1;
    }
    const visit = visits.length;
    const view = counts.ViewContent || 0;
    const cart = counts.AddToCart || 0;
    const checkout = counts.InitiateCheckout || 0;
    const purchase = orders.length;
    return [
      { stage: "Visitas", count: visit, color: "#6B7280" },
      { stage: "Viu produto", count: view, color: "#3B82F6" },
      { stage: "Adicionou ao carrinho", count: cart, color: "#F59E0B" },
      { stage: "Iniciou checkout", count: checkout, color: "#EC4899" },
      { stage: "Comprou", count: purchase, color: "#10B981" },
    ];
  }, [convEvents, visits, orders]);

  // Conversão por fonte (first-touch — atribui venda à origem original)
  const conversionBySource = useMemo(() => {
    // visitas únicas por fonte (sessões)
    const sessionsBySource: Record<string, number> = {};
    for (const s of sessions as any[]) {
      const src = s.first_source || "direto";
      sessionsBySource[src] = (sessionsBySource[src] || 0) + 1;
    }
    // pedidos por fonte (first-touch fallback p/ last)
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

  // Carrinhos abandonados (InitiateCheckout sem Purchase)
  const abandoned = useMemo(() => {
    const checkoutSessions = new Set(
      (convEvents as any[]).filter((e) => e.event_name === "InitiateCheckout").map((e) => e.session_id).filter(Boolean)
    );
    const purchasedSessions = new Set(
      (convEvents as any[]).filter((e) => e.event_name === "Purchase").map((e) => e.session_id).filter(Boolean)
    );
    let abandonedCount = 0;
    checkoutSessions.forEach((s) => { if (!purchasedSessions.has(s)) abandonedCount++; });
    return { initiated: checkoutSessions.size, abandoned: abandonedCount, completed: purchasedSessions.size };
  }, [convEvents]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={20} /> Tráfego
          </h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            De onde vêm seus visitantes
          </p>
        </div>
        <div className="flex gap-1.5 bg-secondary rounded-lg p-1">
          {([["7d", "7 dias"], ["30d", "30 dias"], ["90d", "90 dias"]] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setPeriod(val)}
              className={`px-3 py-1.5 rounded-md font-body text-xs font-medium transition-colors ${
                period === val
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-secondary rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-secondary rounded-xl" />
        </div>
      ) : (
        <>
          {/* Summary Cards — agora com vendas e taxa de conversão real */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Visitas</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{visits.length}</p>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">{uniqueSessions} sessões únicas</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ShoppingBag size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Pedidos</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{orders.length}</p>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                {uniqueSessions > 0 ? ((orders.length / uniqueSessions) * 100).toFixed(2) : "0"}% de conversão
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Receita</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">
                R$ {orders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0).toFixed(0)}
              </p>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                Ticket médio R$ {orders.length > 0 ? (orders.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0) / orders.length).toFixed(0) : "0"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap size={14} className="text-amber-500" />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Tráfego Pago</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{paidVsOrganic.paid}</p>
              <p className="font-body text-[10px] text-muted-foreground mt-0.5">
                {paidVsOrganic.total > 0 ? ((paidVsOrganic.paid / paidVsOrganic.total) * 100).toFixed(0) : "0"}% das visitas
              </p>
            </div>
          </div>

          {/* Funil de conversão */}
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
                        {i > 0 && dropoff > 0 && (
                          <span className="ml-2 text-destructive/70">−{dropoff.toFixed(0)}%</span>
                        )}
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
                  mas não compraram. Use esses dados pra rodar remarketing no Facebook Ads.
                </p>
              </div>
            )}
          </div>

          {/* Conversão por fonte (a tabela mais importante) */}
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
                      <td className="text-right font-body text-foreground font-semibold py-2">
                        R$ {r.revenue.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-3 italic">
                Atribuição first-touch: o pedido é creditado à fonte que trouxe o cliente pela primeira vez (até 30 dias).
                Use isso pra decidir onde investir mais em anúncios.
              </p>
            </div>
          )}

          {/* Daily chart */}
          {dailyStats.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-6">
              <h3 className="font-body text-sm font-semibold text-foreground mb-4">Visitas por Dia</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Source breakdown */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-4">Fontes de Tráfego</h3>
              {sourceStats.length === 0 ? (
                <p className="text-muted-foreground font-body text-xs py-8 text-center">Nenhuma visita registrada.</p>
              ) : (
                <div className="space-y-3">
                  {sourceStats.map((s) => (
                    <div key={s.key}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-body text-xs font-medium text-foreground">{s.label}</span>
                        <span className="font-body text-xs text-muted-foreground">{s.count} ({s.percent}%)</span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.percent}%`, backgroundColor: s.color, minWidth: "4px" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pie chart */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-4">Distribuição</h3>
              {sourceStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sourceStats.slice(0, 8)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ label, percent }) => `${label} ${percent}%`}
                      labelLine={false}
                    >
                      {sourceStats.slice(0, 8).map((entry, i) => (
                        <Cell key={i} fill={entry.color || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground font-body text-xs py-8 text-center">Sem dados.</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Top pages */}
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

            {/* Top referrers */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="font-body text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <ExternalLink size={14} /> Referências Externas
              </h3>
              {topReferrers.length === 0 ? (
                <p className="text-muted-foreground font-body text-xs py-4 text-center">Nenhuma referência externa.</p>
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

          {/* Campaigns */}
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
