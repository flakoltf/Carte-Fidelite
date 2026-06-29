import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentMerchantId } from "@/lib/auth/currentMerchant";
import { fetchOnboardingState } from "@/lib/signup/state";
import SectorPicker from "./SectorPicker";

export const metadata: Metadata = {
  title: "Quel commerce ? — HALO",
  robots: { index: false },
};

export const dynamic = "force-dynamic";

// Étape 0 du wizard self-service. Le provisioning self-heal vit sur /onboarding :
// sans tenant résolu on y renvoie, et un onboarding déjà terminé file au dashboard.
export default async function SectorStepPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/onboarding");

  const state = await fetchOnboardingState(merchantId);
  if (!state) redirect("/onboarding");
  if (state.completedAt) redirect("/dashboard");

  return <SectorPicker />;
}
