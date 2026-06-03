import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/merchants/[id] — éditer le branding d'un marchand (admin only).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const update: Record<string, unknown> = {};

    if (typeof body.shopName === "string") {
      const s = body.shopName.trim();
      if (s.length < 2 || s.length > 100) {
        return NextResponse.json({ error: "Nom de boutique invalide" }, { status: 400 });
      }
      update.shop_name = s;
    }

    // Bundle config marchand (présent dès que le formulaire enregistre).
    if (body.stampGoal !== undefined) {
      const { validateMerchantConfig } = await import("@/lib/merchant-config/validate");
      const v = validateMerchantConfig(body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      update.stamp_goal = v.value.stampGoal;
      update.business_type = v.value.businessType;
      update.primary_color = v.value.primaryColor;
      update.logo_url = v.value.logoUrl;
      update.segment_config = v.value.segmentConfig;
    }

    // Programme de fidélité (type + config). Additif : présent quand le formulaire l'envoie.
    if (body.loyaltyType !== undefined) {
      const { validateLoyaltyProgram } = await import("@/lib/loyalty/validate");
      const v = validateLoyaltyProgram(body.loyaltyType, body.loyaltyConfig);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      update.loyalty_type = v.program.type;
      update.loyalty_config = v.program.config;
      // Garder merchants.stamp_goal synchro pour la rétro-compat de l'UI tampons.
      if (v.program.type === "stamp_card") update.stamp_goal = v.program.config.goal;
    }

    // Adresse / position (géocodée) — traitée à part via le helper partagé.
    if (typeof body.address === "string" && body.address.trim()) {
      const { applyMerchantLocation } = await import("@/lib/geo/applyLocation");
      await applyMerchantLocation(id, {
        address: body.address,
        latitude: typeof body.latitude === "number" ? body.latitude : undefined,
        longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      });
    }

    const addressOnly = typeof body.address === "string" && body.address.trim().length > 0;
    if (Object.keys(update).length === 0 && !addressOnly) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true });
    }

    const { data, error } = await supabaseAdmin
      .from("merchants")
      .update(update)
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    await logAuditEvent({
      action: "MERCHANT_UPDATED",
      merchant_id: id,
      details: { fields: Object.keys(update) },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin update merchant error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
