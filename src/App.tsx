import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ThemeProvider from "@/components/ThemeProvider";
import MaintenancePage from "@/components/store/MaintenancePage";
import { useVisitTracker } from "@/lib/visitTracker";
import Index from "./pages/Index";

// Páginas públicas pesadas — lazy
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Account = lazy(() => import("./pages/Account"));
const Checkout = lazy(() => import("./pages/Checkout"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const SobreNos = lazy(() => import("./pages/SobreNos"));
const PoliticaTroca = lazy(() => import("./pages/PoliticaTroca"));
const GuiaTamanhos = lazy(() => import("./pages/GuiaTamanhos"));
const EntregaFrete = lazy(() => import("./pages/EntregaFrete"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin — totalmente lazy (não envia pro visitante público)
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminAuditLog = lazy(() => import("./pages/admin/AdminAuditLog"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminDesigner = lazy(() => import("./pages/admin/AdminDesigner"));
const AdminImport = lazy(() => import("./pages/admin/AdminImport"));
const AdminGallery = lazy(() => import("./pages/admin/AdminGallery"));
const AdminPageBuilder = lazy(() => import("./pages/admin/AdminPageBuilder"));
const AdminManualSales = lazy(() => import("./pages/admin/AdminManualSales"));
const AdminTraffic = lazy(() => import("./pages/admin/AdminTraffic"));
const AdminDeliveries = lazy(() => import("./pages/admin/AdminDeliveries"));
const AdminProductOrder = lazy(() => import("./pages/admin/AdminProductOrder"));
const AdminFinancialAI = lazy(() => import("./pages/admin/AdminFinancialAI"));

const queryClient = new QueryClient();

const useMaintenanceMode = () => {
  return useQuery({
    queryKey: ["site-settings", "maintenance_mode"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
      return (data?.value as any)?.enabled === true;
    },
    staleTime: 10000,
  });
};

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="Carregando" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();
  const { data: isMaintenance } = useMaintenanceMode();
  const isAdminRoute = location.pathname.startsWith("/admin");
  useVisitTracker();

  if (isMaintenance && !isAdminRoute) {
    return <MaintenancePage />;
  }

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/produto/:slug" element={<ProductPage />} />
        <Route path="/categoria/:slug" element={<CategoryPage />} />
        <Route path="/cadastro" element={<Register />} />
        <Route path="/minha-conta" element={<Account />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/sobre-nos" element={<SobreNos />} />
        <Route path="/politica-troca" element={<PoliticaTroca />} />
        <Route path="/guia-tamanhos" element={<GuiaTamanhos />} />
        <Route path="/entrega-frete" element={<EntregaFrete />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="produtos" element={<AdminProducts />} />
          <Route path="ordenar-produtos" element={<AdminProductOrder />} />
          <Route path="categorias" element={<AdminCategories />} />
          <Route path="pedidos" element={<AdminOrders />} />
          <Route path="clientes" element={<AdminCustomers />} />
          <Route path="cupons" element={<AdminCoupons />} />
          <Route path="banners" element={<AdminBanners />} />
          <Route path="relatorios" element={<AdminReports />} />
          <Route path="configuracoes" element={<AdminSettings />} />
          <Route path="designer" element={<AdminDesigner />} />
          <Route path="historico" element={<AdminAuditLog />} />
          <Route path="importacao" element={<AdminImport />} />
          <Route path="galeria" element={<AdminGallery />} />
          <Route path="page-builder" element={<AdminPageBuilder />} />
          <Route path="vendas-manuais" element={<AdminManualSales />} />
          <Route path="trafego" element={<AdminTraffic />} />
          <Route path="entregas" element={<AdminDeliveries />} />
          <Route path="consultor-financeiro" element={<AdminFinancialAI />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CartProvider>
            <ThemeProvider>
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </ThemeProvider>
          </CartProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
