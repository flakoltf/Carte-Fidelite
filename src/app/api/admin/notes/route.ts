import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { UUID_RE } from "@/lib/validation/uuid";

// POST /api/admin/notes — créer une note CRM interne sur un marchand OU un
// lead. pinned=true = « à relancer » (remonte dans les vues de pilotage).
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const merchantId = typeof body.merchantId === "string" ? body.merchantId : null;
    const leadId = typeof body.leadId === "string" ? body.leadId : null;
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const pinned = body.pinned === true;

    if ((merchantId === null) === (leadId === null)) {
      return NextResponse.json({ error: "Cible requise : merchantId OU leadId" }, { status: 400 });
    }
    const target = merchantId ?? leadId!;
    if (!UUID_RE.test(target)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    if (text.length < 1 || text.length > 4000) {
      return NextResponse.json({ error: "Note requise (4000 caractères max)" }, { status: 400 });
    }

    // Vérifie l'existence de la cible (et le rôle marchand le cas échéant).
    if (merchantId) {
      const { data: m } = await supabaseAdmin
        .from("merchants")
        .select("id, role")
        .eq("id", merchantId)
        .maybeSingle();
      if (!m || m.role !== "merchant") {
        return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
      }
    } else {
      const { data: l } = await supabaseAdmin.from("leads").select("id").eq("id", leadId!).maybeSingle();
      if (!l) return NextResponse.json({ error: "Lead introuvable" }, { status: 404 });
    }

    const { userId } = await getSessionRole();
    const { data: note, error } = await supabaseAdmin
      .from("admin_notes")
      .insert({
        merchant_id: merchantId,
        lead_id: leadId,
        body: text,
        author_user_id: userId,
        pinned,
      })
      .select("id")
      .single();
    if (error || !note) {
      return NextResponse.json({ error: "Création de la note échouée" }, { status: 500 });
    }

    await logAuditEvent({
      action: "ADMIN_NOTE_ADDED",
      merchant_id: merchantId ?? undefined,
      user_id: userId ?? undefined,
      details: { note_id: note.id, lead_id: leadId, pinned },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, noteId: note.id });
  } catch (error) {
    console.error("Admin note create error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
