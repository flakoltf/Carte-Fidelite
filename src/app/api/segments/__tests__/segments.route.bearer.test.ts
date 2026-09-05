import { beforeEach, describe, expect, it, vi } from "vitest";
import { MERCHANT_A, MERCHANT_B, bearerRequest, bearerState, fakeJwt, resetBearerState, tokenFor } from "@/test/bearerAuthMock";

// Lectures de la BASE CLIENTS par JETON (app mobile) :
//   GET /api/segments            — comptes par étape
//   GET /api/segments/[segment]  — membres d'une étape
//   GET /api/merchant/segments   — seuils du marchand
// Chaque lecture est bornée au marchand du jeton (invariant n°3).

vi.mock("@/utils/supabase/server", async () => (await import("@/test/bearerAuthMock")).cookieServerMock);
vi.mock("@supabase/supabase-js", async () => (await import("@/test/bearerAuthMock")).supabaseJsMock);

const calls = { counts: [] as string[], members: [] as string[], thresholds: [] as string[] };
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (_col: string, merchantId: string) => ({
          maybeSingle: async () => {
            calls.thresholds.push(merchantId);
            return { data: { stamp_goal: 10, segment_config: null }, error: null };
          },
        }),
      }),
    }),
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 119 }) }));
vi.mock("@/lib/segments/fetch", async (orig) => ({
  ...(await orig<typeof import("@/lib/segments/fetch")>()),
  fetchSegmentCounts: async (merchantId: string) => { calls.counts.push(merchantId); return { total: 1 }; },
  fetchSegmentMembers: async (merchantId: string) => { calls.members.push(merchantId); return [{ id: `c-${merchantId}` }]; },
}));

import { GET as getCounts } from "@/app/api/segments/route";
import { GET as getMembers } from "@/app/api/segments/[segment]/route";
import { GET as getThresholds } from "@/app/api/merchant/segments/route";

const base = "https://app.halocard.ch/api";
const get = (path: string, token?: string | null) => bearerRequest(`${base}${path}`, { method: "GET", token });
const members = (token?: string | null) =>
  getMembers(get("/segments/regulier", token), { params: Promise.resolve({ segment: "regulier" }) });

beforeEach(() => {
  resetBearerState();
  calls.counts = [];
  calls.members = [];
  calls.thresholds = [];
});

describe("Base clients — lectures par jeton Bearer", () => {
  it("GET /api/segments : jeton A → 200, comptes du marchand A", async () => {
    const res = await getCounts(get("/segments", tokenFor(MERCHANT_A.userId)));
    expect(res.status).toBe(200);
    expect(calls.counts).toEqual([MERCHANT_A.merchantId]);
  });

  it("GET /api/segments/[segment] : jeton B → membres de B uniquement", async () => {
    const res = await members(tokenFor(MERCHANT_B.userId));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([{ id: `c-${MERCHANT_B.merchantId}` }]);
    expect(calls.members).toEqual([MERCHANT_B.merchantId]);
  });

  it("GET /api/merchant/segments : jeton A → seuils lus avec le filtre du marchand A", async () => {
    const res = await getThresholds(get("/merchant/segments", tokenFor(MERCHANT_A.userId)));
    expect(res.status).toBe(200);
    expect(calls.thresholds).toEqual([MERCHANT_A.merchantId]);
  });

  it("jeton invalide / absent → 401 sur les trois lectures, aucune requête de données", async () => {
    const ghost = fakeJwt({ sub: "ghost" });
    expect((await getCounts(get("/segments", ghost))).status).toBe(401);
    expect((await members(ghost)).status).toBe(401);
    expect((await getThresholds(get("/merchant/segments", ghost))).status).toBe(401);
    expect((await getCounts(get("/segments"))).status).toBe(401);
    expect((await members(null)).status).toBe(401);
    expect((await getThresholds(get("/merchant/segments"))).status).toBe(401);
    expect(calls).toEqual({ counts: [], members: [], thresholds: [] });
  });

  it("cookie seul → 200 comme avant, jeton jamais sollicité", async () => {
    bearerState.cookieUser = { id: MERCHANT_A.userId };
    expect((await getCounts(get("/segments"))).status).toBe(200);
    expect((await members(null)).status).toBe(200);
    expect((await getThresholds(get("/merchant/segments"))).status).toBe(200);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("2FA active : aal1 → 401, aal2 → 200", async () => {
    const aal1 = tokenFor(MERCHANT_A.userId, "aal1");
    const aal2 = tokenFor(MERCHANT_A.userId, "aal2");
    const withMfa = { id: MERCHANT_A.userId, factors: [{ status: "verified" }] };
    bearerState.users[aal1] = withMfa;
    bearerState.users[aal2] = withMfa;
    expect((await getCounts(get("/segments", aal1))).status).toBe(401);
    expect((await getCounts(get("/segments", aal2))).status).toBe(200);
  });
});
