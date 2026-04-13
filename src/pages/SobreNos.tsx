import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import { MapPin } from "lucide-react";

const SobreNos = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container max-w-3xl py-16 px-4">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-8">Sobre Nós</h1>
      <div className="font-body text-muted-foreground leading-relaxed space-y-4 text-base">
        <p>
          A Vitrine Charmosa nasceu com o propósito de trazer o melhor da moda feminina em um só lugar.
          Trabalhamos com peças selecionadas que unem conforto, estilo e qualidade, sempre acompanhando
          as tendências do momento.
        </p>
        <p>
          Nosso objetivo é fazer você se sentir linda, confiante e única em cada look.
        </p>
        <p>
          Aqui, cada detalhe importa — desde a escolha dos tecidos até o carinho na entrega.
        </p>
      </div>

      <div className="mt-12 p-6 bg-secondary/40 rounded-xl">
        <h2 className="font-heading text-xl font-semibold text-foreground flex items-center gap-2 mb-3">
          <MapPin size={18} className="text-primary" /> Endereço
        </h2>
        <p className="font-body text-muted-foreground">
          Rua Floriano Peixoto, 101 — Bairro Centro<br />
          Messias — AL | CEP 57990-000
        </p>
      </div>
    </main>
    <Footer />
  </div>
);

export default SobreNos;
