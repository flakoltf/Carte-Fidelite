import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";
import { rotateDemoPassword, type RotateAuthAdmin } from "@/lib/demo/rotate";
import type { DemoDb } from "@/lib/demo/db";
import { DemoGuardError } from "@/lib/demo/identity";
import { DEMO_SLUG } from "@/lib/demo/constants";

// POST /api/admin/demo/rotate-password — génère un nouveau mot de passe pour le
// SEUL compte démo réservé (triple garde slug + email @example.com + rôle) et le
// réécrit côté Supabase Auth. Admin uniquement. Le mot de passe n'est renvoyé
// qu'une fois, pour affichage éphémère côté UI. (Action A2 de l'audit terrain.)
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { userId } = await getSessionRole();

    const rl = await rateLimit(`demo-rotate:${userId}`, 5, 3600000); // 5/h
    if (!rl.success) {
      return NextResponse.json({ error: "Trop de rotations. Réessayez plus tard." }, { status: 429 });
    }

    const authAdmin: RotateAuthAdmin = {
      updateUserById: (id, attrs) => supabaseAdmin.auth.admin.updateUserById(id, attrs),
    };
    const res = await rotateDemoPassword(supabaseAdmin as unknown as DemoDb, authAdmin);

    await logAuditEvent({
      action: "DEMO_ACCOUNT_ROTATED",
      merchant_id: res.merchantId,
      user_id: userId ?? undefined,
      details: { slug: DEMO_SLUG, target_user_id: res.userId },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, tempPassword: res.tempPassword });
  } catch (error) {
    if (error instanceof DemoGuardError) {
      const status = error.reason === "not_found" ? 404 : 409;
      const message =
        error.reason === "not_found"
          ? "Aucun compte démo à roter — préparez-en un d'abord."
          : "Le compte démo réservé est occupé par un marchand non-démo (rotation refusée).";
      return NextResponse.json({ error: message }, { status });
    }
    console.error("Demo rotate error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Rotation du mot de passe démo échouée" }, { status: 500 });
  }
}
