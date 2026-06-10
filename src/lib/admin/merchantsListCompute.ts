// Modèle + tri/filtre/recherche purs de la table marchands (testés sans réseau).
// Surface ADMIN UNIQUEMENT — même règle d'import que overviewCompute.

import type { PlanKey } from "@/lib/billing/usage";
import type { MerchantAdminStatus } from "./merchantControls";

export interface MerchantTableRow {
  id: string;
  shopName: string;
  email: string | null;
  slug: string | null;
  businessType: string | null;
  address: string | null;
  createdAt: string;
  managedByConcierge: boolean;
  status: MerchantAdminStatus;
  plan: PlanKey;
  cap: number | null;
  capOverride: number | null;
  activeCards90: number;
  cardsTotal: number;
  scans30d: number;
  lastScanAt: string | null;
  healthScore: number | null;
  healthStatus: "vert" | "orange" | "rouge" | null;
  flaggedForFollowup: boolean;
  isDemo: boolean;
}

export type MerchantSortKey = "nom" | "sante" | "palier" | "conso" | "scans" | "activite" | "anciennete";
export type MerchantStatusFilter = "tous" | "actif" | "suspendu" | "rouge" | "a_relancer";

export interface MerchantTableQuery {
  search: string;
  statusFilter: MerchantStatusFilter;
  planFilter: PlanKey | "tous";
  sortKey: MerchantSortKey;
  ascending: boolean;
}

export const DEFAULT_MERCHANT_QUERY: MerchantTableQuery = {
  search: "",
  statusFilter: "tous",
  planFilter: "tous",
  sortKey: "sante",
  ascending: true,
};

function matchesSearch(row: MerchantTableRow, needle: string): boolean {
  if (!needle) return true;
  const haystack = [row.shopName, row.email, row.slug, row.businessType, row.address]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return needle
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function matchesStatus(row: MerchantTableRow, filter: MerchantStatusFilter): boolean {
  switch (filter) {
    case "tous": return true;
    case "actif": return row.status === "actif";
    case "suspendu": return row.status === "suspendu";
    case "rouge": return row.healthStatus === "rouge";
    case "a_relancer": return row.flaggedForFollowup;
  }
}

const PLAN_ORDER: Record<PlanKey, number> = { essentiel: 0, croissance: 1, premium: 2, custom: 3 };

export function filterAndSortMerchants(
  rows: MerchantTableRow[],
  query: MerchantTableQuery
): MerchantTableRow[] {
  const filtered = rows.filter(
    (r) =>
      matchesSearch(r, query.search.trim()) &&
      matchesStatus(r, query.statusFilter) &&
      (query.planFilter === "tous" || r.plan === query.planFilter)
  );

  const dir = query.ascending ? 1 : -1;
  filtered.sort((a, b) => {
    switch (query.sortKey) {
      case "nom": return a.shopName.localeCompare(b.shopName, "fr") * dir;
      case "sante": return ((a.healthScore ?? -1) - (b.healthScore ?? -1)) * dir;
      case "palier": return (PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan]) * dir;
      case "conso": {
        const ratio = (r: MerchantTableRow) => (r.cap ? r.activeCards90 / r.cap : -1);
        return (ratio(a) - ratio(b)) * dir;
      }
      case "scans": return (a.scans30d - b.scans30d) * dir;
      case "activite": {
        const t = (r: MerchantTableRow) => (r.lastScanAt ? new Date(r.lastScanAt).getTime() : 0);
        return (t(a) - t(b)) * dir;
      }
      case "anciennete":
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });
  return filtered;
}

export function countMerchantsByFilter(rows: MerchantTableRow[]): Record<MerchantStatusFilter, number> {
  return {
    tous: rows.length,
    actif: rows.filter((r) => r.status === "actif").length,
    suspendu: rows.filter((r) => r.status === "suspendu").length,
    rouge: rows.filter((r) => r.healthStatus === "rouge").length,
    a_relancer: rows.filter((r) => r.flaggedForFollowup).length,
  };
}
