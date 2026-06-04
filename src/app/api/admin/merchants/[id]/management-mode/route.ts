import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const { managed } = await req.json().catch(() => ({}));
  if (typeof managed !== "boolean") {
    return NextResponse.json({ error: "champ 'managed' booléen requis" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("merchants").update({ managed_by_concierge: managed }).eq("id", id);
  if (error) return NextResponse.json({ error: "échec mise à jour" }, { status: 500 });

  const { userId } = await getSessionRole();
  await logAuditEvent({
    action: "MERCHANT_UPDATED",
    merchant_id: id,
    user_id: userId ?? undefined,
    details: { managed_by_concierge: managed },
  });

  return NextResponse.json({ ok: true, managed });
}
