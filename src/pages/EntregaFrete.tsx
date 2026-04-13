import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import { Truck } from "lucide-react";

const EntregaFrete = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container max-w-3xl py-16 px-4">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-8">Entrega e Frete</h1>
      <div className="font-body text-muted-foreground leading-relaxed space-y-4 text-base">
        <p>A Vitrine Charmosa realiza entregas para todo o Brasil.</p>
        <p>O prazo de envio varia conforme a região e a transportadora responsável:</p>
        <div className="bg-secondary/40 rounded-xl p-6 space-y-3 my-6">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-primary" />
            <span className="font-semibold text-foreground">Nordeste:</span>
            <span>entre 3 a 10 dias úteis</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-primary" />
            <span className="font-semibold text-foreground">Demais regiões do Brasil:</span>
            <span>entre 5 a 15 dias úteis</span>
          </div>
        </div>
        <p>
          Após a confirmação do pagamento, você receberá um código de rastreio para acompanhar sua
          entrega diretamente no site da transportadora.
        </p>
        <p>
          O prazo de entrega começa a contar a partir da confirmação do pagamento e da separação do
          pedido em nosso estoque.
        </p>
      </div>
    </main>
    <Footer />
  </div>
);

export default EntregaFrete;
