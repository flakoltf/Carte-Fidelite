export const runtime = 'nodejs';

// Assets du studio marchand (Agent A).
// POST /api/merchant/card-design/assets — upload (logo | strip | stamp_filled | stamp_empty),
//   redimensionné aux formats cibles Apple/Google côté serveur (sharp).
// GET  /api/merchant/card-design/assets — bibliothèque : fichiers du tenant + URLs signées.
//
// Tenancy (invariant 3) : currentMerchantId() ; tous les chemins Storage sont
// préfixés par l'id du tenant (applePath/googlePath/stampPath), la liste ne
// parcourt QUE le dossier du tenant.

import { NextResponse } from 'next/server';
import { currentMerchantId } from '@/lib/analytics/merchant';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionRole } from '@/lib/adminAuth';
import { logAuditEvent, extractRequestMeta } from '@/lib/auditLog';
import { resizeLogo, resizeStrip } from '@/lib/cardDesign/imageSizes';
import { uploadAsset, applePath, googlePath, signedUrl } from '@/lib/cardDesign/storage';
import { resizeStampIcon, stampPath } from '@/lib/merchant/studioImages';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo
const KINDS = ['logo', 'strip', 'stamp_filled', 'stamp_empty'] as const;
type Kind = (typeof KINDS)[number];

export async function POST(req: Request) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });
  const { userId } = await getSessionRole();
  if (!userId) return NextResponse.json({ error: 'Session expirée' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const kind = (formData.get('kind') as string | null) ?? 'logo';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Champ « file » manquant ou invalide' }, { status: 400 });
    }
    if (!KINDS.includes(kind as Kind)) {
      return NextResponse.json({ error: 'Type d’asset inconnu' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format non supporté. Utilisez PNG, JPEG ou WebP.' }, { status: 415 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux. Maximum 5 Mo.' }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    let payload: Record<string, unknown>;
    if (kind === 'strip') {
      const out = await resizeStrip(buf);
      const [strip1, strip2, strip3, hero] = await Promise.all([
        uploadAsset(applePath(merchantId, 'strip.png'), out.apple_strip1),
        uploadAsset(applePath(merchantId, 'strip@2x.png'), out.apple_strip2),
        uploadAsset(applePath(merchantId, 'strip@3x.png'), out.apple_strip3),
        uploadAsset(googlePath(merchantId, 'hero.png'), out.google_hero),
      ]);
      payload = { assets: { apple: { strip1, strip2, strip3 }, google: { hero } } };
    } else if (kind === 'stamp_filled' || kind === 'stamp_empty') {
      const resized = await resizeStampIcon(buf);
      const path = await uploadAsset(
        stampPath(merchantId, kind === 'stamp_filled' ? 'filled' : 'empty'),
        resized
      );
      payload = { path };
    } else {
      const out = await resizeLogo(buf);
      const [x1, x2, x3, icon1, icon2, icon3, logo] = await Promise.all([
        uploadAsset(applePath(merchantId, 'logo.png'), out.apple_x1),
        uploadAsset(applePath(merchantId, 'logo@2x.png'), out.apple_x2),
        uploadAsset(applePath(merchantId, 'logo@3x.png'), out.apple_x3),
        uploadAsset(applePath(merchantId, 'icon.png'), out.apple_icon1),
        uploadAsset(applePath(merchantId, 'icon@2x.png'), out.apple_icon2),
        uploadAsset(applePath(merchantId, 'icon@3x.png'), out.apple_icon3),
        uploadAsset(googlePath(merchantId, 'logo.png'), out.google_logo),
      ]);
      payload = { assets: { apple: { x1, x2, x3, icon1, icon2, icon3 }, google: { logo } } };
    }

    await logAuditEvent({
      action: 'CARD_ASSET_UPLOADED',
      merchant_id: merchantId,
      user_id: userId,
      details: { kind },
      ...extractRequestMeta(req),
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('POST assets studio (marchand):', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// Bibliothèque d'images : tout ce que le tenant a déjà uploadé, avec URL signée.
export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: 'non authentifié' }, { status: 401 });

  try {
    const folders = ['apple', 'google', 'stamps'];
    const items: { path: string; name: string; folder: string; url: string; updatedAt: string | null }[] = [];

    for (const folder of folders) {
      const { data } = await supabaseAdmin.storage
        .from('card-assets')
        .list(`${merchantId}/${folder}`, { limit: 50, sortBy: { column: 'updated_at', order: 'desc' } });
      for (const entry of data ?? []) {
        if (!entry.name || entry.name.startsWith('.')) continue;
        const path = `${merchantId}/${folder}/${entry.name}`;
        try {
          const url = await signedUrl(path);
          items.push({
            path,
            name: entry.name,
            folder,
            url,
            updatedAt: (entry.updated_at as string | undefined) ?? null,
          });
        } catch {
          // fichier illisible : on l'ignore plutôt que de casser la bibliothèque
        }
      }
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET assets studio (marchand):', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
