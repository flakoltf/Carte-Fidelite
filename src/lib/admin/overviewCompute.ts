// Calculs purs du dashboard super-admin (testés sans réseau).
// Surface ADMIN UNIQUEMENT : ces fonctions agrègent des données cross-tenant —
// elles ne doivent être alimentées que derrière requireAdminPage/requireAdminApi.

import { BILLING_PLANS, normalizePlan, NEAR_THRESHOLD, type PlanKey } from "@/lib/billing/usage";

// ── Ligne santé enrichie (merchant_health ⋈ merchants) ─────────────────────
export interface HealthRow {
  merchantId: string;
  shopName: string;
  email: string | null;
  plan: PlanKey;
  healthScore: number;
  statut: "vert" | "orange" | "rouge";
  scans30j: number;
  cartesActives90j: number;
  cartesTotal: number;
  nouveauxClients30j: number;
  dernierScan: string | null;
  merchantSince: string;
  isDemo: boolean;
}

export function isDemoMerchant(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith("@example.com"));
}

// ── KPIs globaux ────────────────────────────────────────────────────────────
export interface GlobalKpis {
  merchants: number;
  /** ≥ 1 scan sur les 30 derniers jours. */
  activeMerchants: number;
  activeCards90: number;
  newMerchants30d: number;
}

export function computeGlobalKpis(rows: HealthRow[], now: Date): GlobalKpis {
  const cutoff30 = now.getTime() - 30 * 86400000;
  return {
    merchants: rows.length,
    activeMerchants: rows.filter((r) => r.scans30j > 0).length,
    activeCards90: rows.reduce((sum, r) => sum + r.cartesActives90j, 0),
    newMerchants30d: rows.filter((r) => new Date(r.merchantSince).getTime() >= cutoff30).length,
  };
}

// ── MRR estimé (placeholder honnête tant que Stripe n'est pas branché) ─────
// Hypothèses affichées avec le chiffre : prix du palier × marchand, hors
// comptes démo et hors essais en cours. Aucune facturation réelle derrière.
export interface MrrEstimate {
  totalChf: number;
  billableCount: number;
  excludedDemo: number;
  excludedTrial: number;
}

export function estimateMrr(
  merchants: { plan: unknown; email?: string | null; trial_ends_at?: string | null }[],
  now: Date
): MrrEstimate {
  let totalChf = 0, billableCount = 0, excludedDemo = 0, excludedTrial = 0;
  for (const m of merchants) {
    if (isDemoMerchant(m.email)) { excludedDemo++; continue; }
    if (m.trial_ends_at && new Date(m.trial_ends_at).getTime() > now.getTime()) { excludedTrial++; continue; }
    const price = BILLING_PLANS[normalizePlan(m.plan)].priceChf;
    if (price === null) continue; // palier custom : sur devis, non sommable
    totalChf += price;
    billableCount++;
  }
  return { totalChf, billableCount, excludedDemo, excludedTrial };
}

// ── Opportunités (upsell) & risques (dépassement) ───────────────────────────
export interface UsageRow {
  merchantId: string;
  shopName: string;
  plan: PlanKey;
  activeCards90: number;
  planCap: number | null;
}

export interface Opportunities {
  /** ≥ 80 % du plafond, pas encore dépassé — candidats upsell. */
  near: UsageRow[];
  /** > 100 % — dépassement : passage de palier le mois suivant (CGV §6.2). */
  over: UsageRow[];
}

export function classifyOpportunities(rows: UsageRow[]): Opportunities {
  const near: UsageRow[] = [];
  const over: UsageRow[] = [];
  for (const r of rows) {
    if (r.planCap === null || r.planCap <= 0) continue;
    const ratio = r.activeCards90 / r.planCap;
    if (ratio > 1) over.push(r);
    else if (ratio >= NEAR_THRESHOLD) near.push(r);
  }
  const byRatio = (a: UsageRow, b: UsageRow) =>
    b.activeCards90 / (b.planCap || 1) - a.activeCards90 / (a.planCap || 1);
  near.sort(byRatio);
  over.sort(byRatio);
  return { near, over };
}

// ── Signups dans le temps (semaine ISO simplifiée : tranches de 7 jours) ───
export function bucketSignupsByWeek(
  dates: (string | Date)[],
  now: Date,
  weeks = 12
): { label: string; value: number }[] {
  const DAY = 86400000;
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const start = new Date(now.getTime() - (weeks - i) * 7 * DAY);
    return {
      start: start.getTime(),
      end: start.getTime() + 7 * DAY,
      label: start.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit" }),
      value: 0,
    };
  });
  for (const d of dates) {
    const t = new Date(d).getTime();
    const b = buckets.find((x) => t >= x.start && t < x.end);
    if (b) b.value++;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

// ── Tri / filtre de la table santé (côté client) ───────────────────────────
export type HealthSortKey = "score" | "scans" | "cartes" | "nom" | "anciennete";
export type HealthFilter = "tous" | "vert" | "orange" | "rouge";

export function sortAndFilterHealth(
  rows: HealthRow[],
  filter: HealthFilter,
  sortKey: HealthSortKey,
  ascending: boolean
): HealthRow[] {
  const filtered = filter === "tous" ? [...rows] : rows.filter((r) => r.statut === filter);
  const dir = ascending ? 1 : -1;
  filtered.sort((a, b) => {
    switch (sortKey) {
      case "score": return (a.healthScore - b.healthScore) * dir;
      case "scans": return (a.scans30j - b.scans30j) * dir;
      case "cartes": return (a.cartesActives90j - b.cartesActives90j) * dir;
      case "nom": return a.shopName.localeCompare(b.shopName, "fr") * dir;
      case "anciennete":
        return (new Date(a.merchantSince).getTime() - new Date(b.merchantSince).getTime()) * dir;
    }
  });
  return filtered;
}
