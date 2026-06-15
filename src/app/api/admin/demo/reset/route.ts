import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";
import { resetDemoMerchant } from "@/lib/demo/reset";
import type { DemoDb } from "@/lib/demo/db";
import { DemoGuardError } from "@/lib/demo/identity";
import { DEMO_SLUG } from "@/lib/demo/constants";

// POST /api/admin/demo/reset — repart d'une démo propre : purge clients/cartes/
// scans du SEUL compte démo réservé (RGPD-safe, mêmes purges que la suppression
// client), sans toucher le marchand ni sa config. Admin uniquement.
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { userId } = await getSessionRole();

    const rl = await rateLimit(`demo-reset:${userId}`, 20, 3600000); // 20/h
    if (!rl.success) {
      return NextResponse.json({ error: "Trop de réinitialisations. Réessayez plus tard." }, { status: 429 });
    }

    const res = await resetDemoMerchant(supabaseAdmin as unknown as DemoDb);

    await logAuditEvent({
      action: "DEMO_ACCOUNT_RESET",
      merchant_id: res.merchantId,
      user_id: userId ?? undefined,
      details: { slug: DEMO_SLUG, cards_purged: res.cards },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, cardsPurged: res.cards });
  } catch (error) {
    if (error instanceof DemoGuardError) {
      const status = error.reason === "not_found" ? 404 : 409;
      const message =
        error.reason === "not_found"
          ? "Aucun compte démo à réinitialiser — préparez-en un d'abord."
          : "Le compte démo réservé est occupé par un marchand non-démo (réinitialisation refusée).";
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Demo reset error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Réinitialisation de la démo échouée" }, { status: 500 });
  }
}
