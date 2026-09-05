import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MERCHANT_A, MERCHANT_B, bearerRequest, bearerState, fakeJwt, resetBearerState, tokenFor,
} from "@/test/bearerAuthMock";

// POST /api/scan par JETON (app mobile) : le jeton identifie le marchand comme
// le cookie ; la tenancy (carte d'un autre établissement → 403) reste posée.

vi.mock("@/utils/supabase/server", async () => (await import("@/test/bearerAuthMock")).cookieServerMock);
vi.mock("@supabase/supabase-js", async () => (await import("@/test/bearerAuthMock")).supabaseJsMock);

// Une seule carte, appartenant au marchand A.
const CARD_A = { id: "card-a", merchant_id: MERCHANT_A.merchantId, stamps_count: 3, redeemed_tiers: null, customers: null };
const merchantRows: Record<string, Record<string, unknown>> = {
  [MERCHANT_A.userId]: { id: MERCHANT_A.merchantId, loyalty_type: "stamp_card", loyalty_config: null, stamp_goal: 10, suspended_at: null },
  [MERCHANT_B.userId]: { id: MERCHANT_B.merchantId, loyalty_type: "stamp_card", loyalty_config: null, stamp_goal: 10, suspended_at: null },
};
const adminCalls = { merchantLookups: [] as [string, string][], rpc: [] as string[] };

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "scan_history") return { insert: async () => ({ error: null }) };
      return {
        select: () => ({
          eq: (col: string, val: string) => ({
            single: async () => {
              if (table === "merchants") {
                adminCalls.merchantLookups.push([col, val]);
                return { data: merchantRows[val] ?? null, error: null };
              }
              return { data: val === CARD_A.id ? { ...CARD_A, stamps_count: 4 } : null, error: null };
            },
          }),
        }),
      };
    },
    rpc: async (name: string) => {
      adminCalls.rpc.push(name);
      return { data: [{ status: "incremented", new_count: 4 }], error: null };
    },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 199 }) }));
vi.mock("@/lib/idempotency", () => ({ checkIdempotency: async () => null, setIdempotency: async () => {} }));
vi.mock("@/lib/qrSignature", () => ({ verifyQRCode: (qr: string) => ({ valid: true, cardId: qr }) }));
vi.mock("@/lib/merchant-config/fetch", () => ({
  fetchMerchantConfig: async () => ({ scanCooldownSeconds: 30, stampGoal: 10 }),
}));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async () => {},
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/wallet/channel", () => ({ getChannels: () => [] }));
vi.mock("@/lib/wallet/authToken", () => ({ clearCardMessage: async () => {} }));

import { POST } from "@/app/api/scan/route";

const URL = "https://app.halocard.ch/api/scan";

beforeEach(() => {
  resetBearerState();
  adminCalls.merchantLookups = [];
  adminCalls.rpc = [];
});

describe("POST /api/scan — jeton Bearer", () => {
  it("jeton valide du marchand A → 200, tampon posé sur SA carte", async () => {
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_A.userId) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.card.merchant_id).toBe(MERCHANT_A.merchantId);
    expect(adminCalls.rpc).toEqual(["scan_increment"]);
    // Le marchand est résolu par l'utilisateur du jeton, jamais par un id fourni.
    expect(adminCalls.merchantLookups).toEqual([["user_id", MERCHANT_A.userId]]);
  });

  it("jeton du marchand B sur une carte de A → 403, aucun tampon, aucune donnée de A", async () => {
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_B.userId) }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).not.toHaveProperty("card");
    expect(adminCalls.rpc).toEqual([]);
  });

  it("jeton inconnu du serveur Auth (invalide/expiré) → 401", async () => {
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: fakeJwt({ sub: "ghost", aal: "aal1" }) }));
    expect(res.status).toBe(401);
    expect(adminCalls.merchantLookups).toEqual([]);
  });

  it("ni cookie ni jeton → 401 (comportement inchangé)", async () => {
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id } }));
    expect(res.status).toBe(401);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("cookie seul → 200 comme avant, le chemin jeton n'est pas sollicité", async () => {
    bearerState.cookieUser = { id: MERCHANT_A.userId };
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id } }));
    expect(res.status).toBe(200);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("2FA active : jeton aal1 → 401 ; jeton aal2 → 200", async () => {
    const aal1 = tokenFor(MERCHANT_A.userId, "aal1");
    const aal2 = tokenFor(MERCHANT_A.userId, "aal2");
    const withMfa = { id: MERCHANT_A.userId, factors: [{ status: "verified" }] };
    bearerState.users[aal1] = withMfa;
    bearerState.users[aal2] = withMfa;

    expect((await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: aal1 }))).status).toBe(401);
    expect((await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: aal2 }))).status).toBe(200);
  });

  it("serveur Auth en panne → 401 (fail-closed), jamais 500 ni tampon", async () => {
    bearerState.authDown = true;
    const res = await POST(bearerRequest(URL, { body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_A.userId) }));
    expect(res.status).toBe(401);
    expect(adminCalls.rpc).toEqual([]);
  });
});
