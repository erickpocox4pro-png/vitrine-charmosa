import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE_URL = "https://vitrinecharmosa.com.br";

const STATIC_ROUTES: { path: string; changefreq: string; priority: string }[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/sobre-nos", changefreq: "monthly", priority: "0.5" },
  { path: "/politica-troca", changefreq: "monthly", priority: "0.4" },
  { path: "/guia-tamanhos", changefreq: "monthly", priority: "0.4" },
  { path: "/entrega-frete", changefreq: "monthly", priority: "0.4" },
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: products } = await supabase
      .from("products")
      .select("slug, id, updated_at, image_url, name")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5000);

    const { data: categories } = await supabase
      .from("categories")
      .select("slug, updated_at")
      .limit(200);

    const urls: string[] = [];

    for (const r of STATIC_ROUTES) {
      urls.push(`  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`);
    }

    for (const p of products || []) {
      const slug = p.slug || p.id;
      const lastmod = p.updated_at ? new Date(p.updated_at).toISOString() : undefined;
      const image = p.image_url
        ? `
    <image:image>
      <image:loc>${escapeXml(p.image_url)}</image:loc>
      <image:title>${escapeXml(p.name || "")}</image:title>
    </image:image>`
        : "";
      urls.push(`  <url>
    <loc>${SITE_URL}/produto/${escapeXml(slug)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>${image}
  </url>`);
    }

    for (const c of categories || []) {
      if (!c.slug) continue;
      urls.push(`  <url>
    <loc>${SITE_URL}/categoria/${escapeXml(c.slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });
  }
});
