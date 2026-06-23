import { describe, it, expect } from "vitest";
import { queryComptoirStats, type CountClient, type CountQuery } from "../stats";
import type { LoyaltyProgram } from "@/lib/loyalty/types";

// Faux client Supabase : enregistre, pour chaque requête, la table et les
// filtres `.eq("merchant_id", …)` posés, puis résout un count fixé par table.
type Call = { table: string; eqMerchant: string | null; filters: string[] };

function fakeClient(countsByTable: Record<string, number>): {
  client: CountClient;
  calls: Call[];
} {
  const calls: Call[] = [];
  const client: CountClient = {
    from(table: string): CountQuery {
      const call: Call = { table, eqMerchant: null, filters: [] };
      calls.push(call);
      const result = { count: countsByTable[table] ?? 0, error: null };
      const q: CountQuery = {
        select: () => q,
        eq: (col: string, val: string) => {
          if (col === "merchant_id") call.eqMerchant = val;
          return q;
        },
        or: (f: string) => {
          call.filters.push(`or:${f}`);
          return q;
        },
        gte: (col: string, val: string | number) => {
          call.filters.push(`gte:${col}:${val}`);
          return q;
        },
        then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
      };
      return q;
    },
  };
  return { client, calls };
}

const stampProgram: LoyaltyProgram = { type: "stamp_card", config: { goal: 10 } };
const NOW = new Date("2026-06-18T12:00:00.000Z");

describe("queryComptoirStats", () => {
  it("mappe les counts par table sur les 3 chiffres", async () => {
    const { client } = fakeClient({ loyalty_cards: 42, scan_history: 7 });
    // loyalty_cards est interrogée 2x (actives + rewardsDue) → même count fixe (42).
    const stats = await queryComptoirStats(client, "m-1", stampProgram, NOW);
    expect(stats).toEqual({ activeCards: 42, scansToday: 7, rewardsDue: 42 });
  });

  it("pose .eq(merchant_id) sur CHAQUE requête (tenancy)", async () => {
    const { client, calls } = fakeClient({ loyalty_cards: 1, scan_history: 1 });
    await queryComptoirStats(client, "tenant-X", stampProgram, NOW);
    expect(calls.length).toBe(3);
    for (const c of calls) {
      expect(c.eqMerchant, `${c.table} sans filtre merchant_id`).toBe("tenant-X");
    }
  });

  it("rewardsDue = 0 et aucune 2e requête loyalty_cards pour un programme sans seuil", async () => {
    const visit: LoyaltyProgram = { type: "visit_based", config: { milestones: [5, 10] } };
    const { client, calls } = fakeClient({ loyalty_cards: 99, scan_history: 3 });
    const stats = await queryComptoirStats(client, "m-1", visit, NOW);
    expect(stats.rewardsDue).toBe(0);
    expect(calls.filter((c) => c.table === "loyalty_cards").length).toBe(1);
  });

  it("rewardsDue interroge stamps_count >= goal", async () => {
    const { client, calls } = fakeClient({ loyalty_cards: 5, scan_history: 0 });
    await queryComptoirStats(client, "m-1", { type: "stamp_card", config: { goal: 8 } }, NOW);
    const rewardCall = calls.filter((c) => c.table === "loyalty_cards")[1];
    expect(rewardCall.filters).toContain("gte:stamps_count:8");
  });

  it("amount_points : rewardsDue interroge points_balance >= rewardThreshold (tenancy posée)", async () => {
    // Type pas encore dans l'union LoyaltyProgram (livré par M-Points) → cast.
    const amount = { type: "amount_points", config: { rewardThreshold: 100 } } as unknown as LoyaltyProgram;
    const { client, calls } = fakeClient({ loyalty_cards: 12, scan_history: 4 });
    const stats = await queryComptoirStats(client, "tenant-Y", amount, NOW);
    expect(stats.rewardsDue).toBe(12);
    const rewardCall = calls.filter((c) => c.table === "loyalty_cards")[1];
    expect(rewardCall.eqMerchant).toBe("tenant-Y");
    expect(rewardCall.filters).toContain("gte:points_balance:100");
  });

  it("amount_points sans rewardThreshold numérique → rewardsDue 0, pas de 2e requête", async () => {
    const amount = { type: "amount_points", config: {} } as unknown as LoyaltyProgram;
    const { client, calls } = fakeClient({ loyalty_cards: 9, scan_history: 0 });
    const stats = await queryComptoirStats(client, "m-1", amount, NOW);
    expect(stats.rewardsDue).toBe(0);
    expect(calls.filter((c) => c.table === "loyalty_cards").length).toBe(1);
  });

  it("count null ou error → 0 (jamais de crash au comptoir)", async () => {
    const calls: Call[] = [];
    const client: CountClient = {
      from(table: string): CountQuery {
        calls.push({ table, eqMerchant: null, filters: [] });
        const q: CountQuery = {
          select: () => q,
          eq: () => q,
          or: () => q,
          gte: () => q,
          then: (onfulfilled) =>
            Promise.resolve({ count: null, error: { message: "boom" } }).then(onfulfilled),
        };
        return q;
      },
    };
    const stats = await queryComptoirStats(client, "m-1", stampProgram, NOW);
    expect(stats).toEqual({ activeCards: 0, scansToday: 0, rewardsDue: 0 });
  });
});
