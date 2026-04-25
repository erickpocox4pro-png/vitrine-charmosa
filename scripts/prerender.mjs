/**
 * prerender.mjs
 * Pre-renders each public route into a static HTML file inside `dist/`.
 *
 * Strategy:
 *  1. Start a local `vite preview` server pointing at the freshly built `dist/`.
 *  2. Use Puppeteer to navigate each route, wait for React + Helmet to settle, and
 *     capture the fully rendered HTML.
 *  3. Save the captured HTML as `dist/<route>/index.html`.
 *
 * Result: bots that don't execute JS (WhatsApp, Facebook, Twitter, older crawlers)
 * see complete content + per-page meta/OG tags. Hostinger/LiteSpeed serves the
 * static file when it exists, falling back to the SPA index.html otherwise.
 *
 * Skip with SKIP_PRERENDER=1.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

if (process.env.SKIP_PRERENDER === "1") {
  console.log("⏭️  SKIP_PRERENDER=1 — pulando prerender");
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(__dirname, "../dist");

const SUPABASE_URL = "https://vmcvocoajkibwobcapqr.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtY3ZvY29hamtpYndvYmNhcHFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIzNTUxMzUsImV4cCI6MjA3NzkzMTEzNX0.24my2D8zhwEsnwMJqcaqPe2sputVTmV_XFjWC7Xq5xo";

const STATIC_ROUTES = [
  "/",
  "/sobre-nos",
  "/politica-troca",
  "/guia-tamanhos",
  "/entrega-frete",
];

async function fetchRows(table, select, filter = "") {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter}&limit=5000`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} on ${table}`);
  return res.json();
}

async function getRoutes() {
  const [products, categories] = await Promise.all([
    fetchRows("products", "slug", "&is_active=eq.true"),
    fetchRows("categories", "slug", "&is_active=eq.true"),
  ]);

  const productRoutes = products
    .filter((p) => p.slug)
    .map((p) => `/produto/${p.slug}`);
  const categoryRoutes = categories
    .filter((c) => c.slug)
    .map((c) => `/categoria/${c.slug}`);

  return [...STATIC_ROUTES, ...categoryRoutes, ...productRoutes];
}

async function main() {
  console.log("🎬 Prerender iniciado");

  // Lazy-import heavy deps so SKIP_PRERENDER bypasses them entirely
  const { preview } = await import("vite");
  const puppeteer = (await import("puppeteer")).default;

  const routes = await getRoutes();
  console.log(`📋 ${routes.length} rotas a renderizar`);

  // Boot a vite preview server pointing at dist/
  const server = await preview({
    preview: { port: 4173, host: "127.0.0.1", strictPort: true },
  });
  const baseUrl = "http://127.0.0.1:4173";

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  let success = 0;
  let failed = 0;
  const failures = [];

  for (const route of routes) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 800 });
      // Block heavy resources we don't need to capture HTML
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const type = req.resourceType();
        if (type === "media" || type === "font") {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(`${baseUrl}${route}`, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Give Helmet + Supabase queries a moment to settle
      await new Promise((r) => setTimeout(r, 800));

      // Mark as prerendered so we can detect it later if needed
      await page.evaluate(() => {
        document.documentElement.setAttribute("data-prerendered", "true");
      });

      const html = await page.content();

      const filePath =
        route === "/"
          ? resolve(DIST_DIR, "index.html")
          : resolve(DIST_DIR, `.${route}/index.html`);

      const dir = dirname(filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      writeFileSync(filePath, html, "utf8");
      success++;
      if (success % 10 === 0 || success <= 5) {
        console.log(`  ✓ [${success}/${routes.length}] ${route}`);
      }
    } catch (err) {
      failed++;
      failures.push({ route, message: err.message });
      console.error(`  ✗ ${route}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  await new Promise((resolve, reject) =>
    server.httpServer.close((err) => (err ? reject(err) : resolve()))
  );

  console.log(
    `\n✅ Prerender concluído: ${success} OK, ${failed} falhas (de ${routes.length})`
  );

  if (failures.length > 0) {
    console.log("\nFalhas:");
    failures.forEach((f) => console.log(`  - ${f.route}: ${f.message}`));
  }

  // Hard-fail only if everything broke
  if (success === 0) process.exit(1);
}

main().catch((err) => {
  console.error("❌ Prerender falhou:", err);
  process.exit(1);
});
