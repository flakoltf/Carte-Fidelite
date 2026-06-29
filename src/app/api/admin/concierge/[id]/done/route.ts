// POST /api/admin/concierge/[id]/done — l'équipe a livré le design sur-mesure.
// Solde l'entrée de la file « cartes à personnaliser ». Audité, idempotent.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { UUID_RE } from "@/lib/validation/uuid";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  // Valide l'id en UUID en tête : un id malformé doit répondre 400, pas 500
  // (la requête Postgres lèverait une erreur de type sinon).
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("merchants")
    .update({ concierge_design_done_at: new Date().toISOString() })
    .eq("id", id)
    .not("concierge_design_requested_at", "is", null)
    .is("concierge_design_done_at", null)
    .select("id, shop_name")
    .maybeSingle();
  if (error) {
    console.error("Concierge done error:", error.code, error.message);
    return NextResponse.json({ error: "échec mise à jour" }, { status: 500 });
  }
  // Déjà soldé ou hors file : idempotent, on répond ok sans ré-auditer.
  if (!data) return NextResponse.json({ ok: true, already: true });

  const { userId } = await getSessionRole();
  await logAuditEvent({
    action: "CONCIERGE_DESIGN_DELIVERED",
    merchant_id: id,
    user_id: userId ?? undefined,
    details: { shop_name: data.shop_name ?? null },
    ...extractRequestMeta(req),
  });

  return NextResponse.json({ ok: true });
}
