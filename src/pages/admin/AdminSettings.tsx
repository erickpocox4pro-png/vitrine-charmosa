import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Settings, Truck, Plus, Pencil, Trash2, Save, X, MapPin,
  DollarSign, Clock, Check, Package, AlertTriangle, Store,
  CreditCard, QrCode, Phone, Mail, Globe, Instagram, Facebook,
  Lock, Unlock, ShieldAlert, Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/* ── Types ── */
interface ShippingRule {
  id: string;
  region_name: string;
  cep_start: string;
  cep_end: string;
  price: number;
  is_free: boolean;
  delivery_days_min: number;
  delivery_days_max: number;
  is_active: boolean;
  sort_order: number;
}

const emptyRule: Omit<ShippingRule, "id"> = {
  region_name: "", cep_start: "", cep_end: "", price: 0,
  is_free: false, delivery_days_min: 3, delivery_days_max: 7,
  is_active: true, sort_order: 0,
};

interface StoreInfo {
  name: string;
  cnpj: string;
  address: string;
  city: string;
  state: string;
  cep: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  instagram: string;
  facebook: string;
  about: string;
}

const defaultStoreInfo: StoreInfo = {
  name: "Vitrine Charmosa", cnpj: "", address: "", city: "", state: "", cep: "",
  phone: "", whatsapp: "", email: "", website: "", instagram: "", facebook: "", about: "",
};

interface PaymentConfig {
  pix_enabled: boolean;
  pix_key: string;
  pix_key_type: string;
  pix_holder_name: string;
  card_enabled: boolean;
  boleto_enabled: boolean;
}

const defaultPaymentConfig: PaymentConfig = {
  pix_enabled: true, pix_key: "", pix_key_type: "cnpj", pix_holder_name: "",
  card_enabled: true, boleto_enabled: false,
};

type Tab = "store" | "payments" | "shipping" | "pixel";

interface PixelSettings {
  enabled: boolean;
  pixel_id: string;
  google_ads_id: string;
  google_ads_purchase_label: string;
  test_event_code: string;
}

const defaultPixelSettings: PixelSettings = {
  enabled: true,
  pixel_id: "",
  google_ads_id: "",
  google_ads_purchase_label: "",
  test_event_code: "",
};

/* ── Inline Price Editor ── */
const InlinePrice = ({ rule, onSave }: { rule: ShippingRule; onSave: (price: number) => void }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(Number(rule.price)));

  if (!editing) {
    return (
      <button
        onClick={() => { setValue(String(Number(rule.price))); setEditing(true); }}
        className="text-xs font-mono font-medium text-foreground hover:text-primary cursor-pointer underline decoration-dashed underline-offset-2 transition-colors"
        title="Clique para editar"
      >
        R$ {Number(rule.price).toFixed(0)}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-6 w-16 text-xs font-mono px-1"
        step="0.01"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(parseFloat(value) || 0); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button onClick={() => { onSave(parseFloat(value) || 0); setEditing(false); }} className="text-success hover:text-success/80"><Check size={12} /></button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X size={12} /></button>
    </div>
  );
};

/* ── Maintenance Toggle ── */
const MaintenanceToggle = () => {
  const queryClient = useQueryClient();
  const { data: maintenanceData } = useQuery({
    queryKey: ["site-settings", "maintenance_mode"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
      return (data?.value as any)?.enabled === true;
    },
  });

  const isEnabled = maintenanceData === true;

  const toggleMaintenance = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "maintenance_mode").maybeSingle();
      const value = { enabled } as any;
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value }).eq("key", "maintenance_mode");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key: "maintenance_mode", value });
        if (error) throw error;
      }
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "maintenance_mode"] });
      toast.success(enabled ? "Loja suspensa! Clientes verão a tela de manutenção." : "Loja desbloqueada! Clientes podem acessar normalmente.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`glass-card p-5 space-y-3 border-l-4 ${isEnabled ? "border-l-destructive" : "border-l-success"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className={isEnabled ? "text-destructive" : "text-success"} />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Status da Loja</h3>
            <p className="text-[11px] text-muted-foreground">
              {isEnabled ? "A loja está suspensa — clientes veem a tela de manutenção" : "A loja está ativa e acessível para os clientes"}
            </p>
          </div>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isEnabled ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
          {isEnabled ? "Suspensa" : "Ativa"}
        </span>
      </div>
      <Button
        variant={isEnabled ? "default" : "destructive"}
        size="sm"
        className="gap-1.5 w-full sm:w-auto"
        onClick={() => toggleMaintenance.mutate(!isEnabled)}
        disabled={toggleMaintenance.isPending}
      >
        {isEnabled ? <><Unlock size={14} /> Desbloquear Loja</> : <><Lock size={14} /> Suspender Loja</>}
      </Button>
    </div>
  );
};

/* ── Component ── */
const AdminSettings = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("store");

  // ── Store Info ──
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(defaultStoreInfo);
  const { data: storeData } = useQuery({
    queryKey: ["site-settings", "store_info"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "store_info").maybeSingle();
      return data?.value as unknown as StoreInfo | null;
    },
  });
  useEffect(() => { if (storeData) setStoreInfo({ ...defaultStoreInfo, ...storeData }); }, [storeData]);

  const saveStoreMutation = useMutation({
    mutationFn: async (info: StoreInfo) => {
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "store_info").maybeSingle();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value: info as any }).eq("key", "store_info");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key: "store_info", value: info as any });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["site-settings"] }); toast.success("Dados salvos!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Payment Config ──
  const [payConfig, setPayConfig] = useState<PaymentConfig>(defaultPaymentConfig);
  const { data: payData } = useQuery({
    queryKey: ["site-settings", "payment_config"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "payment_config").maybeSingle();
      return data?.value as unknown as PaymentConfig | null;
    },
  });
  useEffect(() => { if (payData) setPayConfig({ ...defaultPaymentConfig, ...payData }); }, [payData]);

  const savePayMutation = useMutation({
    mutationFn: async (config: PaymentConfig) => {
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "payment_config").maybeSingle();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value: config as any }).eq("key", "payment_config");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key: "payment_config", value: config as any });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["site-settings"] }); toast.success("Pagamentos salvos!"); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Pixel & Tracking ──
  const [pixelSettings, setPixelSettings] = useState<PixelSettings>(defaultPixelSettings);
  const { data: pixelData } = useQuery({
    queryKey: ["site-settings", "meta_pixel_settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "meta_pixel_settings").maybeSingle();
      return data?.value as unknown as PixelSettings | null;
    },
  });
  useEffect(() => { if (pixelData) setPixelSettings({ ...defaultPixelSettings, ...pixelData }); }, [pixelData]);

  const savePixelMutation = useMutation({
    mutationFn: async (cfg: PixelSettings) => {
      // Sanitiza pixel_id (só dígitos)
      const sanitized: PixelSettings = {
        ...cfg,
        pixel_id: cfg.pixel_id.replace(/\D/g, ""),
        google_ads_id: cfg.google_ads_id.trim(),
      };
      const { data: existing } = await supabase.from("site_settings").select("id").eq("key", "meta_pixel_settings").maybeSingle();
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value: sanitized as any }).eq("key", "meta_pixel_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key: "meta_pixel_settings", value: sanitized as any });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast.success("Pixel & tracking salvos! Recarregue a loja para ativar.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Shipping Rules ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ShippingRule>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<Omit<ShippingRule, "id">>(emptyRule);
  const [testCep, setTestCep] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["shipping-rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_rules").select("*").order("sort_order", { ascending: true });
      if (error) throw error;
      return data as ShippingRule[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (rule: Partial<ShippingRule> & { id: string }) => {
      const { id, ...rest } = rule;
      const { error } = await supabase.from("shipping_rules").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping-rules"] }); setEditingId(null); toast.success("Regra atualizada!"); },
  });

  const createMutation = useMutation({
    mutationFn: async (rule: Omit<ShippingRule, "id">) => {
      const { error } = await supabase.from("shipping_rules").insert(rule);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping-rules"] }); setShowAdd(false); setAddForm(emptyRule); toast.success("Regra criada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shipping-rules"] }); toast.success("Regra removida!"); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("shipping_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shipping-rules"] }),
  });

  const doTest = () => {
    const clean = testCep.replace(/\D/g, "");
    if (clean.length < 5) { toast.error("CEP inválido"); return; }
    const prefix = clean.substring(0, 5);
    const match = rules.find((r) => {
      if (!r.is_active) return false;
      return prefix >= r.cep_start.padEnd(5, "0") && prefix <= r.cep_end.padEnd(5, "9");
    });
    setTestResult(match ? { found: true, ...match } : { found: false, message: "Nenhuma regra encontrada" });
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "store", label: "Dados da Loja", icon: Store },
    { id: "payments", label: "Pagamentos", icon: CreditCard },
    { id: "shipping", label: "Frete & Entrega", icon: Truck },
    { id: "pixel", label: "Pixel & Tracking", icon: Target },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings size={16} className="text-primary" /> Configurações
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie dados da loja, pagamentos e frete</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: Dados da Loja ═══ */}
      {activeTab === "store" && (
        <div className="space-y-4">
          {/* ── Suspender Loja ── */}
          <MaintenanceToggle />
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Store size={14} className="text-primary" /> Informações da Loja
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Nome da Loja</label>
                <Input value={storeInfo.name} onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">CNPJ</label>
                <Input value={storeInfo.cnpj} onChange={(e) => setStoreInfo({ ...storeInfo, cnpj: e.target.value })} className="h-9 text-sm font-mono" placeholder="00.000.000/0000-00" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Endereço</label>
              <Input value={storeInfo.address} onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })} className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Cidade</label>
                <Input value={storeInfo.city} onChange={(e) => setStoreInfo({ ...storeInfo, city: e.target.value })} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Estado</label>
                <Input value={storeInfo.state} onChange={(e) => setStoreInfo({ ...storeInfo, state: e.target.value })} className="h-9 text-sm" placeholder="AL" maxLength={2} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">CEP</label>
                <Input value={storeInfo.cep} onChange={(e) => setStoreInfo({ ...storeInfo, cep: e.target.value })} className="h-9 text-sm font-mono" />
              </div>
            </div>
          </div>

          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Phone size={14} className="text-primary" /> Contato & Redes Sociais
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Phone size={10} /> Telefone</label>
                <Input value={storeInfo.phone} onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })} className="h-9 text-sm" placeholder="(82) 9xxxx-xxxx" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Phone size={10} /> WhatsApp</label>
                <Input value={storeInfo.whatsapp} onChange={(e) => setStoreInfo({ ...storeInfo, whatsapp: e.target.value })} className="h-9 text-sm" placeholder="5582993879439" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Mail size={10} /> E-mail</label>
                <Input value={storeInfo.email} onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })} className="h-9 text-sm" type="email" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Globe size={10} /> Website</label>
                <Input value={storeInfo.website} onChange={(e) => setStoreInfo({ ...storeInfo, website: e.target.value })} className="h-9 text-sm" placeholder="https://" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Instagram size={10} /> Instagram</label>
                <Input value={storeInfo.instagram} onChange={(e) => setStoreInfo({ ...storeInfo, instagram: e.target.value })} className="h-9 text-sm" placeholder="@vitrinecharmosa" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1"><Facebook size={10} /> Facebook</label>
                <Input value={storeInfo.facebook} onChange={(e) => setStoreInfo({ ...storeInfo, facebook: e.target.value })} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Sobre a Loja</label>
              <Textarea value={storeInfo.about} onChange={(e) => setStoreInfo({ ...storeInfo, about: e.target.value })} rows={3} className="text-sm" placeholder="Descrição breve sobre a loja..." />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveStoreMutation.mutate(storeInfo)} className="gap-1.5">
              <Save size={14} /> Salvar Dados
            </Button>
          </div>
        </div>
      )}

      {/* ═══ TAB: Pagamentos ═══ */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* PIX */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <QrCode size={14} className="text-primary" /> Pix
              </h3>
              <Switch checked={payConfig.pix_enabled} onCheckedChange={(v) => setPayConfig({ ...payConfig, pix_enabled: v })} />
            </div>
            {payConfig.pix_enabled && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Tipo de Chave</label>
                  <select
                    value={payConfig.pix_key_type}
                    onChange={(e) => setPayConfig({ ...payConfig, pix_key_type: e.target.value })}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="cnpj">CNPJ</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="phone">Telefone</option>
                    <option value="random">Chave aleatória</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Chave Pix</label>
                  <Input value={payConfig.pix_key} onChange={(e) => setPayConfig({ ...payConfig, pix_key: e.target.value })} className="h-9 text-sm font-mono" placeholder="Sua chave Pix" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[11px] text-muted-foreground mb-1 block">Nome do Titular</label>
                  <Input value={payConfig.pix_holder_name} onChange={(e) => setPayConfig({ ...payConfig, pix_holder_name: e.target.value })} className="h-9 text-sm" placeholder="Nome que aparece no Pix" />
                </div>
              </div>
            )}
          </div>

          {/* Cartão */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <CreditCard size={14} className="text-primary" /> Cartão de Crédito/Débito
              </h3>
              <Switch checked={payConfig.card_enabled} onCheckedChange={(v) => setPayConfig({ ...payConfig, card_enabled: v })} />
            </div>
            {payConfig.card_enabled && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Processado via Stripe. Configure a chave secreta no painel de conectores.
              </p>
            )}
          </div>

          {/* Boleto */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <DollarSign size={14} className="text-primary" /> Boleto Bancário
              </h3>
              <Switch checked={payConfig.boleto_enabled} onCheckedChange={(v) => setPayConfig({ ...payConfig, boleto_enabled: v })} />
            </div>
            {payConfig.boleto_enabled && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Boleto será habilitado no checkout. Prazo de compensação: 1-3 dias úteis.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => savePayMutation.mutate(payConfig)} className="gap-1.5">
              <Save size={14} /> Salvar Pagamentos
            </Button>
          </div>
        </div>
      )}

      {/* ═══ TAB: Frete & Entrega ═══ */}
      {activeTab === "shipping" && (
        <div className="space-y-4">
          {/* Test CEP */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Truck size={14} className="text-primary" /> Testar CEP
            </h3>
            <div className="flex gap-2 items-end">
              <div className="flex-1 max-w-xs">
                <label className="text-[11px] text-muted-foreground mb-1 block">CEP</label>
                <Input value={testCep} onChange={(e) => setTestCep(e.target.value)} placeholder="00000-000" className="h-9 text-sm font-mono" maxLength={9} />
              </div>
              <Button size="sm" onClick={doTest} className="h-9 gap-1.5"><Truck size={13} /> Calcular</Button>
            </div>
            {testResult && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${testResult.found ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {testResult.found ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{testResult.region_name}</span>
                      <span className="text-muted-foreground ml-2">CEP {testResult.cep_start}–{testResult.cep_end}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold font-mono">{testResult.is_free ? "GRÁTIS" : `R$ ${Number(testResult.price).toFixed(2)}`}</span>
                      <span className="text-muted-foreground ml-2">{testResult.delivery_days_min}–{testResult.delivery_days_max} dias</span>
                    </div>
                  </div>
                ) : <span>{testResult.message}</span>}
              </div>
            )}
          </div>

          {/* Rules Table */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <MapPin size={14} className="text-primary" /> Regras de Frete por Região
              </h3>
              <Button size="sm" onClick={() => setShowAdd(true)} className="h-8 text-xs gap-1.5">
                <Plus size={13} /> Nova Região
              </Button>
            </div>

            {showAdd && (
              <div className="p-4 rounded-lg bg-secondary/30 border border-border mb-4 space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Nova Regra de Frete</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Região</label><Input value={addForm.region_name} onChange={(e) => setAddForm({ ...addForm, region_name: e.target.value })} className="h-8 text-xs" /></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">CEP Início</label><Input value={addForm.cep_start} onChange={(e) => setAddForm({ ...addForm, cep_start: e.target.value })} className="h-8 text-xs font-mono" /></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">CEP Fim</label><Input value={addForm.cep_end} onChange={(e) => setAddForm({ ...addForm, cep_end: e.target.value })} className="h-8 text-xs font-mono" /></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Preço (R$)</label><Input type="number" value={addForm.price} onChange={(e) => setAddForm({ ...addForm, price: parseFloat(e.target.value) || 0 })} className="h-8 text-xs font-mono" step="0.01" /></div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Dias Mín.</label><Input type="number" value={addForm.delivery_days_min} onChange={(e) => setAddForm({ ...addForm, delivery_days_min: parseInt(e.target.value) || 1 })} className="h-8 text-xs font-mono" /></div>
                  <div><label className="text-[10px] text-muted-foreground mb-1 block">Dias Máx.</label><Input type="number" value={addForm.delivery_days_max} onChange={(e) => setAddForm({ ...addForm, delivery_days_max: parseInt(e.target.value) || 1 })} className="h-8 text-xs font-mono" /></div>
                  <div className="flex items-end gap-2"><label className="text-[10px] text-muted-foreground flex items-center gap-1.5 pb-1.5"><Switch checked={addForm.is_free} onCheckedChange={(v) => setAddForm({ ...addForm, is_free: v, price: v ? 0 : addForm.price })} /> Frete Grátis</label></div>
                  <div className="flex items-end gap-2">
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={() => {
                      if (!addForm.region_name || !addForm.cep_start || !addForm.cep_end) { toast.error("Preencha todos os campos"); return; }
                      createMutation.mutate({ ...addForm, sort_order: rules.length + 1 });
                    }}><Save size={12} /> Salvar</Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setShowAdd(false); setAddForm(emptyRule); }}><X size={12} /></Button>
                  </div>
                </div>
              </div>
            )}

            {rulesLoading ? (
              <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg animate-pulse" />)}</div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  <div className="col-span-1">Ativo</div>
                  <div className="col-span-3">Região</div>
                  <div className="col-span-2">CEP</div>
                  <div className="col-span-1">Preço</div>
                  <div className="col-span-2">Prazo</div>
                  <div className="col-span-1">Grátis</div>
                  <div className="col-span-2 text-right">Ações</div>
                </div>
                {rules.map((rule) => {
                  const isEditing = editingId === rule.id;
                  if (isEditing) {
                    return (
                      <div key={rule.id} className="grid grid-cols-12 gap-2 items-center p-2 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="col-span-1"><Switch checked={editForm.is_active ?? true} onCheckedChange={(v) => setEditForm({ ...editForm, is_active: v })} /></div>
                        <div className="col-span-3"><Input value={editForm.region_name || ""} onChange={(e) => setEditForm({ ...editForm, region_name: e.target.value })} className="h-7 text-xs" /></div>
                        <div className="col-span-2 flex gap-1">
                          <Input value={editForm.cep_start || ""} onChange={(e) => setEditForm({ ...editForm, cep_start: e.target.value })} className="h-7 text-xs font-mono" />
                          <Input value={editForm.cep_end || ""} onChange={(e) => setEditForm({ ...editForm, cep_end: e.target.value })} className="h-7 text-xs font-mono" />
                        </div>
                        <div className="col-span-1"><Input type="number" value={editForm.price ?? 0} onChange={(e) => setEditForm({ ...editForm, price: parseFloat(e.target.value) || 0 })} className="h-7 text-xs font-mono" step="0.01" /></div>
                        <div className="col-span-2 flex gap-1">
                          <Input type="number" value={editForm.delivery_days_min ?? 3} onChange={(e) => setEditForm({ ...editForm, delivery_days_min: parseInt(e.target.value) || 1 })} className="h-7 text-xs font-mono w-14" />
                          <span className="text-xs text-muted-foreground self-center">–</span>
                          <Input type="number" value={editForm.delivery_days_max ?? 7} onChange={(e) => setEditForm({ ...editForm, delivery_days_max: parseInt(e.target.value) || 1 })} className="h-7 text-xs font-mono w-14" />
                        </div>
                        <div className="col-span-1"><Switch checked={editForm.is_free ?? false} onCheckedChange={(v) => setEditForm({ ...editForm, is_free: v, price: v ? 0 : editForm.price })} /></div>
                        <div className="col-span-2 flex gap-1 justify-end">
                          <Button size="sm" className="h-7 text-xs px-2 gap-1" onClick={() => saveMutation.mutate({ id: rule.id, ...editForm })}><Save size={11} /></Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setEditingId(null)}><X size={11} /></Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={rule.id} className={`grid grid-cols-12 gap-2 items-center p-2.5 rounded-lg transition-colors group ${rule.is_active ? "hover:bg-secondary/40" : "opacity-50"}`}>
                      <div className="col-span-1"><Switch checked={rule.is_active} onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, is_active: v })} /></div>
                      <div className="col-span-3"><span className="text-xs font-medium text-foreground">{rule.region_name}</span></div>
                      <div className="col-span-2"><span className="text-xs font-mono text-muted-foreground">{rule.cep_start}–{rule.cep_end}</span></div>
                      <div className="col-span-1">
                        {rule.is_free ? (
                          <span className="text-xs font-mono font-medium text-success">Grátis</span>
                        ) : (
                          <InlinePrice rule={rule} onSave={(newPrice) => saveMutation.mutate({ id: rule.id, price: newPrice })} />
                        )}
                      </div>
                      <div className="col-span-2"><span className="text-xs text-muted-foreground flex items-center gap-1"><Clock size={11} />{rule.delivery_days_min}–{rule.delivery_days_max} dias</span></div>
                      <div className="col-span-1">{rule.is_free && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">FREE</span>}</div>
                      <div className="col-span-2 flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingId(rule.id); setEditForm({ ...rule }); }}><Pencil size={12} /></Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Remover "${rule.region_name}"?`)) deleteMutation.mutate(rule.id); }}><Trash2 size={12} /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="glass-card p-4 !bg-secondary/20">
            <div className="flex items-start gap-2">
              <AlertTriangle size={14} className="text-warning mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                As regras são avaliadas pelos primeiros 5 dígitos do CEP. A primeira regra que casar será usada. Desative uma regra para impedir envios sem removê-la.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ TAB: Pixel & Tracking ═══ */}
      {activeTab === "pixel" && (
        <div className="space-y-4 max-w-2xl">
          {/* Status / toggle */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Target size={14} className="text-primary" /> Pixel do Facebook (Meta)
              </h3>
              <Switch
                checked={pixelSettings.enabled}
                onCheckedChange={(v) => setPixelSettings({ ...pixelSettings, enabled: v })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">
              Quando ativado, o Pixel rastreia visitas, visualizações de produto, adições ao carrinho,
              checkouts iniciados e compras. Esses dados aparecem no Gerenciador de Eventos da Meta e
              alimentam suas campanhas no Facebook Ads.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">
                  Pixel ID do Facebook
                </label>
                <Input
                  value={pixelSettings.pixel_id}
                  onChange={(e) => setPixelSettings({ ...pixelSettings, pixel_id: e.target.value })}
                  placeholder="Ex: 799756736248413"
                  className="h-9 text-sm font-mono"
                  maxLength={20}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  15–16 dígitos. Encontrado em business.facebook.com → Gerenciador de Eventos →
                  ID do conjunto de dados do Pixel.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">
                  Test Event Code (opcional)
                </label>
                <Input
                  value={pixelSettings.test_event_code}
                  onChange={(e) => setPixelSettings({ ...pixelSettings, test_event_code: e.target.value })}
                  placeholder="Ex: TEST12345"
                  className="h-9 text-sm font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Use no Gerenciador de Eventos → "Testar eventos" pra validar disparos. Remova depois.
                </p>
              </div>
            </div>
          </div>

          {/* Google Ads */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Globe size={14} className="text-primary" /> Google Ads / Analytics (opcional)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">
                  ID do Google Ads / GA4
                </label>
                <Input
                  value={pixelSettings.google_ads_id}
                  onChange={(e) => setPixelSettings({ ...pixelSettings, google_ads_id: e.target.value })}
                  placeholder="Ex: AW-1234567890 ou G-XXXXXXXXXX"
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-foreground mb-1 block">
                  Label de Conversão "Purchase"
                </label>
                <Input
                  value={pixelSettings.google_ads_purchase_label}
                  onChange={(e) => setPixelSettings({ ...pixelSettings, google_ads_purchase_label: e.target.value })}
                  placeholder="Ex: abcDEF12"
                  className="h-9 text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* Eventos disparados */}
          <div className="glass-card p-5 !bg-secondary/20">
            <h3 className="text-sm font-semibold text-foreground mb-3">Eventos rastreados automaticamente</h3>
            <ul className="space-y-1.5 text-[11px] text-muted-foreground">
              <li>✓ <b>PageView</b> — toda navegação na loja</li>
              <li>✓ <b>ViewContent</b> — visualização de produto</li>
              <li>✓ <b>AddToCart</b> — produto adicionado ao carrinho</li>
              <li>✓ <b>InitiateCheckout</b> — entrada no checkout (use pra remarketing de carrinho abandonado)</li>
              <li>✓ <b>Lead</b> — cliente preencheu nome/email/CEP</li>
              <li>✓ <b>Purchase</b> — pedido criado (PIX gerado ou Stripe pago)</li>
            </ul>
            <p className="text-[10px] text-muted-foreground mt-3 italic">
              Eventos também são gravados em <code>conversion_events</code> no Supabase como fallback
              imune a ad blockers — você sempre tem os dados, mesmo que o Pixel seja bloqueado.
            </p>
          </div>

          {/* Test instructions */}
          <div className="glass-card p-4 border-l-2 border-primary !bg-primary/5">
            <p className="text-[11px] text-foreground">
              <b>Como testar:</b> depois de salvar, abre a loja em aba anônima, navega num produto,
              adiciona ao carrinho, vai pro checkout. No Gerenciador de Eventos da Meta → "Testar eventos"
              você deve ver os eventos chegando em ~30s.
            </p>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => savePixelMutation.mutate(pixelSettings)} className="gap-1.5">
              <Save size={14} /> Salvar Pixel & Tracking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
