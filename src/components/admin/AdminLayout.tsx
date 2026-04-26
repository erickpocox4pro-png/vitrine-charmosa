import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/contexts/AuthContext";
import {
  Package, Tag, LayoutDashboard, LogOut, ArrowLeft, History,
  ShoppingBag, Users, Ticket, Image, Settings, BarChart3,
  ChevronLeft, ChevronRight, Menu, Paintbrush, Upload, ImageIcon, Layout,
  Store, Globe, Truck, ArrowUpDown, Brain,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const navSections = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Pedidos", href: "/admin/pedidos", icon: ShoppingBag },
      { label: "Entregas", href: "/admin/entregas", icon: Truck },
    ],
  },
  {
    title: "Catálogo",
    items: [
      { label: "Produtos", href: "/admin/produtos", icon: Package },
      { label: "Ordenar Produtos", href: "/admin/ordenar-produtos", icon: ArrowUpDown },
      { label: "Categorias", href: "/admin/categorias", icon: Tag },
      { label: "Importação", href: "/admin/importacao", icon: Upload },
    ],
  },
  {
    title: "Clientes",
    items: [
      { label: "Clientes", href: "/admin/clientes", icon: Users },
      { label: "Cupons", href: "/admin/cupons", icon: Ticket },
    ],
  },
  {
    title: "Conteúdo",
    items: [
      { label: "Banners", href: "/admin/banners", icon: Image },
      { label: "Galeria", href: "/admin/galeria", icon: ImageIcon },
      { label: "Designer", href: "/admin/designer", icon: Paintbrush },
      { label: "Page Builder", href: "/admin/page-builder", icon: Layout },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { label: "Tráfego", href: "/admin/trafego", icon: Globe },
      { label: "Vendas Manuais", href: "/admin/vendas-manuais", icon: Store },
      { label: "Relatórios", href: "/admin/relatorios", icon: BarChart3 },
      { label: "Consultor IA", href: "/admin/consultor-financeiro", icon: Brain },
      { label: "Histórico", href: "/admin/historico", icon: History },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
    ],
  },
];

const AdminLayout = () => {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!adminLoading && !authLoading) {
      if (!isAuthenticated) navigate("/login");
      else if (!isAdmin) navigate("/");
    }
  }, [isAdmin, isAuthenticated, adminLoading, authLoading, navigate]);

  if (adminLoading || authLoading) {
    return (
      <div className="admin-dark min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-body text-sm">Carregando painel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const isActive = (href: string) => {
    if (href === "/admin") return location.pathname === "/admin";
    return location.pathname.startsWith(href);
  };

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={`p-4 border-b border-border ${collapsed ? "px-3" : "px-5"}`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-heading text-sm font-bold">VC</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-body text-sm font-semibold text-foreground truncate">Vitrine Charmosa</h1>
              <p className="font-body text-[10px] text-muted-foreground">Painel Admin</p>
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navSections.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <p className="px-3 mb-1.5 font-body text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {section.title}
              </p>
            )}
            {section.items.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-body text-[13px] transition-all mb-0.5 ${
                  isActive(item.href)
                    ? "bg-primary/15 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                } ${collapsed ? "justify-center" : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={18} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-border space-y-0.5">
        <Link
          to="/"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-body text-[13px] text-muted-foreground hover:text-foreground hover:bg-secondary ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Voltar à loja" : undefined}
        >
          <ArrowLeft size={18} />
          {!collapsed && <span>Voltar à loja</span>}
        </Link>
        <button
          onClick={async () => { await logout(); navigate("/"); }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg font-body text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-full ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="admin-dark min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-card shrink-0 transition-all duration-300 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex items-center justify-center p-2 border-t border-border text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-60 bg-card border-r border-border flex flex-col z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm flex items-center px-3 md:px-6 gap-3 shrink-0 sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 active:bg-secondary transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/30 flex items-center justify-center">
              <span className="text-primary text-[13px] font-semibold">A</span>
            </div>
          </div>
        </header>

        {/* Content — espaçamento mais generoso no mobile, tipografia base maior */}
        <main className="flex-1 px-3 py-4 sm:px-5 md:px-6 md:py-6 overflow-auto pb-20 md:pb-6">
          <div className="max-w-[1400px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
