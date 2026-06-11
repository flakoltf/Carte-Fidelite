// POST /api/onboarding/complete — « Votre programme est en ligne. »
// Fige l'onboarding (le slug public ne sera plus recalculé), audite, et envoie
// l'email de mise en ligne (best-effort). Idempotent : re-appel → ok.

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { sendEmail } from "@/lib/email/send";
import { programLiveEmail } from "@/lib/email/templates";
import { PLACEHOLDER_SHOP_NAME } from "@/lib/signup/state";

export const runtime = "nodejs";

const MARKETING_BASE = "https://halocard.ch";

export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const meta = extractRequestMeta(req);
  const { data: merchant, error } = await supabaseAdmin
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .maybeSingle();
  if (error || !merchant) {
    return NextResponse.json({ error: "profil marchand introuvable" }, { status: 404 });
  }

  const row = merchant as Record<string, unknown>;
  const shopName = typeof row.shop_name === "string" ? row.shop_name : "";
  const slug = typeof row.slug === "string" ? row.slug : null;
  const email = typeof row.email === "string" ? row.email : null;

  // Garde-fou : pas de mise en ligne sans profil renseigné (le slug public
  // refléterait un placeholder).
  if (!slug || !shopName || shopName === PLACEHOLDER_SHOP_NAME) {
    return NextResponse.json(
      { error: "Renseignez d'abord le nom de votre commerce (étape Profil)." },
      { status: 422 }
    );
  }

  const alreadyDone = Boolean(row.onboarding_completed_at);
  if (!alreadyDone) {
    const { error: updErr } = await supabaseAdmin
      .from("merchants")
      .update({ onboarding_completed_at: new Date().toISOString(), onboarding_step: "done" })
      .eq("id", merchantId)
      .is("onboarding_completed_at", null);
    if (updErr) {
      console.error("Onboarding complete error:", updErr.code, updErr.message);
      return NextResponse.json({ error: "Enregistrement impossible. Réessayez." }, { status: 500 });
    }

    await logAuditEvent({
      action: "ONBOARDING_COMPLETED",
      merchant_id: merchantId,
      details: { shop_name: shopName, slug },
      ...meta,
    });

    if (email) {
      const enrollUrl = `${MARKETING_BASE}/c/${slug}`;
      await sendEmail({ to: email, ...programLiveEmail({ shopName, enrollUrl }) }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true, slug });
}
