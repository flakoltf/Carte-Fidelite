import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MERCHANT_A, MERCHANT_B, bearerRequest, bearerState, fakeJwt, resetBearerState, tokenFor,
} from "@/test/bearerAuthMock";

// GET /api/comptoir/rewards-due par JETON (app mobile) : le comptage des
// « récompenses dues » vit côté serveur (queryRewardsDue + resolveLoyaltyProgram)
// — on prouve que la route résout le programme du marchand DU JETON et pose le
// filtre .eq("merchant_id", …) sur la requête service-role (invariant n°3).

vi.mock("@/utils/supabase/server", async () => (await import("@/test/bearerAuthMock")).cookieServerMock);
vi.mock("@supabase/supabase-js", async () => (await import("@/test/bearerAuthMock")).supabaseJsMock);

// Programme du marchand A : la config prime sur stamp_goal (goal 8, pas 10) —
// exactement la précédence que le mobile ne doit PAS recoder.
const merchantRowsById: Record<string, Record<string, unknown>> = {
  [MERCHANT_A.merchantId]: { loyalty_type: "stamp_card", loyalty_config: { goal: 8 }, stamp_goal: 10 },
  [MERCHANT_B.merchantId]: { loyalty_type: "visit_based", loyalty_config: { milestones: [5] }, stamp_goal: 10 },
};
const counts = { cards: 3 };
const countCalls: Record<string, unknown>[] = [];

// Builder de comptage minimal : chaînable, « thenable », qui journalise ses
// filtres — même façade CountQuery que src/lib/comptoir/stats.ts.
function countQuery(filters: Record<string, unknown>) {
  const q = {
    select: () => q,
    eq: (col: string, val: unknown) => {
      filters[`eq:${col}`] = val;
      return q;
    },
    or: (f: string) => {
      filters.or = f;
      return q;
    },
    gte: (col: string, val: unknown) => {
      filters[`gte:${col}`] = val;
      return q;
    },
    then: (resolve: (r: { count: number; error: null }) => unknown) =>
      Promise.resolve({ count: counts.cards, error: null }).then(resolve),
  };
  return q;
}

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: merchantRowsById[id] ?? null, error: null }),
            }),
          }),
        };
      }
      const filters: Record<string, unknown> = { table };
      countCalls.push(filters);
      return countQuery(filters);
    },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 119 }) }));

import { GET } from "@/app/api/comptoir/rewards-due/route";

const URL = "https://app.halocard.ch/api/comptoir/rewards-due";
const get = (token?: string | null) => GET(bearerRequest(URL, { method: "GET", token }));

beforeEach(() => {
  resetBearerState();
  countCalls.length = 0;
});

describe("GET /api/comptoir/rewards-due — jeton Bearer", () => {
  it("jeton du marchand A → 200, comptage au seuil de SA config, filtré sur SON tenant", async () => {
    const res = await get(tokenFor(MERCHANT_A.userId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rewardsDue: 3 });
    // Le programme est résolu côté serveur : goal 8 (loyalty_config) et non 10
    // (stamp_goal) — la précédence n'est jamais recodée côté mobile.
    expect(countCalls).toEqual([
      { table: "loyalty_cards", "eq:merchant_id": MERCHANT_A.merchantId, "gte:stamps_count": 8 },
    ]);
  });

  it("jeton du marchand B (visit_based) → 200 et 0 : pas de notion de récompense due, aucun comptage", async () => {
    const res = await get(tokenFor(MERCHANT_B.userId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ rewardsDue: 0 });
    expect(countCalls).toEqual([]);
  });

  it("jeton inconnu du serveur Auth (invalide/expiré) → 401", async () => {
    const res = await get(fakeJwt({ sub: "ghost", aal: "aal1" }));
    expect(res.status).toBe(401);
    expect(countCalls).toEqual([]);
  });

  it("ni cookie ni jeton → 401", async () => {
    const res = await get(null);
    expect(res.status).toBe(401);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("2FA active : jeton aal1 → 401 (fail-closed, même règle que les autres routes Bearer)", async () => {
    const aal1 = tokenFor(MERCHANT_A.userId, "aal1");
    bearerState.users[aal1] = { id: MERCHANT_A.userId, factors: [{ status: "verified" }] };
    const res = await get(aal1);
    expect(res.status).toBe(401);
    expect(countCalls).toEqual([]);
  });
});
