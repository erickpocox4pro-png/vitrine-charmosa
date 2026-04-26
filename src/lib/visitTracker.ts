import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { metaPixel } from "@/lib/metaPixel";

/**
 * Detecta a fonte de tráfego com base em UTM, fbclid, gclid e referrer.
 * Ordem de prioridade:
 *   1. fbclid → facebook-ads (mesmo sem utm)
 *   2. gclid  → google-ads
 *   3. utm_source / utm_medium=cpc|paid
 *   4. referrer (Instagram, Google orgânico, etc.)
 *   5. landing direto + sem nada → "direto"
 */
export interface SourceInfo {
  source_label: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  fbclid: string;
  gclid: string;
  referrer: string;
}

export function detectSource(): SourceInfo {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";

  const utm_source = params.get("utm_source") || "";
  const utm_medium = params.get("utm_medium") || "";
  const utm_campaign = params.get("utm_campaign") || "";
  const utm_term = params.get("utm_term") || "";
  const utm_content = params.get("utm_content") || "";
  const fbclid = params.get("fbclid") || "";
  const gclid = params.get("gclid") || "";

  let source_label = "direto";

  // Click-IDs ganham prioridade (anúncio pago, mesmo sem UTM)
  if (fbclid) {
    source_label = "facebook-ads";
  } else if (gclid) {
    source_label = "google-ads";
  } else if (utm_source) {
    const src = utm_source.toLowerCase();
    const med = utm_medium.toLowerCase();
    const isPaid = med === "cpc" || med === "ppc" || med === "paid" || med === "paidsocial" || med === "paid_social";
    if (src.includes("facebook") || src === "fb" || src === "ig" || src.includes("instagram") || src === "meta") {
      source_label = isPaid ? "facebook-ads" : (src.includes("instagram") || src === "ig" ? "instagram" : "facebook");
    } else if (src.includes("google")) {
      source_label = isPaid ? "google-ads" : "google";
    } else if (src.includes("tiktok")) {
      source_label = isPaid ? "tiktok-ads" : "tiktok";
    } else {
      source_label = src + (isPaid && !src.includes("ads") ? "-ads" : "");
    }
  } else if (referrer) {
    const ref = referrer.toLowerCase();
    if (ref.includes("google.")) source_label = "google";
    else if (ref.includes("instagram.com") || ref.includes("l.instagram")) source_label = "instagram";
    else if (ref.includes("facebook.com") || ref.includes("fb.com") || ref.includes("l.facebook") || ref.includes("m.facebook")) source_label = "facebook";
    else if (ref.includes("whatsapp") || ref.includes("wa.me") || ref.includes("api.whatsapp")) source_label = "whatsapp";
    else if (ref.includes("tiktok.com")) source_label = "tiktok";
    else if (ref.includes("twitter.com") || ref.includes("t.co") || ref.includes("x.com")) source_label = "twitter";
    else if (ref.includes("pinterest.")) source_label = "pinterest";
    else if (ref.includes("youtube.com") || ref.includes("youtu.be")) source_label = "youtube";
    else if (ref.includes("bing.com")) source_label = "bing";
    else if (ref.includes("linkedin.com")) source_label = "linkedin";
    else source_label = "referencia";
  }

  return { source_label, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, referrer };
}

const SESSION_KEY = "vc_session_id";
const FIRST_TOUCH_KEY = "vc_first_touch";          // 30 dias
const LAST_VISIT_KEY = "vc_last_visit_path";        // dedup por rota
const VISIT_COUNT_KEY = "vc_visit_count";           // detect first visit ever
const FIRST_TOUCH_TTL_DAYS = 30;

export function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

interface FirstTouch extends SourceInfo {
  landing_path: string;
  saved_at: number;
}

/** Lê (e expira após 30d) o first-touch persistido em localStorage. */
export function getFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(FIRST_TOUCH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FirstTouch;
    const ageDays = (Date.now() - parsed.saved_at) / 86400000;
    if (ageDays > FIRST_TOUCH_TTL_DAYS) {
      localStorage.removeItem(FIRST_TOUCH_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveFirstTouch(src: SourceInfo, landing_path: string) {
  const data: FirstTouch = { ...src, landing_path, saved_at: Date.now() };
  try {
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua) && !/ipad|tablet/.test(ua)) return "mobile";
  if (/tablet|ipad/.test(ua)) return "tablet";
  return "desktop";
}

/** Detecta bots/crawlers/headless — NÃO contar como visita real */
function isBot(): boolean {
  if (typeof navigator === "undefined") return true;
  const ua = navigator.userAgent.toLowerCase();
  // Headless Chrome (puppeteer/playwright), bots conhecidos, prerender, lighthouse
  if (/headlesschrome|puppeteer|playwright|lighthouse|prerender|chrome-lighthouse/i.test(ua)) return true;
  if (/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|googlebot|duckduckbot|ahrefsbot|semrushbot|mj12bot/i.test(ua)) return true;
  // navigator.webdriver = true em qualquer browser controlado por automação
  if ((navigator as any).webdriver === true) return true;
  return false;
}

/** Atualiza linha em attribution_sessions (upsert) */
async function upsertAttributionSession(sessionId: string, src: SourceInfo, landing_path: string, firstTouch: FirstTouch) {
  // Tenta INSERT — se conflitar (já existe), faz UPDATE só de last_*
  const { error } = await supabase.from("attribution_sessions").upsert(
    {
      session_id: sessionId,
      first_seen_at: new Date(firstTouch.saved_at).toISOString(),
      last_seen_at: new Date().toISOString(),
      first_source: firstTouch.source_label,
      first_utm_source: firstTouch.utm_source,
      first_utm_medium: firstTouch.utm_medium,
      first_utm_campaign: firstTouch.utm_campaign,
      first_utm_term: firstTouch.utm_term,
      first_utm_content: firstTouch.utm_content,
      first_referrer: firstTouch.referrer,
      first_landing_path: firstTouch.landing_path,
      first_fbclid: firstTouch.fbclid,
      first_gclid: firstTouch.gclid,
      last_source: src.source_label,
      last_utm_source: src.utm_source,
      last_utm_medium: src.utm_medium,
      last_utm_campaign: src.utm_campaign,
      last_referrer: src.referrer,
      last_fbclid: src.fbclid,
      last_gclid: src.gclid,
    } as any,
    { onConflict: "session_id" }
  );
  if (error) {
    // silencioso (RLS pode rejeitar update sem owner — fallback ok)
  }
}

async function trackVisit(pathname: string, hash: string) {
  const path = pathname + hash;
  const src = detectSource();
  const sessionId = getSessionId();

  // First-touch: se não existe ainda, esse é o primeiro contato
  let firstTouch = getFirstTouch();
  const isFirstVisit = !firstTouch;
  if (!firstTouch) {
    saveFirstTouch(src, path);
    firstTouch = { ...src, landing_path: path, saved_at: Date.now() };
  }

  // Conta visitas (pra distinguir first ever vs returning)
  try {
    const c = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || "0", 10) + 1;
    localStorage.setItem(VISIT_COUNT_KEY, String(c));
  } catch {
    /* */
  }

  // Insere visita
  await supabase.from("page_visits").insert({
    page_path: path,
    landing_path: firstTouch.landing_path,
    referrer: src.referrer,
    utm_source: src.utm_source,
    utm_medium: src.utm_medium,
    utm_campaign: src.utm_campaign,
    utm_term: src.utm_term,
    utm_content: src.utm_content,
    fbclid: src.fbclid,
    gclid: src.gclid,
    source_label: src.source_label,
    user_agent: navigator.userAgent,
    session_id: sessionId,
    is_first_visit: isFirstVisit,
    device_type: detectDevice(),
  } as any);

  // Atualiza tabela de atribuição (first + last touch consolidado)
  await upsertAttributionSession(sessionId, src, path, firstTouch);

  // Dispara PageView no Pixel do Facebook
  metaPixel.pageView();
}

/** Hook: chama uma vez no AppRoutes — escuta mudanças de rota. */
export function useVisitTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    // Bots / prerender (puppeteer no build) NÃO contam como visita
    if (isBot()) return;

    // Dedup: mesma rota num intervalo de 2s não conta de novo
    const path = location.pathname + location.hash;
    const last = sessionStorage.getItem(LAST_VISIT_KEY);
    const lastTime = parseInt(sessionStorage.getItem(LAST_VISIT_KEY + "_t") || "0", 10);
    if (last === path && Date.now() - lastTime < 2000) return;
    sessionStorage.setItem(LAST_VISIT_KEY, path);
    sessionStorage.setItem(LAST_VISIT_KEY + "_t", String(Date.now()));

    trackVisit(location.pathname, location.hash).catch(() => {
      /* silent */
    });
  }, [location.pathname, location.hash]);
}

/** Lê cookie por nome (lado client). */
function readCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? m[2] : "";
}

/** Helper síncrono pra obter contexto de atribuição em pontos de conversão (ex: criar pedido) */
export function getAttributionContext() {
  const ft = getFirstTouch();
  const lt = detectSource();
  return {
    session_id: getSessionId(),
    first: ft,
    last: lt,
    fbp: readCookie("_fbp"),  // Browser ID que o Pixel cria
    fbc: readCookie("_fbc"),  // Click ID do FB (formato fb.1.<ts>.<fbclid>)
  };
}
