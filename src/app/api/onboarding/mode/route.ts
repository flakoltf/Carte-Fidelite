// POST /api/onboarding/mode — fork du parcours d'onboarding.
// 'self'      → wizard 5 étapes (comportement existant).
// 'concierge' → mini-profil puis mise en ligne automatique (carte provisoire,
//               l'équipe HALO personnalise ensuite).
// Modifiable tant que l'onboarding n'est pas terminé ; jamais après (le QR
// peut être imprimé, le parcours est figé).

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateModeInput } from "@/lib/signup/onboarding";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const meta = extractRequestMeta(req);
  const body = await req.json().catch(() => ({}));
  const validated = validateModeInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("merchants")
    .update({ setup_mode: validated.mode })
    .eq("id", merchantId)
    .is("onboarding_completed_at", null);
  if (error) {
    // Colonne absente pré-migration 20260614 incluse : on ne bloque pas le
    // marchand sur une erreur brute, le wizard self reste praticable.
    console.error("Onboarding mode error:", error.code, error.message);
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }

  await logAuditEvent({
    action: "ONBOARDING_MODE_SELECTED",
    merchant_id: merchantId,
    details: { mode: validated.mode },
    ...meta,
  });

  return NextResponse.json({ ok: true, mode: validated.mode });
}
