import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, User, ShoppingBag, Heart, Menu, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import SearchOverlay from "./SearchOverlay";
import CartDrawer from "./CartDrawer";
import defaultLogo from "@/assets/logo-vitrine-charmosa.png";
import { useCategories } from "@/data/categories";
import { motion, AnimatePresence } from "framer-motion";

const staticFallbackLinks = [
  { label: "Novidades", href: "#produtos" },
  { label: "Vestidos", href: "#produtos" },
  { label: "Blusas", href: "#produtos" },
  { label: "Calças", href: "#produtos" },
];

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { totalItems } = useCart();
  const { isAuthenticated } = useAuth();
  const { data: categories = [] } = useCategories();

  const { data: logoSettings } = useQuery({
    queryKey: ["logo-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "logo_settings")
        .maybeSingle();
      return data?.value as { url?: string; scale?: number; align?: string } | null;
    },
    staleTime: 60000,
  });

  const logo = logoSettings?.url || defaultLogo;
  const logoScale = (logoSettings?.scale ?? 100) / 100;
  const logoAlign = logoSettings?.align || "left";

  const navLinks = useMemo(() => {
    const dynamicCategoryLinks = categories
      .slice(0, 5)
      .map((category) => ({ label: category.name, href: `/#categoria-${category.slug}` }));

    return [
      { label: "Todos os Produtos", href: "/#produtos" },
      ...(dynamicCategoryLinks.length > 0 ? dynamicCategoryLinks : staticFallbackLinks),
    ];
  }, [categories]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/60">
        {/* Desktop */}
        <div className={`hidden lg:flex items-center px-8 py-3 ${logoAlign === "center" ? "justify-center gap-8" : "justify-between"}`}>
          <Link to="/" className={`flex-shrink-0 ${logoAlign === "right" ? "order-last" : ""}`}>
            <img src={logo} alt="Vitrine Charmosa" className="h-20 w-auto transition-transform" style={{ imageRendering: "auto", transform: `scale(${logoScale})`, transformOrigin: logoAlign === "right" ? "right center" : logoAlign === "center" ? "center center" : "left center" }} />
          </Link>
          <nav className="flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-body font-medium text-foreground/70 hover:text-primary transition-colors tracking-wide"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-5">
            <button onClick={() => setSearchOpen(true)} className="text-foreground/70 hover:text-primary transition-colors" aria-label="Buscar">
              <Search size={20} />
            </button>
            <Link to={isAuthenticated ? "/minha-conta" : "/login"} className="text-foreground/70 hover:text-primary transition-colors" aria-label="Conta">
              <User size={20} />
            </Link>
            <button className="text-foreground/70 hover:text-primary transition-colors" aria-label="Favoritos">
              <Heart size={20} />
            </button>
            <button onClick={() => setCartOpen(true)} className="relative text-foreground/70 hover:text-primary transition-colors" aria-label="Carrinho">
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-body font-semibold">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile - improved touch targets and spacing */}
        <div className="flex lg:hidden items-center justify-between px-4 py-2.5 safe-area-top">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-11 h-11 flex items-center justify-center rounded-full text-foreground/80 active:bg-secondary/60 transition-colors"
            aria-label="Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <img src={logo} alt="Vitrine Charmosa" className="h-14 w-auto transition-transform" style={{ imageRendering: "auto", transform: `scale(${logoScale})`, transformOrigin: "center center" }} />
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-full text-foreground/80 active:bg-secondary/60 transition-colors"
              aria-label="Buscar"
            >
              <Search size={20} />
            </button>
            <Link
              to={isAuthenticated ? "/minha-conta" : "/login"}
              className="w-11 h-11 flex items-center justify-center rounded-full text-foreground/80 active:bg-secondary/60 transition-colors"
              aria-label="Conta"
            >
              <User size={20} />
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative w-11 h-11 flex items-center justify-center rounded-full text-foreground/80 active:bg-secondary/60 transition-colors"
              aria-label="Carrinho"
            >
              <ShoppingBag size={20} />
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 bg-primary text-primary-foreground text-[10px] w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center font-body font-bold">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu - slide down with animation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="lg:hidden bg-card border-t border-border/40 overflow-hidden"
            >
              <div className="px-5 py-4 space-y-1">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block text-[15px] font-body font-medium text-foreground/80 hover:text-primary active:text-primary transition-colors py-3 px-3 rounded-xl active:bg-secondary/40"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
};

export default Header;
