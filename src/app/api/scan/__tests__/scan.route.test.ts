import { beforeEach, describe, expect, it, vi } from "vitest";

// Garde du COMPTOIR : POST /api/scan passe par la RPC atomique scan_increment
// (cooldown + plafond appliqués sous verrou DB). On vérifie le câblage route ↔
// RPC et les branches que la démo expose : incrément, cooldown (pas de double
// tampon), carte pleine (récompense sans tampon), propriété, suspension.
//
// La RPC SQL elle-même n'est pas exécutée ici (pas de Postgres en unit) : on
// mocke son retour { status, new_count } et on prouve que la route réagit bien.

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
// Un faux canal qui ENREGISTRE les notify() (au lieu d'un mock vide) : nécessaire
// pour vérifier le TITRE du push envoyé au franchissement d'un palier de points
// (Minor 7, revue finale — cohérence avec "Récompense utilisée" de redeem.ts,
// sans emoji dans le titre).
const channelCalls = { notify: [] as { cardIds: string[]; message?: { title: string; body: string } }[] };
vi.mock("@/lib/wallet/channel", () => ({
  getChannels: () => [
    {
      notify: async (cardIds: string[], message?: { title: string; body: string }) => {
        channelCalls.notify.push({ cardIds, message });
      },
    },
  ],
}));

import { POST } from "@/app/api/scan/route";

function scanReq(cardId = "card-1") {
  return new Request("https://app.halocard.ch/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cardId }),
  });
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
  state.card = { id: "card-1", merchant_id: "merchant-1", stamps_count: 9, customers: { full_name: "Nadia" } };
  state.rpcData = [{ new_count: 10, status: "incremented" }];
  state.rpcError = null;
  state.cooldownSeconds = 30;
  state.stampGoal = 10;
  calls.rpc = [];
  channelCalls.notify = [];
});

describe("POST /api/scan — câblage RPC scan_increment", () => {
  it("incrément au palier → succès, récompense débloquée, tampon ajouté", async () => {
    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.added).toBe(true);
    expect(body.rewardReady).toBe(true);
    // la route a bien appelé la RPC atomique avec le plafond = objectif (stamp_card).
    expect(calls.rpc[0].name).toBe("scan_increment");
    expect(calls.rpc[0].params).toMatchObject({ p_card_id: "card-1", p_cap: 10, p_cooldown_seconds: 30 });
  });

  it("cooldown actif → 429, AUCUN double tampon", async () => {
    state.rpcData = [{ new_count: 9, status: "cooldown" }];
    const res = await POST(scanReq());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.cooldown).toBe(true);
  });

  it("carte PLEINE (status full) → récompense prête, added=false (rien ajouté)", async () => {
    state.rpcData = [{ new_count: 10, status: "full" }];
    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rewardReady).toBe(true);
    expect(body.added).toBe(false);
  });

  it("carte introuvable côté RPC → 404", async () => {
    state.rpcData = [{ new_count: 0, status: "notfound" }];
    const res = await POST(scanReq());
    expect(res.status).toBe(404);
  });

  it("RPC en erreur → 500 (fail-loud, jamais de fallback racé)", async () => {
    state.rpcError = { message: "lock timeout" };
    const res = await POST(scanReq());
    expect(res.status).toBe(500);
  });
});

describe("POST /api/scan — programme à points : push au franchissement d'un palier (Minor 7)", () => {
  it("titre du push SANS emoji (cohérence avec « Récompense utilisée » de redeem.ts)", async () => {
    state.merchant = {
      id: "merchant-1",
      loyalty_type: "points",
      loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
      stamp_goal: 10,
      suspended_at: null,
    };
    state.card = { id: "card-1", merchant_id: "merchant-1", points_balance: 25, redeemed_tiers: [], customers: { full_name: "Nadia" } };
    // scan_increment_points : franchit le palier 30 (before=25, after=30).
    state.rpcData = [{ new_count: 30, points_added: 5, status: "incremented" }];

    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rewardReady).toBe(true);

    expect(channelCalls.notify).toHaveLength(1);
    expect(channelCalls.notify[0].message?.title).toBe("Récompense disponible");
    expect(channelCalls.notify[0].message?.body).toContain("Café offert");
  });

  it("pas de franchissement de palier → push silencieux (sans message)", async () => {
    state.merchant = {
      id: "merchant-1",
      loyalty_type: "points",
      loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
      stamp_goal: 10,
      suspended_at: null,
    };
    state.card = { id: "card-1", merchant_id: "merchant-1", points_balance: 10, redeemed_tiers: [], customers: { full_name: "Nadia" } };
    state.rpcData = [{ new_count: 15, points_added: 5, status: "incremented" }];

    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify).toHaveLength(1);
    expect(channelCalls.notify[0].message).toBeUndefined();
  });
});

describe("POST /api/scan — gardes de sécurité du comptoir", () => {
  it("non authentifié → 401", async () => {
    state.user = null;
    const res = await POST(scanReq());
    expect(res.status).toBe(401);
    expect(calls.rpc).toHaveLength(0);
  });

  it("carte d'un AUTRE établissement → 403, aucune RPC", async () => {
    state.card = { id: "card-1", merchant_id: "autre-merchant", stamps_count: 3 };
    const res = await POST(scanReq());
    expect(res.status).toBe(403);
    expect(calls.rpc).toHaveLength(0);
  });

  it("marchand suspendu → 403, aucune RPC", async () => {
    state.merchant = { ...(state.merchant as object), suspended_at: "2026-06-01T00:00:00Z" };
    const res = await POST(scanReq());
    expect(res.status).toBe(403);
    expect(calls.rpc).toHaveLength(0);
  });
});
