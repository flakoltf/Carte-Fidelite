import { beforeEach, describe, expect, it, vi } from "vitest";

// Garde du COMPTOIR : POST /api/scan/redeem (« Offrir la récompense »). Même
// logique partagée que /api/redeem (src/lib/loyalty/redeem.ts). On prouve : auth
// obligatoire, tenancy (.eq merchant_id), encaissement atomique conditionnel
// (carte pleine → 0), refus si déjà offerte / pas pleine.

const state = {
  user: { id: "user-merchant-1" } as { id: string } | null,
  merchant: null as Record<string, unknown> | null,
  card: null as Record<string, unknown> | null,
  updatedRows: [] as unknown[],
  updateError: null as { message: string } | null,
};
const calls = {
  audit: [] as Record<string, unknown>[],
  updateFilters: [] as Record<string, unknown>[],
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: state.merchant, error: null }) }) }),
        };
      }
      // loyalty_cards : lecture (.select().eq().single()) ET encaissement
      // (.update().eq().eq().gte().select()).
      return {
        select: () => ({ eq: () => ({ single: async () => ({ data: state.card, error: null }) }) }),
        update: (patch: Record<string, unknown>) => {
          const filter: Record<string, unknown> = { patch };
          calls.updateFilters.push(filter);
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
                        select: async () => ({ data: state.updatedRows, error: state.updateError }),
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
    calls.audit.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/wallet/channel", () => ({ getChannels: () => [] }));

import { POST } from "@/app/api/scan/redeem/route";
import type { NextRequest } from "next/server";

function redeemReq(cardId: string | undefined = "550e8400-e29b-41d4-a716-446655440000") {
  return new Request("https://app.halocard.ch/api/scan/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId }),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  state.user = { id: "user-merchant-1" };
  state.merchant = {
    id: "merchant-1",
    loyalty_type: "stamp_card",
    loyalty_config: { goal: 10 },
    stamp_goal: 10,
    suspended_at: null,
  };
  state.card = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    merchant_id: "merchant-1",
    stamps_count: 10,
    customers: { full_name: "Nadia" },
  };
  state.updatedRows = [{ ...state.card, stamps_count: 0 }];
  state.updateError = null;
  calls.audit = [];
  calls.updateFilters = [];
});

describe("POST /api/scan/redeem", () => {
  it("non authentifié → 401", async () => {
    state.user = null;
    const res = await POST(redeemReq());
    expect(res.status).toBe(401);
    expect(calls.updateFilters).toHaveLength(0);
  });

  it("cardId absent → 400", async () => {
    const req = new Request("https://app.halocard.ch/api/scan/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("carte d'un AUTRE établissement → 403 (tenancy)", async () => {
    state.card = { ...(state.card as object), merchant_id: "autre-merchant" };
    const res = await POST(redeemReq());
    expect(res.status).toBe(403);
    expect(calls.updateFilters).toHaveLength(0);
  });

  it("succès → 200, carte remise à 0, audit REWARD_REDEEMED + filtre tenancy", async () => {
    const res = await POST(redeemReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.card.stamps_count).toBe(0);
    // tenancy posée sur l'UPDATE atomique
    expect(calls.updateFilters[0]["eq:merchant_id"]).toBe("merchant-1");
    expect(calls.updateFilters[0]["gte:stamps_count"]).toBe(10);
    // audit avec une AuditAction existante (pas de migration jumelle requise)
    expect(calls.audit[0].action).toBe("REWARD_REDEEMED");
  });

  it("carte non pleine / déjà offerte → 409 (aucune ligne mise à jour)", async () => {
    state.updatedRows = [];
    const res = await POST(redeemReq());
    expect(res.status).toBe(409);
    expect(calls.audit).toHaveLength(0);
  });
});
