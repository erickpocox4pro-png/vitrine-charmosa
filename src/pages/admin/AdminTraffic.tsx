import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Globe, TrendingUp, Users, Calendar, ExternalLink } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  direto: { label: "Acesso Direto", color: "hsl(var(--primary))" },
  google: { label: "Google (Orgânico)", color: "#4285F4" },
  "google-ads": { label: "Google Ads", color: "#FBBC05" },
  instagram: { label: "Instagram", color: "#E1306C" },
  facebook: { label: "Facebook", color: "#1877F2" },
  whatsapp: { label: "WhatsApp", color: "#25D366" },
  tiktok: { label: "TikTok", color: "#010101" },
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
        .limit(1000);
      if (error) throw error;
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
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Total de Visitas</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{visits.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Sessões Únicas</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{uniqueSessions}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Globe size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Fontes</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">{sourceStats.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar size={14} />
                <span className="font-body text-[11px] uppercase tracking-wider font-semibold">Média/Dia</span>
              </div>
              <p className="font-body text-2xl font-bold text-foreground">
                {periodDays > 0 ? (visits.length / periodDays).toFixed(1) : 0}
              </p>
            </div>
          </div>

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
