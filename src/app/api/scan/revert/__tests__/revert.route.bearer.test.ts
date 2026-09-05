import { beforeEach, describe, expect, it, vi } from "vitest";
import { MERCHANT_A, MERCHANT_B, bearerRequest, bearerState, fakeJwt, resetBearerState, tokenFor } from "@/test/bearerAuthMock";

// POST /api/scan/revert par JETON (app mobile) : annulation du dernier tampon
// avec la même tenancy que le cookie (carte d'un autre établissement → 403).

vi.mock("@/utils/supabase/server", async () => (await import("@/test/bearerAuthMock")).cookieServerMock);
vi.mock("@supabase/supabase-js", async () => (await import("@/test/bearerAuthMock")).supabaseJsMock);

const CARD_A = { id: "11111111-1111-4111-8111-111111111111", merchant_id: MERCHANT_A.merchantId };
const merchantRows: Record<string, Record<string, unknown>> = {
  [MERCHANT_A.userId]: { id: MERCHANT_A.merchantId, suspended_at: null },
  [MERCHANT_B.userId]: { id: MERCHANT_B.merchantId, suspended_at: null },
};
const adminCalls = { rpc: [] as string[] };

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "scan_history") return { insert: async () => ({ error: null }) };
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            single: async () =>
              table === "merchants"
                ? { data: merchantRows[val] ?? null, error: null }
                : { data: val === CARD_A.id ? { ...CARD_A, stamps_count: 2 } : null, error: null },
          }),
        }),
      };
    },
    rpc: async (name: string) => {
      adminCalls.rpc.push(name);
      return { data: [{ status: "reverted", new_count: 2 }], error: null };
    },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 59 }) }));
vi.mock("@/lib/qrSignature", () => ({ verifyQRCode: () => ({ valid: false }) }));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async () => {},
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/wallet/channel", () => ({ getChannels: () => [] }));

import { POST } from "@/app/api/scan/revert/route";

const URL = "https://app.halocard.ch/api/scan/revert";

beforeEach(() => {
  resetBearerState();
  adminCalls.rpc = [];
});

describe("POST /api/scan/revert — jeton Bearer", () => {
  it("jeton valide du marchand A → 200, RPC scan_revert appelée", async () => {
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_A.userId) }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(adminCalls.rpc).toEqual(["scan_revert"]);
  });

  it("jeton du marchand B sur une carte de A → 403 sans annulation", async () => {
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_B.userId) }));
    expect(res.status).toBe(403);
    expect(adminCalls.rpc).toEqual([]);
  });

  it("jeton invalide → 401 ; aucun jeton → 401", async () => {
    expect((await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: fakeJwt({ sub: "ghost" }) }))).status).toBe(401);
    expect((await POST(bearerRequest(URL, { body: { cardId: CARD_A.id } }))).status).toBe(401);
    expect(adminCalls.rpc).toEqual([]);
  });

  it("cookie seul → 200 comme avant, jeton jamais sollicité", async () => {
    bearerState.cookieUser = { id: MERCHANT_A.userId };
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id } }));
    expect(res.status).toBe(200);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("2FA active : aal1 → 401, aal2 → 200", async () => {
    const aal1 = tokenFor(MERCHANT_A.userId, "aal1");
    const aal2 = tokenFor(MERCHANT_A.userId, "aal2");
    const withMfa = { id: MERCHANT_A.userId, factors: [{ status: "verified" }] };
    bearerState.users[aal1] = withMfa;
    bearerState.users[aal2] = withMfa;
    expect((await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: aal1 }))).status).toBe(401);
    expect((await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: aal2 }))).status).toBe(200);
  });
});
