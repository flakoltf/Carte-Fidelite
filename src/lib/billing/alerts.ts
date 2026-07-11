// Alerte de dépassement de palier — logique pure (testée sans réseau).
//
// Le cron mensuel `billing-snapshot` fige le comptage « cartes actives 90 j ».
// Ce module décide, à partir de ce comptage, quels marchands méritent une
// alerte interne (email récap au fondateur + note système), en réutilisant la
// même bascule de seuils que la jauge dashboard (`computeUsage` : near à 80 %,
// over au-delà du plafond). L'alerte INFORME : elle ne change jamais le plan —
// le passage de palier reste une décision manuelle du fondateur (CGV §6.2).
//
// Idempotence : on ne ré-alerte pas tant que la sévérité n'a pas monté. Le
// niveau déjà notifié est mémorisé dans `billing_snapshots.alert_level` ; on
// compare le niveau courant au niveau déjà enregistré pour le mois.

import { computeUsage } from "./usage";

export type AlertLevel = "near" | "over";

/** Ligne de comptage du mois (issue de la vue `billing_active_cards`). */
export interface AlertSnapshotRow {
  merchant_id: string;
  plan: unknown;
  active_cards_90d: number;
  /** Facultatif : nom du commerce, pour un récap lisible. */
  merchant_name?: string | null;
}

/** Niveau déjà notifié pour la période (lu avant l'upsert du snapshot). */
export interface ExistingAlertState {
  merchant_id: string;
  alert_level: string | null;
}

export interface MerchantAlert {
  merchantId: string;
  merchantName: string | null;
  level: AlertLevel;
  activeCards: number;
  cap: number;
  planLabel: string;
  /** Corps de la note système déposée dans `admin_notes`. */
  noteBody: string;
}

export interface BillingAlertDigest {
  subject: string;
  html: string;
  text: string;
}

export interface BillingAlertPlan {
  alerts: MerchantAlert[];
  /** Null quand aucun marchand ne franchit un nouveau seuil ce mois-ci. */
  digest: BillingAlertDigest | null;
}

const RANK: Record<string, number> = { over: 2, near: 1 };

function rankOf(level: string | null | undefined): number {
  return level ? (RANK[level] ?? 0) : 0;
}

function noteBodyFor(name: string, level: AlertLevel, cards: number, cap: number, planLabel: string): string {
  const franchi = level === "over" ? "plafond dépassé" : "seuil d'alerte (80 %) atteint";
  return (
    `[HALO • facturation] ${name} : ${cards} cartes actives pour ${cap} incluses ` +
    `dans le palier ${planLabel} — ${franchi}. À examiner : proposer le passage de palier ` +
    `(ajustement manuel du plan, aucun service interrompu au comptoir).`
  );
}

/**
 * Décide des alertes de palier pour une période donnée.
 *
 * @param rows       comptage du mois par marchand (vue billing_active_cards)
 * @param existing   niveaux déjà notifiés pour la période (avant upsert)
 * @param period     période au format `YYYY-MM-01`
 */
export function computeBillingAlerts(
  rows: AlertSnapshotRow[],
  existing: ExistingAlertState[],
  period: string,
): BillingAlertPlan {
  const priorByMerchant = new Map(existing.map((e) => [e.merchant_id, e.alert_level]));

  const alerts: MerchantAlert[] = [];
  for (const row of rows) {
    const usage = computeUsage(row.active_cards_90d, row.plan);
    if (usage.state !== "near" && usage.state !== "over") continue;
    if (usage.cap === null) continue; // palier sur mesure : pas de plafond à surveiller

    const level = usage.state;
    const prior = priorByMerchant.get(row.merchant_id) ?? null;
    // On n'alerte qu'à la première bascule ou à une montée de sévérité (near → over).
    if (rankOf(level) <= rankOf(prior)) continue;

    const name = row.merchant_name?.trim() || row.merchant_id;
    alerts.push({
      merchantId: row.merchant_id,
      merchantName: row.merchant_name?.trim() || null,
      level,
      activeCards: usage.activeCards,
      cap: usage.cap,
      planLabel: usage.planLabel,
      noteBody: noteBodyFor(name, level, usage.activeCards, usage.cap, usage.planLabel),
    });
  }

  if (alerts.length === 0) return { alerts, digest: null };

  const overCount = alerts.filter((a) => a.level === "over").length;
  const subject =
    overCount > 0
      ? `HALO — ${alerts.length} commerce(s) au palier (${overCount} en dépassement)`
      : `HALO — ${alerts.length} commerce(s) proche(s) du plafond`;

  const lines = alerts.map((a) => {
    const name = a.merchantName || a.merchantId;
    const tag = a.level === "over" ? "DÉPASSÉ" : "80 %";
    return `• [${tag}] ${name} — ${a.activeCards}/${a.cap} cartes actives (palier ${a.planLabel})`;
  });

  const text =
    `Comptage figé le ${period}. Commerces à examiner pour un passage de palier ` +
    `(ajustement manuel, aucun service interrompu) :\n\n${lines.join("\n")}\n`;

  const htmlItems = alerts
    .map((a) => {
      const name = a.merchantName || a.merchantId;
      const tag = a.level === "over" ? "Dépassé" : "Proche (80 %)";
      return `<li><strong>${name}</strong> — ${a.activeCards}/${a.cap} cartes actives · palier ${a.planLabel} · <em>${tag}</em></li>`;
    })
    .join("");
  const html =
    `<p>Comptage figé le ${period}. Commerces à examiner pour un passage de palier ` +
    `(ajustement manuel, aucun service interrompu au comptoir) :</p><ul>${htmlItems}</ul>`;

  return { alerts, digest: { subject, html, text } };
}
