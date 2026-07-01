import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de POST /api/generate-apple-pass (émission manuelle d'un pass
// Apple côté dashboard marchand). On prouve :
//  - 401 sans session ;
//  - 403 si le marchand est suspendu ;
//  - plafond des tampons initiaux borné par le GOAL réel du programme (400) ;
//  - succès → 200 .pkpass + audit CARD_GENERATED + tenancy (merchant_id posé).

type Row = Record<string, unknown>;

const state = {
  user: { id: "user-1" } as { id: string } | null,
  merchantId: "merchant-1" as string | null,
  merchant: null as Row | null,
  merchError: null as { message: string } | null,
};

const calls = {
  customerInserts: [] as Row[],
  cardInserts: [] as Row[],
  audit: [] as Row[],
  applePassArgs: [] as Row[],
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
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

vi.mock("@/lib/applePass", () => ({
  buildApplePassBuffer: async (args: Row) => {
    calls.applePassArgs.push(args);
    return Buffer.from("PKPASS");
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "merchants") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.merchant, error: state.merchError }) }),
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
      };
    },
  },
}));

import { POST } from "@/app/api/generate-apple-pass/route";
import type { NextRequest } from "next/server";

function makeReq(body: unknown): NextRequest {
  return new Request("https://app.halocard.ch/api/generate-apple-pass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  state.user = { id: "user-1" };
  state.merchantId = "merchant-1";
  state.merchant = {
    id: "merchant-1",
    shop_name: "Boulangerie des Pâquis",
    primary_color: "#0D6B5E",
    suspended_at: null,
    loyalty_type: "stamp_card",
    loyalty_config: { goal: 10 },
    stamp_goal: 10,
  };
  state.merchError = null;
  calls.customerInserts = [];
  calls.cardInserts = [];
  calls.audit = [];
  calls.applePassArgs = [];
});

describe("POST /api/generate-apple-pass", () => {
  it("sans session → 401, aucune création", async () => {
    state.user = null;
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(401);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("marchand suspendu → 403, aucune création", async () => {
    state.merchant = { ...(state.merchant as Row), suspended_at: "2026-01-01T00:00:00Z" };
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(403);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("currentStamps > goal → 400 (plafond borné par l'objectif réel)", async () => {
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 11 }));
    expect(res.status).toBe(400);
    expect(calls.cardInserts).toHaveLength(0);
  });

  it("currentStamps == goal → accepté (borne inclusive)", async () => {
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 10 }));
    expect(res.status).toBe(200);
    expect(calls.cardInserts[0].stamps_count).toBe(10);
  });

  it("currentStamps négatif → 400", async () => {
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: -1 }));
    expect(res.status).toBe(400);
  });

  it("succès → 200 .pkpass + audit CARD_GENERATED + tenancy merchant_id", async () => {
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 3 }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/vnd.apple.pkpass");
    expect(calls.cardInserts[0].merchant_id).toBe("merchant-1");
    expect(calls.cardInserts[0].pass_type).toBe("apple");
    expect(calls.audit[0]).toMatchObject({ action: "CARD_GENERATED", merchant_id: "merchant-1", user_id: "user-1" });
  });

  it("profil marchand manquant (currentMerchantId null) → 400", async () => {
    state.merchantId = null;
    const res = await POST(makeReq({ customerName: "Nadia", currentStamps: 0 }));
    expect(res.status).toBe(400);
    expect(calls.cardInserts).toHaveLength(0);
  });
});
