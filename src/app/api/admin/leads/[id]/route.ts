import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateLeadPatch } from "@/lib/admin/leadsCompute";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/leads/[id] — faire avancer un lead dans le pipeline
// (statut, relance, motif de perte, conversion en marchand).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateLeadPatch(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { data: before } = await supabaseAdmin
      .from("leads")
      .select("id, business_name, status")
      .eq("id", id)
      .maybeSingle();
    if (!before) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    // Cohérence de conversion : un lead « gagné » avec marchand lié doit pointer
    // vers un marchand existant.
    if (v.value.convertedMerchantId) {
      const { data: m } = await supabaseAdmin
        .from("merchants")
        .select("id, role")
        .eq("id", v.value.convertedMerchantId)
        .maybeSingle();
      if (!m || m.role !== "merchant") {
        return NextResponse.json({ error: "Marchand converti introuvable" }, { status: 404 });
      }
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (v.value.status !== undefined) update.status = v.value.status;
    if (v.value.nextFollowupAt !== undefined) update.next_followup_at = v.value.nextFollowupAt;
    if (v.value.lostReason !== undefined) update.lost_reason = v.value.lostReason;
    if (v.value.convertedMerchantId !== undefined) update.converted_merchant_id = v.value.convertedMerchantId;

    const { error } = await supabaseAdmin.from("leads").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Mise à jour échouée" }, { status: 500 });
    }

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "LEAD_UPDATED",
      user_id: userId ?? undefined,
      details: {
        lead_id: id,
        business_name: before.business_name,
        fields: v.changedFields,
        ...(v.value.status !== undefined ? { status_before: before.status, status_after: v.value.status } : {}),
      },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin lead patch error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/admin/leads/[id] — suppression définitive (confirmée côté UI).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id, business_name")
      .eq("id", id)
      .maybeSingle();
    if (!lead) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });

    const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Suppression échouée" }, { status: 500 });
    }

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "LEAD_DELETED",
      user_id: userId ?? undefined,
      details: { lead_id: id, business_name: lead.business_name },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin lead delete error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
