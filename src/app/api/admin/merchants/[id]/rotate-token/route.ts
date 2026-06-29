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
    // Garde de rôle (aligné sur suspension/reset-password) : ne jamais roter le
    // jeton d'une ligne non-marchand (ex. admin). Le filtre .eq("role","merchant")
    // rend l'opération atomique : 0 ligne touchée → 404.
    const { data, error } = await supabaseAdmin
      .from("merchants")
      .update({ enrollment_token: newToken })
      .eq("id", id)
      .eq("role", "merchant")
      .select("id")
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    await logAuditEvent({
      action: "MERCHANT_TOKEN_ROTATED",
      merchant_id: id,
      ...extractRequestMeta(req),
    });

    // On ne renvoie PAS le nouveau jeton au navigateur (invariant 5) : le QR
    // public est désormais bâti sur le slug stable, et le client ne fait que
    // rafraîchir après succès.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin rotate token error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
