import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de POST /api/generate-google-pass. On prouve :
//  - GATE Google EN TÊTE : sans NEXT_PUBLIC_GOOGLE_WALLET_READY=="true" → 503,
//    et AUCUNE création (customer/carte) ni même de lecture de session ;
//  - 401 sans session (flag activé) ;
//  - 403 si le marchand est suspendu ;
//  - plafond des tampons initiaux borné par le GOAL réel (400) ;
//  - succès → 200 { saveUrl } + audit CARD_GENERATED + tenancy.

type Row = Record<string, unknown>;

const state = {
  user: { id: "user-1" } as { id: string } | null,
  merchantId: "merchant-1" as string | null,
  merchant: null as Row | null,
};

const calls = {
  getUser: 0,
  customerInserts: [] as Row[],
  cardInserts: [] as Row[],
  audit: [] as Row[],
  googleArgs: [] as Row[],
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => {
        calls.getUser += 1;
        return { data: { user: state.user } };
      },
    },
  }),
}));

vi.mock("@/lib/analytics/merchant", () => ({
  currentMerchantId: async () => state.merchantId,
}));

vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async () => ({ success: true, remaining: 29 }),
}));

vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: async () => null,
  setIdempotency: async () => {},
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audit.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

vi.mock("@/lib/googlePass", () => ({
  buildGoogleSaveUrl: async (args: Row) => {
    calls.googleArgs.push(args);
    return { saveUrl: "https://pay.google.com/save/abc", objectId: "obj-1" };
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.merchant, error: null }) }),
          }),
        };
      }
      if (table === "customers") {
        return {
          insert: (payload: Row) => {
            calls.customerInserts.push(payload);
            return { select: () => ({ single: async () => ({ data: { id: "cust-1" }, error: null }) }) };
          },
        };
      }
      // loyalty_cards
      return {
        insert: (payload: Row) => {
          calls.cardInserts.push(payload);
          return {
            select: () => ({
              single: async () => ({ data: { id: "card-1", stamps_count: payload.stamps_count }, error: null }),
            }),
          };
        },
        update: () => ({ eq: async () => ({ data: null, error: null }) }),
      };
    },
  },
}));

import { POST } from "@/app/api/generate-google-pass/route";

function makeReq(body: unknown): Request {
  return new Request("https://app.halocard.ch/api/generate-google-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY;

beforeEach(() => {
  state.user = { id: "user-1" };
  state.merchantId = "merchant-1";
  state.merchant = {
    suspended_at: null,
    loyalty_type: "stamp_card",
    loyalty_config: { goal: 10 },
    stamp_goal: 10,
  };
  calls.getUser = 0;
  calls.customerInserts = [];
  calls.cardInserts = [];
  calls.audit = [];
  calls.googleArgs = [];
  process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY = "true";
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY;
  else process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY = ORIGINAL_FLAG;
});

describe("POST /api/generate-google-pass", () => {
  it("flag absent → 503 EN TÊTE (aucune session lue, aucune création)", async () => {
    delete process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY;
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(503);
    // la garde précède toute lecture de session et toute création
    expect(calls.getUser).toBe(0);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("flag != true → 503", async () => {
    process.env.NEXT_PUBLIC_GOOGLE_WALLET_READY = "false";
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(503);
  });

  it("sans session (flag actif) → 401", async () => {
    state.user = null;
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(401);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("marchand suspendu → 403", async () => {
    state.merchant = { ...(state.merchant as Row), suspended_at: "2026-01-01T00:00:00Z" };
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(403);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("currentStamps > goal → 400", async () => {
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 11 }));
    expect(res.status).toBe(400);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("succès → 200 { saveUrl } + audit CARD_GENERATED + tenancy", async () => {
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 2 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.saveUrl).toBe("https://pay.google.com/save/abc");
    expect(body.success).toBe(true);
    expect(calls.cardInserts[0].merchant_id).toBe("merchant-1");
    expect(calls.cardInserts[0].pass_type).toBe("google");
    expect(calls.audit[0]).toMatchObject({ action: "CARD_GENERATED", merchant_id: "merchant-1" });
  });
});
