import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads colors and fonts from site_settings and applies them
 * as CSS custom properties on :root so the whole store theme updates live.
 * Only applies on non-admin pages (admin keeps its own dark theme).
 */
const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: settings } = useQuery({
    queryKey: ["site-settings-theme"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["colors", "fonts", "discount_badge"]);
      const map: Record<string, any> = {};
      data?.forEach((s: any) => {
        map[s.key] = s.value;
      });
      return map;
    },
    staleTime: 60000,
  });

  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;

    // Apply colors
    if (settings.colors) {
      const c = settings.colors;
      if (c.primary) root.style.setProperty("--primary", c.primary);
      if (c.secondary) root.style.setProperty("--secondary", c.secondary);
      if (c.background) root.style.setProperty("--background", c.background);
      if (c.foreground) root.style.setProperty("--foreground", c.foreground);
      if (c.accent) root.style.setProperty("--accent", c.accent);
      if (c.muted) root.style.setProperty("--muted", c.muted);
      // Also update ring to match primary
      if (c.primary) root.style.setProperty("--ring", c.primary);
    }

    // Apply discount badge colors
    if (settings.discount_badge) {
      const db = settings.discount_badge;
      if (db.bg) root.style.setProperty("--discount-badge-bg", db.bg);
      if (db.text) root.style.setProperty("--discount-badge-text", db.text);
    }

    // Apply fonts
    if (settings.fonts) {
      const f = settings.fonts;
      if (f.heading) {
        root.style.setProperty("--font-heading", `'${f.heading}', serif`);
        if (f.headingUrl) {
          loadFontFromUrl(f.heading, f.headingUrl);
        } else {
          loadFont(f.heading);
        }
      }
      if (f.body) {
        root.style.setProperty("--font-body", `'${f.body}', sans-serif`);
        if (f.bodyUrl) {
          loadFontFromUrl(f.body, f.bodyUrl);
        } else {
          loadFont(f.body);
        }
      }
    }

    return () => {
      // Cleanup: remove inline styles so defaults from CSS take over
      const props = [
        "--primary", "--secondary", "--background", "--foreground",
        "--accent", "--muted", "--ring", "--font-heading", "--font-body",
        "--discount-badge-bg", "--discount-badge-text",
      ];
      props.forEach((p) => root.style.removeProperty(p));
    };
  }, [settings]);

  return <>{children}</>;
};

function loadFont(fontName: string) {
  const id = `dynamic-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700&display=swap`;
  document.head.appendChild(link);
}

function loadFontFromUrl(fontName: string, url: string) {
  const id = `dynamic-font-custom-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  
  // If it's a Google Fonts URL or any CSS URL, load as stylesheet
  if (url.endsWith(".css") || url.includes("fonts.googleapis.com") || url.includes("fonts.bunny.net")) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = url;
    document.head.appendChild(link);
  } else {
    // Assume it's a direct font file URL (.woff2, .ttf, etc.)
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `@font-face { font-family: '${fontName}'; src: url('${url}') format('woff2'); font-weight: 100 900; font-display: swap; }`;
    document.head.appendChild(style);
  }
}

export default ThemeProvider;
