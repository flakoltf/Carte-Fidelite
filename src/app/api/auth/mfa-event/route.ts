import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { event } = await req.json().catch(() => ({}));
  if (event !== "enrolled" && event !== "disabled") {
    return NextResponse.json({ error: "Évènement invalide" }, { status: 400 });
  }

  const { data: merchant } = await supabaseAdmin
    .from("merchants").select("id").eq("user_id", user.id).maybeSingle();

  await logAuditEvent({
    action: event === "enrolled" ? "MFA_ENROLLED" : "MFA_DISABLED",
    user_id: user.id,
    merchant_id: merchant?.id,
    ...extractRequestMeta(req),
  });

  return NextResponse.json({ success: true });
}
