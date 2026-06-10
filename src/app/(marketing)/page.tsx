import type { Metadata } from "next";
import HomeClient from "./HomeClient";
import { JsonLd, organizationJsonLd, softwareApplicationJsonLd } from "@/components/site/JsonLd";

export const metadata: Metadata = {
  title: "Carte de fidélité numérique Apple & Google Wallet pour commerçants — HaloCard Genève",
  description:
    "Créez la carte de fidélité numérique de votre commerce dans Apple & Google Wallet, sans appli à télécharger. Tampons, points, paliers, cashback — dès 69 CHF/mois, sans engagement.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={softwareApplicationJsonLd()} />
      <HomeClient />
    </>
  );
}
