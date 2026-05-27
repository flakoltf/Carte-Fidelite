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
    if (typeof body.primaryColor === "string") {
      if (!/^#[0-9a-fA-F]{6}$/.test(body.primaryColor)) {
        return NextResponse.json({ error: "Couleur invalide (format #rrggbb)" }, { status: 400 });
      }
      update.primary_color = body.primaryColor;
    }
    if (typeof body.logoUrl === "string") {
      update.logo_url = body.logoUrl.trim() || null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
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
