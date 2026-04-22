/**
 * generate-sitemap.mjs
 * Generates public/sitemap.xml at build time fetching products/categories from Supabase.
 * Uses the public anon key (safe — only reads public data).
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SITE_URL = "https://vitrinecharmosa.com.br";
const SUPABASE_URL = "https://vmcvocoajkibwobcapqr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY3ZvY29hamtpYndvYmNhcHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTUxMzUsImV4cCI6MjA3NzkzMTEzNX0.24my2D8zhwEsnwMJqcaqPe2sputVTmV_XFjWC7Xq5xo";

const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/sobre-nos", changefreq: "monthly", priority: "0.5" },
  { path: "/politica-troca", changefreq: "monthly", priority: "0.4" },
  { path: "/guia-tamanhos", changefreq: "monthly", priority: "0.4" },
  { path: "/entrega-frete", changefreq: "monthly", priority: "0.4" },
];

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchAll(table, select, filters = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filters}&limit=5000`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status} on ${table}`);
  return res.json();
}

async function main() {
  console.log("🗺️  Generating sitemap.xml...");

  const [products, categories] = await Promise.all([
    fetchAll("products", "slug,id,updated_at,image_url,name", "&is_active=eq.true"),
    fetchAll("categories", "slug", ""),
  ]);

  const urls = [];

  for (const r of STATIC_ROUTES) {
    urls.push(`  <url>
    <loc>${SITE_URL}${r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`);
  }

  for (const p of products || []) {
    const slug = p.slug || p.id;
    const lastmod = p.updated_at ? new Date(p.updated_at).toISOString() : "";
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
    <loc>${SITE_URL}/#categoria-${escapeXml(c.slug)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  const outPath = resolve(__dirname, "../public/sitemap.xml");
  writeFileSync(outPath, xml, "utf8");
  console.log(`✅ sitemap.xml gerado com ${products?.length || 0} produtos e ${categories?.length || 0} categorias → ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Erro ao gerar sitemap:", err.message);
  process.exit(1);
});
