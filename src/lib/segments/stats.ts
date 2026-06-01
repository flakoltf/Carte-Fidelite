import { type CustomerStats } from "./types";

export type CustomerRow = { id: string; full_name: string | null; created_at: string };
export type CardRow = { id: string; stamps_count: number | null; last_scan: string | null };

export function buildCustomerStats(
  customer: CustomerRow,
  cards: CardRow[],
  scanCounts: Map<string, number>,
  reachableSerials: Set<string>,
): CustomerStats {
  let visits = 0;
  let lastScanMs = 0;
  let maxStamps = 0;
  let reachablePush = false;
  for (const c of cards) {
    visits += scanCounts.get(c.id) ?? 0;
    if (c.last_scan) lastScanMs = Math.max(lastScanMs, new Date(c.last_scan).getTime());
    maxStamps = Math.max(maxStamps, c.stamps_count ?? 0);
    if (reachableSerials.has(c.id)) reachablePush = true;
  }
  return {
    customerId: customer.id,
    name: customer.full_name ?? "Client",
    visits,
    lastScan: lastScanMs > 0 ? new Date(lastScanMs) : null,
    createdAt: new Date(customer.created_at),
    maxStamps,
    reachablePush,
  };
}
