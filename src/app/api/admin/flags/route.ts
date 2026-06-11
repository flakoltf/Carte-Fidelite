import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateFlagPatch } from "@/lib/admin/platform";

// PUT /api/admin/flags — créer/basculer un feature flag DB. Audité.
// (Les gates par variable d'environnement restent en lecture seule dans l'UI.)
export async function PUT(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const v = validateFlagPatch(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { userId } = await getSessionRole();
    const { data: before } = await supabaseAdmin
      .from("feature_flags")
      .select("enabled")
      .eq("key", v.value.key)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("feature_flags").upsert(
      {
        key: v.value.key,
        enabled: v.value.enabled,
        ...(v.value.description !== null ? { description: v.value.description } : {}),
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "key" }
    );
    if (error) {
      return NextResponse.json({ error: "Enregistrement échoué" }, { status: 500 });
    }

    await logAuditEvent({
      action: "FEATURE_FLAG_UPDATED",
      user_id: userId ?? undefined,
      details: { key: v.value.key, before: before?.enabled ?? null, after: v.value.enabled },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin flag update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
