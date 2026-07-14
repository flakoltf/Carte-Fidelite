export const runtime = 'nodejs';

// POST /api/merchant/card-design/publish (Agent A)
// Publication du design : validation studio complète, versionnage (+1),
// synchronisation de l'objectif de tampons, puis synchro de la classe Google
// Wallet (best-effort, GET-then-merge via ensureLoyaltyClass — invariant 2).
//
// Tenancy (invariant 3) : currentMerchantId() + .eq('merchant_id', …) sur
// chaque requête supabaseAdmin ; assets re-scopés au préfixe du tenant.

import { NextResponse } from 'next/server';
import { currentMerchantId } from '@/lib/analytics/merchant';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionRole } from '@/lib/adminAuth';
import { logAuditEvent, extractRequestMeta } from '@/lib/auditLog';
import { validateStudioDesign } from '@/lib/cardDesign/studioValidation';
import { signedUrl } from '@/lib/cardDesign/storage';
import { ensureLoyaltyClass } from '@/lib/wallet/googleClass';
import { refreshMerchantPasses } from '@/lib/wallet/refresh';
import {
  parseCardDesign,
  enforceAssetOwnership,
  designToPublishRow,
  stampGoalForMerchant,
} from '@/lib/merchant/cardStudio';
import { buildLoyaltyUpdate, type LoyaltyMerchantUpdate } from '@/lib/loyalty/studioRules';

export async function POST(req: Request) {
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

  const parsed = parseCardDesign((body as { design?: unknown })?.design);
  if (!parsed) return NextResponse.json({ error: 'Design mal formé' }, { status: 400 });
  const design = enforceAssetOwnership(parsed, merchantId);

  const { errors, warnings } = validateStudioDesign(design);
  if (errors.length) return NextResponse.json({ errors, warnings }, { status: 422 });

  // B — Règles du programme (optionnel) : validées AVANT toute écriture pour ne
  // jamais publier un design avec des règles invalides. Réutilise validate.ts.
  let loyaltyUpdate: LoyaltyMerchantUpdate | null = null;
  const programInput = (body as { program?: unknown }).program;
  if (programInput !== undefined && programInput !== null) {
    const lr = buildLoyaltyUpdate(programInput as Parameters<typeof buildLoyaltyUpdate>[0]);
    if (!lr.ok) return NextResponse.json({ errors: [lr.error], warnings }, { status: 422 });
    loyaltyUpdate = lr.update;
  }

  try {
    // Versionnage simple : lecture du compteur courant puis +1 (contention
    // quasi nulle : un seul éditeur par tenant ; pas besoin de RPC atomique).
    const { data: row } = await supabaseAdmin
      .from('card_designs')
      .select('version')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    const nextVersion = ((row?.version as number | null) ?? 0) + 1;

    const { error: upsertError } = await supabaseAdmin
      .from('card_designs')
      .upsert(designToPublishRow(design, merchantId, userId, nextVersion), {
        onConflict: 'merchant_id',
      });
    if (upsertError) throw new Error(upsertError.message);

    // Aligne le moteur de fidélité (scan_increment lit merchants.stamp_goal).
    const goal = stampGoalForMerchant(design);
    if (goal !== null) {
      await supabaseAdmin.from('merchants').update({ stamp_goal: goal }).eq('id', merchantId);
    }

    // B — Persiste les règles du programme (loyalty_type/config + reward_label).
    // Tenant strict (.eq('id', merchantId), invariant 3) ; pas de migration (jsonb
    // + colonne reward_label existante) ; action d'audit existante (#1 respecté).
    if (loyaltyUpdate) {
      await supabaseAdmin
        .from('merchants')
        .update({
          loyalty_type: loyaltyUpdate.loyalty_type,
          loyalty_config: loyaltyUpdate.loyalty_config,
          reward_label: loyaltyUpdate.reward_label,
        })
        .eq('id', merchantId);
      await logAuditEvent({
        action: 'MERCHANT_UPDATED',
        merchant_id: merchantId,
        user_id: userId,
        details: { via: 'studio-publish', loyalty_type: loyaltyUpdate.loyalty_type },
        ...extractRequestMeta(req),
      });
    }

    await logAuditEvent({
      action: 'CARD_DESIGN_PUBLISHED',
      merchant_id: merchantId,
      user_id: userId,
      details: { version: nextVersion },
      ...extractRequestMeta(req),
    });

    // Propage le nouveau design aux cartes déjà installées : push APNs SILENCIEUX
    // (comme un changement d'identité/photo, cf. refreshMerchantPasses) — iOS
    // re-récupère le pass reconstruit. Pas de bannière : une refonte de design
    // n'est pas un événement client, l'envoyer en alerte serait du spam.
    // Best-effort : un échec de push ne doit jamais faire échouer la publication.
    try {
      await refreshMerchantPasses(merchantId);
    } catch (pushErr) {
      console.error('refresh passes après publish design:', pushErr instanceof Error ? pushErr.message : pushErr);
    }

    // Synchro Google Wallet — best-effort, comme côté admin (207 si échec).
    try {
      const logoPath = design.logo.assets?.google?.logo;
      const heroPath = design.logo.assets?.google?.hero;
      const logoUrl = logoPath ? await signedUrl(logoPath) : undefined;
      const heroUrl = heroPath ? await signedUrl(heroPath) : undefined;
      const googleClassId = await ensureLoyaltyClass(merchantId, design, logoUrl, heroUrl);

      await supabaseAdmin
        .from('card_designs')
        .update({ google_class_id: googleClassId, google_class_synced_at: new Date().toISOString() })
        .eq('merchant_id', merchantId);

      await logAuditEvent({
        action: 'CARD_CLASS_SYNCED',
        merchant_id: merchantId,
        user_id: userId,
        details: { googleClassId },
        ...extractRequestMeta(req),
      });

      return NextResponse.json({ ok: true, version: nextVersion, warnings, googleClassId });
    } catch (syncErr) {
      console.error('Google Wallet sync (studio marchand):', syncErr instanceof Error ? syncErr.message : syncErr);
      return NextResponse.json(
        { ok: true, version: nextVersion, warnings, googleSync: 'failed' },
        { status: 207 }
      );
    }
  } catch (error) {
    console.error('POST publish card-design (marchand):', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
