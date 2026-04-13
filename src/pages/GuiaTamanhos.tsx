import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

const GuiaTamanhos = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container max-w-3xl py-16 px-4">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-8">Guia de Tamanhos</h1>
      <div className="font-body text-muted-foreground leading-relaxed space-y-4 text-base">
        <p>
          Sabemos como é importante escolher o tamanho certo. Por isso, criamos um guia simples para
          ajudar você a encontrar o caimento perfeito.
        </p>
        <p>
          Antes de finalizar sua compra, recomendamos conferir as medidas descritas em cada produto.
        </p>
        <p>
          Caso ainda tenha dúvidas, nossa equipe de atendimento está à disposição para auxiliar na
          escolha ideal.
        </p>
      </div>
    </main>
    <Footer />
  </div>
);

export default GuiaTamanhos;
