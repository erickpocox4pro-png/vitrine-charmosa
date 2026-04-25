/**
 * optimize-assets.mjs
 * Comprime imagens em src/assets/ in-place e gera variantes WebP ao lado.
 *
 * Filosofia:
 *  - Sobrescreve PNG/JPG originais com versões otimizadas (quality + resize cap).
 *  - Gera .webp irmão de cada imagem para uso futuro com <picture>.
 *  - Logo PNG é tratado especial: re-encodado em modo paleta (drástica redução).
 *
 * Idempotente: rodar de novo sobre arquivos já otimizados não quebra nada
 * (sharp re-encoda; pode aumentar perda em ~2% por geração — usar com moderação).
 *
 * Uso:
 *   node scripts/optimize-assets.mjs
 */

import sharp from "sharp";
import { readdir, readFile, stat, writeFile } from "fs/promises";
import { resolve, dirname, extname, basename, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, "../src/assets");

// Caps de tamanho (largura) por tipo de asset
const MAX_WIDTH = {
  logo: 600,    // logo no header tem h-20 (~80px) — 600px de largura é mais que suficiente
  hero: 1920,  // banners desktop full-width
  product: 800,// thumbnails em grid; product page nunca passa de ~600
  default: 1600,
};

const JPG_QUALITY = 78;
const WEBP_QUALITY = 75;

function classify(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes("logo")) return "logo";
  if (lower.includes("hero")) return "hero";
  if (lower.includes("/products/") || lower.includes("\\products\\")) return "product";
  return "default";
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

async function processOne(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return null;

  const before = (await stat(filePath)).size;
  const kind = classify(filePath);
  const maxW = MAX_WIDTH[kind] ?? MAX_WIDTH.default;

  // Lê o arquivo inteiro pra Buffer ANTES de processar — desbloqueia
  // o write subsequente no mesmo path (file-locking no Windows).
  const original = await readFile(filePath);
  const metadata = await sharp(original, { failOn: "none" }).metadata();
  const targetWidth = metadata.width && metadata.width > maxW ? maxW : metadata.width;

  let pipeline = sharp(original, { failOn: "none" });
  if (targetWidth && targetWidth !== metadata.width) {
    pipeline = pipeline.resize({ width: targetWidth, withoutEnlargement: true });
  }

  // Re-encode according to original format
  let outBuffer;
  if (ext === ".png") {
    // Para logos: paleta indexada cai drasticamente
    if (kind === "logo") {
      outBuffer = await pipeline
        .png({ palette: true, quality: 80, compressionLevel: 9, effort: 10 })
        .toBuffer();
    } else {
      outBuffer = await pipeline
        .png({ quality: 85, compressionLevel: 9, effort: 8 })
        .toBuffer();
    }
  } else {
    outBuffer = await pipeline
      .jpeg({ quality: JPG_QUALITY, mozjpeg: true, progressive: true })
      .toBuffer();
  }

  // Só sobrescreve se reduziu (>=5% menor) — evita re-encodes que pioram
  const reduction = (before - outBuffer.length) / before;
  let action = "skip";
  if (outBuffer.length < before && reduction >= 0.05) {
    await writeFile(filePath, outBuffer);
    action = "replace";
  }

  // Gera .webp irmão sempre (gerado a partir do buffer original em memória)
  const webpPath = filePath.replace(/\.(png|jpe?g)$/i, ".webp");
  let webpStats = null;
  try {
    let wpipe = sharp(original, { failOn: "none" });
    if (targetWidth && targetWidth !== metadata.width) {
      wpipe = wpipe.resize({ width: targetWidth, withoutEnlargement: true });
    }
    const buf = await wpipe.webp({ quality: WEBP_QUALITY, effort: 6 }).toBuffer();
    await writeFile(webpPath, buf);
    webpStats = buf.length;
  } catch (err) {
    console.warn(`  ⚠️  webp falhou em ${basename(filePath)}: ${err.message}`);
  }

  const after = (await stat(filePath)).size;
  return {
    file: filePath.replace(ASSETS_DIR, ""),
    kind,
    before,
    after,
    webp: webpStats,
    action,
  };
}

async function main() {
  console.log(`🖼️  Otimizando assets em ${ASSETS_DIR}\n`);
  const results = [];
  let totalBefore = 0;
  let totalAfter = 0;
  let totalWebp = 0;

  for await (const file of walk(ASSETS_DIR)) {
    const r = await processOne(file);
    if (!r) continue;
    results.push(r);
    totalBefore += r.before;
    totalAfter += r.after;
    if (r.webp) totalWebp += r.webp;

    const arrow = r.action === "replace" ? "→" : "=";
    console.log(
      `  [${r.kind.padEnd(7)}] ${r.file.padEnd(50)} ${fmtBytes(r.before).padStart(8)} ${arrow} ${fmtBytes(r.after).padStart(8)}` +
        (r.webp ? `  webp:${fmtBytes(r.webp)}` : "")
    );
  }

  console.log(
    `\n✅ ${results.length} imagens processadas. Total: ${fmtBytes(totalBefore)} → ${fmtBytes(totalAfter)} (webp: ${fmtBytes(totalWebp)})`
  );
}

main().catch((err) => {
  console.error("❌ Otimização falhou:", err);
  process.exit(1);
});
