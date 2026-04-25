import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Paintbrush, Type, Palette, Image, Save, Upload, Trash2, Clock, Zap, Plus, X } from "lucide-react";
import { STORE_COLOR_PRESETS } from "@/data/colorPresets";
import { compressImage } from "@/lib/imageCompression";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FONT_OPTIONS = [
  "Playfair Display", "Montserrat", "Inter", "Lora", "Raleway", "Poppins",
  "Roboto", "Open Sans", "Oswald", "Merriweather", "Crimson Text", "DM Sans",
  "Nunito", "Libre Baskerville", "Cormorant Garamond", "Jost",
];

const THEME_PRESETS = [
  { name: "Rosa Champagne", primary: "14 45% 68%", secondary: "15 53% 94%", accent: "15 53% 94%" },
  { name: "Dourado Luxo", primary: "43 74% 49%", secondary: "43 30% 92%", accent: "43 30% 92%" },
  { name: "Azul Marinho", primary: "220 60% 40%", secondary: "220 25% 93%", accent: "220 25% 93%" },
  { name: "Verde Oliva", primary: "85 30% 45%", secondary: "85 20% 92%", accent: "85 20% 92%" },
  { name: "Terracota", primary: "15 55% 55%", secondary: "15 40% 93%", accent: "15 40% 93%" },
  { name: "Roxo Elegante", primary: "280 40% 55%", secondary: "280 25% 93%", accent: "280 25% 93%" },
  { name: "🇧🇷 Brasil Copa", primary: "152 100% 31%", secondary: "51 100% 50%", accent: "220 100% 23%" },
  { name: "🇧🇷 Canarinho", primary: "51 100% 50%", secondary: "152 100% 31%", accent: "51 80% 93%" },
  { name: "🇧🇷 Seleção Azul", primary: "220 100% 23%", secondary: "51 100% 50%", accent: "220 40% 92%" },
];

// Preset solid colors for brand kit
const SOLID_PRESETS = [
  "#000000", "#333333", "#666666", "#999999", "#CCCCCC", "#FFFFFF",
  "#FF0000", "#FF3366", "#FF00AA", "#CC66FF", "#9933FF", "#6600CC",
  "#00CC66", "#00AA88", "#00CCCC", "#0099FF", "#3366FF", "#000099",
  "#006644", "#00DDAA", "#66FFCC", "#FFCC00", "#FF9900", "#FF6600",
  // Gradients represented as first color
  "#FF6B6B", "#EE5A24", "#F8B500", "#78E08F", "#38ADA9", "#0984E3",
];

// Convert hex to HSL string
function hexToHsl(hex: string): string {
  let r = 0, g = 0, b = 0;
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16) / 255;
    g = parseInt(hex[1] + hex[1], 16) / 255;
    b = parseInt(hex[2] + hex[2], 16) / 255;
  } else {
    r = parseInt(hex.substring(0, 2), 16) / 255;
    g = parseInt(hex.substring(2, 4), 16) / 255;
    b = parseInt(hex.substring(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function hslToHex(hslStr: string): string {
  const parts = hslStr.match(/(\d+)\s+(\d+)%?\s+(\d+)%?/);
  if (!parts) return "#000000";
  const h = parseInt(parts[1]) / 360;
  const s = parseInt(parts[2]) / 100;
  const l = parseInt(parts[3]) / 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  const toHex = (c: number) => Math.round(c * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const AdminDesigner = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"slideshow" | "fonts" | "colors">("slideshow");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  // Slideshow state
  const [slideDuration, setSlideDuration] = useState(5000);
  const [slideSpeed, setSlideSpeed] = useState(800);
  const [bannerImages, setBannerImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Fonts state
  const [headingFont, setHeadingFont] = useState("Playfair Display");
  const [headingFontUrl, setHeadingFontUrl] = useState("");
  const [bodyFont, setBodyFont] = useState("Montserrat");
  const [bodyFontUrl, setBodyFontUrl] = useState("");

  // Colors state
  const [colors, setColors] = useState({
    primary: "14 45% 68%",
    secondary: "15 53% 94%",
    background: "0 0% 98%",
    foreground: "0 0% 10%",
    accent: "15 53% 94%",
    muted: "15 20% 94%",
  });

  // Discount badge config
  const [discountBadge, setDiscountBadge] = useState({
    bg: "0 84% 60%",
    text: "0 0% 100%",
  });

  // Brand colors (saved custom colors)
  const [brandColors, setBrandColors] = useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customHex, setCustomHex] = useState("#1B1B1B");
  const [editingColorKey, setEditingColorKey] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    if (settings.slideshow) {
      setSlideDuration(settings.slideshow.duration || 5000);
      setSlideSpeed(settings.slideshow.speed || 800);
      setBannerImages(settings.slideshow.images || []);
    }
    if (settings.fonts) {
      setHeadingFont(settings.fonts.heading || "Playfair Display");
      setHeadingFontUrl(settings.fonts.headingUrl || "");
      setBodyFont(settings.fonts.body || "Montserrat");
      setBodyFontUrl(settings.fonts.bodyUrl || "");
    }
    if (settings.colors) {
      setColors((prev) => ({ ...prev, ...settings.colors }));
    }
    if (settings.discount_badge) {
      setDiscountBadge((prev) => ({ ...prev, ...settings.discount_badge }));
    }
    if (settings.brand_colors) {
      setBrandColors(settings.brand_colors || []);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ key, value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings-theme"] });
      toast.success("Configuração salva! As mudanças serão aplicadas no site.");
    },
    onError: () => toast.error("Erro ao salvar."),
  });

  const handleSaveSlideshow = () => {
    saveMutation.mutate({ key: "slideshow", value: { duration: slideDuration, speed: slideSpeed, images: bannerImages } });
  };

  const handleSaveFonts = () => {
    saveMutation.mutate({ key: "fonts", value: { heading: headingFont, headingUrl: headingFontUrl, body: bodyFont, bodyUrl: bodyFontUrl } });
  };

  const handleSaveColors = () => {
    saveMutation.mutate({ key: "colors", value: colors });
    saveMutation.mutate({ key: "discount_badge", value: discountBadge });
    saveMutation.mutate({ key: "brand_colors", value: brandColors });
  };

  const handleUploadBanner = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop();
      const path = `banners/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, compressed, { contentType: compressed.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setBannerImages((prev) => [...prev, urlData.publicUrl]);
      toast.success("Banner adicionado!");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeBanner = (index: number) => {
    setBannerImages((prev) => prev.filter((_, i) => i !== index));
  };

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    setColors((prev) => ({ ...prev, primary: preset.primary, secondary: preset.secondary, accent: preset.accent }));
    toast.success(`Paleta "${preset.name}" aplicada!`);
  };

  const applySolidToKey = (hex: string) => {
    if (editingColorKey) {
      setColors((prev) => ({ ...prev, [editingColorKey]: hexToHsl(hex) }));
      setEditingColorKey(null);
      toast.success("Cor aplicada!");
    }
  };

  const addBrandColor = () => {
    if (brandColors.includes(customHex)) {
      toast.error("Cor já existe no kit.");
      return;
    }
    setBrandColors((prev) => [...prev, customHex]);
    setShowColorPicker(false);
    toast.success("Cor adicionada ao kit de marca!");
  };

  const removeBrandColor = (hex: string) => {
    setBrandColors((prev) => prev.filter((c) => c !== hex));
  };

  if (isLoading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card rounded-lg animate-pulse" />)}</div>;
  }

  const tabs = [
    { key: "slideshow" as const, label: "Slideshow / Banners", icon: Image },
    { key: "fonts" as const, label: "Tipografia", icon: Type },
    { key: "colors" as const, label: "Paleta de Cores", icon: Palette },
  ];

  const colorKeyLabels: Record<string, string> = {
    primary: "Primária",
    secondary: "Secundária",
    background: "Fundo",
    foreground: "Texto",
    accent: "Destaque",
    muted: "Suave",
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-body text-xl font-bold text-foreground flex items-center gap-2">
          <Paintbrush size={20} /> Designer
        </h2>
        <p className="font-body text-xs text-muted-foreground mt-0.5">Personalize a aparência da sua loja</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${
              activeTab === t.key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Slideshow Tab */}
      {activeTab === "slideshow" && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl p-6 border border-border space-y-5">
            <h3 className="font-body text-base font-semibold text-foreground">Configurações do Slideshow</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-body text-muted-foreground flex items-center gap-1.5 mb-1.5"><Clock size={12} /> Duração por slide (ms)</Label>
                <Input type="number" value={slideDuration} onChange={(e) => setSlideDuration(Number(e.target.value))} min={1000} max={30000} step={500} />
                <p className="text-[10px] text-muted-foreground mt-1">{(slideDuration / 1000).toFixed(1)}s entre cada slide</p>
              </div>
              <div>
                <Label className="text-xs font-body text-muted-foreground flex items-center gap-1.5 mb-1.5"><Zap size={12} /> Velocidade da transição (ms)</Label>
                <Input type="number" value={slideSpeed} onChange={(e) => setSlideSpeed(Number(e.target.value))} min={200} max={3000} step={100} />
                <p className="text-[10px] text-muted-foreground mt-1">{(slideSpeed / 1000).toFixed(1)}s para trocar</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-body text-base font-semibold text-foreground">Imagens dos Banners</h3>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" onChange={handleUploadBanner} className="hidden" />
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90">
                  <Upload size={14} /> {uploading ? "Enviando..." : "Adicionar"}
                </span>
              </label>
            </div>

            {bannerImages.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground font-body text-sm">
                Nenhum banner customizado. Banners padrão serão usados.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {bannerImages.map((img, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-video bg-secondary/30">
                    <img src={img} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeBanner(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                    <span className="absolute bottom-2 left-2 bg-foreground/60 text-background text-[10px] font-mono px-1.5 py-0.5 rounded">
                      #{i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSaveSlideshow} disabled={saveMutation.isPending} className="gap-2">
            <Save size={16} /> Salvar Slideshow
          </Button>
        </div>
      )}

      {/* Fonts Tab */}
      {activeTab === "fonts" && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl p-6 border border-border space-y-5">
            <h3 className="font-body text-base font-semibold text-foreground">Tipografia</h3>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-body text-muted-foreground mb-1.5">Fonte de Títulos</Label>
                  <select
                    value={FONT_OPTIONS.includes(headingFont) ? headingFont : "__custom__"}
                    onChange={(e) => { if (e.target.value !== "__custom__") { setHeadingFont(e.target.value); setHeadingFontUrl(""); } else { setHeadingFont(""); } }}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary"
                  >
                    {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                    <option value="__custom__">✏️ Fonte personalizada...</option>
                  </select>
                </div>
                {(!FONT_OPTIONS.includes(headingFont) || headingFontUrl) && (
                  <div className="space-y-2 p-3 bg-secondary/30 rounded-lg border border-border">
                    <div>
                      <Label className="text-[10px] font-body text-muted-foreground mb-1">Nome da fonte</Label>
                      <Input value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} placeholder="Ex: Bebas Neue" />
                    </div>
                    <div>
                      <Label className="text-[10px] font-body text-muted-foreground mb-1">URL da fonte (Google Fonts, .woff2, .ttf)</Label>
                      <Input value={headingFontUrl} onChange={(e) => setHeadingFontUrl(e.target.value)} placeholder="https://fonts.googleapis.com/css2?family=..." />
                    </div>
                    <p className="text-[9px] text-muted-foreground">Cole a URL do Google Fonts ou de um arquivo .woff2 / .ttf</p>
                  </div>
                )}
                <div className="p-4 bg-secondary/20 rounded-lg border border-border">
                  <p className="text-xl text-foreground" style={{ fontFamily: `'${headingFont}', serif` }}>Título de Exemplo</p>
                  <p className="text-sm text-muted-foreground mt-1" style={{ fontFamily: `'${headingFont}', serif` }}>Subtítulo da página</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-body text-muted-foreground mb-1.5">Fonte do Corpo</Label>
                  <select
                    value={FONT_OPTIONS.includes(bodyFont) ? bodyFont : "__custom__"}
                    onChange={(e) => { if (e.target.value !== "__custom__") { setBodyFont(e.target.value); setBodyFontUrl(""); } else { setBodyFont(""); } }}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary"
                  >
                    {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                    <option value="__custom__">✏️ Fonte personalizada...</option>
                  </select>
                </div>
                {(!FONT_OPTIONS.includes(bodyFont) || bodyFontUrl) && (
                  <div className="space-y-2 p-3 bg-secondary/30 rounded-lg border border-border">
                    <div>
                      <Label className="text-[10px] font-body text-muted-foreground mb-1">Nome da fonte</Label>
                      <Input value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} placeholder="Ex: Nunito Sans" />
                    </div>
                    <div>
                      <Label className="text-[10px] font-body text-muted-foreground mb-1">URL da fonte (Google Fonts, .woff2, .ttf)</Label>
                      <Input value={bodyFontUrl} onChange={(e) => setBodyFontUrl(e.target.value)} placeholder="https://fonts.googleapis.com/css2?family=..." />
                    </div>
                    <p className="text-[9px] text-muted-foreground">Cole a URL do Google Fonts ou de um arquivo .woff2 / .ttf</p>
                  </div>
                )}
                <div className="p-4 bg-secondary/20 rounded-lg border border-border">
                  <p className="text-sm text-foreground" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
                    Este é um texto de exemplo para o corpo da página.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleSaveFonts} disabled={saveMutation.isPending} className="gap-2">
            <Save size={16} /> Salvar Tipografia
          </Button>
        </div>
      )}

      {/* Colors Tab */}
      {activeTab === "colors" && (
        <div className="space-y-6">
          {/* Brand Kit Colors */}
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-body text-base font-semibold text-foreground flex items-center gap-2">🎨 Kit de Marca</h3>
                <p className="font-body text-xs text-muted-foreground mt-0.5">Suas cores personalizadas para usar no site e nos produtos</p>
              </div>
              <button
                onClick={() => setShowColorPicker(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary border border-border text-foreground font-body text-xs font-medium hover:bg-secondary/80 transition-colors"
              >
                <Plus size={14} /> Nova Cor
              </button>
            </div>

            {brandColors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {brandColors.map((hex) => (
                  <div key={hex} className="relative group">
                    <button
                      className="w-10 h-10 rounded-full border-2 border-border hover:border-primary transition-all hover:scale-110"
                      style={{ backgroundColor: hex }}
                      title={hex}
                    />
                    <button
                      onClick={() => removeBrandColor(hex)}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {brandColors.length === 0 && !showColorPicker && (
              <div className="space-y-2">
                <p className="text-center py-2 text-muted-foreground font-body text-sm">
                  Nenhuma cor personalizada. Use as cores pré-definidas abaixo ou clique em "Nova Cor".
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STORE_COLOR_PRESETS.filter(c => c.hex !== "#MULTI").map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => { setBrandColors(prev => [...prev, preset.hex]); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] font-body hover:border-primary transition-all"
                      title={`Adicionar ${preset.name}`}
                    >
                      <span className="w-3 h-3 rounded-full border border-border shrink-0" style={{ backgroundColor: preset.hex }} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Picker Popup */}
            {showColorPicker && (
              <div className="bg-secondary/50 rounded-xl p-4 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-body text-sm font-semibold text-foreground">Escolher Cor</p>
                  <button onClick={() => setShowColorPicker(false)} className="text-muted-foreground hover:text-foreground">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customHex}
                    onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                    className="w-16 h-16 rounded-xl border-2 border-border cursor-pointer bg-transparent"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg border border-border" style={{ backgroundColor: customHex }} />
                      <Input
                        value={customHex}
                        onChange={(e) => setCustomHex(e.target.value.toUpperCase())}
                        className="font-mono text-sm flex-1"
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                    <p className="font-body text-[10px] text-muted-foreground">HSL: {hexToHsl(customHex)}</p>
                  </div>
                </div>
                <Button onClick={addBrandColor} size="sm" className="w-full gap-1.5">
                  <Plus size={14} /> Adicionar ao Kit
                </Button>
              </div>
            )}
          </div>

          {/* Solid Color Presets */}
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-body text-base font-semibold text-foreground">🎯 Cores Sólidas Padrão</h3>
              {editingColorKey && (
                <span className="text-xs font-body text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                  Aplicando em: {colorKeyLabels[editingColorKey]}
                </span>
              )}
            </div>
            {!editingColorKey && (
              <p className="font-body text-xs text-muted-foreground">Clique em uma cor do tema abaixo e depois selecione uma cor sólida para aplicar.</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {SOLID_PRESETS.map((hex) => (
                <button
                  key={hex}
                  onClick={() => editingColorKey ? applySolidToKey(hex) : null}
                  className={`w-8 h-8 rounded-full border transition-all ${
                    editingColorKey
                      ? "border-border hover:scale-125 hover:border-primary cursor-pointer hover:shadow-lg"
                      : "border-border/50 opacity-60 cursor-default"
                  }`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
              {/* Brand colors also clickable */}
              {brandColors.map((hex) => (
                <button
                  key={`brand-${hex}`}
                  onClick={() => editingColorKey ? applySolidToKey(hex) : null}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    editingColorKey
                      ? "border-primary hover:scale-125 cursor-pointer hover:shadow-lg"
                      : "border-primary/50 opacity-60 cursor-default"
                  }`}
                  style={{ backgroundColor: hex }}
                  title={`Kit: ${hex}`}
                />
              ))}
            </div>
          </div>

          {/* Theme Colors */}
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <h3 className="font-body text-base font-semibold text-foreground">🎨 Cores do Tema</h3>
            <p className="font-body text-xs text-muted-foreground">Clique em uma cor para editá-la com o seletor acima, ou digite o valor HSL manualmente.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(colors).map(([key, value]) => (
                <div key={key}>
                  <Label className="text-xs font-body text-muted-foreground capitalize mb-1.5">{colorKeyLabels[key] || key}</Label>
                  <div className="flex gap-2 items-center">
                    <button
                      onClick={() => setEditingColorKey(editingColorKey === key ? null : key)}
                      className={`w-10 h-10 rounded-lg border-2 shrink-0 transition-all cursor-pointer ${
                        editingColorKey === key
                          ? "border-primary ring-2 ring-primary/30 scale-110"
                          : "border-border hover:border-primary/50"
                      }`}
                      style={{ backgroundColor: `hsl(${value})` }}
                      title="Clique para editar com as cores acima"
                    />
                    <div className="flex-1 space-y-1">
                      <Input
                        value={value}
                        onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                        placeholder="H S% L%"
                        className="font-mono text-xs"
                      />
                      <p className="font-body text-[9px] text-muted-foreground">{hslToHex(value)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Theme Presets */}
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <h3 className="font-body text-base font-semibold text-foreground">✨ Paletas Pré-definidas</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="p-3 rounded-lg border border-border hover:border-primary transition-colors text-left"
                >
                  <div className="flex gap-1 mb-2">
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `hsl(${preset.primary})` }} />
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `hsl(${preset.secondary})` }} />
                    <div className="w-6 h-6 rounded-full" style={{ backgroundColor: `hsl(${preset.accent})` }} />
                  </div>
                  <p className="font-body text-xs font-medium text-foreground">{preset.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Discount Badge Config */}
          <div className="bg-card rounded-xl p-6 border border-border space-y-4">
            <h3 className="font-body text-base font-semibold text-foreground">🏷️ Badge de Desconto</h3>
            <p className="font-body text-xs text-muted-foreground">Personalize a aparência do selo de desconto exibido nos cards de produtos.</p>
            
            <div className="flex items-center gap-6">
              {/* Preview */}
              <div className="flex flex-col items-center gap-2">
                <span
                  className="text-[11px] font-body font-bold px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: `hsl(${discountBadge.bg})`,
                    color: `hsl(${discountBadge.text})`,
                  }}
                >
                  -15%
                </span>
                <p className="font-body text-[10px] text-muted-foreground">Preview</p>
              </div>

              <div className="flex-1 grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-body text-muted-foreground mb-1.5">Cor de Fundo</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={hslToHex(discountBadge.bg)}
                      onChange={(e) => setDiscountBadge(prev => ({ ...prev, bg: hexToHsl(e.target.value) }))}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                    />
                    <div className="flex-1 space-y-1">
                      <Input
                        value={discountBadge.bg}
                        onChange={(e) => setDiscountBadge(prev => ({ ...prev, bg: e.target.value }))}
                        placeholder="H S% L%"
                        className="font-mono text-xs"
                      />
                      <p className="font-body text-[9px] text-muted-foreground">{hslToHex(discountBadge.bg)}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-body text-muted-foreground mb-1.5">Cor do Texto</Label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={hslToHex(discountBadge.text)}
                      onChange={(e) => setDiscountBadge(prev => ({ ...prev, text: hexToHsl(e.target.value) }))}
                      className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                    />
                    <div className="flex-1 space-y-1">
                      <Input
                        value={discountBadge.text}
                        onChange={(e) => setDiscountBadge(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="H S% L%"
                        className="font-mono text-xs"
                      />
                      <p className="font-body text-[9px] text-muted-foreground">{hslToHex(discountBadge.text)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick presets for badge */}
            <div className="space-y-2">
              <p className="font-body text-xs text-muted-foreground">Cores rápidas:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: "Vermelho", bg: "0 84% 60%", text: "0 0% 100%" },
                  { name: "Verde", bg: "152 69% 31%", text: "0 0% 100%" },
                  { name: "Amarelo", bg: "45 100% 51%", text: "0 0% 10%" },
                  { name: "Preto", bg: "0 0% 10%", text: "0 0% 100%" },
                  { name: "Rosa", bg: "340 82% 52%", text: "0 0% 100%" },
                  { name: "Laranja", bg: "24 95% 53%", text: "0 0% 100%" },
                  { name: "Roxo", bg: "270 50% 40%", text: "0 0% 100%" },
                  { name: "Azul", bg: "220 80% 50%", text: "0 0% 100%" },
                ].map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setDiscountBadge({ bg: p.bg, text: p.text })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border hover:border-primary transition-colors text-[11px] font-body"
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-border/50"
                      style={{ backgroundColor: `hsl(${p.bg})` }}
                    />
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border space-y-3">
            <h3 className="font-body text-base font-semibold text-foreground">👀 Pré-visualização</h3>
            <div className="rounded-lg border border-border overflow-hidden" style={{ backgroundColor: `hsl(${colors.background})` }}>
              <div className="p-4" style={{ backgroundColor: `hsl(${colors.primary})` }}>
                <p className="text-sm font-semibold" style={{ color: "white" }}>Header com cor Primária</p>
              </div>
              <div className="p-4 space-y-2">
                <p className="text-lg font-bold" style={{ color: `hsl(${colors.foreground})` }}>Título do Produto</p>
                <p className="text-sm" style={{ color: `hsl(${colors.muted})` }}>Descrição do produto em tom suave</p>
                <div className="flex gap-2">
                  <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: `hsl(${colors.secondary})`, color: `hsl(${colors.foreground})` }}>Categoria</span>
                  <span className="px-3 py-1 rounded-full text-xs" style={{ backgroundColor: `hsl(${colors.accent})`, color: `hsl(${colors.foreground})` }}>Destaque</span>
                </div>
                <button className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: `hsl(${colors.primary})`, color: "white" }}>Adicionar ao Carrinho</button>
              </div>
            </div>
          </div>

          <Button onClick={handleSaveColors} disabled={saveMutation.isPending} className="gap-2">
            <Save size={16} /> Salvar Paleta de Cores
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminDesigner;
