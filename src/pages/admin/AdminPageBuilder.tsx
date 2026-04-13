import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Layers, Save, Plus, Trash2, Eye, EyeOff, GripVertical, ChevronDown, ChevronUp,
  Type, Image, ShoppingBag, Info, MapPin, Layout, PanelTop, PanelBottom,
  Pencil, X, Copy, Move, Settings2, Columns, AlignLeft, AlignCenter,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ---- Section type definitions ----
interface SectionConfig {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  props: Record<string, any>;
}

interface PageConfig {
  sections: SectionConfig[];
  header: Record<string, any>;
  footer: Record<string, any>;
}

const SECTION_TEMPLATES = [
  {
    type: "hero",
    label: "Hero / Slideshow",
    icon: Image,
    description: "Banner principal com imagens em destaque",
    defaultProps: { title: "", subtitle: "", buttonText: "Ver Produtos", buttonLink: "#produtos", overlay: true, height: "70vh" },
  },
  {
    type: "featured_products",
    label: "Produtos em Destaque",
    icon: ShoppingBag,
    description: "Grade de produtos destaque",
    defaultProps: { title: "Destaques", limit: 8, showPrice: true, columns: 4 },
  },
  {
    type: "all_products",
    label: "Todos os Produtos",
    icon: ShoppingBag,
    description: "Listagem completa dos produtos com filtros",
    defaultProps: { title: "Nossos Produtos", showFilters: true, columns: 4 },
  },
  {
    type: "text_block",
    label: "Bloco de Texto",
    icon: Type,
    description: "Título, subtítulo e texto livre",
    defaultProps: { title: "Título da Seção", subtitle: "", body: "Conteúdo do texto aqui...", alignment: "center", bgColor: "transparent" },
  },
  {
    type: "banner",
    label: "Banner / CTA",
    icon: Image,
    description: "Imagem com texto e botão de ação",
    defaultProps: { imageUrl: "", title: "Confira as Novidades", subtitle: "", buttonText: "Saiba Mais", buttonLink: "/", bgColor: "", textColor: "" },
  },
  {
    type: "about",
    label: "Sobre / Institucional",
    icon: Info,
    description: "Seção sobre a marca",
    defaultProps: { title: "Sobre Nós", body: "Conte sua história aqui...", imageUrl: "", layout: "text-left" },
  },
  {
    type: "gallery",
    label: "Galeria de Imagens",
    icon: Image,
    description: "Grid de imagens com efeito hover",
    defaultProps: { title: "Galeria", images: [], columns: 3, gap: 4 },
  },
  {
    type: "spacer",
    label: "Espaçador",
    icon: Move,
    description: "Espaço vertical entre seções",
    defaultProps: { height: 48 },
  },
  {
    type: "two_columns",
    label: "Duas Colunas",
    icon: Columns,
    description: "Conteúdo dividido em duas colunas",
    defaultProps: { leftTitle: "Coluna Esquerda", leftBody: "", rightTitle: "Coluna Direita", rightBody: "", imageUrl: "", imagePosition: "right" },
  },
];

const DEFAULT_PAGE_CONFIG: PageConfig = {
  sections: [
    { id: "hero-default", type: "hero", title: "Hero / Slideshow", visible: true, props: SECTION_TEMPLATES[0].defaultProps },
    { id: "featured-default", type: "featured_products", title: "Produtos em Destaque", visible: true, props: SECTION_TEMPLATES[1].defaultProps },
    { id: "all-default", type: "all_products", title: "Todos os Produtos", visible: true, props: SECTION_TEMPLATES[2].defaultProps },
  ],
  header: {
    showLogo: true,
    showSearch: true,
    showCart: true,
    showAccount: true,
    sticky: true,
    bgOpacity: 95,
  },
  footer: {
    showAbout: true,
    aboutText: "Vitrine Charmosa - Moda feminina com estilo e elegância.",
    showLinks: true,
    showPayments: true,
    showSocial: true,
    instagramUrl: "",
    whatsappUrl: "",
    copyrightText: "© 2025 Vitrine Charmosa. Todos os direitos reservados.",
  },
};

// ---- Section Editor Component ----
const SectionEditor = ({
  section, onChange, onDelete, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  section: SectionConfig;
  onChange: (updated: SectionConfig) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const template = SECTION_TEMPLATES.find((t) => t.type === section.type);
  const Icon = template?.icon || Layers;

  const updateProp = (key: string, value: any) => {
    onChange({ ...section, props: { ...section.props, [key]: value } });
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground";

  return (
    <div className={`rounded-xl border transition-all ${section.visible ? "border-border bg-card" : "border-border/50 bg-card/50 opacity-60"}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <GripVertical size={16} className="text-muted-foreground cursor-grab shrink-0" />
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            className="font-body text-sm font-medium text-foreground bg-transparent border-none outline-none w-full"
          />
          <p className="font-body text-[10px] text-muted-foreground">{template?.description}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20">
            <ChevronUp size={14} />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20">
            <ChevronDown size={14} />
          </button>
          <button
            onClick={() => onChange({ ...section, visible: !section.visible })}
            className={`p-1 rounded transition-colors ${section.visible ? "text-foreground" : "text-muted-foreground"}`}
          >
            {section.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className={`p-1 rounded transition-colors ${expanded ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            <Settings2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1 rounded text-muted-foreground hover:text-destructive">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Expanded props editor */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-3 bg-secondary/20">
          {section.type === "hero" && (
            <>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título overlay</Label>
                <input value={section.props.title || ""} onChange={(e) => updateProp("title", e.target.value)} className={inputClass} placeholder="Título sobre o banner" />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Subtítulo</Label>
                <input value={section.props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} className={inputClass} placeholder="Subtítulo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Texto do botão</Label>
                  <input value={section.props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Altura</Label>
                  <input value={section.props.height || "70vh"} onChange={(e) => updateProp("height", e.target.value)} className={inputClass} placeholder="70vh" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={section.props.overlay !== false} onChange={(e) => updateProp("overlay", e.target.checked)} className="rounded border-border" />
                <span className="font-body text-xs text-foreground">Mostrar overlay escuro</span>
              </label>
            </>
          )}

          {(section.type === "featured_products" || section.type === "all_products") && (
            <>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título da seção</Label>
                <input value={section.props.title || ""} onChange={(e) => updateProp("title", e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Colunas</Label>
                  <select value={section.props.columns || 4} onChange={(e) => updateProp("columns", Number(e.target.value))} className={inputClass}>
                    <option value={2}>2 colunas</option>
                    <option value={3}>3 colunas</option>
                    <option value={4}>4 colunas</option>
                    <option value={5}>5 colunas</option>
                  </select>
                </div>
                {section.type === "featured_products" && (
                  <div>
                    <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Limite</Label>
                    <input type="number" value={section.props.limit || 8} onChange={(e) => updateProp("limit", Number(e.target.value))} className={inputClass} min={2} max={20} />
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={section.props.showPrice !== false} onChange={(e) => updateProp("showPrice", e.target.checked)} className="rounded border-border" />
                <span className="font-body text-xs text-foreground">Exibir preços</span>
              </label>
            </>
          )}

          {section.type === "text_block" && (
            <>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título</Label>
                <input value={section.props.title || ""} onChange={(e) => updateProp("title", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Subtítulo</Label>
                <input value={section.props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Conteúdo</Label>
                <textarea value={section.props.body || ""} onChange={(e) => updateProp("body", e.target.value)} className={inputClass + " resize-none"} rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Alinhamento</Label>
                  <select value={section.props.alignment || "center"} onChange={(e) => updateProp("alignment", e.target.value)} className={inputClass}>
                    <option value="left">Esquerda</option>
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </div>
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Cor de fundo</Label>
                  <input value={section.props.bgColor || ""} onChange={(e) => updateProp("bgColor", e.target.value)} className={inputClass} placeholder="transparent" />
                </div>
              </div>
            </>
          )}

          {section.type === "banner" && (
            <>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">URL da imagem</Label>
                <input value={section.props.imageUrl || ""} onChange={(e) => updateProp("imageUrl", e.target.value)} className={inputClass} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título</Label>
                <input value={section.props.title || ""} onChange={(e) => updateProp("title", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Subtítulo</Label>
                <input value={section.props.subtitle || ""} onChange={(e) => updateProp("subtitle", e.target.value)} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Texto do botão</Label>
                  <input value={section.props.buttonText || ""} onChange={(e) => updateProp("buttonText", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Link do botão</Label>
                  <input value={section.props.buttonLink || ""} onChange={(e) => updateProp("buttonLink", e.target.value)} className={inputClass} />
                </div>
              </div>
            </>
          )}

          {section.type === "about" && (
            <>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título</Label>
                <input value={section.props.title || ""} onChange={(e) => updateProp("title", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Texto</Label>
                <textarea value={section.props.body || ""} onChange={(e) => updateProp("body", e.target.value)} className={inputClass + " resize-none"} rows={4} />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">URL da imagem</Label>
                <input value={section.props.imageUrl || ""} onChange={(e) => updateProp("imageUrl", e.target.value)} className={inputClass} placeholder="https://..." />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Layout</Label>
                <select value={section.props.layout || "text-left"} onChange={(e) => updateProp("layout", e.target.value)} className={inputClass}>
                  <option value="text-left">Texto à esquerda</option>
                  <option value="text-right">Texto à direita</option>
                  <option value="text-center">Centralizado</option>
                </select>
              </div>
            </>
          )}

          {section.type === "spacer" && (
            <div>
              <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Altura (px)</Label>
              <input type="number" value={section.props.height || 48} onChange={(e) => updateProp("height", Number(e.target.value))} className={inputClass} min={8} max={200} />
            </div>
          )}

          {section.type === "two_columns" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título esquerda</Label>
                  <input value={section.props.leftTitle || ""} onChange={(e) => updateProp("leftTitle", e.target.value)} className={inputClass} />
                </div>
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título direita</Label>
                  <input value={section.props.rightTitle || ""} onChange={(e) => updateProp("rightTitle", e.target.value)} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Conteúdo esquerda</Label>
                  <textarea value={section.props.leftBody || ""} onChange={(e) => updateProp("leftBody", e.target.value)} className={inputClass + " resize-none"} rows={3} />
                </div>
                <div>
                  <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Conteúdo direita</Label>
                  <textarea value={section.props.rightBody || ""} onChange={(e) => updateProp("rightBody", e.target.value)} className={inputClass + " resize-none"} rows={3} />
                </div>
              </div>
            </>
          )}

          {section.type === "gallery" && (
            <>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Título</Label>
                <input value={section.props.title || ""} onChange={(e) => updateProp("title", e.target.value)} className={inputClass} />
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Colunas</Label>
                <select value={section.props.columns || 3} onChange={(e) => updateProp("columns", Number(e.target.value))} className={inputClass}>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">URLs das imagens (uma por linha)</Label>
                <textarea
                  value={(section.props.images || []).join("\n")}
                  onChange={(e) => updateProp("images", e.target.value.split("\n").filter(Boolean))}
                  className={inputClass + " resize-none font-mono"}
                  rows={4}
                  placeholder="https://..."
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ---- Main Page Builder ----
const AdminPageBuilder = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"sections" | "header" | "footer">("sections");
  const [pageConfig, setPageConfig] = useState<PageConfig>(DEFAULT_PAGE_CONFIG);
  const [showAddSection, setShowAddSection] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["site-settings", "page_builder"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "page_builder")
        .maybeSingle();
      return data?.value as unknown as PageConfig | null;
    },
  });

  useEffect(() => {
    if (settings && !loaded) {
      setPageConfig({ ...DEFAULT_PAGE_CONFIG, ...settings });
      setLoaded(true);
    } else if (!settings && !loaded) {
      setLoaded(true);
    }
  }, [settings, loaded]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "page_builder")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: pageConfig as any, updated_at: new Date().toISOString() })
          .eq("key", "page_builder");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("site_settings")
          .insert({ key: "page_builder", value: pageConfig as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings", "page_builder"] });
      toast.success("Layout da página salvo com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar layout."),
  });

  const addSection = (type: string) => {
    const template = SECTION_TEMPLATES.find((t) => t.type === type);
    if (!template) return;
    const newSection: SectionConfig = {
      id: `${type}-${Date.now()}`,
      type,
      title: template.label,
      visible: true,
      props: { ...template.defaultProps },
    };
    setPageConfig((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
    setShowAddSection(false);
    toast.success(`Seção "${template.label}" adicionada!`);
  };

  const updateSection = (index: number, updated: SectionConfig) => {
    setPageConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? updated : s)),
    }));
  };

  const deleteSection = (index: number) => {
    if (!confirm("Remover esta seção?")) return;
    setPageConfig((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
    toast.success("Seção removida!");
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= pageConfig.sections.length) return;
    setPageConfig((prev) => {
      const sections = [...prev.sections];
      [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];
      return { ...prev, sections };
    });
  };

  const duplicateSection = (index: number) => {
    const section = pageConfig.sections[index];
    const copy: SectionConfig = {
      ...section,
      id: `${section.type}-${Date.now()}`,
      title: `${section.title} (cópia)`,
    };
    setPageConfig((prev) => ({
      ...prev,
      sections: [...prev.sections.slice(0, index + 1), copy, ...prev.sections.slice(index + 1)],
    }));
    toast.success("Seção duplicada!");
  };

  const updateHeader = (key: string, value: any) => {
    setPageConfig((prev) => ({ ...prev, header: { ...prev.header, [key]: value } }));
  };

  const updateFooter = (key: string, value: any) => {
    setPageConfig((prev) => ({ ...prev, footer: { ...prev.footer, [key]: value } }));
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-border bg-background font-body text-sm text-foreground outline-none focus:border-primary placeholder:text-muted-foreground";

  const tabs = [
    { key: "sections" as const, label: "Seções da Página", icon: Layers },
    { key: "header" as const, label: "Cabeçalho", icon: PanelTop },
    { key: "footer" as const, label: "Rodapé", icon: PanelBottom },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-body text-xl font-bold text-foreground flex items-center gap-2">
            <Layout size={20} /> Page Builder
          </h2>
          <p className="font-body text-xs text-muted-foreground mt-0.5">
            Edite a estrutura, seções, cabeçalho e rodapé do site
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
          <Save size={16} /> Salvar Layout
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-body text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* SECTIONS TAB */}
      {activeTab === "sections" && (
        <div className="space-y-3">
          {pageConfig.sections.length === 0 && (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <Layers size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground font-body text-sm">Nenhuma seção. Clique em "Adicionar Seção" para começar.</p>
            </div>
          )}

          {pageConfig.sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              section={section}
              onChange={(updated) => updateSection(index, updated)}
              onDelete={() => deleteSection(index)}
              onMoveUp={() => moveSection(index, -1)}
              onMoveDown={() => moveSection(index, 1)}
              isFirst={index === 0}
              isLast={index === pageConfig.sections.length - 1}
            />
          ))}

          {/* Add section */}
          {showAddSection ? (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-body text-sm font-semibold text-foreground">Adicionar Seção</h3>
                <button onClick={() => setShowAddSection(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SECTION_TEMPLATES.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => addSection(template.type)}
                    className="p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left group"
                  >
                    <template.icon size={20} className="text-muted-foreground group-hover:text-primary mb-1.5" />
                    <p className="font-body text-xs font-medium text-foreground">{template.label}</p>
                    <p className="font-body text-[10px] text-muted-foreground mt-0.5">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddSection(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary flex items-center justify-center gap-2 font-body text-sm transition-colors"
            >
              <Plus size={16} /> Adicionar Seção
            </button>
          )}
        </div>
      )}

      {/* HEADER TAB */}
      {activeTab === "header" && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h3 className="font-body text-base font-semibold text-foreground flex items-center gap-2">
            <PanelTop size={18} /> Configurações do Cabeçalho
          </h3>
          <div className="space-y-3">
            {[
              { key: "showLogo", label: "Exibir logo" },
              { key: "showSearch", label: "Exibir botão de busca" },
              { key: "showCart", label: "Exibir carrinho" },
              { key: "showAccount", label: "Exibir ícone de conta" },
              { key: "sticky", label: "Header fixo (sticky)" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                <input
                  type="checkbox"
                  checked={pageConfig.header[key] !== false}
                  onChange={(e) => updateHeader(key, e.target.checked)}
                  className="rounded border-border w-4 h-4"
                />
                <span className="font-body text-sm text-foreground">{label}</span>
              </label>
            ))}
            <div>
              <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Opacidade do fundo (%)</Label>
              <input
                type="number"
                min={0}
                max={100}
                value={pageConfig.header.bgOpacity ?? 95}
                onChange={(e) => updateHeader("bgOpacity", Number(e.target.value))}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      )}

      {/* FOOTER TAB */}
      {activeTab === "footer" && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h3 className="font-body text-base font-semibold text-foreground flex items-center gap-2">
            <PanelBottom size={18} /> Configurações do Rodapé
          </h3>
          <div className="space-y-3">
            {[
              { key: "showAbout", label: "Exibir texto sobre a loja" },
              { key: "showLinks", label: "Exibir links úteis" },
              { key: "showPayments", label: "Exibir bandeiras de pagamento" },
              { key: "showSocial", label: "Exibir redes sociais" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-secondary/30 transition-colors">
                <input
                  type="checkbox"
                  checked={pageConfig.footer[key] !== false}
                  onChange={(e) => updateFooter(key, e.target.checked)}
                  className="rounded border-border w-4 h-4"
                />
                <span className="font-body text-sm text-foreground">{label}</span>
              </label>
            ))}
            <div>
              <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Texto sobre a loja</Label>
              <textarea
                value={pageConfig.footer.aboutText || ""}
                onChange={(e) => updateFooter("aboutText", e.target.value)}
                className={inputClass + " resize-none"}
                rows={3}
              />
            </div>
            <div>
              <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Instagram URL</Label>
              <input value={pageConfig.footer.instagramUrl || ""} onChange={(e) => updateFooter("instagramUrl", e.target.value)} className={inputClass} placeholder="https://instagram.com/..." />
            </div>
            <div>
              <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">WhatsApp URL</Label>
              <input value={pageConfig.footer.whatsappUrl || ""} onChange={(e) => updateFooter("whatsappUrl", e.target.value)} className={inputClass} placeholder="https://wa.me/..." />
            </div>
            <div>
              <Label className="text-[10px] font-body text-muted-foreground uppercase tracking-wider mb-1">Texto de copyright</Label>
              <input value={pageConfig.footer.copyrightText || ""} onChange={(e) => updateFooter("copyrightText", e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPageBuilder;
