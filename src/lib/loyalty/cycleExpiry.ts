// Échéance glissante des mécaniques à cycle SANS ancre dédiée (stamp_card,
// amount_points) : contrairement à points (ancre points_cycle_started_at posée
// au 1er scan du cycle), l'ancre est ici le DERNIER passage — last_scan,
// entretenue par toutes les RPC de scan — avec repli sur created_at (carte
// jamais scannée : tampon de bienvenue seul). Aucune colonne ajoutée.
//
// Idempotence : le cron ne considère que les cartes à compteur > 0 ; une carte
// remise à zéro sort du périmètre jusqu'à son prochain passage. Logique pure
// (testée sans réseau) — le cron ne fait que filtrer et écrire.

import { pointsCycleExpired } from "./points";
import type { CycleExpiration } from "./types";

export type CycleCardInput = {
  expiration: CycleExpiration | undefined;
  /** Compteur du cycle : stamps_count (stamp_card) ou points_balance (amount_points). */
  count: number;
  lastScan: string | null;
  createdAt: string | null;
  now: Date;
};

export function cycleCardExpired({ expiration, count, lastScan, createdAt, now }: CycleCardInput): boolean {
  if (count <= 0) return false; // rien à remettre à zéro
  const raw = lastScan ?? createdAt;
  if (!raw) return false; // aucune ancre exploitable : ne jamais expirer par défaut
  const anchor = new Date(raw);
  if (Number.isNaN(anchor.getTime())) return false;
  // Même frontière glissante que points (N mois, fins de mois normalisées).
  return pointsCycleExpired(expiration, anchor, now);
}
