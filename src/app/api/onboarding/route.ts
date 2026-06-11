// GET /api/onboarding — état du wizard (sauvegarde-et-reprise).
// Tenant résolu serveur (currentMerchantId, impersonation gérée) ; toutes les
// lectures service-role sont filtrées par tenant dans fetchOnboardingState.

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchOnboardingState } from "@/lib/signup/state";

export const runtime = "nodejs";

export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const state = await fetchOnboardingState(merchantId);
  if (!state) return NextResponse.json({ error: "profil marchand introuvable" }, { status: 404 });

  return NextResponse.json({ state });
}
