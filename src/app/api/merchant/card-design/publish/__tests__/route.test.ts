import { beforeEach, describe, expect, it, vi } from "vitest";

// Régression Important 2 (revue finale cartes-à-points) : POST
// /api/merchant/card-design/publish ne doit JAMAIS écraser reward_label en base
// quand le body ne porte pas cette clé (p. ex. le prefetch /api/merchant/me pas
// encore résolu au moment du Publier) — la colonne doit être OMISE de l'UPDATE
// merchants, pas écrite à null. Quand la clé est présente (même vide), elle
// s'applique normalement (effacement volontaire ou nouvelle valeur).

type Row = Record<string, unknown>;

const state = {
  merchantId: "merchant-1" as string | null,
  userId: "user-1" as string | null,
  cardDesignVersion: null as number | null,
};

const calls = {
  upserts: [] as { table: string; row: Row }[],
  updates: [] as { table: string; patch: Row }[],
  audit: [] as Row[],
};

vi.mock("@/lib/analytics/merchant", () => ({
  currentMerchantId: async () => state.merchantId,
}));

vi.mock("@/lib/adminAuth", () => ({
  getSessionRole: async () => ({ userId: state.userId, role: "merchant" }),
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audit.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

vi.mock("@/lib/cardDesign/storage", () => ({
  signedUrl: async () => "https://example.test/signed",
}));

vi.mock("@/lib/wallet/googleClass", () => ({
  ensureLoyaltyClass: async () => "class-1",
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.cardDesignVersion !== null ? { version: state.cardDesignVersion } : null, error: null }),
        }),
      }),
      upsert: (row: Row) => {
        calls.upserts.push({ table, row });
        return Promise.resolve({ error: null });
      },
      update: (patch: Row) => {
        calls.updates.push({ table, patch });
        return { eq: () => Promise.resolve({ data: null, error: null }) };
      },
    }),
  },
}));

import { POST } from "@/app/api/merchant/card-design/publish/route";
import { DEFAULT_CARD_DESIGN } from "@/lib/cardDesign/types";

function publishReq(body: unknown) {
  return new Request("https://app.halocard.ch/api/merchant/card-design/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function merchantsLoyaltyUpdate(): Row | undefined {
  return calls.updates.find((c) => c.table === "merchants" && "loyalty_type" in c.patch)?.patch;
}

beforeEach(() => {
  state.merchantId = "merchant-1";
  state.userId = "user-1";
  state.cardDesignVersion = 0;
  calls.upserts = [];
  calls.updates = [];
  calls.audit = [];
});

describe("POST /api/merchant/card-design/publish — reward_label (Important 2)", () => {
  it("program.reward_label ABSENT → colonne reward_label OMISE de l'UPDATE merchants (préservation)", async () => {
    const res = await POST(
      publishReq({
        design: DEFAULT_CARD_DESIGN,
        program: { type: "stamp_card", goal: 10 },
      })
    );
    expect(res.status).toBe(200);
    const patch = merchantsLoyaltyUpdate();
    expect(patch).toBeTruthy();
    expect("reward_label" in (patch as Row)).toBe(false);
    expect((patch as Row).loyalty_type).toBe("stamp_card");
  });

  it("program.reward_label chaîne vide → écrit reward_label: null (effacement volontaire)", async () => {
    const res = await POST(
      publishReq({
        design: DEFAULT_CARD_DESIGN,
        program: { type: "stamp_card", goal: 10, reward_label: "" },
      })
    );
    expect(res.status).toBe(200);
    const patch = merchantsLoyaltyUpdate();
    expect(patch).toBeTruthy();
    expect((patch as Row).reward_label).toBe(null);
  });

  it("program.reward_label présent → écrit la valeur telle quelle", async () => {
    const res = await POST(
      publishReq({
        design: DEFAULT_CARD_DESIGN,
        program: { type: "stamp_card", goal: 10, reward_label: "Un café offert" },
      })
    );
    expect(res.status).toBe(200);
    const patch = merchantsLoyaltyUpdate();
    expect(patch).toBeTruthy();
    expect((patch as Row).reward_label).toBe("Un café offert");
  });

  it("pas de `program` dans le body → aucun UPDATE loyalty_type sur merchants", async () => {
    const res = await POST(publishReq({ design: DEFAULT_CARD_DESIGN }));
    expect(res.status).toBe(200);
    expect(merchantsLoyaltyUpdate()).toBeUndefined();
  });
});
