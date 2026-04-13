import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";

const PoliticaTroca = () => (
  <div className="min-h-screen bg-background">
    <Header />
    <main className="container max-w-3xl py-16 px-4">
      <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground mb-8">Política de Troca</h1>
      <div className="font-body text-muted-foreground leading-relaxed space-y-4 text-base">
        <p>
          Queremos que você tenha a melhor experiência com a Vitrine Charmosa, por isso oferecemos o
          direito de troca ou devolução dentro de <strong className="text-foreground">7 dias</strong> após
          o recebimento da peça, conforme o Código de Defesa do Consumidor.
        </p>
        <p>Para que a troca seja aceita, é necessário que:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li>A peça esteja com a etiqueta original;</li>
          <li>Sem sinais de uso, manchas ou danificações;</li>
          <li>E passe por uma verificação de qualidade ao chegar em nosso centro de distribuição.</li>
        </ul>
        <p>
          Após a análise e aprovação, o cliente poderá optar por receber uma nova peça ou reembolso do
          valor pago.
        </p>
      </div>
    </main>
    <Footer />
  </div>
);

export default PoliticaTroca;
