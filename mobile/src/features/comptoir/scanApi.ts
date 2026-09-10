// Appels du comptoir. TOUT passe par le client API central (`@/lib/api`) :
// c'est lui qui attache « Authorization: Bearer <jeton> » et normalise les
// erreurs — aucun `fetch` direct ici.
//
// Routes ouvertes au jeton Bearer : POST /api/scan et POST /api/scan/revert
// (mission M1), POST /api/scan/redeem et GET /api/comptoir/rewards-due
// (comptoir complet).

import { ApiError, api, type ApiClient } from "@/lib/api";

import { interpretScanResult, type ScanOutcome, type ScanResponseBody } from "./scanContract";
import { revertDoneMessage, type RevertableLoyaltyType } from "./revertRules";

/**
 * Crédite la carte scannée. Le `cardId` transmis est le PAYLOAD BRUT du QR
 * (signé) : c'est le serveur qui vérifie la signature et en extrait l'identifiant.
 * `amountChf` : programmes `amount_points` uniquement — le montant tapé au
 * pavé CHF, que le serveur revalide (> 0, ≤ 10 000, 2 décimales max).
 *
 * Pas d'en-tête `Idempotency-Key` : le serveur ne dédoublonne que deux appels
 * portant la MÊME clé, et l'app ne rejoue jamais un scan automatiquement — une
 * clé aléatoire par appel (ce que fait le web) serait sans effet. La garde
 * anti-double-crédit reste le cooldown serveur.
 */
export async function submitScan(
  cardId: string,
  client: ApiClient = api(),
  amountChf?: number,
): Promise<ScanOutcome> {
  try {
    const body = await client.post<ScanResponseBody | null>(
      "/api/scan",
      amountChf === undefined ? { cardId } : { cardId, amountChf },
    );
    return interpretScanResult({ ok: true, body: body ?? {} }, cardId);
  } catch (error) {
    if (error instanceof ApiError) {
      return interpretScanResult(
        { ok: false, status: error.status, message: error.message, payload: error.payload },
        cardId,
      );
    }
    return interpretScanResult(
      { ok: false, status: 500, message: "Scan impossible pour le moment. Réessayez." },
      cardId,
    );
  }
}

export type RedeemResult =
  | { ok: true; cycleReset: boolean; tierReward: string | null }
  | { ok: false; offline: boolean; message: string };

/**
 * Encaisse la récompense (« Offrir »). Même contrat que le web
 * (RedeemFullScreen) : POST /api/scan/redeem { cardId } — ou
 * { cardId, tierThreshold } pour valider UN palier d'une carte à points.
 * La décision (carte pleine, palier atteint, déjà offert) reste au serveur ;
 * on relaie son verdict tel quel.
 */
export async function submitRedeem(
  cardId: string,
  tierThreshold?: number,
  client: ApiClient = api(),
): Promise<RedeemResult> {
  try {
    const body = await client.post<Record<string, unknown> | null>(
      "/api/scan/redeem",
      tierThreshold === undefined ? { cardId } : { cardId, tierThreshold },
    );
    if (body?.success !== true) {
      const msg = typeof body?.error === "string" && body.error.trim() ? body.error : "Échec de l'encaissement. Réessayez.";
      return { ok: false, offline: false, message: msg };
    }
    const tier = body.tier as { reward?: unknown } | null | undefined;
    return {
      ok: true,
      cycleReset: body.cycleReset === true,
      tierReward: typeof tier?.reward === "string" && tier.reward.trim() ? tier.reward : null,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      // Réseau coupé : lever l'ambiguïté « est-ce encaissé ou pas ? ».
      if (error.status === 0) return { ok: false, offline: true, message: "Réseau coupé — rien n'a été encaissé. Réessayez." };
      return { ok: false, offline: false, message: error.message };
    }
    return { ok: false, offline: false, message: "Échec de l'encaissement. Réessayez." };
  }
}

export type RevertResult = { ok: boolean; message: string };

/**
 * Annule le dernier crédit. La décision appartient à la RPC `scan_revert`
 * (fenêtre de 5 min, jamais sous zéro) : on affiche simplement sa réponse.
 */
export async function submitRevert(
  cardId: string,
  loyaltyType: RevertableLoyaltyType,
  client: ApiClient = api(),
): Promise<RevertResult> {
  try {
    await client.post("/api/scan/revert", { cardId });
    return { ok: true, message: revertDoneMessage(loyaltyType) };
  } catch (error) {
    if (error instanceof ApiError) {
      // Réseau coupé : lever l'ambiguïté « est-ce annulé ou pas ? ».
      if (error.status === 0) return { ok: false, message: "Réseau coupé — rien n'a été annulé." };
      return { ok: false, message: error.message };
    }
    return { ok: false, message: "Annulation impossible. Réessayez." };
  }
}
