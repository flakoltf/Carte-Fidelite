import { NextResponse } from "next/server";
import sharp from "sharp";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { rateLimit } from "@/lib/rateLimit";
import { uploadAsset } from "@/lib/cardDesign/storage";
import { applyKitEntry, seedDemoKit, type KitDb, type KitSeedDeps } from "@/lib/demo/seedKit";
import { DEMO_KIT, getKitEntry } from "@/lib/demo/kit";
import { DemoGuardError } from "@/lib/demo/identity";

export const runtime = "nodejs";
// Rendu de 11 PNG × N marchands : on laisse de la marge (Fluid/Pro).
export const maxDuration = 60;

// POST /api/admin/demo/seed-kit — (ré)applique le KIT DE DÉMONSTRATION à la
// flotte de prospection (6 marchands démo @example.com). Idempotent. Admin only.
// Body optionnel { slug } : ne (re)génère qu'un seul marchand démo.
//
// Garde : applyKitEntry refuse TOUTE ligne hors allowlist (DemoGuardError) AVANT
// la moindre écriture. Aucun marchand réel n'est jamais touché.
export async function POST(req: Request) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { userId } = await getSessionRole();

    const rl = await rateLimit(`demo-seed-kit:${userId}`, 6, 3600000); // 6/h
    if (!rl.success) {
      return NextResponse.json({ error: "Trop de régénérations du kit démo. Réessayez plus tard." }, { status: 429 });
    }

    let slug: string | undefined;
    try {
      const body = (await req.json()) as { slug?: unknown };
      if (typeof body?.slug === "string") slug = body.slug;
    } catch {
      // Pas de corps → kit complet.
    }

    const deps: KitSeedDeps = {
      db: supabaseAdmin as unknown as KitDb,
      render: (svg, w, h) => sharp(Buffer.from(svg)).resize(w, h, { fit: "fill" }).png().toBuffer(),
      upload: async (path, body) => {
        await uploadAsset(path, body);
      },
      actorUserId: userId ?? "",
    };

    let results;
    if (slug) {
      const entry = getKitEntry(slug);
      if (!entry) {
        return NextResponse.json({ error: `Slug démo inconnu : ${slug}` }, { status: 404 });
      }
      results = [await applyKitEntry(deps, entry)];
    } else {
      results = await seedDemoKit(deps);
    }

    // Audit best-effort par marchand (DEMO_ACCOUNT_SEEDED — action EXISTANTE).
    for (const r of results) {
      await logAuditEvent({
        action: "DEMO_ACCOUNT_SEEDED",
        merchant_id: r.merchantId,
        user_id: userId ?? undefined,
        details: { kit: true, slug: r.slug, cards: r.cards, assets: r.assets },
        ...extractRequestMeta(req),
      });
    }

    return NextResponse.json({
      ok: true,
      seeded: results.map((r) => ({ slug: r.slug, cards: r.cards, assets: r.assets, enrollPath: `/c/${r.slug}` })),
      total: { merchants: results.length, cards: results.reduce((n, r) => n + r.cards, 0) },
    });
  } catch (error) {
    if (error instanceof DemoGuardError) {
      return NextResponse.json({ error: "Un compte démo réservé est occupé par un marchand non-démo." }, { status: 409 });
    }
    console.error("Demo seed-kit error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Régénération du kit démo échouée" }, { status: 500 });
  }
}

// GET → liste (lecture seule) du kit, pour l'UI admin (aucun secret).
export async function GET() {
  const denied = await requireAdminApi();
  if (denied) return denied;
  return NextResponse.json({
    kit: DEMO_KIT.map((e) => ({
      slug: e.slug,
      shopName: e.shopName,
      loyaltyType: e.loyaltyType,
      demonstrates: e.demonstrates,
      enrollPath: `/c/${e.slug}`,
    })),
  });
}
