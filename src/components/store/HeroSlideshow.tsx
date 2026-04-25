import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";
import hero1Webp from "@/assets/hero-1.webp";
import hero2Webp from "@/assets/hero-2.webp";
import hero3Webp from "@/assets/hero-3.webp";

const defaultSlides = [hero1, hero2, hero3];

// Map JPG bundlado -> WebP irmão (só pros defaults; URLs do admin não tem webp)
const bundledWebpMap: Record<string, string> = {
  [hero1]: hero1Webp,
  [hero2]: hero2Webp,
  [hero3]: hero3Webp,
};

const MOBILE_MEDIA = "(max-width: 767px)";

const HeroSlideshow = () => {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["site-settings-slideshow"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "slideshow")
        .single();

      return data?.value as {
        duration?: number;
        images?: string[];
        mobileSlides?: { url: string }[];
      } | null;
    },
    staleTime: 60000,
  });

  // Só usa o fallback bundlado se a query terminou e não veio NADA do banco.
  // Enquanto carrega, mostra placeholder neutro pra não piscar imagens stock.
  const settingsResolved = !isLoading;
  const hasConfiguredDesktop = !!settings?.images?.length;
  const hasConfiguredMobile = !!settings?.mobileSlides?.length;

  const desktopSlides = hasConfiguredDesktop
    ? settings!.images!
    : settingsResolved
    ? defaultSlides
    : [];
  const mobileSlideUrls = hasConfiguredMobile
    ? settings!.mobileSlides!.map((s) => s.url)
    : null;

  // Cada slide tem um par (desktop, mobile?). Renderizamos AMBOS no <picture>
  // com <source media> — browser escolhe sem necessidade de JS detectar viewport.
  // Isso elimina hydration mismatch e o swap pos-hidratacao que matava o LCP mobile.
  const slides = desktopSlides.map((desktop, i) => ({
    desktop,
    mobile: mobileSlideUrls?.[i] ?? null,
  }));

  const duration = settings?.duration || 4000;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    [Autoplay({ delay: duration, stopOnInteraction: true })]
  );

  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActive(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  // Placeholder enquanto a query do Supabase ainda não resolveu — evita flash
  // dos banners stock bundlados (Fashion Bands) antes dos reais carregarem.
  if (slides.length === 0) {
    return (
      <section className="relative w-full">
        <div className="w-full overflow-hidden aspect-[9/16] md:aspect-[16/9] bg-secondary/30" />
      </section>
    );
  }

  // Preload do PRIMEIRO slide (LCP element). Browser comeca download antes do
  // JS rodar — melhora LCP em segundos. media= garante que so mobile baixa
  // o mobile e so desktop baixa o desktop.
  const firstSlide = slides[0];

  return (
    <section className="relative w-full">
      {firstSlide && (
        <Helmet>
          {firstSlide.mobile && (
            <link
              rel="preload"
              as="image"
              href={firstSlide.mobile}
              media={MOBILE_MEDIA}
              // @ts-expect-error fetchpriority lowercase é o atributo HTML real
              fetchpriority="high"
            />
          )}
          <link
            rel="preload"
            as="image"
            href={firstSlide.desktop}
            media={firstSlide.mobile ? "(min-width: 768px)" : "all"}
            // @ts-expect-error fetchpriority lowercase é o atributo HTML real
            fetchpriority="high"
          />
        </Helmet>
      )}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, index) => {
            const webp = bundledWebpMap[slide.desktop];
            return (
              <div key={`${slide.desktop}-${index}`} className="min-w-0 shrink-0 grow-0 basis-full">
                <div className="relative w-full overflow-hidden aspect-[9/16] md:aspect-[16/9]">
                  <picture>
                    {/* Mobile-specific URL (admin-uploaded) tem prioridade no breakpoint mobile */}
                    {slide.mobile && (
                      <source media={MOBILE_MEDIA} srcSet={slide.mobile} />
                    )}
                    {webp && <source srcSet={webp} type="image/webp" />}
                    <img
                      src={slide.desktop}
                      alt={`Banner ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "low"}
                      decoding={index === 0 ? "sync" : "async"}
                      width={1920}
                      height={1080}
                      draggable={false}
                    />
                  </picture>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ir para slide ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === active ? "w-6 bg-white" : "w-2 bg-white/60"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroSlideshow;
