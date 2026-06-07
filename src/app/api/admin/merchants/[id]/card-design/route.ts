export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminApi, getSessionRole } from '@/lib/adminAuth';
import { logAuditEvent, extractRequestMeta } from '@/lib/auditLog';
import { loadDesign, saveDesign } from '@/lib/cardDesign/repository';
import { validateDesign } from '@/lib/cardDesign/validation';
import { signedUrl } from '@/lib/cardDesign/storage';
import { ensureLoyaltyClass } from '@/lib/wallet/googleClass';

// GET /api/admin/merchants/[id]/card-design — lit le design courant du commerçant.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    const { id } = await params;
    const design = await loadDesign(supabaseAdmin, id);
    return NextResponse.json({ design });
  } catch (error) {
    console.error('Admin GET card-design error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT /api/admin/merchants/[id]/card-design — valide, sauvegarde et synchronise la classe Google.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    // Récupère l'utilisateur courant (réutilise getSessionRole pour éviter un double appel)
    const { userId } = await getSessionRole();
    if (!userId) {
      return NextResponse.json({ error: 'Session expirée' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { design } = body;

    // Garde : corps invalide → 400
    if (!design || typeof design !== 'object' || Array.isArray(design)) {
      return NextResponse.json({ error: 'Corps invalide : "design" manquant ou mal formé' }, { status: 400 });
    }

    // Validation
    const { errors, warnings } = validateDesign(design);
    if (errors.length) {
      return NextResponse.json({ errors }, { status: 422 });
    }

    // Sauvegarde en base
    await saveDesign(supabaseAdmin, id, userId, design);

    await logAuditEvent({
      action: 'CARD_DESIGN_UPDATED',
      merchant_id: id,
      user_id: userId,
      ...extractRequestMeta(req),
    });

    // Synchronisation Google Wallet (non bloquante en cas d'échec)
    try {
      const logoPath = design.logo?.assets?.google?.logo;
      const logoUrl = logoPath ? await signedUrl(logoPath) : undefined;
      const googleClassId = await ensureLoyaltyClass(id, design, logoUrl);

      await supabaseAdmin
        .from('card_designs')
        .update({
          google_class_id: googleClassId,
          google_class_synced_at: new Date().toISOString(),
        })
        .eq('merchant_id', id);

      await logAuditEvent({
        action: 'CARD_CLASS_SYNCED',
        merchant_id: id,
        user_id: userId,
        details: { googleClassId },
        ...extractRequestMeta(req),
      });

      return NextResponse.json({ ok: true, warnings, googleClassId });
    } catch (syncErr) {
      console.error(
        'Google Wallet sync failed:',
        syncErr instanceof Error ? syncErr.message : syncErr,
      );
      return NextResponse.json({ ok: true, warnings, googleSync: 'failed' }, { status: 207 });
    }
  } catch (error) {
    console.error('Admin PUT card-design error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
