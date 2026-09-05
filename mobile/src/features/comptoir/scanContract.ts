// Traduction des réponses de POST /api/scan en états d'écran.
//
// CONTRAT DE RÉFÉRENCE : src/app/api/scan/route.ts (app web). Le serveur décide
// (cooldown, plafond, récompense, tenancy) ; ce module ne fait que LIRE sa
// réponse. Aucune règle métier n'est recalculée ici — pas de seuil, pas de
// compteur, pas de fenêtre. Fonction pure, donc testée sans réseau.
//
// Succès (200) selon la mécanique :
//   stamp_card / visit_based / tiered
//     { success, card: { stamps_count, customers }, stampGoal, loyaltyType,
//       rewardReady, rewardUnlocked, added, events }
//     — carte déjà pleine : added:false, rewardReady:true
//   points
//     { success, loyaltyType:"points", currentValue, pointsAdded, added,
//       rewardReady, redeemableTiers, maxThreshold }
//   amount_points  (AUCUN loyaltyType dans la réponse)
//     { success, currentValue, pointsEarned, rewardReady, rewardLabel }
//
// Refus : 400 (QR forgé · montant CHF requis) · 401 · 403 (autre établissement,
// compte suspendu) · 404 (carte introuvable) · 429 ({ cooldown: true } pour un
// doublon, sinon plafond de scans) · 500.

import { canRevertScan, type RevertableLoyaltyType } from "./revertRules";

export type LoyaltyType = "stamp_card" | "visit_based" | "tiered" | "points" | "amount_points";

/** Corps de réponse du serveur, lu défensivement (aucun champ n'est supposé présent). */
export type ScanResponseBody = Record<string, unknown>;

/** Résultat brut d'un appel, tel que le produit `scanApi.ts` depuis `api()`. */
export type ScanApiResult =
  | { ok: true; body: ScanResponseBody }
  | { ok: false; status: number; message: string; payload?: unknown };

export type ScanOutcomeKind =
  | "credit"
  | "reward"
  | "cooldown"
  | "unknown-card"
  | "offline"
  | "amount-required"
  | "refused";

export interface ScanOutcome {
  kind: ScanOutcomeKind;
  /** Ligne géante de l'écran de résultat. */
  title: string;
  /** Progression ou précision sous le titre ; `null` quand le serveur n'en donne pas. */
  detail: string | null;
  /** Message d'explication (refus) — toujours celui du serveur quand il en fournit un. */
  message: string | null;
  customerName: string | null;
  loyaltyType: LoyaltyType | null;
  /** Renseigné uniquement quand le bandeau « Annuler » a lieu d'être. */
  revert: { cardId: string; loyaltyType: RevertableLoyaltyType } | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

function readLoyaltyType(body: ScanResponseBody): LoyaltyType | null {
  const t = body.loyaltyType;
  if (t === "stamp_card" || t === "visit_based" || t === "tiered" || t === "points") return t;
  // amount_points ne se déclare pas : sa réponse porte `pointsEarned`.
  if (num(body.pointsEarned) !== null) return "amount_points";
  return null;
}

function readCustomerName(body: ScanResponseBody): string | null {
  const card = body.card as { customers?: { full_name?: unknown } | null } | null | undefined;
  return str(card?.customers?.full_name);
}

function readCounter(body: ScanResponseBody): number | null {
  const card = body.card as { stamps_count?: unknown } | null | undefined;
  return num(card?.stamps_count);
}

/** Titre du crédit : le mot juste par mécanique, comme au comptoir web. */
function creditTitle(type: LoyaltyType | null, body: ScanResponseBody): string {
  if (type === "visit_based") return "Visite enregistrée";
  if (type === "tiered") return "Passage compté";
  if (type === "points") return `+${plural(num(body.pointsAdded) ?? 0, "point")}`;
  if (type === "amount_points") return `+${plural(num(body.pointsEarned) ?? 0, "point")}`;
  return "+1 tampon";
}

/** Progression affichée sous le titre, telle que le serveur la donne. */
function creditDetail(type: LoyaltyType | null, body: ScanResponseBody): string | null {
  if (type === "points") {
    const current = num(body.currentValue);
    const max = num(body.maxThreshold);
    return current !== null && max !== null ? `${current} / ${max}` : current !== null ? plural(current, "point") : null;
  }
  if (type === "amount_points") {
    const current = num(body.currentValue);
    return current !== null ? plural(current, "point") : null;
  }
  const count = readCounter(body);
  if (count === null) return null;
  if (type === "visit_based") return plural(count, "visite");
  if (type === "tiered") return plural(count, "passage");
  const goal = num(body.stampGoal);
  return goal !== null ? `${count} / ${goal}` : String(count);
}

const AMOUNT_REQUIRED = /montant en chf/i;

function refusal(
  kind: ScanOutcomeKind,
  title: string,
  message: string,
  loyaltyType: LoyaltyType | null = null,
): ScanOutcome {
  return { kind, title, detail: null, message, customerName: null, loyaltyType, revert: null };
}

export function interpretScanResult(result: ScanApiResult, cardId: string): ScanOutcome {
  if (!result.ok) {
    const { status, message } = result;
    if (status === 0) {
      return refusal("offline", "Pas de réseau", "Le crédit n'a pas été enregistré. Réessayez une fois connecté.");
    }
    // Doublon : le serveur pose explicitement `cooldown: true` (429). Un 429 sans
    // ce drapeau est le plafond de scans par minute — message du serveur.
    const payload = (result.payload ?? {}) as { cooldown?: unknown };
    if (status === 429 && payload.cooldown === true) {
      return refusal("cooldown", "Déjà scanné il y a un instant", message);
    }
    if (status === 404) {
      return refusal("unknown-card", "Carte inconnue", message);
    }
    if (status === 400 && AMOUNT_REQUIRED.test(message)) {
      return refusal(
        "amount-required",
        "Crédit au montant",
        "Cette carte se crédite selon le montant dépensé : passez par le comptoir sur ordinateur.",
        "amount_points",
      );
    }
    return refusal("refused", "Scan refusé", message);
  }

  const body = result.body;
  if (body.success !== true) {
    return refusal("refused", "Scan refusé", str(body.error) ?? "Scan refusé.");
  }

  const loyaltyType = readLoyaltyType(body);
  const customerName = readCustomerName(body);

  // Récompense atteinte : le serveur l'annonce (rewardReady), qu'un crédit ait
  // eu lieu ou que la carte fût déjà pleine. Jamais d'annulation ici.
  if (body.rewardReady === true) {
    return {
      kind: "reward",
      title: "Récompense atteinte",
      detail: creditDetail(loyaltyType, body),
      message: null,
      customerName,
      loyaltyType,
      revert: null,
    };
  }

  return {
    kind: "credit",
    title: creditTitle(loyaltyType, body),
    detail: creditDetail(loyaltyType, body),
    message: null,
    customerName,
    loyaltyType,
    revert: canRevertScan(loyaltyType) ? { cardId, loyaltyType } : null,
  };
}
