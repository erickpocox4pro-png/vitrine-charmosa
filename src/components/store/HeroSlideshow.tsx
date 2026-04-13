import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import hero1 from "@/assets/hero-1.jpg";
import hero2 from "@/assets/hero-2.jpg";
import hero3 from "@/assets/hero-3.jpg";

const defaultSlides = [hero1, hero2, hero3];

const HeroSlideshow = () => {
  const isMobile = useIsMobile();

  const { data: settings } = useQuery({
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

  const desktopSlides = settings?.images?.length ? settings.images : defaultSlides;
  const mobileSlides = settings?.mobileSlides?.length
    ? settings.mobileSlides.map((s) => s.url)
    : null;

  const slides = isMobile && mobileSlides ? mobileSlides : desktopSlides;
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

  return (
    <section className="relative w-full">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((slide, index) => (
            <div key={`${slide}-${index}`} className="min-w-0 shrink-0 grow-0 basis-full">
              <div className="relative w-full overflow-hidden aspect-[9/16] md:aspect-[16/9]">
                <img
                  src={slide}
                  alt={`Banner ${index + 1}`}
                  className="h-full w-full object-cover"
                  loading={index === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              </div>
            </div>
          ))}
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
