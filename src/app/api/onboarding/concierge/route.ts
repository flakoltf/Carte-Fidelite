// POST /api/onboarding/concierge — mise en ligne du parcours « HALO crée ma carte ».
//
// UNE transaction SQL (concierge_launch_merchant) : profil + slug public +
// programme tampons du secteur + onboarding terminé + entrée dans la file de
// personnalisation. Au retour, le QR du marchand est actif : la carte
// provisoire utilise le design par défaut, l'équipe livre le sur-mesure sous
// 24 h ouvrées (les wallets déjà installés se mettront à jour tout seuls).
// Idempotent : re-appel après complétion → renvoie le slug, ne touche à rien.

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateProfileInput, conciergeDefaults } from "@/lib/signup/onboarding";
import { sendEmail } from "@/lib/email/send";
import { conciergeLiveEmail, conciergeQueueEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

const MARKETING_BASE = "https://halocard.ch";

export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const meta = extractRequestMeta(req);
  const body = await req.json().catch(() => ({}));
  const validated = validateProfileInput(body);
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

  const { shopName, businessType, address } = validated.value;
  const { stampGoal } = conciergeDefaults(businessType);

  // Idempotence : si l'onboarding est déjà terminé, la RPC renvoie le slug figé.
  const { data: before } = await supabaseAdmin
    .from("merchants")
    .select("onboarding_completed_at, email")
    .eq("id", merchantId)
    .maybeSingle();
  const alreadyDone = Boolean(before?.onboarding_completed_at);

  const { data: slug, error } = await supabaseAdmin.rpc("concierge_launch_merchant", {
    p_merchant_id: merchantId,
    p_shop_name: shopName,
    p_business_type: businessType,
    p_address: address ?? "",
    p_stamp_goal: stampGoal,
  });

  if (error || !slug) {
    console.error("Onboarding concierge error:", error?.code, error?.message);
    return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
  }

  if (!alreadyDone) {
    await logAuditEvent({
      action: "CONCIERGE_CARD_PROVISIONED",
      merchant_id: merchantId,
      details: { shop_name: shopName, business_type: businessType, stamp_goal: stampGoal, slug },
      ...meta,
    });
    await logAuditEvent({
      action: "ONBOARDING_COMPLETED",
      merchant_id: merchantId,
      details: { shop_name: shopName, slug, via: "concierge" },
      ...meta,
    });

    const enrollUrl = `${MARKETING_BASE}/c/${slug}`;
    const merchantEmail = typeof before?.email === "string" ? before.email : null;
    if (merchantEmail) {
      await sendEmail({ to: merchantEmail, ...conciergeLiveEmail({ shopName, enrollUrl }) }).catch(() => {});
    }
    // Notification interne — file « cartes à personnaliser ».
    const teamEmail = process.env.CONCIERGE_TEAM_EMAIL || "contact@halocard.ch";
    await sendEmail({ to: teamEmail, ...conciergeQueueEmail({ shopName, businessType, merchantId }) }).catch(
      () => {}
    );
  }

  return NextResponse.json({ ok: true, slug });
}
