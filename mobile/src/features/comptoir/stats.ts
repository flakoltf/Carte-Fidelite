// Les chiffres du jour, en tête de l'onglet Comptoir.
//
// MÊMES DONNÉES QUE LE COMPTOIR WEB (`src/lib/comptoir/stats.ts`) : mêmes
// tables, mêmes fenêtres, même définition de « carte active » (CGV §1). La
// lecture se fait ici avec la session du commerçant (clé anon + RLS
// « cards/scans scoped to merchant », migration 20240527_rls_policies.sql) —
// le web, lui, lit en service-role depuis une Server Action, qu'une app mobile
// ne peut pas appeler.
//
// ⚠️ Le 3ᵉ chiffre du web (« récompenses dues ») N'EST PAS repris : il exige de
// résoudre le programme de fidélité (`resolveLoyaltyProgram`, précédence
// loyalty_config.goal → stamp_goal). Le dupliquer ici serait recoder de la
// logique métier — précisément le genre de duplication qui a déjà produit un
// bug (PR #78). Il reviendra quand une route Bearer exposera ce comptage.

/** « Carte active » = activité dans les 90 derniers jours (BILLING_ACTIVE_DAYS, CGV §1). */
export const ACTIVE_CARD_DAYS = 90;

const DAY_MS = 86_400_000;

export interface ComptoirStats {
  activeCards: number;
  scansToday: number;
}

export const EMPTY_STATS: ComptoirStats = { activeCards: 0, scansToday: 0 };

type CountResult = { count: number | null; error: unknown };

/** Façade minimale du builder Supabase réellement utilisée (testable sans réseau). */
export interface CountQuery extends PromiseLike<CountResult> {
  select(columns: string, opts: { count: "exact"; head: true }): CountQuery;
  eq(column: string, value: string): CountQuery;
  or(filter: string): CountQuery;
  gte(column: string, value: string): CountQuery;
}

export interface CountClient {
  from(table: string): CountQuery;
}

// Un chiffre indisponible vaut zéro : le comptoir ne s'arrête jamais sur un KPI.
const safeCount = (result: CountResult): number => (result.error ? 0 : (result.count ?? 0));

export async function fetchComptoirStats(
  client: CountClient,
  merchantId: string,
  now: Date,
): Promise<ComptoirStats> {
  const activeCutoff = new Date(now.getTime() - ACTIVE_CARD_DAYS * DAY_MS).toISOString();
  // Fenêtre glissante de 24 h — même approximation du « jour » que le web.
  const dayCutoff = new Date(now.getTime() - DAY_MS).toISOString();

  const activeQuery = client
    .from("loyalty_cards")
    .select("id", { count: "exact", head: true })
    // Filtre de tenant explicite, en plus de la RLS (invariant CLAUDE.md n°3).
    .eq("merchant_id", merchantId)
    .or(`last_scan.gte.${activeCutoff},created_at.gte.${activeCutoff}`);

  const scansQuery = client
    .from("scan_history")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .gte("scanned_at", dayCutoff);

  const [active, scans] = await Promise.all([activeQuery, scansQuery]);

  return { activeCards: safeCount(active), scansToday: safeCount(scans) };
}
