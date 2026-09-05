import { beforeEach, describe, expect, it, vi } from "vitest";
import { MERCHANT_A, MERCHANT_B, bearerRequest, bearerState, fakeJwt, resetBearerState, tokenFor } from "@/test/bearerAuthMock";
import { NextRequest } from "next/server";

// POST /api/notifications/send par JETON : l'audience est TOUJOURS celle du
// marchand porté par le jeton (fetchAudienceCardIds(merchantId) — invariant n°3).

vi.mock("@/utils/supabase/server", async () => (await import("@/test/bearerAuthMock")).cookieServerMock);
vi.mock("@supabase/supabase-js", async () => (await import("@/test/bearerAuthMock")).supabaseJsMock);
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: {} }));

const calls = { audience: [] as string[], deliver: [] as string[] };
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 9 }) }));
vi.mock("@/lib/billing/guard", () => ({ getTrialBlockReason: async () => null }));
vi.mock("@/lib/segments/fetch", () => ({
  fetchAudienceCardIds: async (merchantId: string) => { calls.audience.push(merchantId); return ["card-x"]; },
}));
vi.mock("@/lib/notifications/deliver", () => ({
  deliverToCards: async (merchantId: string) => { calls.deliver.push(merchantId); return { pushed: 1, reachable: 1 }; },
}));

import { POST } from "@/app/api/notifications/send/route";

const URL = "https://app.halocard.ch/api/notifications/send";
const payload = { title: "Bonjour", body: "Offre du jour", audience: "all" };
const post = (token?: string | null) => {
  const r = bearerRequest(URL, { body: payload, token });
  return POST(new NextRequest(URL, { method: "POST", headers: r.headers, body: JSON.stringify(payload) }));
};

beforeEach(() => {
  resetBearerState();
  calls.audience = [];
  calls.deliver = [];
});

describe("POST /api/notifications/send — jeton Bearer", () => {
  it("jeton du marchand A → 200, audience et envoi limités à A", async () => {
    const res = await post(tokenFor(MERCHANT_A.userId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pushed: 1, reachable: 1 });
    expect(calls.audience).toEqual([MERCHANT_A.merchantId]);
    expect(calls.deliver).toEqual([MERCHANT_A.merchantId]);
  });

  it("jeton du marchand B → n'atteint que l'audience de B, jamais celle de A", async () => {
    await post(tokenFor(MERCHANT_B.userId));
    expect(calls.audience).toEqual([MERCHANT_B.merchantId]);
    expect(calls.audience).not.toContain(MERCHANT_A.merchantId);
  });

  it("jeton invalide → 401 ; aucun jeton → 401 ; rien n'est envoyé", async () => {
    expect((await post(fakeJwt({ sub: "ghost" }))).status).toBe(401);
    expect((await post(null)).status).toBe(401);
    expect(calls.deliver).toEqual([]);
  });

  it("cookie seul → 200 comme avant, jeton jamais sollicité", async () => {
    bearerState.cookieUser = { id: MERCHANT_A.userId };
    expect((await post(null)).status).toBe(200);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("2FA active : aal1 → 401, aal2 → 200", async () => {
    const aal1 = tokenFor(MERCHANT_A.userId, "aal1");
    const aal2 = tokenFor(MERCHANT_A.userId, "aal2");
    const withMfa = { id: MERCHANT_A.userId, factors: [{ status: "verified" }] };
    bearerState.users[aal1] = withMfa;
    bearerState.users[aal2] = withMfa;
    expect((await post(aal1)).status).toBe(401);
    expect((await post(aal2)).status).toBe(200);
  });
});
