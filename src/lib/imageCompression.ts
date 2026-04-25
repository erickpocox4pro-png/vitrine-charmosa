/**
 * Compressão de imagens client-side antes do upload.
 *
 * Estratégia:
 *  - Redimensiona até MAX_DIM no maior lado (mantém aspect-ratio → layout intocado)
 *  - Foto comum (JPEG/sem alpha) → WebP qualidade 0.82 (~80–90% menor, sem perda visível)
 *  - PNG com transparência → PNG (preserva alpha; ainda redimensionado)
 *  - SVG / GIF / arquivo já pequeno → passa direto
 *  - Falha graciosa: se algo der errado, devolve o arquivo original
 */

const MAX_DIM = 1600;        // maior lado em pixels (suficiente p/ retina)
const MAX_DIM_MOBILE = 900;  // versão mobile dos banners
const QUALITY = 0.82;        // WebP quality
const SKIP_BELOW_BYTES = 200 * 1024; // <200 KB já está ok, não recomprime

export interface CompressOptions {
  /** Maior lado em pixels (default 1600). Use 900 para banner mobile. */
  maxDimension?: number;
  /** Qualidade WebP 0–1 (default 0.82). */
  quality?: number;
  /** Pula compressão se arquivo já estiver abaixo desse tamanho em bytes. */
  skipBelowBytes?: number;
}

/**
 * Comprime uma imagem File mantendo aspect-ratio e qualidade visual.
 * NÃO altera dimensões CSS — só o tamanho do arquivo binário.
 */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxDim = opts.maxDimension ?? MAX_DIM;
  const quality = opts.quality ?? QUALITY;
  const skipBelow = opts.skipBelowBytes ?? SKIP_BELOW_BYTES;

  // Pula tipos não-rasterizáveis ou já leves
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (file.size <= skipBelow) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width: w0, height: h0 } = bitmap;

    // Calcula dimensões mantendo aspect-ratio
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: file.type === "image/png" });
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap) (bitmap as ImageBitmap).close();

    // PNG com alpha permanece PNG (logos, ícones)
    const hasAlpha = file.type === "image/png" && (await detectAlpha(canvas, ctx));
    const outType = hasAlpha ? "image/png" : "image/webp";
    const outQuality = hasAlpha ? undefined : quality;

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, outType, outQuality)
    );
    if (!blob) return file;

    // Se a "compressão" piorou (raro, p/ imagens já pequenas), devolve o original
    if (blob.size >= file.size) return file;

    const ext = outType === "image/webp" ? "webp" : "png";
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const newFile = new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    });
    return newFile;
  } catch (err) {
    console.warn("[compressImage] falhou, usando original:", err);
    return file;
  }
}

/** Versão para banners mobile (cap 900px no maior lado). */
export function compressMobileBanner(file: File): Promise<File> {
  return compressImage(file, { maxDimension: MAX_DIM_MOBILE });
}

// --- helpers ---

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fallback abaixo
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Amostra pixels para descobrir se há transparência real (não só PNG por extensão). */
async function detectAlpha(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): Promise<boolean> {
  try {
    // Amostra um grid 16x16 — barato e suficiente
    const step = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / 16));
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4 + 3;
        if (data[idx] < 250) return true;
      }
    }
    return false;
  } catch {
    return true; // se não conseguiu ler (CORS), assume alpha p/ não destruir logo
  }
}
