import { company } from "@/content/legal/company";

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify de données contrôlées par nous (company.ts) — pas d'input utilisateur.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HaloCard",
    legalName: company.raisonSociale,
    url: "https://halocard.ch",
    // Logo lu par Google pour la vignette de marque (≥112×112, URL stable).
    logo: "https://halocard.ch/halo-logo.png",
    image: "https://halocard.ch/halo-logo.png",
    email: company.emailContact,
    address: {
      "@type": "PostalAddress",
      addressLocality: company.localite,
      postalCode: company.npa,
      addressRegion: "GE",
      addressCountry: "CH",
    },
    areaServed: [
      { "@type": "City", name: "Genève" },
      { "@type": "Country", name: "Suisse" },
    ],
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HaloCard",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "SaaS de cartes de fidélité numériques Apple Wallet & Google Wallet pour commerçants suisses.",
    offers: [
      { "@type": "Offer", name: "Essentiel", price: "69", priceCurrency: "CHF" },
      { "@type": "Offer", name: "Croissance", price: "129", priceCurrency: "CHF" },
      { "@type": "Offer", name: "Premium", price: "199", priceCurrency: "CHF" },
    ],
    // PAS de aggregateRating tant qu'il n'y a pas de vrais avis clients.
  };
}
