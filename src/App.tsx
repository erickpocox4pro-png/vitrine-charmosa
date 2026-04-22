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
import Login from "./pages/Login";
import Register from "./pages/Register";
import Account from "./pages/Account";
import Checkout from "./pages/Checkout";
import ProductPage from "./pages/ProductPage";
import SobreNos from "./pages/SobreNos";
import PoliticaTroca from "./pages/PoliticaTroca";
import GuiaTamanhos from "./pages/GuiaTamanhos";
import EntregaFrete from "./pages/EntregaFrete";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDesigner from "./pages/admin/AdminDesigner";
import AdminImport from "./pages/admin/AdminImport";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminPageBuilder from "./pages/admin/AdminPageBuilder";
import AdminManualSales from "./pages/admin/AdminManualSales";
import AdminTraffic from "./pages/admin/AdminTraffic";
import AdminDeliveries from "./pages/admin/AdminDeliveries";
import AdminProductOrder from "./pages/admin/AdminProductOrder";
import AdminFinancialAI from "./pages/admin/AdminFinancialAI";

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

const AppRoutes = () => {
  const location = useLocation();
  const { data: isMaintenance } = useMaintenanceMode();
  const isAdminRoute = location.pathname.startsWith("/admin");
  useVisitTracker();

  if (isMaintenance && !isAdminRoute) {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Login />} />
      <Route path="/produto/:slug" element={<ProductPage />} />
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