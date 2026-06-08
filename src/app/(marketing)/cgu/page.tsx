import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { loadLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — HALO",
  description: "Conditions d'utilisation des cartes de fidélité numériques HALO.",
};

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage content={loadLegalDoc("cgu")} />;
}
