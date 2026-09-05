// Appels du comptoir. TOUT passe par le client API central (`@/lib/api`) :
// c'est lui qui attache « Authorization: Bearer <jeton> » et normalise les
// erreurs — aucun `fetch` direct ici.
//
// Routes ouvertes au jeton Bearer (mission M1) : POST /api/scan et
// POST /api/scan/revert.

import { ApiError, api, type ApiClient } from "@/lib/api";

import { interpretScanResult, type ScanOutcome, type ScanResponseBody } from "./scanContract";
import { revertDoneMessage, type RevertableLoyaltyType } from "./revertRules";

/**
 * Crédite la carte scannée. Le `cardId` transmis est le PAYLOAD BRUT du QR
 * (signé) : c'est le serveur qui vérifie la signature et en extrait l'identifiant.
 *
 * Pas d'en-tête `Idempotency-Key` : le serveur ne dédoublonne que deux appels
 * portant la MÊME clé, et l'app ne rejoue jamais un scan automatiquement — une
 * clé aléatoire par appel (ce que fait le web) serait sans effet. La garde
 * anti-double-crédit reste le cooldown serveur.
 */
export async function submitScan(cardId: string, client: ApiClient = api()): Promise<ScanOutcome> {
  try {
    const body = await client.post<ScanResponseBody | null>("/api/scan", { cardId });
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
