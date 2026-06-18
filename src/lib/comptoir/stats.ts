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
const noReward: PromiseLike<CountResult> = Promise.resolve({ count: 0, error: null });

// Compte les cartes « prêtes à offrir » selon le type de programme. Le seuil et
// la colonne diffèrent (stamp_card → stamps_count/goal ; amount_points →
// points_balance/rewardThreshold). Tenancy posée dans chaque branche.
function rewardReadyQuery(
  admin: CountClient,
  merchantId: string,
  program: LoyaltyProgram,
): PromiseLike<CountResult> {
  if (program.type === "stamp_card") {
    return admin
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .gte("stamps_count", program.config.goal);
  }
  // amount_points : type pas encore dans l'union (livré par M-Points). On lit le
  // seuil de façon défensive sans casser le typage actuel.
  const p = program as { type: string; config: Record<string, unknown> };
  if (p.type === "amount_points") {
    const threshold = p.config.rewardThreshold;
    if (typeof threshold !== "number") return noReward;
    return admin
      .from("loyalty_cards")
      .select("id", { count: "exact", head: true })
      .eq("merchant_id", merchantId)
      .gte("points_balance", threshold);
  }
  // visit_based / tiered : pas de notion de carte « pleine » à offrir au comptoir.
  return noReward;
}

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

  // « Récompense due » = carte au seuil de récompense, non encore offerte.
  // - stamp_card : stamps_count >= goal (un encaissement remet à 0 → exclut les
  //   cartes déjà offertes).
  // - amount_points (M-Points, type pas encore dans l'union LoyaltyProgram) :
  //   points_balance >= rewardThreshold. Accès défensif tant que le type n'est
  //   pas livré. ATTENTION : la colonne `points_balance` n'existera en prod
  //   qu'APRÈS la migration M2 (non appliquée) — sans souci pour les tests (faux
  //   client), mais le compte renverra 0/erreur avalée d'ici là.
  const rewardsP = rewardReadyQuery(admin, merchantId, program);

  const [active, scans, rewards] = await Promise.all([activeP, scansP, rewardsP]);
  return {
    activeCards: safeCount(active),
    scansToday: safeCount(scans),
    rewardsDue: safeCount(rewards),
  };
}
