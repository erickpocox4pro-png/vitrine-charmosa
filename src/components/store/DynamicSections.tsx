import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import HeroSlideshow from "./HeroSlideshow";
import FeaturedProducts from "./FeaturedProducts";
import AllProducts from "./AllProducts";
import { useProducts } from "@/data/products";
import ProductCard from "./ProductCard";

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

export const usePageConfig = () => {
  return useQuery({
    queryKey: ["site-settings", "page_builder"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "page_builder")
        .maybeSingle();
      return (data?.value as unknown as PageConfig) ?? null;
    },
    staleTime: 30000,
  });
};

// --- Individual section renderers ---

const HeroSection = ({ props }: { props: Record<string, any> }) => {
  const height = props.height || "70vh";
  return (
    <div style={{ minHeight: height === "70vh" ? undefined : height }}>
      <HeroSlideshow />
      {(props.title || props.subtitle) && props.overlay && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none" style={{ marginTop: `-${height}` }}>
          <div className="text-center text-white px-4">
            {props.title && <h1 className="font-heading text-3xl md:text-5xl font-bold mb-3">{props.title}</h1>}
            {props.subtitle && <p className="font-body text-lg md:text-xl opacity-90">{props.subtitle}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

const FeaturedProductsSection = ({ props }: { props: Record<string, any> }) => {
  const { data: products, isLoading } = useProducts();
  const limit = props.limit || 8;
  const columns = props.columns || 4;
  const title = props.title || "Destaques";

  const featured = (products || []).filter((p) => p.is_new).slice(0, limit);

  if (isLoading) {
    return (
      <section className="py-10 md:py-20 bg-background">
        <div className="container px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-7 bg-secondary rounded w-40 mx-auto" />
            <div className={`grid grid-cols-2 md:grid-cols-${columns} gap-3 md:gap-6 mt-6`}>
              {[...Array(limit > 4 ? 4 : limit)].map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-secondary rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (featured.length === 0) return null;

  const gridCols = columns === 2 ? "lg:grid-cols-2" : columns === 3 ? "lg:grid-cols-3" : columns === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4";

  return (
    <section className="py-10 md:py-20 bg-background">
      <div className="container px-4">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-8 md:mb-12">
          <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl text-foreground font-bold">{title}</h2>
        </motion.div>
        <div className={`grid grid-cols-2 md:grid-cols-3 ${gridCols} gap-3 sm:gap-4 md:gap-6`}>
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

const AllProductsSection = ({ props }: { props: Record<string, any> }) => {
  return <AllProducts />;
};

const TextBlockSection = ({ props }: { props: Record<string, any> }) => {
  const alignment = props.alignment === "left" ? "text-left" : props.alignment === "right" ? "text-right" : "text-center";
  return (
    <section className="py-12 md:py-20" style={{ backgroundColor: props.bgColor || "transparent" }}>
      <div className={`container max-w-3xl px-4 ${alignment}`}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          {props.title && <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl text-foreground font-bold mb-4">{props.title}</h2>}
          {props.subtitle && <p className="font-body text-lg text-muted-foreground mb-4">{props.subtitle}</p>}
          {props.body && <p className="font-body text-muted-foreground leading-relaxed whitespace-pre-line">{props.body}</p>}
        </motion.div>
      </div>
    </section>
  );
};

const BannerSection = ({ props }: { props: Record<string, any> }) => {
  return (
    <section className="relative overflow-hidden">
      {props.imageUrl ? (
        <div className="relative aspect-[9/16] sm:aspect-[3/4] md:aspect-[16/10] lg:aspect-[16/7] max-h-[70vh]">
          <img src={props.imageUrl} alt={props.title || "Banner"} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white px-4">
              {props.title && <h2 className="font-heading text-2xl md:text-4xl font-bold mb-3">{props.title}</h2>}
              {props.subtitle && <p className="font-body text-base md:text-lg opacity-90 mb-6">{props.subtitle}</p>}
              {props.buttonText && props.buttonLink && (
                <Link to={props.buttonLink} className="inline-block bg-primary text-primary-foreground font-body font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-opacity">
                  {props.buttonText}
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 md:py-24 bg-secondary/40">
          <div className="container text-center px-4">
            {props.title && <h2 className="font-heading text-2xl md:text-4xl text-foreground font-bold mb-3">{props.title}</h2>}
            {props.subtitle && <p className="font-body text-muted-foreground mb-6">{props.subtitle}</p>}
            {props.buttonText && props.buttonLink && (
              <Link to={props.buttonLink} className="inline-block bg-primary text-primary-foreground font-body font-semibold px-8 py-3 rounded-full hover:opacity-90 transition-opacity">
                {props.buttonText}
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const AboutSection = ({ props }: { props: Record<string, any> }) => {
  const layout = props.layout || "text-left";
  return (
    <section className="py-16 md:py-24 bg-secondary/40">
      <div className="container px-4">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          {layout === "text-center" ? (
            <div className="max-w-3xl mx-auto text-center">
              {props.title && <h2 className="font-heading text-3xl md:text-4xl text-foreground font-bold mb-6">{props.title}</h2>}
              {props.body && <p className="font-body text-muted-foreground leading-relaxed whitespace-pre-line">{props.body}</p>}
              {props.imageUrl && <img src={props.imageUrl} alt={props.title || ""} className="mt-8 rounded-2xl w-full max-w-lg mx-auto object-cover" />}
            </div>
          ) : (
            <div className={`grid md:grid-cols-2 gap-10 items-center ${layout === "text-right" ? "direction-rtl" : ""}`}>
              <div className={layout === "text-right" ? "order-2 md:order-1" : ""}>
                {props.title && <h2 className="font-heading text-3xl md:text-4xl text-foreground font-bold mb-6">{props.title}</h2>}
                {props.body && <p className="font-body text-muted-foreground leading-relaxed whitespace-pre-line">{props.body}</p>}
              </div>
              {props.imageUrl && (
                <div className={layout === "text-right" ? "order-1 md:order-2" : ""}>
                  <img src={props.imageUrl} alt={props.title || ""} className="rounded-2xl w-full object-cover max-h-[400px]" />
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </section>
  );
};

const GallerySection = ({ props }: { props: Record<string, any> }) => {
  const images: string[] = props.images || [];
  const columns = props.columns || 3;
  const gridCols = columns === 2 ? "md:grid-cols-2" : columns === 4 ? "md:grid-cols-4" : "md:grid-cols-3";

  if (images.length === 0) return null;

  return (
    <section className="py-12 md:py-20">
      <div className="container px-4">
        {props.title && (
          <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="font-heading text-2xl md:text-3xl text-foreground font-bold text-center mb-8">
            {props.title}
          </motion.h2>
        )}
        <div className={`grid grid-cols-2 ${gridCols} gap-${props.gap || 4}`}>
          {images.map((img, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
              <div className="overflow-hidden rounded-xl group">
                <img src={img} alt={`Galeria ${i + 1}`} className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const SpacerSection = ({ props }: { props: Record<string, any> }) => {
  return <div style={{ height: `${props.height || 48}px` }} />;
};

const TwoColumnsSection = ({ props }: { props: Record<string, any> }) => {
  const hasImage = !!props.imageUrl;
  const imageRight = props.imagePosition !== "left";

  return (
    <section className="py-12 md:py-20">
      <div className="container px-4">
        <div className={`grid md:grid-cols-2 gap-8 items-center`}>
          <div className={imageRight && hasImage ? "" : "order-2 md:order-1"}>
            {props.leftTitle && <h3 className="font-heading text-xl md:text-2xl text-foreground font-bold mb-3">{props.leftTitle}</h3>}
            {props.leftBody && <p className="font-body text-muted-foreground leading-relaxed whitespace-pre-line">{props.leftBody}</p>}
          </div>
          <div className={imageRight && hasImage ? "" : "order-1 md:order-2"}>
            {hasImage ? (
              <img src={props.imageUrl} alt="" className="w-full rounded-2xl object-cover max-h-[400px]" />
            ) : (
              <>
                {props.rightTitle && <h3 className="font-heading text-xl md:text-2xl text-foreground font-bold mb-3">{props.rightTitle}</h3>}
                {props.rightBody && <p className="font-body text-muted-foreground leading-relaxed whitespace-pre-line">{props.rightBody}</p>}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// --- Section renderer map ---
const SECTION_RENDERERS: Record<string, React.FC<{ props: Record<string, any> }>> = {
  hero: HeroSection,
  featured_products: FeaturedProductsSection,
  all_products: AllProductsSection,
  text_block: TextBlockSection,
  banner: BannerSection,
  about: AboutSection,
  gallery: GallerySection,
  spacer: SpacerSection,
  two_columns: TwoColumnsSection,
};

const DynamicSections = () => {
  const { data: config, isLoading } = usePageConfig();

  // If no config saved yet, render default sections
  if (isLoading) return null;

  if (!config || !config.sections || config.sections.length === 0) {
    return (
      <>
        <HeroSlideshow />
        <FeaturedProducts />
        <AllProducts />
      </>
    );
  }

  const visibleSections = config.sections.filter((s) => s.visible);

  return (
    <>
      {visibleSections.map((section) => {
        const Renderer = SECTION_RENDERERS[section.type];
        if (!Renderer) return null;
        return <Renderer key={section.id} props={section.props || {}} />;
      })}
    </>
  );
};

export default DynamicSections;
