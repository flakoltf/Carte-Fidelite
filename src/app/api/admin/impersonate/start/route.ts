import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setImpersonationCookie } from "@/lib/admin/impersonation";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { merchantId } = await req.json().catch(() => ({}));
  if (typeof merchantId !== "string" || !merchantId) {
    return NextResponse.json({ error: "merchantId requis" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("merchants").select("id, shop_name").eq("id", merchantId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Commerçant introuvable" }, { status: 404 });

  await setImpersonationCookie(merchantId);

  const { userId } = await getSessionRole();
  await logAuditEvent({
    action: "ADMIN_IMPERSONATION_START",
    merchant_id: merchantId,
    user_id: userId ?? undefined,
    details: { impersonation: true, shop_name: target.shop_name },
  });

  return NextResponse.json({ ok: true, shopName: target.shop_name });
}
