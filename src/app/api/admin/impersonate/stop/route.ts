import { NextResponse } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { readImpersonationCookie, clearImpersonationCookie } from "@/lib/admin/impersonation";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const merchantId = await readImpersonationCookie();
  await clearImpersonationCookie();

  if (merchantId) {
    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "ADMIN_IMPERSONATION_STOP",
      merchant_id: merchantId,
      user_id: userId ?? undefined,
      details: { impersonation: true },
    });
  }
  return NextResponse.json({ ok: true });
}
