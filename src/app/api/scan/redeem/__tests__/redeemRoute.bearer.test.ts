import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MERCHANT_A, MERCHANT_B, bearerRequest, bearerState, fakeJwt, resetBearerState, tokenFor,
} from "@/test/bearerAuthMock";

// POST /api/scan/redeem par JETON (app mobile) : même pattern que /api/scan
// (scan.route.bearer.test.ts). Le jeton identifie le marchand comme le cookie ;
// la tenancy (carte d'un autre établissement → 403) reste posée, et
// l'encaissement atomique reste filtré .eq("merchant_id", …) (invariant n°3).

vi.mock("@/utils/supabase/server", async () => (await import("@/test/bearerAuthMock")).cookieServerMock);
vi.mock("@supabase/supabase-js", async () => (await import("@/test/bearerAuthMock")).supabaseJsMock);

// Une seule carte PLEINE (10/10), appartenant au marchand A.
const CARD_A = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  merchant_id: MERCHANT_A.merchantId,
  stamps_count: 10,
  customers: { full_name: "Nadia" },
};
const merchantRows: Record<string, Record<string, unknown>> = {
  [MERCHANT_A.userId]: { id: MERCHANT_A.merchantId, loyalty_type: "stamp_card", loyalty_config: { goal: 10 }, stamp_goal: 10, suspended_at: null },
  [MERCHANT_B.userId]: { id: MERCHANT_B.merchantId, loyalty_type: "stamp_card", loyalty_config: { goal: 10 }, stamp_goal: 10, suspended_at: null },
};
const adminCalls = {
  merchantLookups: [] as [string, string][],
  updateFilters: [] as Record<string, unknown>[],
  audit: [] as Record<string, unknown>[],
};

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              single: async () => {
                adminCalls.merchantLookups.push([col, val]);
                return { data: merchantRows[val] ?? null, error: null };
              },
            }),
          }),
        };
      }
      // loyalty_cards : lecture (.select().eq().single()) ET encaissement
      // atomique (.update().eq(id).eq(merchant_id).gte(stamps_count).select()).
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            single: async () => ({ data: val === CARD_A.id ? { ...CARD_A } : null, error: null }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          const filter: Record<string, unknown> = { patch };
          adminCalls.updateFilters.push(filter);
          return {
            eq: (col: string, val: unknown) => {
              filter[`eq:${col}`] = val;
              return {
                eq: (col2: string, val2: unknown) => {
                  filter[`eq:${col2}`] = val2;
                  return {
                    gte: (col3: string, val3: unknown) => {
                      filter[`gte:${col3}`] = val3;
                      return {
                        select: async () => {
                          // L'encaissement ne matche que si le filtre vise le
                          // bon tenant — comme l'UPDATE conditionnel réel.
                          const owns = filter["eq:merchant_id"] === CARD_A.merchant_id && filter["eq:id"] === CARD_A.id;
                          return { data: owns ? [{ ...CARD_A, stamps_count: 0 }] : [], error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  },
}));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 59 }) }));
vi.mock("@/lib/qrSignature", () => ({ verifyQRCode: (qr: string) => ({ valid: true, cardId: qr }) }));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Record<string, unknown>) => {
    adminCalls.audit.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/wallet/channel", () => ({ getChannels: () => [] }));

import { POST } from "@/app/api/scan/redeem/route";
import type { NextRequest } from "next/server";

const URL = "https://app.halocard.ch/api/scan/redeem";
const post = (init: Parameters<typeof bearerRequest>[1]) =>
  POST(bearerRequest(URL, init) as unknown as NextRequest);

beforeEach(() => {
  resetBearerState();
  adminCalls.merchantLookups = [];
  adminCalls.updateFilters = [];
  adminCalls.audit = [];
});

describe("POST /api/scan/redeem — jeton Bearer", () => {
  it("jeton valide du marchand A → 200, encaissement filtré sur SON tenant + audit", async () => {
    const res = await post({ body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_A.userId) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.card.stamps_count).toBe(0);
    // Le marchand est résolu par l'utilisateur du jeton, jamais par un id fourni.
    expect(adminCalls.merchantLookups).toEqual([["user_id", MERCHANT_A.userId]]);
    // Tenancy posée sur l'UPDATE atomique (invariant n°3).
    expect(adminCalls.updateFilters[0]["eq:merchant_id"]).toBe(MERCHANT_A.merchantId);
    expect(adminCalls.audit[0].action).toBe("REWARD_REDEEMED");
  });

  it("jeton du marchand B sur une carte de A → 403, aucun encaissement, aucune donnée de A", async () => {
    const res = await post({ body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_B.userId) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body).not.toHaveProperty("card");
    expect(adminCalls.updateFilters).toHaveLength(0);
    expect(adminCalls.audit).toHaveLength(0);
  });

  it("jeton inconnu du serveur Auth (invalide/expiré) → 401", async () => {
    const res = await post({ body: { cardId: CARD_A.id }, token: fakeJwt({ sub: "ghost", aal: "aal1" }) });
    expect(res.status).toBe(401);
    expect(adminCalls.merchantLookups).toEqual([]);
  });

  it("ni cookie ni jeton → 401 (comportement inchangé)", async () => {
    const res = await post({ body: { cardId: CARD_A.id } });
    expect(res.status).toBe(401);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("cookie seul → 200 comme avant, le chemin jeton n'est pas sollicité", async () => {
    bearerState.cookieUser = { id: MERCHANT_A.userId };
    const res = await post({ body: { cardId: CARD_A.id } });
    expect(res.status).toBe(200);
    expect(bearerState.calls.getUser).toEqual([]);
  });

  it("2FA active : jeton aal1 → 401 ; jeton aal2 → 200", async () => {
    const aal1 = tokenFor(MERCHANT_A.userId, "aal1");
    const aal2 = tokenFor(MERCHANT_A.userId, "aal2");
    const withMfa = { id: MERCHANT_A.userId, factors: [{ status: "verified" }] };
    bearerState.users[aal1] = withMfa;
    bearerState.users[aal2] = withMfa;

    expect((await post({ body: { cardId: CARD_A.id }, token: aal1 })).status).toBe(401);
    expect((await post({ body: { cardId: CARD_A.id }, token: aal2 })).status).toBe(200);
  });

  it("serveur Auth en panne → 401 (fail-closed), jamais 500 ni encaissement", async () => {
    bearerState.authDown = true;
    const res = await post({ body: { cardId: CARD_A.id }, token: tokenFor(MERCHANT_A.userId) });
    expect(res.status).toBe(401);
    expect(adminCalls.updateFilters).toHaveLength(0);
  });
});
