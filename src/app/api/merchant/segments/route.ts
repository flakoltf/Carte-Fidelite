import { NextResponse } from "next/server";
import { currentMerchantContext, currentMerchantId } from "@/lib/auth/currentMerchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateSegmentDays } from "@/lib/merchant-config/validate";
import { resolveMerchantConfig, type MerchantConfigRow } from "@/lib/merchant-config/resolve";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

// Réglage COMMERÇANT des seuils « client en train de partir » / « perdu »
// (merchants.segment_config.active_days / at_risk_days). Jusqu'ici seule l'API
// admin savait les modifier — aucun écran marchand. Tenancy : marchand EFFECTIF
// via currentMerchantContext() (l'admin concierge peut régler pour le marchand
// qu'il gère) ; le filtre .eq("merchant_id") est posé sur chaque requête
// (invariant CLAUDE.md n°3 — supabaseAdmin bypasse la RLS).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lecture ouverte au jeton Bearer (base clients de l'app mobile) ; le PATCH
// reste cookie uniquement (réglage depuis le dashboard).
export async function GET(req: Request) {
  const merchantId = await currentMerchantId({ request: req });
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("merchants")
    .select("stamp_goal, segment_config")
    .eq("id", merchantId)
    .maybeSingle();
  if (error) {
    console.error("GET /api/merchant/segments — SELECT :", error.message);
    return NextResponse.json({ error: "erreur serveur" }, { status: 500 });
  }
  const { thresholds } = resolveMerchantConfig((data ?? null) as MerchantConfigRow | null);
  return NextResponse.json({ active_days: thresholds.activeDays, at_risk_days: thresholds.atRiskDays, vip_visits: thresholds.vipVisits });
}

export async function PATCH(req: Request) {
  const { merchantId, userId } = await currentMerchantContext();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const v = validateSegmentDays(typeof body === "object" && body !== null ? body : {});
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // GET-then-merge : segment_config porte AUSSI vip_visits, new_tenure_days et
  // scan_cooldown_seconds — un écrasement brut les perdrait.
  const { data: current, error: selectError } = await supabaseAdmin
    .from("merchants")
    .select("segment_config")
    .eq("id", merchantId)
    .maybeSingle();
  if (selectError) {
    console.error("PATCH /api/merchant/segments — SELECT :", selectError.message);
    return NextResponse.json({ error: "erreur serveur" }, { status: 500 });
  }

  const merged = {
    ...((current?.segment_config ?? {}) as Record<string, unknown>),
    active_days: v.value.active_days,
    at_risk_days: v.value.at_risk_days,
    // Seuil « client fidèle » : écrit seulement s'il est fourni — sinon la
    // valeur existante (posée ici ou par l'admin) reste intacte.
    ...(v.value.vip_visits !== undefined ? { vip_visits: v.value.vip_visits } : {}),
  };

  const { error } = await supabaseAdmin
    .from("merchants")
    .update({ segment_config: merged })
    .eq("id", merchantId);
  if (error) {
    console.error("PATCH /api/merchant/segments — UPDATE :", error.message);
    return NextResponse.json({ error: "échec de la mise à jour" }, { status: 500 });
  }

  // Action EXISTANTE (déjà dans le CHECK audit_logs_action_check) — pas de
  // nouvelle AuditAction, donc pas de migration jumelle nécessaire.
  await logAuditEvent({
    action: "MERCHANT_UPDATED",
    merchant_id: merchantId,
    user_id: userId ?? undefined,
    details: { segment_days: v.value, source: "merchant_settings" },
    ...extractRequestMeta(req),
  });

  return NextResponse.json({ ok: true, ...v.value });
}
