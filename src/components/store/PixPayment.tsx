import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { metaPixel } from "@/lib/metaPixel";

const WHATSAPP_NUMBER = "5582993879439";

interface Props {
  items: { product_id: string; variant_id: string | null; quantity: number }[];
  cep: string;
  shippingAddress: Record<string, string>;
  productCouponCode: string | null;
  shippingCouponCode: string | null;
  attribution?: Record<string, any>;
  onBack: () => void;
}

const PixPayment = ({ items, cep, shippingAddress, productCouponCode, shippingCouponCode, attribution, onBack }: Props) => {
  const { clearCart } = useCart();
  const [pixCode, setPixCode] = useState("");
  const [pixPayload, setPixPayload] = useState("");
  const [amount, setAmount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const createOrder = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-pix-checkout", {
        body: {
          items,
          cep,
          shippingAddress,
          productCouponCode,
          shippingCouponCode,
          attribution,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setPixCode(data.pixCode);
      setPixPayload(data.pixPayload);
      setAmount(data.amount);

      // Pixel: Purchase (PIX gerado = intenção de compra confirmada)
      // O Purchase definitivo idealmente vem via Conversion API server-side, mas disparamos client-side
      // para captura imediata. eventID = pixCode permite dedupe.
      try {
        metaPixel.purchase({
          order_id: data.orderId || data.pixCode,
          value: data.amount,
          currency: "BRL",
          contents: items.map((i) => ({ id: i.product_id, quantity: i.quantity, item_price: 0 })),
          fbclid: attribution?.fbclid,
          gclid: attribution?.gclid,
          source_label: attribution?.source_last,
        });
      } catch {
        /* */
      }

      await clearCart();
      toast.success("Pedido criado! Escaneie o QR Code para pagar.");
    } catch (err: any) {
      toast.error("Erro ao criar pedido: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }, [items, cep, shippingAddress, productCouponCode, shippingCouponCode, clearCart]);

  useEffect(() => {
    createOrder();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    toast.success("Código PIX copiado!");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendReceipt = () => {
    const message = encodeURIComponent(`Comprovante de pagamento\nCódigo do pedido: ${pixCode}`);
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!pixPayload) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <p className="text-destructive font-body mb-4">Erro ao gerar pagamento PIX.</p>
        <Button onClick={onBack} variant="outline">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={18} /> Voltar
        </button>

        <div className="bg-card rounded-xl p-6 border border-border space-y-6 text-center">
          <div>
            <h2 className="font-heading text-xl text-foreground">Pagamento via PIX</h2>
            <p className="text-sm font-body text-muted-foreground mt-1">Escaneie o QR Code ou copie o código</p>
          </div>

          <div className="bg-secondary/30 rounded-lg px-4 py-2 inline-block mx-auto">
            <p className="text-xs font-body text-muted-foreground mb-1">Código do pedido</p>
            <p className="font-mono text-sm font-bold text-primary">{pixCode}</p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={pixPayload} size={220} level="M" />
            </div>
          </div>

          <div>
            <p className="font-heading text-2xl text-foreground">
              R$ {amount.toFixed(2).replace(".", ",")}
            </p>
            <p className="text-xs font-body text-muted-foreground mt-1">
              CNPJ: 63.540.052/0001-70 • EDUARDA THAMMYRES DOS SANTOS
            </p>
          </div>

          {/* Copy & paste */}
          <div className="space-y-2">
            <p className="text-xs font-body text-muted-foreground">PIX Copia e Cola</p>
            <div className="bg-secondary/30 rounded-lg p-3 text-xs font-mono text-foreground/80 break-all max-h-20 overflow-y-auto select-all">
              {pixPayload}
            </div>
            <Button onClick={handleCopy} variant="outline" className="w-full gap-2">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado!" : "Copiar código PIX"}
            </Button>
          </div>

          {/* Send receipt */}
          <Button
            onClick={handleSendReceipt}
            className="w-full gap-2 py-6 text-base font-body font-semibold"
            style={{ backgroundColor: "hsl(142, 71%, 35%)" }}
          >
            <MessageCircle size={20} />
            Enviar Comprovante
          </Button>

          <p className="text-xs font-body text-muted-foreground">
            Após o pagamento, envie o comprovante pelo WhatsApp com o código do pedido.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PixPayment;
