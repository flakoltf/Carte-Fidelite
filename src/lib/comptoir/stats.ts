import { BILLING_ACTIVE_DAYS } from "@/lib/analytics/types";
import type { LoyaltyProgram } from "@/lib/loyalty/types";

// Les 3 chiffres du comptoir (<StatTrio>). Logique d'accès pure : aucune
// résolution de tenant ici — l'appelant (Server Action) passe le merchantId
// DÉJÀ résolu, et chaque requête repose explicitement le filtre
// `.eq("merchant_id", …)` (invariant tenancy CLAUDE.md n°3).
export interface ComptoirStats {
  activeCards: number;
  scansToday: number;
  rewardsDue: number;
}

// Façade minimale du builder Supabase réellement utilisée ici. Permet de tester
// `queryComptoirStats` sans réseau (on injecte un faux client) tout en restant
// structurellement compatible avec le vrai `supabaseAdmin`.
type CountResult = { count: number | null; error: unknown };
export interface CountQuery extends PromiseLike<CountResult> {
  select(columns: string, opts: { count: "exact"; head: true }): CountQuery;
  eq(column: string, value: string): CountQuery;
  or(filter: string): CountQuery;
  gte(column: string, value: string | number): CountQuery;
}
export interface CountClient {
  from(table: string): CountQuery;
}

const dayMs = 86_400_000;
const safeCount = (r: CountResult): number => (r.error ? 0 : r.count ?? 0);

export async function queryComptoirStats(
  admin: CountClient,
  merchantId: string,
  program: LoyaltyProgram,
  now: Date,
): Promise<ComptoirStats> {
  // « Carte active » = activité (installation OU scan) dans les 90 j — même
  // définition que la vue billing_active_cards / CGV §1.
  const activeCutoff = new Date(now.getTime() - BILLING_ACTIVE_DAYS * dayMs).toISOString();
  // Scans « aujourd'hui » : fenêtre glissante de 24 h (approxime le jour Genève,
  // tolérance acceptée par le cahier des charges U3).
  const dayCutoff = new Date(now.getTime() - dayMs).toISOString();
  // « Récompense due » = carte pleine non encore offerte. Seul le stamp_card a
  // une notion de seuil (stamps_count >= goal) ; un encaissement remet à 0, donc
  // ce comptage exclut naturellement les cartes déjà offertes.
  const goal = program.type === "stamp_card" ? program.config.goal : null;

  const activeP = admin
    .from("loyalty_cards")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .or(`last_scan.gte.${activeCutoff},created_at.gte.${activeCutoff}`);

  const scansP = admin
    .from("scan_history")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .gte("scanned_at", dayCutoff);

  const rewardsP: PromiseLike<CountResult> =
    goal === null
      ? Promise.resolve({ count: 0, error: null })
      : admin
          .from("loyalty_cards")
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", merchantId)
          .gte("stamps_count", goal);

  const [active, scans, rewards] = await Promise.all([activeP, scansP, rewardsP]);
  return {
    activeCards: safeCount(active),
    scansToday: safeCount(scans),
    rewardsDue: safeCount(rewards),
  };
}
