import { beforeEach, describe, expect, it, vi } from "vitest";

// Garde du COMPTOIR (amount_points) : POST /api/scan crédite par MONTANT via la
// RPC atomique scan_increment_amount (verrou DB). On vérifie la validation du
// montant, le câblage route ↔ RPC, le mappage des erreurs et les gardes de sécu.
//
// La RPC SQL n'est pas exécutée ici (pas de Postgres en unit) : on mocke son
// retour jsonb { ok, currentValue, pointsEarned, rewardReady } et on prouve que
// la route réagit bien.

const state = {
  user: { id: "user-merchant-1" } as { id: string } | null,
  merchant: null as Record<string, unknown> | null,
  card: null as Record<string, unknown> | null,
  rpcData: null as unknown,
  rpcError: null as { message: string } | null,
  cooldownSeconds: 30,
  stampGoal: 10,
};
const calls = { rpc: [] as { name: string; params: Record<string, unknown> }[] };

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "scan_history") return { insert: async () => ({ error: null }) };
      return {
        select: () => ({
          eq: () => ({
            single: async () =>
              table === "merchants"
                ? { data: state.merchant, error: null }
                : { data: state.card, error: null },
          }),
        }),
      };
    },
    rpc: async (name: string, params: Record<string, unknown>) => {
      calls.rpc.push({ name, params });
      return { data: state.rpcData, error: state.rpcError };
    },
  },
}));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: async () => ({ success: true, remaining: 199 }) }));
vi.mock("@/lib/idempotency", () => ({
  checkIdempotency: async () => null,
  setIdempotency: async () => {},
}));
vi.mock("@/lib/qrSignature", () => ({
  verifyQRCode: (qr: string) => ({ valid: true, cardId: qr }),
}));
vi.mock("@/lib/merchant-config/fetch", () => ({
  fetchMerchantConfig: async () => ({
    scanCooldownSeconds: state.cooldownSeconds,
    stampGoal: state.stampGoal,
  }),
}));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async () => {},
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/wallet/channel", () => ({ getChannels: () => [] }));

import { POST } from "@/app/api/scan/route";

function scanReq(body: Record<string, unknown>) {
  return new Request("https://app.halocard.ch/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.user = { id: "user-merchant-1" };
  state.merchant = {
    id: "merchant-1",
    loyalty_type: "amount_points",
    loyalty_config: { pointsPerChf: 1, rewardThreshold: 200, rewardLabel: "CHF 20 offerts" },
    stamp_goal: 10,
    suspended_at: null,
  };
  state.card = { id: "card-1", merchant_id: "merchant-1", points_balance: 0, customers: { full_name: "Nadia" } };
  state.rpcData = { ok: true, currentValue: 12, pointsEarned: 12, rewardReady: false };
  state.rpcError = null;
  state.cooldownSeconds = 30;
  state.stampGoal = 10;
  calls.rpc = [];
});

describe("POST /api/scan — amount_points : validation du montant", () => {
  it("amountChf absent → 400, aucune RPC", async () => {
    const res = await POST(scanReq({ cardId: "card-1" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(calls.rpc).toHaveLength(0);
  });

  it("amountChf ≤ 0 → 400", async () => {
    expect((await POST(scanReq({ cardId: "card-1", amountChf: 0 }))).status).toBe(400);
    expect((await POST(scanReq({ cardId: "card-1", amountChf: -5 }))).status).toBe(400);
    expect(calls.rpc).toHaveLength(0);
  });

  it("amountChf > 10000 → 400", async () => {
    expect((await POST(scanReq({ cardId: "card-1", amountChf: 10000.01 }))).status).toBe(400);
    expect((await POST(scanReq({ cardId: "card-1", amountChf: 99999 }))).status).toBe(400);
    expect(calls.rpc).toHaveLength(0);
  });

  it("amountChf avec > 2 décimales → 400", async () => {
    expect((await POST(scanReq({ cardId: "card-1", amountChf: 10.999 }))).status).toBe(400);
    expect((await POST(scanReq({ cardId: "card-1", amountChf: 12.345 }))).status).toBe(400);
    expect(calls.rpc).toHaveLength(0);
  });

  it("amountChf non numérique → 400", async () => {
    expect((await POST(scanReq({ cardId: "card-1", amountChf: "12.50" }))).status).toBe(400);
    expect(calls.rpc).toHaveLength(0);
  });

  it("montant limite exact (10000, 2 décimales) accepté → 200", async () => {
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 10000 }));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/scan — amount_points : succès & câblage RPC", () => {
  it("bon appel RPC (params programme) + bonne réponse", async () => {
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      success: true,
      currentValue: 12,
      pointsEarned: 12,
      rewardReady: false,
      rewardLabel: "CHF 20 offerts",
    });
    expect(calls.rpc[0].name).toBe("scan_increment_amount");
    expect(calls.rpc[0].params).toMatchObject({
      p_card_id: "card-1",
      p_amount_chf: 12.5,
      p_cooldown_seconds: 30,
      p_points_per_chf: 1,
      p_max_points: 1000,
      p_reward_threshold: 200,
    });
  });

  it("rewardReady=true remonté tel quel", async () => {
    state.rpcData = { ok: true, currentValue: 205, pointsEarned: 20, rewardReady: true };
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 20 }));
    const body = await res.json();
    expect(body.rewardReady).toBe(true);
    expect(body.currentValue).toBe(205);
  });

  it("maxPointsPerScan configuré → passé à la RPC (sinon défaut 1000)", async () => {
    state.merchant = {
      ...(state.merchant as object),
      loyalty_config: { pointsPerChf: 2, rewardThreshold: 500, rewardLabel: "Menu offert", maxPointsPerScan: 50 },
    };
    await POST(scanReq({ cardId: "card-1", amountChf: 30 }));
    expect(calls.rpc[0].params).toMatchObject({ p_points_per_chf: 2, p_max_points: 50, p_reward_threshold: 500 });
  });
});

describe("POST /api/scan — amount_points : mappage des erreurs RPC", () => {
  it("cooldown → 429, cooldown:true", async () => {
    state.rpcData = { ok: false, error: "cooldown", currentValue: 50 };
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(429);
    expect((await res.json()).cooldown).toBe(true);
  });

  it("card_not_found → 404", async () => {
    state.rpcData = { ok: false, error: "card_not_found" };
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(404);
  });

  it("RPC en erreur → 500 (fail-loud)", async () => {
    state.rpcError = { message: "lock timeout" };
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/scan — amount_points : gardes de sécurité", () => {
  it("non authentifié → 401, aucune RPC", async () => {
    state.user = null;
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(401);
    expect(calls.rpc).toHaveLength(0);
  });

  it("carte d'un AUTRE établissement → 403, aucune RPC", async () => {
    state.card = { id: "card-1", merchant_id: "autre-merchant", points_balance: 0 };
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(403);
    expect(calls.rpc).toHaveLength(0);
  });

  it("marchand suspendu → 403, aucune RPC", async () => {
    state.merchant = { ...(state.merchant as object), suspended_at: "2026-06-01T00:00:00Z" };
    const res = await POST(scanReq({ cardId: "card-1", amountChf: 12.5 }));
    expect(res.status).toBe(403);
    expect(calls.rpc).toHaveLength(0);
  });
});
