export type MerchantListItem = {
  id: string;
  shop_name: string;
  email: string | null;
  primary_color: string | null;
  enrollment_token: string;
  business_type: string | null;
  managed_by_concierge: boolean;
  created_at: string; // ISO
  has_card: boolean;
  customer_count: number;
  scan_count: number;
  card_count: number; // cartes de fidélité (loyalty_cards) — « cartes actives »
};

export type TriState = "all" | "yes" | "no";
export type MerchantSort = "recent" | "name";
export const MERCHANTS_PAGE_SIZE = 12;

export type MerchantFilters = {
  businessType: string; // "all" ou une valeur de BUSINESS_TYPES
  concierge: TriState;
  hasCard: TriState;
};

function triMatch(state: TriState, value: boolean): boolean {
  return state === "all" || (state === "yes") === value;
}

export function filterMerchants(
  list: MerchantListItem[],
  query: string,
  filters: MerchantFilters,
  sort: MerchantSort,
): MerchantListItem[] {
  const q = query.trim().toLowerCase();

  const filtered = list.filter((m) => {
    const matchesQuery =
      !q ||
      m.shop_name.toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (filters.businessType !== "all" && m.business_type !== filters.businessType) return false;
    if (!triMatch(filters.concierge, m.managed_by_concierge)) return false;
    if (!triMatch(filters.hasCard, m.has_card)) return false;
    return true;
  });

  // Tri : nom via collation FR (gère les accents) ; récent via comparaison ISO
  // explicite (les chaînes ISO 8601 s'ordonnent lexicographiquement = chronologiquement).
  return [...filtered].sort((a, b) =>
    sort === "name"
      ? a.shop_name.localeCompare(b.shop_name, "fr")
      : b.created_at < a.created_at ? -1 : b.created_at > a.created_at ? 1 : 0,
  );
}

export function paginate<T>(list: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize;
  return list.slice(start, start + pageSize);
}
