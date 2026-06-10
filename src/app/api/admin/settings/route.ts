import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateSettingPatch } from "@/lib/admin/platform";

// PUT /api/admin/settings — mettre à jour un réglage plateforme (liste fermée :
// échéance certificats Apple, statut publishing Google, attestation backup).
export async function PUT(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const v = validateSettingPatch(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { userId } = await getSessionRole();
    const { data: before } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", v.value.key)
      .maybeSingle();

    const { error } = await supabaseAdmin.from("platform_settings").upsert(
      {
        key: v.value.key,
        value: v.value.value,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: "key" }
    );
    if (error) {
      return NextResponse.json({ error: "Enregistrement échoué" }, { status: 500 });
    }

    await logAuditEvent({
      action: "PLATFORM_SETTING_UPDATED",
      user_id: userId ?? undefined,
      details: { key: v.value.key, before: before?.value ?? null, after: v.value.value },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin setting update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
