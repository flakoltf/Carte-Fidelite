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
const updateCalls: { table: string; values: Record<string, unknown>; filters: [string, unknown[]][] }[] = [];

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
        // UPDATE chaîné (statut client) : enregistre valeurs + filtres, thenable.
        update: (values: Record<string, unknown>) => {
          const rec = { table, values, filters: [] as [string, unknown[]][] };
          updateCalls.push(rec);
          const builder = {
            eq: (...a: unknown[]) => { rec.filters.push(["eq", a]); return builder; },
            or: (...a: unknown[]) => { rec.filters.push(["or", a]); return builder; },
            then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
              Promise.resolve({ error: null }).then(resolve, reject),
          };
          return builder;
        },
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

// Message commerçant consommé au scan (NOTIFICATIONS-WALLET §3) : on enregistre
// les appels à clearCardMessage pour prouver QUAND la route efface (push
// silencieux) et quand elle n'efface PAS (un message remplace, ou cooldown).
const clearCalls: { cardId: string; merchantId: string }[] = [];
vi.mock("@/lib/wallet/authToken", () => ({
  clearCardMessage: async (cardId: string, merchantId: string) => {
    clearCalls.push({ cardId, merchantId });
  },
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
  updateCalls.length = 0;
  channelCalls.notify = [];
  clearCalls.length = 0;
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

describe("POST /api/scan — statut client (cumul à vie, cartes à points)", () => {
  const STATUS_CONFIG = {
    pointsPerScan: 5,
    tiers: [{ threshold: 30, reward: "Café offert" }],
    statusTiers: [
      { threshold: 0, label: "Bronze" },
      { threshold: 50, label: "Argent", benefit: "5% de réduction" },
    ],
  };

  function pointsState(card: Record<string, unknown>, rpcRow: Record<string, unknown>) {
    state.merchant = {
      id: "merchant-1",
      loyalty_type: "points",
      loyalty_config: STATUS_CONFIG,
      stamp_goal: 10,
      suspended_at: null,
    };
    state.card = { id: "card-1", merchant_id: "merchant-1", redeemed_tiers: [], customers: { full_name: "Nadia" }, ...card };
    state.rpcData = [rpcRow];
  }

  it("changement de statut SEUL → notification « Nouveau statut » + UPDATE monotone du seuil", async () => {
    // before=20 → after=25 : aucun palier de récompense franchi ; cumul 50 → Argent.
    pointsState(
      { points_balance: 20, current_status_tier: 0 },
      { new_count: 25, points_added: 5, new_lifetime: 50, status: "incremented" }
    );

    const res = await POST(scanReq());
    expect(res.status).toBe(200);

    expect(channelCalls.notify).toHaveLength(1);
    expect(channelCalls.notify[0].message?.title).toBe("Nouveau statut");
    expect(channelCalls.notify[0].message?.body).toContain("Argent");
    expect(channelCalls.notify[0].message?.body).toContain("5% de réduction");

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].values).toEqual({ current_status_tier: 50 });
    expect(updateCalls[0].filters).toContainEqual(["eq", ["id", "card-1"]]);
    expect(updateCalls[0].filters).toContainEqual(["eq", ["merchant_id", "merchant-1"]]);
    // Garde monotone : jamais rétrogradé, même en course entre deux scans.
    expect(updateCalls[0].filters).toContainEqual(["or", ["current_status_tier.is.null,current_status_tier.lt.50"]]);
  });

  it("récompense ET statut au même scan → UNE notification combinée, récompense en tête", async () => {
    // before=25 → after=30 : palier récompense 30 franchi ; cumul 50 → Argent.
    pointsState(
      { points_balance: 25, current_status_tier: 0 },
      { new_count: 30, points_added: 5, new_lifetime: 50, status: "incremented" }
    );

    const res = await POST(scanReq());
    expect(res.status).toBe(200);

    expect(channelCalls.notify).toHaveLength(1);
    expect(channelCalls.notify[0].message?.title).toBe("Récompense disponible");
    expect(channelCalls.notify[0].message?.body).toContain("Café offert");
    expect(channelCalls.notify[0].message?.body).toContain("Argent");
    expect(updateCalls).toHaveLength(1);
  });

  it("statut inchangé → push silencieux, aucun UPDATE de statut", async () => {
    pointsState(
      { points_balance: 10, current_status_tier: 0 },
      { new_count: 15, points_added: 5, new_lifetime: 30, status: "incremented" }
    );

    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify[0].message).toBeUndefined();
    expect(updateCalls).toHaveLength(0);
  });

  it("jamais rétrogradé : seuil stocké plus haut que le calculé → ni UPDATE ni notification", async () => {
    pointsState(
      { points_balance: 10, current_status_tier: 50 },
      { new_count: 15, points_added: 5, new_lifetime: 10, status: "incremented" }
    );

    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify[0].message).toBeUndefined();
    expect(updateCalls).toHaveLength(0);
  });

  it("RPC d'avant migration (sans new_lifetime) → aucun recalcul, comportement inchangé", async () => {
    pointsState(
      { points_balance: 20, current_status_tier: null },
      { new_count: 25, points_added: 5, status: "incremented" }
    );

    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify[0].message).toBeUndefined();
    expect(updateCalls).toHaveLength(0);
  });

  it("statusTiers absents de la config → aucun recalcul même avec new_lifetime", async () => {
    pointsState(
      { points_balance: 20, current_status_tier: null },
      { new_count: 25, points_added: 5, new_lifetime: 500, status: "incremented" }
    );
    state.merchant = {
      ...(state.merchant as Record<string, unknown>),
      loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
    };

    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify[0].message).toBeUndefined();
    expect(updateCalls).toHaveLength(0);
  });
});

describe("POST /api/scan — message commerçant consommé au scan (NOTIFICATIONS-WALLET §3)", () => {
  function pointsState(rpcRow: Record<string, unknown>) {
    state.merchant = {
      id: "merchant-1",
      loyalty_type: "points",
      loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
      stamp_goal: 10,
      suspended_at: null,
    };
    state.card = { id: "card-1", merchant_id: "merchant-1", points_balance: 10, redeemed_tiers: [], customers: { full_name: "Nadia" } };
    state.rpcData = [rpcRow];
  }

  it("scan tampons (push silencieux) → efface le message, filtré carte + marchand", async () => {
    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(clearCalls).toEqual([{ cardId: "card-1", merchantId: "merchant-1" }]);
  });

  it("points SANS franchissement (push silencieux) → efface le message", async () => {
    pointsState({ new_count: 15, points_added: 5, status: "incremented" });
    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify[0].message).toBeUndefined();
    expect(clearCalls).toEqual([{ cardId: "card-1", merchantId: "merchant-1" }]);
  });

  it("points AVEC franchissement → n'efface PAS (« Récompense disponible » remplace)", async () => {
    state.merchant = {
      id: "merchant-1",
      loyalty_type: "points",
      loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
      stamp_goal: 10,
      suspended_at: null,
    };
    state.card = { id: "card-1", merchant_id: "merchant-1", points_balance: 25, redeemed_tiers: [], customers: { full_name: "Nadia" } };
    state.rpcData = [{ new_count: 30, points_added: 5, status: "incremented" }];
    const res = await POST(scanReq());
    expect(res.status).toBe(200);
    expect(channelCalls.notify[0].message?.title).toBe("Récompense disponible");
    expect(clearCalls).toHaveLength(0);
  });

  it("cooldown → n'efface pas (le client n'a pas été crédité, le message reste)", async () => {
    state.rpcData = [{ new_count: 9, status: "cooldown" }];
    const res = await POST(scanReq());
    expect(res.status).toBe(429);
    expect(clearCalls).toHaveLength(0);
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
