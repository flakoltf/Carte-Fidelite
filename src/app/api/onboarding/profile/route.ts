// PATCH /api/onboarding/profile — étape « profil commerce » du wizard.
// Nom + secteur + adresse, et recalcul du slug public dans la MÊME transaction
// (fonction SQL self_service_apply_profile — uniquement tant que l'onboarding
// n'est pas terminé : après, l'URL publique du QR ne bouge plus).

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateProfileInput } from "@/lib/signup/onboarding";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const meta = extractRequestMeta(req);
  const body = await req.json().catch(() => ({}));
  const validated = validateProfileInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { shopName, businessType, address } = validated.value;
  const { data: slug, error } = await supabaseAdmin.rpc("self_service_apply_profile", {
    p_merchant_id: merchantId,
    p_shop_name: shopName,
    p_business_type: businessType,
    p_address: address ?? "",
  });

  if (error || !slug) {
    console.error("Onboarding profile error:", error?.code, error?.message);
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }

  await logAuditEvent({
    action: "MERCHANT_UPDATED",
    merchant_id: merchantId,
    details: { via: "onboarding", step: "profile", shop_name: shopName, business_type: businessType },
    ...meta,
  });

  return NextResponse.json({ ok: true, slug, nextStep: "program" });
}
