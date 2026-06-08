import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { loadLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique de confidentialité — HALO",
  description:
    "Comment HALO traite les données personnelles, conformément à la LPD suisse et au RGPD.",
};

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage content={loadLegalDoc("confidentialite")} />;
}
