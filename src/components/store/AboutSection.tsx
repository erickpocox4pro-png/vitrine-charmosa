import { motion } from "framer-motion";

const AboutSection = () => {
  return (
    <section id="sobre" className="py-20 md:py-28 bg-secondary/40">
      <div className="container max-w-3xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-heading text-3xl md:text-4xl text-foreground font-bold mb-6">
            Sobre a Vitrine Charmosa
          </h2>
          <p className="font-body text-muted-foreground leading-relaxed text-base md:text-lg">
            A Vitrine Charmosa nasceu com o propósito de trazer o melhor da moda feminina em um só lugar.
            Trabalhamos com peças selecionadas que unem conforto, estilo e qualidade, sempre acompanhando
            as tendências do momento. Nosso objetivo é fazer você se sentir linda, confiante e única em cada look.
          </p>
          <div className="mt-10 flex justify-center gap-12">
            <div>
              <p className="font-heading text-3xl font-bold text-primary">500+</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Clientes felizes</p>
            </div>
            <div>
              <p className="font-heading text-3xl font-bold text-primary">100+</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Peças exclusivas</p>
            </div>
            <div>
              <p className="font-heading text-3xl font-bold text-primary">4.9</p>
              <p className="font-body text-sm text-muted-foreground mt-1">Avaliação média</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AboutSection;