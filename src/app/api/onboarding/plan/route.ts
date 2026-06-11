// POST /api/onboarding/plan — étape « choix du palier » du wizard.
// SANS collecte de paiement : passe par le port BillingProvider (manual
// aujourd'hui ; Stripe s'enfichera ici sans changer cette route — un résultat
// 'redirect' renverra une URL de checkout au client).
// Les limites s'appliquent sans paiement : un downgrade sous l'usage actuel
// est refusé doucement (evaluatePlanChange), jamais d'interruption de service.

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validatePlanInput } from "@/lib/signup/onboarding";
import { evaluatePlanChange } from "@/lib/billing/subscription";
import { getBillingProvider } from "@/lib/billing/provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const meta = extractRequestMeta(req);
  const body = await req.json().catch(() => ({}));
  const validated = validatePlanInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });
  const { plan, cycle } = validated.value;

  // Plan actuel + usage réel (vue billing_active_cards, filtrée tenant).
  const { data: merchant } = await supabaseAdmin
    .from("merchants")
    .select("plan")
    .eq("id", merchantId)
    .maybeSingle();
  let activeCards = 0;
  try {
    const { data: usage } = await supabaseAdmin
      .from("billing_active_cards")
      .select("active_cards_90d")
      .eq("merchant_id", merchantId)
      .maybeSingle();
    activeCards = Number(usage?.active_cards_90d ?? 0) || 0;
  } catch {
    activeCards = 0;
  }

  const decision = evaluatePlanChange({ targetPlan: plan, activeCards, currentPlan: merchant?.plan });
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.reason }, { status: 422 });
  }

  const provider = getBillingProvider();
  const result = await provider.startSubscription({ merchantId, plan, cycle });
  if (!result.ok) {
    console.error("Onboarding plan error:", result.error);
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }

  // Stripe (plus tard) : redirection checkout. Manuel : activé immédiatement.
  if (result.value.kind === "redirect") {
    return NextResponse.json({ ok: true, redirectUrl: result.value.url });
  }

  await supabaseAdmin
    .from("merchants")
    .update({ onboarding_step: "launch" })
    .eq("id", merchantId)
    .is("onboarding_completed_at", null)
    .in("onboarding_step", ["profile", "program", "design", "plan"]);

  await logAuditEvent({
    action: "SUBSCRIPTION_UPDATED",
    merchant_id: merchantId,
    details: {
      via: "onboarding",
      provider: provider.key,
      from_plan: merchant?.plan ?? null,
      plan,
      cycle,
      warning: decision.warning ?? null,
    },
    ...meta,
  });

  return NextResponse.json({ ok: true, nextStep: "launch", warning: decision.warning ?? null });
}
