import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { getProductImage } from "@/data/products";
import { calculateShippingAsync, type ShippingResult } from "@/lib/shipping";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Truck, CreditCard, QrCode, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import PixPayment from "@/components/store/PixPayment";
import { metaPixel } from "@/lib/metaPixel";
import { getAttributionContext } from "@/lib/visitTracker";

import applePay from "@/assets/payments/apple-pay.webp";
import googlePay from "@/assets/payments/google-pay.png";
import mastercard from "@/assets/payments/mastercard.webp";
import visa from "@/assets/payments/visa.webp";
import pixLogo from "@/assets/payments/pix.png";

interface AppliedCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_discount: number | null;
  applies_to: "products" | "shipping";
}

const Checkout = () => {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [step, setStep] = useState<"address" | "payment" | "pix">("address");

  // Address form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [shippingCalculated, setShippingCalculated] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [processingPayment, setProcessingPayment] = useState(false);

  // Coupons
  const [couponCode, setCouponCode] = useState("");
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [productCoupon, setProductCoupon] = useState<AppliedCoupon | null>(null);
  const [shippingCoupon, setShippingCoupon] = useState<AppliedCoupon | null>(null);

  const calculateDiscount = (coupon: AppliedCoupon, baseValue: number): number => {
    if (baseValue <= 0) return 0;
    let discount = 0;
    if (coupon.discount_type === "percentage") {
      discount = baseValue * (coupon.discount_value / 100);
    } else {
      discount = coupon.discount_value;
    }
    if (coupon.max_discount && discount > coupon.max_discount) {
      discount = coupon.max_discount;
    }
    return Math.min(discount, baseValue);
  };

  const productDiscount = useMemo(() => {
    if (!productCoupon) return 0;
    return calculateDiscount(productCoupon, totalPrice);
  }, [productCoupon, totalPrice]);

  const shippingDiscount = useMemo(() => {
    if (!shippingCoupon || !shipping) return 0;
    return calculateDiscount(shippingCoupon, shipping.price);
  }, [shippingCoupon, shipping]);

  const orderTotal = useMemo(() => {
    const shippingPrice = shipping?.price || 0;
    return Math.max(0, totalPrice - productDiscount + shippingPrice - shippingDiscount);
  }, [totalPrice, shipping, productDiscount, shippingDiscount]);

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;

    // Check if already applied
    if (productCoupon?.code === code || shippingCoupon?.code === code) {
      toast.error("Este cupom já foi aplicado.");
      return;
    }

    setApplyingCoupon(true);
    try {
      const { data: result, error } = await supabase
        .rpc("validate_coupon", { _code: code.toUpperCase(), _order_total: totalPrice });

      if (error) throw error;

      const validation = result as any;
      if (!validation?.valid) {
        toast.error(validation?.error || "Cupom não encontrado ou inválido.");
        return;
      }

      const appliesTo = validation.applies_to || "products";

      // Check if slot already taken
      if (appliesTo === "products" && productCoupon) {
        toast.error("Já existe um cupom de produto aplicado. Remova-o antes de adicionar outro.");
        return;
      }
      if (appliesTo === "shipping" && shippingCoupon) {
        toast.error("Já existe um cupom de frete aplicado. Remova-o antes de adicionar outro.");
        return;
      }
      if (appliesTo === "shipping" && (!shipping || shipping.isFree)) {
        toast.error("Calcule o frete antes de aplicar um cupom de frete, ou seu frete já é grátis.");
        return;
      }

      const coupon: AppliedCoupon = {
        id: validation.id,
        code: validation.code,
        discount_type: validation.discount_type,
        discount_value: validation.discount_value,
        max_discount: validation.max_discount,
        applies_to: appliesTo,
      };

      if (appliesTo === "shipping") {
        setShippingCoupon(coupon);
      } else {
        setProductCoupon(coupon);
      }

      setCouponCode("");
      toast.success(`Cupom ${validation.code} aplicado com sucesso!`);
    } catch (err: any) {
      toast.error("Erro ao validar cupom: " + (err.message || "Tente novamente."));
    } finally {
      setApplyingCoupon(false);
    }
  };

  if (items.length === 0 && step !== "pix") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-muted-foreground font-body mb-4">Seu carrinho está vazio.</p>
        <Button onClick={() => navigate("/")} variant="outline">Voltar à loja</Button>
      </div>
    );
  }

  const handleCalculateShipping = async () => {
    const result = await calculateShippingAsync(cep);
    if (!result) {
      toast.error("CEP inválido. Digite um CEP com 8 dígitos.");
      return;
    }
    setShipping(result);
    setShippingCalculated(true);
    // Reset shipping coupon if shipping changed
    if (shippingCoupon && result.isFree) {
      setShippingCoupon(null);
    }
    toast.success(result.isFree ? "Frete grátis para sua região!" : `Frete: R$ ${result.price.toFixed(2).replace(".", ",")}`);
  };

  const handleCepChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 8);
    const formatted = clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
    setCep(formatted);
    setShippingCalculated(false);
    setShipping(null);
    setShippingCoupon(null);
  };

  const handlePhoneChange = (value: string) => {
    const clean = value.replace(/\D/g, "").slice(0, 11);
    let formatted = clean;
    if (clean.length > 2) formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
    if (clean.length > 7) formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
    setPhone(formatted);
  };

  const validateAddress = () => {
    if (!name.trim()) { toast.error("Preencha seu nome completo."); return false; }
    if (!email.trim() || !email.includes("@")) { toast.error("Preencha um e-mail válido."); return false; }
    if (phone.replace(/\D/g, "").length < 10) { toast.error("Preencha um telefone válido."); return false; }
    if (!shippingCalculated) { toast.error("Calcule o frete antes de continuar."); return false; }
    if (!street.trim() || !number.trim() || !neighborhood.trim() || !city.trim() || !state.trim()) {
      toast.error("Preencha todos os campos do endereço.");
      return false;
    }
    return true;
  };

  const goToPayment = () => {
    if (!validateAddress()) return;
    setStep("payment");
    // Pixel: InitiateCheckout
    metaPixel.initiateCheckout({
      value: totalPrice,
      num_items: items.reduce((s, i) => s + i.quantity, 0),
    });
    // Lead (cliente preencheu dados → vira lead qualificado)
    metaPixel.lead({ value: totalPrice });
  };

  // Atribuição enviada nas edge functions — pra gravar source da venda + CAPI
  const attribution = useMemo(() => {
    const ctx = getAttributionContext();
    return {
      attribution_session_id: ctx.session_id,
      utm_source: ctx.last.utm_source,
      utm_medium: ctx.last.utm_medium,
      utm_campaign: ctx.last.utm_campaign,
      utm_term: ctx.last.utm_term,
      utm_content: ctx.last.utm_content,
      fbclid: ctx.last.fbclid,
      gclid: ctx.last.gclid,
      fbp: ctx.fbp,    // Cookie do Pixel pra dedupe CAPI
      fbc: ctx.fbc,
      source_first: ctx.first?.source_label || ctx.last.source_label,
      source_last: ctx.last.source_label,
    };
  }, []);

  // Pixel: ViewCart quando entra no /checkout
  useEffect(() => {
    if (items.length > 0 && step === "address") {
      metaPixel.initiateCheckout({
        value: totalPrice,
        num_items: items.reduce((s, i) => s + i.quantity, 0),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStripeCheckout = async () => {
    setProcessingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          items: items.map((i) => ({
            product_id: i.product_id,
            variant_id: i.variant_id || null,
            quantity: i.quantity,
          })),
          cep: cep.replace(/\D/g, ""),
          shippingAddress: { name, email, phone, cep, street, number, complement, neighborhood, city, state },
          productCouponCode: productCoupon?.code || null,
          shippingCouponCode: shippingCoupon?.code || null,
          attribution,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Erro ao processar pagamento: " + (err.message || "Tente novamente."));
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePixPayment = async () => {
    if (!isAuthenticated) {
      toast.error("Faça login para pagar com PIX.");
      navigate("/login");
      return;
    }
    setStep("pix");
  };

  if (step === "pix") {
    return (
      <PixPayment
        items={items.map((i) => ({
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          quantity: i.quantity,
        }))}
        cep={cep.replace(/\D/g, "")}
        shippingAddress={{ name, email, phone, cep, street, number, complement, neighborhood, city, state }}
        productCouponCode={productCoupon?.code || null}
        shippingCouponCode={shippingCoupon?.code || null}
        attribution={attribution}
        onBack={() => setStep("payment")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => step === "payment" ? setStep("address") : navigate("/")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-heading text-2xl text-foreground">
            {step === "address" ? "Endereço e Frete" : "Pagamento"}
          </h1>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Main content */}
          <div className="lg:col-span-3 space-y-6">
            {step === "address" && (
              <>
                {/* Contact info */}
                <div className="bg-card rounded-xl p-6 border border-border space-y-4">
                  <h2 className="font-heading text-lg text-foreground flex items-center gap-2"><MapPin size={18} /> Dados de Contato</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><Label className="text-xs font-body text-muted-foreground">Nome Completo *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" /></div>
                    <div><Label className="text-xs font-body text-muted-foreground">E-mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" /></div>
                    <div className="sm:col-span-2"><Label className="text-xs font-body text-muted-foreground">Telefone / WhatsApp *</Label><Input value={phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(00) 00000-0000" /></div>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-card rounded-xl p-6 border border-border space-y-4">
                  <h2 className="font-heading text-lg text-foreground flex items-center gap-2"><Truck size={18} /> Endereço de Entrega</h2>
                  <div className="flex gap-3">
                    <div className="flex-1"><Label className="text-xs font-body text-muted-foreground">CEP *</Label><Input value={cep} onChange={(e) => handleCepChange(e.target.value)} placeholder="00000-000" /></div>
                    <Button onClick={handleCalculateShipping} className="mt-5" variant="outline">Calcular Frete</Button>
                  </div>
                  {shippingCalculated && shipping && (
                    <div className={`p-3 rounded-lg text-sm font-body ${shipping.isFree ? "bg-green-50 text-green-700 border border-green-200" : "bg-secondary/50 text-foreground border border-border"}`}>
                      {shipping.isFree ? "🎉 Frete Grátis!" : `📦 Frete para ${shipping.region}: R$ ${shipping.price.toFixed(2).replace(".", ",")}`}
                    </div>
                  )}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2"><Label className="text-xs font-body text-muted-foreground">Rua *</Label><Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Nome da rua" /></div>
                    <div><Label className="text-xs font-body text-muted-foreground">Número *</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="123" /></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><Label className="text-xs font-body text-muted-foreground">Complemento</Label><Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Apto, bloco..." /></div>
                    <div><Label className="text-xs font-body text-muted-foreground">Bairro *</Label><Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" /></div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div><Label className="text-xs font-body text-muted-foreground">Cidade *</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" /></div>
                    <div><Label className="text-xs font-body text-muted-foreground">Estado *</Label><Input value={state} onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" maxLength={2} /></div>
                  </div>
                </div>

                <Button onClick={goToPayment} className="w-full py-6 text-base font-body font-semibold" size="lg">
                  Continuar para Pagamento
                </Button>
              </>
            )}

            {step === "payment" && (
              <div className="bg-card rounded-xl p-6 border border-border space-y-6">
                <h2 className="font-heading text-lg text-foreground flex items-center gap-2"><CreditCard size={18} /> Método de Pagamento</h2>

                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                  <label className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "stripe" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                    <RadioGroupItem value="stripe" />
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-body font-medium text-sm text-foreground">Cartão de Crédito / Débito</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src={visa} alt="Visa" className="h-6 object-contain" />
                      <img src={mastercard} alt="Mastercard" className="h-6 object-contain" />
                      <img src={googlePay} alt="Google Pay" className="h-6 object-contain" />
                      <img src={applePay} alt="Apple Pay" className="h-6 object-contain" />
                    </div>
                  </label>

                  <label className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${paymentMethod === "pix" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                    <RadioGroupItem value="pix" />
                    <div className="flex items-center gap-3 flex-1">
                      <span className="font-body font-medium text-sm text-foreground">PIX</span>
                    </div>
                    <img src={pixLogo} alt="PIX" className="h-8 object-contain" />
                  </label>
                </RadioGroup>

                <Button
                  onClick={paymentMethod === "pix" ? handlePixPayment : handleStripeCheckout}
                  disabled={processingPayment}
                  className="w-full py-6 text-base font-body font-semibold"
                  size="lg"
                >
                  {processingPayment ? "Processando..." : paymentMethod === "pix"
                    ? `Pagar com PIX — R$ ${orderTotal.toFixed(2).replace(".", ",")}`
                    : `Pagar com Cartão — R$ ${orderTotal.toFixed(2).replace(".", ",")}`}
                </Button>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-xl p-6 border border-border sticky top-24 space-y-4">
              <h3 className="font-heading text-lg text-foreground">Resumo do Pedido</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {items.map((item) => {
                  const itemPrice = item.variant?.price || item.product.price;
                  return (
                    <div key={item.id} className="flex gap-3">
                      <img src={item.variantImage || getProductImage(item.product.image_url)} alt={item.product.name} className="w-14 h-14 rounded-md object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium text-foreground truncate">{item.product.name}</p>
                        {item.variant && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {item.variant.color && (
                              <span className="text-[10px] font-body text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{item.variant.color_name || item.variant.color}</span>
                            )}
                            {item.variant.size && (
                              <span className="text-[10px] font-body text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Tam: {item.variant.size}</span>
                            )}
                            {item.variant.numbering && (
                              <span className="text-[10px] font-body text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Nº {item.variant.numbering}</span>
                            )}
                          </div>
                        )}
                        <p className="text-xs font-body text-muted-foreground">Qtd: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-body font-semibold text-foreground whitespace-nowrap">
                        R$ {(itemPrice * item.quantity).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Coupon input */}
              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Ticket size={14} className="text-muted-foreground" />
                  <span className="text-xs font-body font-medium text-foreground">Cupom de Desconto</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Digite o cupom"
                    className="h-9 text-xs uppercase"
                    onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={applyingCoupon || !couponCode.trim()}
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs whitespace-nowrap"
                  >
                    {applyingCoupon ? "..." : "Aplicar"}
                  </Button>
                </div>

                {/* Applied coupons */}
                {productCoupon && (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-body font-semibold text-primary">🛍️ {productCoupon.code}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {productCoupon.discount_type === "percentage"
                          ? `${productCoupon.discount_value}% nos produtos`
                          : `R$ ${productCoupon.discount_value.toFixed(2)} nos produtos`}
                        {" → "}
                        <span className="font-semibold text-primary">-R$ {productDiscount.toFixed(2).replace(".", ",")}</span>
                      </p>
                    </div>
                    <button onClick={() => setProductCoupon(null)} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </button>
                  </div>
                )}
                {shippingCoupon && (
                  <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                    <div>
                      <p className="text-xs font-body font-semibold text-primary">🚚 {shippingCoupon.code}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {shippingCoupon.discount_type === "percentage"
                          ? `${shippingCoupon.discount_value}% no frete`
                          : `R$ ${shippingCoupon.discount_value.toFixed(2)} no frete`}
                        {" → "}
                        <span className="font-semibold text-primary">-R$ {shippingDiscount.toFixed(2).replace(".", ",")}</span>
                      </p>
                    </div>
                    <button onClick={() => setShippingCoupon(null)} className="text-muted-foreground hover:text-destructive">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-2">
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">R$ {totalPrice.toFixed(2).replace(".", ",")}</span>
                </div>
                {productDiscount > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">Desconto produtos</span>
                    <span className="text-primary font-semibold">-R$ {productDiscount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-body">
                  <span className="text-muted-foreground">Frete</span>
                  <span className={shipping?.isFree ? "text-green-600 font-semibold" : "text-foreground"}>
                    {shipping ? (shipping.isFree ? "Grátis" : `R$ ${shipping.price.toFixed(2).replace(".", ",")}`) : "—"}
                  </span>
                </div>
                {shippingDiscount > 0 && (
                  <div className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground">Desconto frete</span>
                    <span className="text-primary font-semibold">-R$ {shippingDiscount.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
                <div className="flex justify-between font-heading text-lg pt-2 border-t border-border">
                  <span>Total</span>
                  <span>R$ {orderTotal.toFixed(2).replace(".", ",")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
