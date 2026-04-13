import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Detects traffic source from referrer and UTM parameters.
 */
function detectSource(): {
  source_label: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  referrer: string;
} {
  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || "";
  
  const utm_source = params.get("utm_source") || "";
  const utm_medium = params.get("utm_medium") || "";
  const utm_campaign = params.get("utm_campaign") || "";
  const utm_term = params.get("utm_term") || "";
  const utm_content = params.get("utm_content") || "";

  let source_label = "direto";

  // Priority: UTM params > referrer detection
  if (utm_source) {
    source_label = utm_source.toLowerCase();
  } else if (referrer) {
    const ref = referrer.toLowerCase();
    if (ref.includes("google.com") || ref.includes("google.com.br")) {
      source_label = utm_medium === "cpc" ? "google-ads" : "google";
    } else if (ref.includes("instagram.com")) {
      source_label = "instagram";
    } else if (ref.includes("facebook.com") || ref.includes("fb.com")) {
      source_label = "facebook";
    } else if (ref.includes("whatsapp") || ref.includes("wa.me") || ref.includes("api.whatsapp")) {
      source_label = "whatsapp";
    } else if (ref.includes("tiktok.com")) {
      source_label = "tiktok";
    } else if (ref.includes("twitter.com") || ref.includes("t.co") || ref.includes("x.com")) {
      source_label = "twitter";
    } else if (ref.includes("pinterest.com")) {
      source_label = "pinterest";
    } else if (ref.includes("youtube.com") || ref.includes("youtu.be")) {
      source_label = "youtube";
    } else if (ref.includes("bing.com")) {
      source_label = "bing";
    } else if (ref.includes("linkedin.com")) {
      source_label = "linkedin";
    } else {
      source_label = "referencia";
    }
  }

  // Detect paid traffic from UTM medium
  if (utm_medium) {
    const medium = utm_medium.toLowerCase();
    if (medium === "cpc" || medium === "ppc" || medium === "paid") {
      if (!source_label.includes("ads")) {
        source_label = source_label + "-ads";
      }
    }
  }

  return { source_label, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer };
}

/**
 * Generates a simple session ID to group visits from the same session.
 */
function getSessionId(): string {
  const key = "visit_session_id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

/**
 * Hook that tracks page visits. Call once at app level.
 */
export function useVisitTracker() {
  useEffect(() => {
    // Don't track admin pages
    if (window.location.pathname.startsWith("/admin")) return;

    // Debounce: don't track the same page twice in 5 seconds
    const lastVisitKey = "last_visit_tracked";
    const lastVisit = sessionStorage.getItem(lastVisitKey);
    const now = Date.now();
    if (lastVisit && now - parseInt(lastVisit) < 5000) return;
    sessionStorage.setItem(lastVisitKey, now.toString());

    const { source_label, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer } = detectSource();
    const session_id = getSessionId();

    supabase.from("page_visits").insert({
      page_path: window.location.pathname + window.location.hash,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      source_label,
      user_agent: navigator.userAgent,
      session_id,
    } as any).then(() => { /* silent */ });
  }, []);
}
