import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Image, Upload, Trash2, Save, Clock, Zap, GripVertical, Plus, Type, Link2, Eye, Monitor, Smartphone, Maximize, Minimize, AlignLeft, AlignCenter, AlignRight, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

interface BannerItem {
  url: string;
  title: string;
  subtitle: string;
  link: string;
  buttonText: string;
  isActive: boolean;
}

interface MobileSlide {
  url: string;
}

const emptyBanner: BannerItem = { url: "", title: "", subtitle: "", link: "", buttonText: "", isActive: true };

const AdminBanners = () => {
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("*");
      const map: Record<string, any> = {};
      data?.forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const [duration, setDuration] = useState(5000);
  const [speed, setSpeed] = useState(800);
  const [autoplay, setAutoplay] = useState(true);
  const [imageFit, setImageFit] = useState<"cover" | "contain">("cover");
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [mobileSlides, setMobileSlides] = useState<MobileSlide[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadingMobile, setUploadingMobile] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<BannerItem>(emptyBanner);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [mobileDragIdx, setMobileDragIdx] = useState<number | null>(null);

  // Logo settings
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoScale, setLogoScale] = useState(100);
  const [logoAlign, setLogoAlign] = useState<"left" | "center" | "right">("left");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    if (settings?.logo_settings) {
      const ls = settings.logo_settings;
      setLogoUrl(ls.url || "");
      setLogoScale(ls.scale ?? 100);
      setLogoAlign(ls.align || "left");
    }
  }, [settings]);

  useEffect(() => {
    if (!settings?.slideshow) return;
    const s = settings.slideshow;
    setDuration(s.duration || 5000);
    setSpeed(s.speed || 800);
    setAutoplay(s.autoplay !== false);
    setImageFit(s.imageFit || "cover");
    if (s.banners && Array.isArray(s.banners)) {
      setBanners(s.banners.map((b: any) => ({ ...emptyBanner, ...b, mobileUrl: undefined })));
    } else if (s.images && Array.isArray(s.images)) {
      setBanners(s.images.map((url: string) => ({ ...emptyBanner, url })));
    }
    if (s.mobileSlides && Array.isArray(s.mobileSlides)) {
      setMobileSlides(s.mobileSlides);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const value = {
        duration,
        speed,
        autoplay,
        imageFit,
        banners: banners.map(({ url, title, subtitle, link, buttonText, isActive }) => ({ url, title, subtitle, link, buttonText, isActive })),
        images: banners.filter((b) => b.isActive).map((b) => b.url),
        mobileSlides: mobileSlides.map((s) => ({ url: s.url })),
      } as unknown as Record<string, unknown>;

      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "slideshow").single();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value: value as any, updated_at: new Date().toISOString() }).eq("key", "slideshow");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert([{ key: "slideshow", value: value as any }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      qc.invalidateQueries({ queryKey: ["site-settings-slideshow"] });
      toast.success("Banners salvos com sucesso!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // Desktop upload
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `banners/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setBanners((prev) => [...prev, { ...emptyBanner, url: urlData.publicUrl }]);
      toast.success("Imagem adicionada!");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  // Mobile upload
  const handleMobileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingMobile(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `banners/mobile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("product-images").upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        setMobileSlides((prev) => [...prev, { url: urlData.publicUrl }]);
      }
      toast.success("Imagem(ns) mobile adicionada(s)!");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploadingMobile(false);
      e.target.value = "";
    }
  };

  const removeBanner = (index: number) => {
    if (!confirm("Remover este banner?")) return;
    setBanners((prev) => prev.filter((_, i) => i !== index));
  };

  const removeMobileSlide = (index: number) => {
    if (!confirm("Remover este slide mobile?")) return;
    setMobileSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const openEdit = (index: number) => {
    setEditIndex(index);
    setEditForm({ ...banners[index] });
  };

  const saveEdit = () => {
    if (editIndex === null) return;
    setBanners((prev) => prev.map((b, i) => (i === editIndex ? editForm : b)));
    setEditIndex(null);
    toast.success("Banner atualizado! Clique em Salvar para aplicar.");
  };

  // Desktop drag
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setBanners((prev) => {
      const items = [...prev];
      const [moved] = items.splice(dragIdx, 1);
      items.splice(idx, 0, moved);
      return items;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  // Mobile drag
  const handleMobileDragStart = (idx: number) => setMobileDragIdx(idx);
  const handleMobileDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (mobileDragIdx === null || mobileDragIdx === idx) return;
    setMobileSlides((prev) => {
      const items = [...prev];
      const [moved] = items.splice(mobileDragIdx, 1);
      items.splice(idx, 0, moved);
      return items;
    });
    setMobileDragIdx(idx);
  };
  const handleMobileDragEnd = () => setMobileDragIdx(null);

  const handleReplaceImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `banners/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setBanners((prev) => prev.map((b, i) => (i === index ? { ...b, url: urlData.publicUrl } : b)));
      toast.success("Imagem substituída!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    e.target.value = "";
  };

  const handleReplaceMobileImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `banners/mobile-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setMobileSlides((prev) => prev.map((s, i) => (i === index ? { url: urlData.publicUrl } : s)));
      toast.success("Imagem mobile substituída!");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    e.target.value = "";
  };

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `branding/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast.success("Logo enviada!");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  const saveLogoMutation = useMutation({
    mutationFn: async () => {
      const value = { url: logoUrl, scale: logoScale, align: logoAlign } as unknown as Record<string, unknown>;
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "logo_settings").single();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value: value as any, updated_at: new Date().toISOString() }).eq("key", "logo_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert([{ key: "logo_settings", value: value as any }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["site-settings"] });
      qc.invalidateQueries({ queryKey: ["logo-settings"] });
      toast.success("Configurações da logo salvas!");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (isLoading) {
    return <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-card rounded-lg animate-pulse" />)}</div>;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground flex items-center gap-2">
            <Image size={20} /> Banners e Slideshow
          </h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">Gerencie os banners da homepage</p>
        </div>
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1.5">
          <Save size={14} /> {saveMutation.isPending ? "Salvando..." : "Salvar Tudo"}
        </Button>
      </div>

      {/* Slideshow Config */}
      <div className="bg-card rounded-xl p-5 border border-border mb-6">
        <h3 className="font-body text-sm font-semibold text-foreground mb-4">Configurações do Slideshow</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Clock size={12} /> Duração por slide
            </Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={1000} max={30000} step={500} />
            <p className="text-[10px] text-muted-foreground mt-1">{(duration / 1000).toFixed(1)} segundos</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Zap size={12} /> Velocidade da transição
            </Label>
            <Input type="number" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} min={200} max={3000} step={100} />
            <p className="text-[10px] text-muted-foreground mt-1">{(speed / 1000).toFixed(1)} segundos</p>
          </div>
          <div className="flex items-end gap-3 pb-1">
            <Switch checked={autoplay} onCheckedChange={setAutoplay} />
            <div>
              <Label className="text-xs text-foreground">Autoplay</Label>
              <p className="text-[10px] text-muted-foreground">Trocar slides automaticamente</p>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5">
              Ajuste da Imagem
            </Label>
            <div className="flex gap-2">
              <button
                onClick={() => setImageFit("cover")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  imageFit === "cover"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Maximize size={12} /> Preencher
              </button>
              <button
                onClick={() => setImageFit("contain")}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                  imageFit === "contain"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <Minimize size={12} /> Inteira
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {imageFit === "cover" ? "Imagem preenche o espaço (pode cortar)" : "Imagem aparece inteira (pode ter espaço)"}
            </p>
          </div>
        </div>
      </div>

      {/* ===== DESKTOP BANNERS ===== */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Monitor size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="font-body text-sm font-semibold text-foreground">Banners Desktop</h3>
              <p className="font-body text-[10px] text-muted-foreground">Imagens exibidas em telas grandes (tablets e computadores)</p>
            </div>
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 transition-opacity">
              <Plus size={14} /> {uploading ? "Enviando..." : "Adicionar"}
            </span>
          </label>
        </div>

        {banners.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Monitor size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="font-body text-xs text-muted-foreground">Nenhum banner desktop. Os padrão serão usados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {banners.map((banner, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`rounded-lg border border-border p-2.5 flex gap-3 items-center transition-all ${
                  dragIdx === idx ? "opacity-50 scale-[0.98]" : ""
                } ${!banner.isActive ? "opacity-50" : ""}`}
              >
                <GripVertical size={14} className="text-muted-foreground cursor-grab shrink-0" />
                <div className="relative w-28 h-16 rounded-md overflow-hidden bg-secondary/30 shrink-0 group">
                  <img src={banner.url} alt={`Banner ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                    <button onClick={() => setPreviewIndex(idx)} className="w-7 h-7 rounded-full bg-card/90 flex items-center justify-center text-foreground hover:bg-card">
                      <Eye size={12} />
                    </button>
                    <label className="w-7 h-7 rounded-full bg-card/90 flex items-center justify-center text-foreground hover:bg-card cursor-pointer">
                      <Upload size={12} />
                      <input type="file" accept="image/*" onChange={(e) => handleReplaceImage(idx, e)} className="hidden" />
                    </label>
                  </div>
                  <span className="absolute bottom-0.5 left-0.5 bg-foreground/60 text-background text-[8px] font-mono px-1 rounded">#{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-xs font-medium text-foreground truncate">{banner.title || `Banner ${idx + 1}`}</p>
                  {banner.link && (
                    <p className="font-body text-[10px] text-primary truncate flex items-center gap-1"><Link2 size={9} /> {banner.link}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(idx)} title="Editar"><Type size={12} /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeBanner(idx)} title="Remover"><Trash2 size={12} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== MOBILE BANNERS ===== */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/80 flex items-center justify-center">
              <Smartphone size={16} className="text-accent-foreground" />
            </div>
            <div>
              <h3 className="font-body text-sm font-semibold text-foreground">Banners Mobile</h3>
              <p className="font-body text-[10px] text-muted-foreground">Imagens exibidas em celulares. Se vazio, os banners desktop serão usados.</p>
            </div>
          </div>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" multiple onChange={handleMobileUpload} className="hidden" />
            <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 transition-opacity">
              <Plus size={14} /> {uploadingMobile ? "Enviando..." : "Adicionar"}
            </span>
          </label>
        </div>

        {mobileSlides.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Smartphone size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="font-body text-xs text-muted-foreground">Nenhum banner mobile configurado.</p>
            <p className="font-body text-[10px] text-muted-foreground mt-1">Os banners desktop serão exibidos no celular.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {mobileSlides.map((slide, idx) => (
              <div
                key={idx}
                draggable
                onDragStart={() => handleMobileDragStart(idx)}
                onDragOver={(e) => handleMobileDragOver(e, idx)}
                onDragEnd={handleMobileDragEnd}
                className={`relative rounded-lg overflow-hidden border border-border bg-secondary/20 group cursor-grab transition-all ${
                  mobileDragIdx === idx ? "opacity-50 scale-95" : ""
                }`}
              >
                <div className="aspect-[9/16]">
                  <img src={slide.url} alt={`Mobile ${idx + 1}`} className="w-full h-full object-cover" />
                </div>
                <span className="absolute top-1 left-1 bg-foreground/60 text-background text-[8px] font-mono px-1 rounded">#{idx + 1}</span>
                <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <label className="w-8 h-8 rounded-full bg-card/90 flex items-center justify-center text-foreground hover:bg-card cursor-pointer">
                    <Upload size={14} />
                    <input type="file" accept="image/*" onChange={(e) => handleReplaceMobileImage(idx, e)} className="hidden" />
                  </label>
                  <button onClick={() => removeMobileSlide(idx)} className="w-8 h-8 rounded-full bg-card/90 flex items-center justify-center text-destructive hover:bg-card">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== LOGO DO SITE ===== */}
      <div className="bg-card rounded-xl border border-border p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ImageIcon size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="font-body text-sm font-semibold text-foreground">Logo do Site</h3>
              <p className="font-body text-[10px] text-muted-foreground">Troque a logo, ajuste tamanho e alinhamento no cabeçalho</p>
            </div>
          </div>
          <Button size="sm" onClick={() => saveLogoMutation.mutate()} disabled={saveLogoMutation.isPending} className="gap-1.5">
            <Save size={14} /> {saveLogoMutation.isPending ? "Salvando..." : "Salvar Logo"}
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Logo preview & upload */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Logo Atual</Label>
            <div className="rounded-lg border border-border bg-secondary/20 p-6 flex items-center min-h-[120px]"
              style={{ justifyContent: logoAlign === "left" ? "flex-start" : logoAlign === "right" ? "flex-end" : "center" }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo preview"
                  className="max-h-32 w-auto"
                  style={{ transform: `scale(${logoScale / 100})`, transformOrigin: logoAlign === "left" ? "left center" : logoAlign === "right" ? "right center" : "center center" }}
                />
              ) : (
                <div className="text-center">
                  <ImageIcon size={40} className="mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">Usando logo padrão do código</p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <label className="cursor-pointer flex-1">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                <span className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground font-body text-xs font-medium hover:opacity-90 transition-opacity w-full">
                  <Upload size={14} /> {uploadingLogo ? "Enviando..." : logoUrl ? "Trocar Logo" : "Enviar Logo"}
                </span>
              </label>
              {logoUrl && (
                <Button variant="outline" size="sm" onClick={() => { setLogoUrl(""); toast.info("Logo removida. Salve para aplicar."); }}>
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          </div>

          {/* Logo settings */}
          <div className="space-y-5">
            {/* Alignment */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Alinhamento no Cabeçalho</Label>
              <div className="flex gap-2">
                {([
                  { value: "left" as const, icon: AlignLeft, label: "Esquerda" },
                  { value: "center" as const, icon: AlignCenter, label: "Centro" },
                  { value: "right" as const, icon: AlignRight, label: "Direita" },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setLogoAlign(opt.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                      logoAlign === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <opt.icon size={14} /> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-muted-foreground">Tamanho da Logo</Label>
                <span className="text-xs font-mono font-semibold text-foreground">{logoScale}%</span>
              </div>
              <Slider
                value={[logoScale]}
                onValueChange={(v) => setLogoScale(v[0])}
                min={50}
                max={200}
                step={5}
              />
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">50%</span>
                <span className="text-[10px] text-muted-foreground font-medium">100% (original)</span>
                <span className="text-[10px] text-muted-foreground">200%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal (desktop banners only) */}
      <Dialog open={editIndex !== null} onOpenChange={(o) => { if (!o) setEditIndex(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Banner #{(editIndex ?? 0) + 1}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editForm.url && (
              <div className="rounded-lg overflow-hidden aspect-video bg-secondary/30 relative">
                <img src={editForm.url} alt="Preview" className="w-full h-full object-cover" />
                {(editForm.title || editForm.subtitle) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent flex flex-col justify-end p-4">
                    {editForm.title && <p className="text-background font-semibold text-lg">{editForm.title}</p>}
                    {editForm.subtitle && <p className="text-background/80 text-sm">{editForm.subtitle}</p>}
                    {editForm.buttonText && (
                      <span className="mt-2 inline-block w-fit px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-medium">
                        {editForm.buttonText}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Título (overlay)</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="Ex: Nova Coleção" />
            </div>
            <div>
              <Label className="text-xs">Subtítulo</Label>
              <Textarea value={editForm.subtitle} onChange={(e) => setEditForm({ ...editForm, subtitle: e.target.value })} placeholder="Ex: Descubra as novidades" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Texto do botão</Label>
                <Input value={editForm.buttonText} onChange={(e) => setEditForm({ ...editForm, buttonText: e.target.value })} placeholder="Ex: Ver mais" />
              </div>
              <div>
                <Label className="text-xs">Link</Label>
                <Input value={editForm.link} onChange={(e) => setEditForm({ ...editForm, link: e.target.value })} placeholder="/colecao" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editForm.isActive} onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })} />
              <Label className="text-xs">{editForm.isActive ? "Visível no site" : "Oculto"}</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditIndex(null)}>Cancelar</Button>
              <Button size="sm" onClick={saveEdit}>Aplicar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewIndex !== null} onOpenChange={(o) => { if (!o) setPreviewIndex(null); }}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {previewIndex !== null && banners[previewIndex] && (
            <div className="relative aspect-video">
              <img src={banners[previewIndex].url} alt="Preview" className="w-full h-full object-cover" />
              {(banners[previewIndex].title || banners[previewIndex].subtitle) && (
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent flex flex-col justify-end p-8">
                  {banners[previewIndex].title && (
                    <p className="text-background font-bold text-3xl">{banners[previewIndex].title}</p>
                  )}
                  {banners[previewIndex].subtitle && (
                    <p className="text-background/80 text-lg mt-1">{banners[previewIndex].subtitle}</p>
                  )}
                  {banners[previewIndex].buttonText && (
                    <span className="mt-3 inline-block w-fit px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
                      {banners[previewIndex].buttonText}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBanners;
