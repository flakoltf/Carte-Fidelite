import { isRewardReady, type CardLoyaltySnapshot } from "./loyaltyCell";
import type { LoyaltyProgram } from "@/lib/loyalty/types";

export type CustomerListItem = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  loyalty_cards: ({ id: string; last_scan: string | null } & CardLoyaltySnapshot)[] | null;
};

export type StatusFilter = "all" | "full" | "nocard";

export function filterCustomers(
  customers: CustomerListItem[],
  query: string,
  status: StatusFilter,
  program: LoyaltyProgram,
): CustomerListItem[] {
  const q = query.trim().toLowerCase();
  return customers.filter((c) => {
    const matchesQuery = !q
      || c.full_name.toLowerCase().includes(q)
      || (c.email ?? "").toLowerCase().includes(q)
      || (c.phone ?? "").toLowerCase().includes(q);
    if (!matchesQuery) return false;

    const card = c.loyalty_cards?.[0];
    // « Carte pleine » = prête à encaisser SELON la mécanique du programme
    // (tampons pour stamp_card, points pour amount_points/points…).
    if (status === "full") return !!card && isRewardReady(program, card);
    if (status === "nocard") return !card;
    return true;
  });
}
