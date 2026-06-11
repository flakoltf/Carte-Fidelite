import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/admin/notes/[noteId] — épingler/dépingler (« à relancer »).
export async function PATCH(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { noteId } = await params;
    if (!UUID_RE.test(noteId)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    if (typeof body.pinned !== "boolean") {
      return NextResponse.json({ error: "pinned doit être un booléen" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("admin_notes")
      .update({ pinned: body.pinned })
      .eq("id", noteId)
      .select("id")
      .maybeSingle();
    if (error || !data) {
      return NextResponse.json({ error: "Note introuvable" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin note patch error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE /api/admin/notes/[noteId] — suppression (confirmée côté UI), auditée.
export async function DELETE(req: Request, { params }: { params: Promise<{ noteId: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { noteId } = await params;
    if (!UUID_RE.test(noteId)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { data: note } = await supabaseAdmin
      .from("admin_notes")
      .select("id, merchant_id, lead_id")
      .eq("id", noteId)
      .maybeSingle();
    if (!note) return NextResponse.json({ error: "Note introuvable" }, { status: 404 });

    const { error } = await supabaseAdmin.from("admin_notes").delete().eq("id", noteId);
    if (error) {
      return NextResponse.json({ error: "Suppression échouée" }, { status: 500 });
    }

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "ADMIN_NOTE_DELETED",
      merchant_id: (note.merchant_id as string) ?? undefined,
      user_id: userId ?? undefined,
      details: { note_id: noteId, lead_id: note.lead_id },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin note delete error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
