/**
 * Recomprime todas as imagens já existentes no Supabase Storage.
 *
 * Estratégia (igual ao client-side):
 *  - Resize até 1600px no maior lado (banners desktop) / 900px (banners mobile, prefixo "mobile-")
 *  - Foto sem alpha → WebP qualidade 82
 *  - PNG com alpha → PNG otimizado (preserva transparência de logo)
 *  - Pula arquivos < 200 KB (já leves)
 *
 * Mapeia URL antiga → URL nova em todas as tabelas que armazenam URLs.
 * Faz upload da versão recomprimida no MESMO path original (mantém URL!) sempre que
 * o tipo MIME final for igual ao original; quando muda (jpg→webp), faz upload no novo
 * path e atualiza referências.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/recompress-storage.mjs [--dry-run]
 *
 * Service role key é necessária (acesso total ao bucket + tabelas).
 */

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "product-images";
const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_BELOW = 200 * 1024;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[recompress] Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no env.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stats = { scanned: 0, skipped: 0, recompressed: 0, savedBytes: 0, errors: 0, urlMaps: 0 };

const isMobileBanner = (path) => /\/mobile-|^banners\/mobile-/.test(path);

async function listAllPaths(prefix = "") {
  const out = [];
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw error;
  for (const item of data) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id && item.metadata) {
      out.push({ path: fullPath, size: item.metadata.size || 0 });
    } else {
      // pasta
      const sub = await listAllPaths(fullPath);
      out.push(...sub);
    }
  }
  return out;
}

async function processOne(item) {
  stats.scanned++;
  const { path, size } = item;

  if (size < SKIP_BELOW) {
    stats.skipped++;
    return null;
  }
  if (!/\.(jpe?g|png|webp)$/i.test(path)) {
    stats.skipped++;
    return null;
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(path);
  if (dlErr || !blob) {
    console.warn(`  download falhou: ${path}: ${dlErr?.message}`);
    stats.errors++;
    return null;
  }

  const buf = Buffer.from(await blob.arrayBuffer());
  const meta = await sharp(buf).metadata();
  const hasAlpha = meta.hasAlpha && meta.format === "png";
  const maxDim = isMobileBanner(path) ? 900 : 1600;

  let pipeline = sharp(buf, { failOn: "none" }).rotate(); // honra EXIF orientation
  if ((meta.width || 0) > maxDim || (meta.height || 0) > maxDim) {
    pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true });
  }

  let outBuf, outExt, outContentType;
  if (hasAlpha) {
    outBuf = await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer();
    outExt = "png";
    outContentType = "image/png";
  } else {
    outBuf = await pipeline.webp({ quality: 82, effort: 5 }).toBuffer();
    outExt = "webp";
    outContentType = "image/webp";
  }

  if (outBuf.length >= buf.length) {
    stats.skipped++;
    return null;
  }

  // Mantém URL se extensão não muda; senão upload novo + map old→new
  const oldExt = path.split(".").pop().toLowerCase();
  let newPath = path;
  if (oldExt !== outExt) {
    newPath = path.replace(/\.[^.]+$/, `.${outExt}`);
  }

  console.log(`  ${path} (${(size / 1024).toFixed(0)} KB) → ${newPath} (${(outBuf.length / 1024).toFixed(0)} KB)  -${(((size - outBuf.length) / size) * 100).toFixed(0)}%`);

  if (DRY_RUN) {
    stats.recompressed++;
    stats.savedBytes += size - outBuf.length;
    return { oldPath: path, newPath };
  }

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, outBuf, {
    contentType: outContentType,
    upsert: true,
    cacheControl: "31536000",
  });
  if (upErr) {
    console.warn(`  upload falhou: ${newPath}: ${upErr.message}`);
    stats.errors++;
    return null;
  }

  if (newPath !== path) {
    // remove o antigo
    await supabase.storage.from(BUCKET).remove([path]);
  }

  stats.recompressed++;
  stats.savedBytes += size - outBuf.length;
  return { oldPath: path, newPath };
}

function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function rewriteUrlsInDb(urlMap) {
  if (urlMap.size === 0) return;
  console.log(`\n[db] Reescrevendo ${urlMap.size} URLs nas tabelas...`);

  // products.image_url, products.images (jsonb)
  const { data: products } = await supabase.from("products").select("id, image_url, images");
  for (const p of products || []) {
    let changed = false;
    let image_url = p.image_url;
    if (image_url && urlMap.has(image_url)) {
      image_url = urlMap.get(image_url);
      changed = true;
    }
    let images = p.images;
    if (Array.isArray(images)) {
      const newArr = images.map((u) => (typeof u === "string" && urlMap.has(u) ? urlMap.get(u) : u));
      if (JSON.stringify(newArr) !== JSON.stringify(images)) {
        images = newArr;
        changed = true;
      }
    }
    if (changed && !DRY_RUN) {
      await supabase.from("products").update({ image_url, images }).eq("id", p.id);
      stats.urlMaps++;
    }
  }

  // product_images.image_url
  const { data: pimgs } = await supabase.from("product_images").select("id, image_url");
  for (const r of pimgs || []) {
    if (r.image_url && urlMap.has(r.image_url)) {
      if (!DRY_RUN) await supabase.from("product_images").update({ image_url: urlMap.get(r.image_url) }).eq("id", r.id);
      stats.urlMaps++;
    }
  }

  // site_settings (banners desktop+mobile, logo) — value é jsonb
  const { data: settings } = await supabase.from("site_settings").select("id, key, value");
  for (const s of settings || []) {
    const before = JSON.stringify(s.value);
    const after = JSON.parse(before, (_k, v) => (typeof v === "string" && urlMap.has(v) ? urlMap.get(v) : v));
    const afterStr = JSON.stringify(after);
    if (afterStr !== before) {
      if (!DRY_RUN) await supabase.from("site_settings").update({ value: after }).eq("id", s.id);
      stats.urlMaps++;
    }
  }
}

async function main() {
  console.log(`[recompress] ${DRY_RUN ? "DRY-RUN " : ""}Listando bucket "${BUCKET}"...`);
  const all = await listAllPaths("");
  console.log(`[recompress] ${all.length} arquivos encontrados.\n`);

  const urlMap = new Map();
  for (const item of all) {
    try {
      const result = await processOne(item);
      if (result && result.oldPath !== result.newPath) {
        urlMap.set(publicUrl(result.oldPath), publicUrl(result.newPath));
      }
    } catch (e) {
      console.warn(`  erro ${item.path}: ${e.message}`);
      stats.errors++;
    }
  }

  await rewriteUrlsInDb(urlMap);

  console.log("\n[recompress] Resumo:");
  console.log(`  arquivos analisados:  ${stats.scanned}`);
  console.log(`  recomprimidos:        ${stats.recompressed}`);
  console.log(`  pulados (já leves):   ${stats.skipped}`);
  console.log(`  erros:                ${stats.errors}`);
  console.log(`  refs DB atualizadas:  ${stats.urlMaps}`);
  console.log(`  total economizado:    ${(stats.savedBytes / 1024 / 1024).toFixed(2)} MB`);
  if (DRY_RUN) console.log("  (dry-run — nada foi escrito)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
