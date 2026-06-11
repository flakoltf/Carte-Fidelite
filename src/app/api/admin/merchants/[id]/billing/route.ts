import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateBillingPatch } from "@/lib/admin/merchantControls";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/merchants/[id]/billing — palier, limite manuelle, essai,
// partenaire de lancement, cycle. Action à impact facturation → confirmation
// explicite côté UI ; chaque champ modifié est audité avec avant/après.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateBillingPatch(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { data: before } = await supabaseAdmin
      .from("merchants")
      .select("id, shop_name, role, plan, plan_cap_override, trial_ends_at, launch_partner, billing_cycle")
      .eq("id", id)
      .maybeSingle();
    if (!before || before.role !== "merchant") {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    const update: Record<string, unknown> = {};
    if (v.value.plan !== undefined) {
      update.plan = v.value.plan;
      // Nouveau palier = nouveau point de départ contractuel.
      if (v.value.plan !== before.plan) update.plan_started_at = new Date().toISOString();
    }
    if (v.value.planCapOverride !== undefined) update.plan_cap_override = v.value.planCapOverride;
    if (v.value.trialEndsAt !== undefined) update.trial_ends_at = v.value.trialEndsAt;
    if (v.value.launchPartner !== undefined) update.launch_partner = v.value.launchPartner;
    if (v.value.billingCycle !== undefined) update.billing_cycle = v.value.billingCycle;

    const { error } = await supabaseAdmin.from("merchants").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Mise à jour échouée" }, { status: 500 });
    }

    const { userId } = await getSessionRole();
    const meta = extractRequestMeta(req);
    const baseDetails = { shop_name: before.shop_name as string };

    // Un événement d'audit par famille de changement (lisibilité du journal).
    if (v.value.plan !== undefined && v.value.plan !== before.plan) {
      await logAuditEvent({
        action: "MERCHANT_PLAN_CHANGED",
        merchant_id: id,
        user_id: userId ?? undefined,
        details: { ...baseDetails, before: before.plan, after: v.value.plan },
        ...meta,
      });
    }
    if (v.value.planCapOverride !== undefined && v.value.planCapOverride !== before.plan_cap_override) {
      await logAuditEvent({
        action: "MERCHANT_LIMIT_ADJUSTED",
        merchant_id: id,
        user_id: userId ?? undefined,
        details: { ...baseDetails, before: before.plan_cap_override, after: v.value.planCapOverride },
        ...meta,
      });
    }
    const otherFields = v.changedFields.filter((f) => f !== "plan" && f !== "planCapOverride");
    if (otherFields.length > 0) {
      await logAuditEvent({
        action: "MERCHANT_BILLING_UPDATED",
        merchant_id: id,
        user_id: userId ?? undefined,
        details: {
          ...baseDetails,
          fields: otherFields,
          before: {
            trial_ends_at: before.trial_ends_at,
            launch_partner: before.launch_partner,
            billing_cycle: before.billing_cycle,
          },
        },
        ...meta,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin billing patch error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
