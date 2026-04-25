import { supabase } from "@/integrations/supabase/client";

/**
 * Meta (Facebook) Pixel + Google Ads loader.
 * - Carrega assíncrono (não bloqueia LCP)
 * - Lê pixel_id de site_settings.value.meta_pixel_settings
 * - Bufferiza eventos disparados antes do snippet carregar (fbq fila nativa já faz isso)
 * - Também loga em conversion_events (Supabase) pra ter dados mesmo sem ad blocker
 */

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    __vc_pixel_inited?: boolean;
    __vc_gads_inited?: boolean;
  }
}

interface PixelSettings {
  enabled?: boolean;
  pixel_id?: string;
  google_ads_id?: string;        // ex: "AW-1234567890"
  google_ads_purchase_label?: string; // ex: "abcDEF12"
  test_event_code?: string;      // p/ teste de eventos
}

let cachedSettings: PixelSettings | null = null;
let settingsPromise: Promise<PixelSettings> | null = null;

async function loadSettings(): Promise<PixelSettings> {
  if (cachedSettings) return cachedSettings;
  if (settingsPromise) return settingsPromise;
  settingsPromise = (async () => {
    try {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "meta_pixel_settings")
        .maybeSingle();
      cachedSettings = ((data?.value as PixelSettings) || {}) as PixelSettings;
    } catch {
      cachedSettings = {};
    }
    return cachedSettings!;
  })();
  return settingsPromise;
}

/** O snippet do Pixel já é carregado no index.html (early load).
 *  Aqui só re-init com pixel_id customizado se for diferente do default. */
function ensureFbPixel(pixelId: string) {
  if (window.__vc_pixel_inited) return;
  window.__vc_pixel_inited = true;
  if (!window.fbq) return; // pixel bloqueado por ad blocker — silencioso
  // Só re-init se admin configurou um pixel_id diferente do que está no HTML
  // (default no HTML: 799756736248413)
  if (pixelId && pixelId !== "799756736248413") {
    window.fbq("init", pixelId);
  }
}

/** Carrega o snippet do Google Ads/Analytics. */
function ensureGoogleAds(gadsId: string) {
  if (window.__vc_gads_inited) return;
  window.__vc_gads_inited = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gadsId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", gadsId);
}

async function ensureLoaded(): Promise<PixelSettings> {
  const s = await loadSettings();
  if (s.enabled === false) return s;
  if (s.pixel_id) ensureFbPixel(s.pixel_id);
  if (s.google_ads_id) ensureGoogleAds(s.google_ads_id);
  return s;
}

/** Loga em conversion_events (server-side fallback, imune a ad blocker). */
async function logEvent(name: string, params: Record<string, any> = {}) {
  try {
    let session_id = "";
    try {
      session_id = sessionStorage.getItem("vc_session_id") || "";
    } catch {
      /* */
    }
    await supabase.from("conversion_events").insert({
      event_name: name,
      event_value: params.value || 0,
      currency: params.currency || "BRL",
      product_id: params.content_ids?.[0] || params.product_id || null,
      order_id: params.order_id || null,
      source_label: params.source_label || "",
      fbclid: params.fbclid || "",
      gclid: params.gclid || "",
      session_id,
      meta: params,
    } as any);
  } catch {
    /* silent */
  }
}

function fireFb(event: string, params?: Record<string, any>, eventID?: string) {
  if (!window.fbq) return;
  const opts: Record<string, any> = {};
  if (eventID) opts.eventID = eventID;
  if (params) {
    window.fbq("track", event, params, opts);
  } else {
    window.fbq("track", event, {}, opts);
  }
}

function fireGads(eventName: string, params?: Record<string, any>) {
  if (!window.gtag) return;
  window.gtag("event", eventName, params || {});
}

/* ========= API pública ========= */

export const metaPixel = {
  async init() {
    await ensureLoaded();
  },

  async pageView() {
    await ensureLoaded();
    fireFb("PageView");
    // logEvent silencioso (já temos page_visits — evita duplicar)
  },

  async viewContent(p: { product_id: string; name: string; price: number; currency?: string; category?: string }) {
    await ensureLoaded();
    const params = {
      content_type: "product",
      content_ids: [p.product_id],
      content_name: p.name,
      content_category: p.category,
      value: p.price,
      currency: p.currency || "BRL",
    };
    fireFb("ViewContent", params);
    fireGads("view_item", { items: [{ id: p.product_id, google_business_vertical: "retail" }], value: p.price, currency: params.currency });
    logEvent("ViewContent", params);
  },

  async addToCart(p: { product_id: string; name: string; price: number; quantity?: number; currency?: string }) {
    await ensureLoaded();
    const params = {
      content_type: "product",
      content_ids: [p.product_id],
      content_name: p.name,
      value: p.price * (p.quantity || 1),
      currency: p.currency || "BRL",
    };
    fireFb("AddToCart", params);
    fireGads("add_to_cart", { items: [{ id: p.product_id, quantity: p.quantity || 1 }], value: params.value, currency: params.currency });
    logEvent("AddToCart", params);
  },

  async initiateCheckout(p: { value: number; num_items: number; currency?: string }) {
    await ensureLoaded();
    const params = { value: p.value, currency: p.currency || "BRL", num_items: p.num_items };
    fireFb("InitiateCheckout", params);
    fireGads("begin_checkout", params);
    logEvent("InitiateCheckout", params);
  },

  async lead(p: { value?: number; currency?: string } = {}) {
    await ensureLoaded();
    const params = { value: p.value || 0, currency: p.currency || "BRL" };
    fireFb("Lead", params);
    fireGads("generate_lead", params);
    logEvent("Lead", params);
  },

  async purchase(p: {
    order_id: string;
    value: number;
    currency?: string;
    contents?: { id: string; quantity: number; item_price: number }[];
    fbclid?: string;
    gclid?: string;
    source_label?: string;
  }) {
    const settings = await ensureLoaded();
    const params: Record<string, any> = {
      value: p.value,
      currency: p.currency || "BRL",
      content_type: "product",
      contents: p.contents || [],
      content_ids: (p.contents || []).map((c) => c.id),
      num_items: (p.contents || []).reduce((a, c) => a + c.quantity, 0),
    };
    // eventID = order_id permite dedupe com Conversion API server-side
    fireFb("Purchase", params, p.order_id);
    if (settings.google_ads_id && settings.google_ads_purchase_label) {
      fireGads("conversion", {
        send_to: `${settings.google_ads_id}/${settings.google_ads_purchase_label}`,
        value: p.value,
        currency: params.currency,
        transaction_id: p.order_id,
      });
    }
    fireGads("purchase", {
      transaction_id: p.order_id,
      value: p.value,
      currency: params.currency,
      items: (p.contents || []).map((c) => ({ id: c.id, quantity: c.quantity, price: c.item_price })),
    });
    logEvent("Purchase", { ...params, order_id: p.order_id, fbclid: p.fbclid, gclid: p.gclid, source_label: p.source_label });
  },

  /** Limpa cache (chamar após admin alterar settings) */
  resetCache() {
    cachedSettings = null;
    settingsPromise = null;
  },
};
