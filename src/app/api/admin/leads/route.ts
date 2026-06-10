import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { validateLeadCreate } from "@/lib/admin/leadsCompute";

// POST /api/admin/leads — saisie manuelle d'un lead (prospection terrain).
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const v = validateLeadCreate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .insert({
        business_name: v.value.businessName,
        trade: v.value.trade,
        contact: v.value.contact,
        plan: v.value.plan,
        source_path: v.value.sourcePath,
      })
      .select("id")
      .single();
    if (error || !lead) {
      return NextResponse.json({ error: "Création du lead échouée" }, { status: 500 });
    }

    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "LEAD_CREATED",
      user_id: userId ?? undefined,
      details: { lead_id: lead.id, business_name: v.value.businessName, source: "admin:manuel" },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, leadId: lead.id });
  } catch (error) {
    console.error("Admin lead create error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
