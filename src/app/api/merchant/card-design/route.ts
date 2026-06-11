export const runtime = 'nodejs';

// Studio de design marchand (Agent A).
// GET  /api/merchant/card-design  — design publié + brouillon + URLs signées d'assets.
// PUT  /api/merchant/card-design  — enregistre le BROUILLON (ne touche pas la carte publiée).
//
// Tenancy (invariant 3) : le tenant est résolu par currentMerchantId() (gère
// l'impersonation concierge) ; chaque requête supabaseAdmin est filtrée
// .eq('merchant_id', merchantId). Les chemins d'assets sont re-scopés au
// préfixe Storage du tenant avant toute persistance ou signature d'URL.

import { NextResponse } from 'next/server';
import { currentMerchantId } from '@/lib/analytics/merchant';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionRole } from '@/lib/adminAuth';
import { logAuditEvent, extractRequestMeta } from '@/lib/auditLog';
import { DEFAULT_CARD_DESIGN, type CardDesign } from '@/lib/cardDesign/types';
import { rowToDesign } from '@/lib/cardDesign/repository';
import { signedUrl } from '@/lib/cardDesign/storage';
import {
  parseCardDesign,
  enforceAssetOwnership,
  designToDraftRow,
} from '@/lib/merchant/cardStudio';

export type StudioAssetUrls = {
  appleLogo?: string;
  appleStrip?: string;
  googleLogo?: string;
  googleHero?: string;
  stampFilled?: string;
  stampEmpty?: string;
};

// URLs signées des assets référencés par un design (chemins déjà scopés tenant).
async function signAssetUrls(design: CardDesign | null): Promise<StudioAssetUrls> {
  if (!design) return {};
  const sign = async (path?: string) => {
    if (!path) return undefined;
    try {
      return await signedUrl(path);
    } catch {
      return undefined; // asset manquant : l'aperçu retombe sur les initiales
    }
  };
  const [appleLogo, appleStrip, googleLogo, googleHero, stampFilled, stampEmpty] = await Promise.all([
    sign(design.logo.assets?.apple?.x1),
    sign(design.logo.assets?.apple?.strip1),
    sign(design.logo.assets?.google?.logo),
    sign(design.logo.assets?.google?.hero),
    sign(design.stamps?.filledAssetPath),
    sign(design.stamps?.emptyAssetPath),
  ]);
  return { appleLogo, appleStrip, googleLogo, googleHero, stampFilled, stampEmpty };
}

type StudioRow = {
  draft: unknown;
  draft_saved_at: string | null;
  version: number | null;
  published_at: string | null;
} & Parameters<typeof rowToDesign>[0];

export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });

  try {
    const [{ data: row }, { data: merchant }] = await Promise.all([
      supabaseAdmin
        .from('card_designs')
        .select('*')
        .eq('merchant_id', merchantId)
        .maybeSingle<StudioRow>(),
      supabaseAdmin
        .from('merchants')
        .select('id, shop_name, business_type, stamp_goal, slug')
        .eq('id', merchantId)
        .maybeSingle(),
    ]);

    const published = row ? rowToDesign(row) : null;
    // Avant la migration studio, la colonne draft n'existe pas → undefined → null.
    const rawDraft = row?.draft ?? null;
    const draft = rawDraft ? enforceAssetOwnership(parseCardDesign(rawDraft) ?? DEFAULT_CARD_DESIGN, merchantId) : null;
    const current = draft ?? published;

    const [assetUrls, draftAssetUrls] = await Promise.all([
      signAssetUrls(published),
      current === draft ? signAssetUrls(draft) : Promise.resolve({}),
    ]);

    return NextResponse.json({
      published,
      draft,
      version: row?.version ?? 0,
      publishedAt: row?.published_at ?? null,
      draftSavedAt: row?.draft_saved_at ?? null,
      assetUrls: { ...assetUrls, ...draftAssetUrls },
      merchant: merchant
        ? {
            shopName: merchant.shop_name as string,
            businessType: (merchant.business_type as string | null) ?? null,
            stampGoal: (merchant.stamp_goal as number | null) ?? 10,
            slug: (merchant.slug as string | null) ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error('GET card-design (marchand):', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });

  const { userId } = await getSessionRole();
  if (!userId) return NextResponse.json({ error: 'Session expirée' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'corps invalide' }, { status: 400 });
  }

  const design = parseCardDesign((body as { draft?: unknown })?.draft);
  if (!design) return NextResponse.json({ error: 'Brouillon mal formé' }, { status: 400 });
  const scoped = enforceAssetOwnership(design, merchantId);

  try {
    const { error } = await supabaseAdmin
      .from('card_designs')
      .upsert(designToDraftRow(scoped, merchantId, userId), { onConflict: 'merchant_id' });
    if (error) throw new Error(error.message);

    await logAuditEvent({
      action: 'CARD_DESIGN_DRAFT_SAVED',
      merchant_id: merchantId,
      user_id: userId,
      ...extractRequestMeta(req),
    });

    return NextResponse.json({ ok: true, draftSavedAt: new Date().toISOString() });
  } catch (error) {
    console.error('PUT card-design draft (marchand):', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Impossible d'enregistrer le brouillon. Réessayez dans un instant." },
      { status: 500 }
    );
  }
}
