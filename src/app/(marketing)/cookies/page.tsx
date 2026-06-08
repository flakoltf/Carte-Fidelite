import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { loadLegalDoc } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politique cookies — HALO",
  description: "Cookies et traceurs utilisés par le site HALO et leur gestion.",
};

export const dynamic = "force-static";

export default function Page() {
  return <LegalPage content={loadLegalDoc("cookies")} />;
}
