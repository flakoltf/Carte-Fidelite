import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/admin/merchants/[id]/rotate-token — régénère le jeton d'enrôlement
// (invalide l'ancien QR/lien). Admin only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const newToken = crypto.randomUUID();
    const { data, error } = await supabaseAdmin
      .from("merchants")
      .update({ enrollment_token: newToken })
      .eq("id", id)
      .select("enrollment_token")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    await logAuditEvent({
      action: "MERCHANT_TOKEN_ROTATED",
      merchant_id: id,
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ enrollmentToken: data.enrollment_token });
  } catch (error) {
    console.error("Admin rotate token error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
