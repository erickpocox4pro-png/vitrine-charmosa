import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://vitrinecharmosa.com.br";
export const SITE_NAME = "Vitrine Charmosa";
export const DEFAULT_DESCRIPTION =
  "Na Vitrine Charmosa, qualidade e elegância se unem para valorizar seu estilo. Vista-se bem, vista-se com charme.";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  path?: string;
  type?: "website" | "article" | "product";
  keywords?: string;
  noindex?: boolean;
  jsonLd?: Record<string, any> | Record<string, any>[];
}

/**
 * Reusable SEO component. Sets title, meta description, canonical, Open Graph,
 * Twitter Card and optional JSON-LD structured data.
 */
const SEO = ({
  title,
  description,
  image,
  path,
  type = "website",
  keywords,
  noindex,
  jsonLd,
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const desc = description || DEFAULT_DESCRIPTION;
  const ogImage = image || DEFAULT_OG_IMAGE;
  const canonical = path ? `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}` : SITE_URL;

  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content="pt_BR" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@VitrinCharmosa" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />

      {jsonLdArray.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
