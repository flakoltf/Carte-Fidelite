export type CustomerListItem = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  loyalty_cards: { id: string; stamps_count: number; last_scan: string | null }[] | null;
};

export type StatusFilter = "all" | "full" | "nocard";

export function filterCustomers(
  customers: CustomerListItem[],
  query: string,
  status: StatusFilter,
  stampGoal: number,
): CustomerListItem[] {
  const q = query.trim().toLowerCase();
  return customers.filter((c) => {
    const matchesQuery = !q
      || c.full_name.toLowerCase().includes(q)
      || (c.email ?? "").toLowerCase().includes(q)
      || (c.phone ?? "").toLowerCase().includes(q);
    if (!matchesQuery) return false;

    const card = c.loyalty_cards?.[0];
    if (status === "full") return !!card && card.stamps_count >= stampGoal;
    if (status === "nocard") return !card;
    return true;
  });
}
