// PATCH /api/onboarding/program — étape « programme de fidélité » du wizard.
// Tampons (stamp_card) ou visites (visit_based), validés par la logique pure
// du moteur de fidélité existant (lib/loyalty/validate).

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateProgramInput } from "@/lib/signup/onboarding";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const meta = extractRequestMeta(req);
  const body = await req.json().catch(() => ({}));
  const validated = validateProgramInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { program } = validated;
  const updates: Record<string, unknown> = {
    loyalty_type: program.type,
    loyalty_config: program.config,
  };
  // Le compteur historique merchants.stamp_goal reste synchronisé (le scan et
  // les passes le lisent en fallback).
  if (program.type === "stamp_card") updates.stamp_goal = program.config.goal;

  const { error } = await supabaseAdmin.from("merchants").update(updates).eq("id", merchantId);
  if (error) {
    console.error("Onboarding program error:", error.code, error.message);
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }

  // Avancement du wizard — jamais de régression, jamais après complétion.
  await supabaseAdmin
    .from("merchants")
    .update({ onboarding_step: "design" })
    .eq("id", merchantId)
    .is("onboarding_completed_at", null)
    .in("onboarding_step", ["profile", "program"]);

  await logAuditEvent({
    action: "MERCHANT_UPDATED",
    merchant_id: merchantId,
    details: { via: "onboarding", step: "program", loyalty_type: program.type },
    ...meta,
  });

  return NextResponse.json({ ok: true, nextStep: "design" });
}
