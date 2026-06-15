import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";
import { seedDemoMerchant, type SeedAuthAdmin } from "@/lib/demo/seed";
import type { DemoDb } from "@/lib/demo/db";
import { DemoGuardError } from "@/lib/demo/identity";
import { DEMO_SLUG } from "@/lib/demo/constants";

// POST /api/admin/demo/seed — prépare (ou réinitialise) le compte démo de
// prospection « Boulangerie Démo », pleinement configuré. Admin uniquement.
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { userId } = await getSessionRole();

    const rl = await rateLimit(`demo-seed:${userId}`, 10, 3600000); // 10/h
    if (!rl.success) {
      return NextResponse.json({ error: "Trop de préparations de démo. Réessayez plus tard." }, { status: 429 });
    }

    const authAdmin: SeedAuthAdmin = {
      createUser: (input) => supabaseAdmin.auth.admin.createUser(input),
      deleteUser: (id) => supabaseAdmin.auth.admin.deleteUser(id),
    };
    const res = await seedDemoMerchant(supabaseAdmin as unknown as DemoDb, authAdmin);

    await logAuditEvent({
      action: "DEMO_ACCOUNT_SEEDED",
      merchant_id: res.merchantId,
      user_id: userId ?? undefined,
      details: { mode: res.mode, slug: DEMO_SLUG },
      ...extractRequestMeta(req),
    });

    return NextResponse.json({
      ok: true,
      mode: res.mode,
      slug: DEMO_SLUG,
      enrollPath: `/c/${DEMO_SLUG}`,
      ...(res.tempPassword ? { email: "boulangerie-demo@example.com", tempPassword: res.tempPassword } : {}),
    });
  } catch (error) {
    if (error instanceof DemoGuardError) {
      // Le slug réservé pointe sur autre chose qu'un compte démo : refus net.
      return NextResponse.json({ error: "Le compte démo réservé est occupé par un marchand non-démo." }, { status: 409 });
    }
    console.error("Demo seed error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Préparation de la démo échouée" }, { status: 500 });
  }
}
