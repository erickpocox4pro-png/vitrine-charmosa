import Header from "@/components/store/Header";
import Footer from "@/components/store/Footer";
import DynamicSections from "@/components/store/DynamicSections";
import SEO, { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from "@/components/SEO";

const Index = () => {
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: DEFAULT_DESCRIPTION,
    email: "contato@vitrinecharmosa.com.br",
    sameAs: [
      "https://www.instagram.com/vitrinecharmosa",
      "https://www.facebook.com/vitrinecharmosa",
    ],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "pt-BR",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Moda Feminina, Acessórios e Estilo"
        description="Loja online de moda feminina, acessórios, joias folheadas e presentes. Qualidade, elegância e envio para todo Brasil. Vista-se com charme na Vitrine Charmosa."
        path="/"
        keywords="moda feminina, acessórios femininos, joias folheadas, semijoias, colar feminino, brincos, bolsas femininas, loja online moda"
        jsonLd={[organizationJsonLd, websiteJsonLd]}
      />
      <Header />
      <main className="pt-[52px] lg:pt-[68px]">
        <DynamicSections />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
