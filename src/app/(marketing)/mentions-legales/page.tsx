import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { loadLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales — HALO",
  description: "Éditeur, hébergement et informations légales du site HALO.",
};

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage content={loadLegalDoc("mentions-legales")} />;
}
