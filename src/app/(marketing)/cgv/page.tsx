import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { loadLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Conditions générales de vente — HALO",
  description: "Conditions de l'abonnement HALO pour les commerçants.",
};

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage content={loadLegalDoc("cgv")} />;
}
