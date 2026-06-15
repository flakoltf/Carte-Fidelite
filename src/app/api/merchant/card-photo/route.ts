export const runtime = "nodejs";

// POST /api/merchant/card-photo — « Photo de votre commerce » (Feature 1).
//
// UNE seule image (le strip/heroImage de la carte), éditable par DEUX UI :
// ce uploader simple (mode rapide) et le studio (mode avancé). Last-write-wins,
// zéro précédence : ici on écrit DIRECTEMENT le design publié (saveDesign), donc
// la modif apparaît sur les cartes en circulation après refresh. Réutilise
// intégralement le pipeline d'assets du studio (resizeStrip + card-assets).
//
// Tenancy (invariant 3) : currentMerchantId() + chemins Storage préfixés tenant.
// Google (invariant 2) : ensureLoyaltyClass = GET-then-merge/PATCH, jamais de PUT.

import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { getSessionRole } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { resizeStrip } from "@/lib/cardDesign/imageSizes";
import { uploadAsset, applePath, googlePath } from "@/lib/cardDesign/storage";
import { loadDesign, saveDesign } from "@/lib/cardDesign/repository";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const { userId } = await getSessionRole();
  if (!userId) return NextResponse.json({ error: "Session expirée" }, { status: 401 });

  const limit = await rateLimit(`card-photo:${userId}`, 20, 3600000); // 20/h
  if (!limit.success) {
    return NextResponse.json({ error: "Trop de modifications. Réessayez plus tard." }, { status: 429 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Champ « file » manquant ou invalide" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Format non supporté. Utilisez PNG, JPEG ou WebP." }, { status: 415 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "Fichier trop volumineux. Maximum 5 Mo." }, { status: 413 });
    }

    // 1. Redimensionne aux ratios wallet + stocke dans card-assets (préfixe tenant).
    const out = await resizeStrip(Buffer.from(await file.arrayBuffer()));
    const [strip1, strip2, strip3, hero] = await Promise.all([
      uploadAsset(applePath(merchantId, "strip.png"), out.apple_strip1),
      uploadAsset(applePath(merchantId, "strip@2x.png"), out.apple_strip2),
      uploadAsset(applePath(merchantId, "strip@3x.png"), out.apple_strip3),
      uploadAsset(googlePath(merchantId, "hero.png"), out.google_hero),
    ]);

    // 2. Persiste dans le design PUBLIÉ (last-write-wins) sans casser le reste.
    const design = await loadDesign(supabaseAdmin, merchantId);
    design.logo = {
      ...design.logo,
      assets: {
        ...design.logo.assets,
        apple: { ...design.logo.assets?.apple, strip1, strip2, strip3 },
        google: { ...design.logo.assets?.google, hero },
      },
    };
    await saveDesign(supabaseAdmin, merchantId, userId, design);

    await logAuditEvent({
      action: "CARD_ASSET_UPLOADED",
      merchant_id: merchantId,
      user_id: userId,
      details: { kind: "strip", via: "card-photo" },
      ...extractRequestMeta(req),
    });

    // 3. Sync classe Google (hero au niveau classe) + refresh des cartes — best-effort.
    try {
      const { ensureLoyaltyClass } = await import("@/lib/wallet/googleClass");
      const { signedUrl } = await import("@/lib/cardDesign/storage");
      const heroUrl = await signedUrl(hero).catch(() => undefined);
      const logoUrl = design.logo.assets?.google?.logo
        ? await signedUrl(design.logo.assets.google.logo).catch(() => undefined)
        : undefined;
      await ensureLoyaltyClass(merchantId, design, logoUrl, heroUrl);
    } catch (e) {
      console.error("card-photo: sync classe Google (non bloquant):", e instanceof Error ? e.message : e);
    }
    try {
      const { refreshMerchantPasses } = await import("@/lib/wallet/refresh");
      await refreshMerchantPasses(merchantId);
    } catch (e) {
      console.error("card-photo: refresh (non bloquant):", e instanceof Error ? e.message : e);
    }

    const { signedUrl } = await import("@/lib/cardDesign/storage");
    const previewUrl = await signedUrl(strip1).catch(() => undefined);
    return NextResponse.json({ ok: true, previewUrl });
  } catch (error) {
    console.error("POST card-photo:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
