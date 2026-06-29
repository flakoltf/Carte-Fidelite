import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateSuspensionBody } from "@/lib/admin/merchantControls";
import { UUID_RE } from "@/lib/validation/uuid";

// POST /api/admin/merchants/[id]/suspension — suspendre ou réactiver un
// marchand (admin only, action à impact → confirmation explicite côté UI).
// La suspension est un état administratif tracé (qui/quand/pourquoi) ; le
// blocage comptoir effectif est une dépendance d'intégration (manifeste).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateSuspensionBody(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, shop_name, suspended_at, role")
      .eq("id", id)
      .maybeSingle();
    if (!merchant || merchant.role !== "merchant") {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    if (v.action === "suspend" && merchant.suspended_at) {
      return NextResponse.json({ error: "Ce marchand est déjà suspendu" }, { status: 409 });
    }
    if (v.action === "reactivate" && !merchant.suspended_at) {
      return NextResponse.json({ error: "Ce marchand n'est pas suspendu" }, { status: 409 });
    }

    const update =
      v.action === "suspend"
        ? { suspended_at: new Date().toISOString(), suspended_reason: v.reason }
        : { suspended_at: null, suspended_reason: null };

    const { error } = await supabaseAdmin.from("merchants").update(update).eq("id", id);
    if (error) {
      return NextResponse.json({ error: "Mise à jour échouée" }, { status: 500 });
    }

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: v.action === "suspend" ? "MERCHANT_SUSPENDED" : "MERCHANT_REACTIVATED",
      merchant_id: id,
      user_id: userId ?? undefined,
      details:
        v.action === "suspend"
          ? { shop_name: merchant.shop_name, reason: v.reason }
          : { shop_name: merchant.shop_name },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, status: v.action === "suspend" ? "suspendu" : "actif" });
  } catch (error) {
    console.error("Admin suspension error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
