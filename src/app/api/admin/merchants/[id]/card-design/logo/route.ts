export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/adminAuth';
import { resizeLogo, resizeStrip } from '@/lib/cardDesign/imageSizes';
import { uploadAsset, applePath, googlePath } from '@/lib/cardDesign/storage';

const ALLOWED_TYPES = ['image/png', 'image/jpeg'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

// POST /api/admin/merchants/[id]/card-design/logo — redimensionne et stocke le logo.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Champ "file" invalide' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format non supporté. Utilisez PNG ou JPEG.' },
        { status: 415 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux. Max 5 Mo.' }, { status: 413 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const kind = (formData.get('kind') as string | null) ?? 'logo';

    // ── Strip / bannière : tailles strip Apple + hero Google ──────────────────
    if (kind === 'strip') {
      const out = await resizeStrip(buf);
      const [strip1, strip2, strip3, hero] = await Promise.all([
        uploadAsset(applePath(id, 'strip.png'), out.apple_strip1),
        uploadAsset(applePath(id, 'strip@2x.png'), out.apple_strip2),
        uploadAsset(applePath(id, 'strip@3x.png'), out.apple_strip3),
        uploadAsset(googlePath(id, 'hero.png'), out.google_hero),
      ]);
      return NextResponse.json({
        assets: { apple: { strip1, strip2, strip3 }, google: { hero } },
      });
    }

    // ── Logo (par défaut) : tailles logo + icône ──────────────────────────────
    const out = await resizeLogo(buf);
    const [x1, x2, x3, icon1, icon2, icon3, logo] = await Promise.all([
      uploadAsset(applePath(id, 'logo.png'), out.apple_x1),
      uploadAsset(applePath(id, 'logo@2x.png'), out.apple_x2),
      uploadAsset(applePath(id, 'logo@3x.png'), out.apple_x3),
      uploadAsset(applePath(id, 'icon.png'), out.apple_icon1),
      uploadAsset(applePath(id, 'icon@2x.png'), out.apple_icon2),
      uploadAsset(applePath(id, 'icon@3x.png'), out.apple_icon3),
      uploadAsset(googlePath(id, 'logo.png'), out.google_logo),
    ]);

    return NextResponse.json({
      assets: {
        apple: { x1, x2, x3, icon1, icon2, icon3 },
        google: { logo },
      },
    });
  } catch (error) {
    console.error('Admin POST logo error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
