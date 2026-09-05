import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de PATCH /api/admin/merchants/[id] — programme de fidélité.
// Bug n°1 (audit PR #78) : la sauvegarde admin RECONSTRUISAIT loyalty_config à
// partir de zéro → welcome_stamps, intermediate_milestone, maxPointsPerScan
// (posés au Studio) étaient effacés. Attendu : GET-then-merge, clé par clé,
// même patron que segment_config — une clé non éditée survit.

type Row = Record<string, unknown>;

const state = {
  denied: null as unknown,
  current: null as Row | null,
  updateError: null as { message: string } | null,
};
const calls = {
  selects: [] as { cols: string; filter: Row }[],
  updates: [] as { payload: Row; filter: Row }[],
  audits: [] as Row[],
};

vi.mock("@/lib/adminAuth", () => ({ requireAdminApi: async () => state.denied }));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "merchants") throw new Error(`table inattendue ${table}`);
      return {
        select: (cols: string) => {
          const filter: Row = {};
          const chain = {
            eq: (col: string, val: unknown) => {
              filter[col] = val;
              return chain;
            },
            maybeSingle: async () => {
              calls.selects.push({ cols, filter: { ...filter } });
              return { data: state.current, error: null };
            },
          };
          return chain;
        },
        update: (payload: Row) => {
          const filter: Row = {};
          const chain = {
            eq: (col: string, val: unknown) => {
              filter[col] = val;
              return chain;
            },
            select: () => ({
              single: async () => {
                calls.updates.push({ payload, filter: { ...filter } });
                return state.updateError ? { data: null, error: state.updateError } : { data: { id: filter.id }, error: null };
              },
            }),
          };
          return chain;
        },
      };
    },
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audits.push(e);
  },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));

import { PATCH } from "@/app/api/admin/merchants/[id]/route";

const ID = "22222222-2222-4222-8222-222222222222";

function patch(body: unknown, id = ID) {
  const req = new Request(`https://app.halocard.ch/api/admin/merchants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id }) });
}

const savedConfig = () => calls.updates[0].payload.loyalty_config as Row;

beforeEach(() => {
  state.denied = null;
  state.current = null;
  state.updateError = null;
  calls.selects = [];
  calls.updates = [];
  calls.audits = [];
});

describe("PATCH /api/admin/merchants/[id] — loyalty_config : GET-then-merge", () => {
  it("stamp_card : welcome_stamps et intermediate_milestone (posés au Studio) SURVIVENT à une sauvegarde qui n'envoie que goal", async () => {
    state.current = { loyalty_type: "stamp_card", loyalty_config: { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 } };
    const res = await patch({ loyaltyType: "stamp_card", loyaltyConfig: { goal: 12 } });
    expect(res.status).toBe(200);
    expect(savedConfig()).toEqual({ goal: 12, welcome_stamps: 1, intermediate_milestone: 5 });
    // stamp_goal reste synchro
    expect(calls.updates[0].payload.stamp_goal).toBe(12);
  });

  it("la lecture de l'existant est filtrée par l'id du marchand", async () => {
    state.current = { loyalty_type: "stamp_card", loyalty_config: { goal: 10 } };
    await patch({ loyaltyType: "stamp_card", loyaltyConfig: { goal: 10 } });
    expect(calls.selects[0].filter).toEqual({ id: ID });
    expect(calls.selects[0].cols).toContain("loyalty_config");
    expect(calls.updates[0].filter).toEqual({ id: ID });
  });

  it("amount_points : maxPointsPerScan survit quand la fiche ne l'envoie pas", async () => {
    state.current = {
      loyalty_type: "amount_points",
      loyalty_config: { type: "amount_points", pointsPerChf: 1, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", maxPointsPerScan: 300 },
    };
    const res = await patch({
      loyaltyType: "amount_points",
      loyaltyConfig: { pointsPerChf: 2, rewardThreshold: 150, rewardLabel: "Un dessert offert" },
    });
    expect(res.status).toBe(200);
    expect(savedConfig()).toMatchObject({ pointsPerChf: 2, rewardThreshold: 150, rewardLabel: "Un dessert offert", maxPointsPerScan: 300 });
  });

  it("une clé envoyée EXPLICITEMENT à null est effacée (choix de l'admin, pas un oubli)", async () => {
    state.current = { loyalty_type: "stamp_card", loyalty_config: { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 } };
    await patch({ loyaltyType: "stamp_card", loyaltyConfig: { goal: 10, intermediate_milestone: null, welcome_stamps: 0 } });
    expect(savedConfig()).toEqual({ goal: 10 });
  });

  it("changement de mécanique : AUCUNE fusion avec la config de l'ancien type (pas de clés orphelines)", async () => {
    state.current = { loyalty_type: "stamp_card", loyalty_config: { goal: 10, welcome_stamps: 1 } };
    const res = await patch({ loyaltyType: "visit_based", loyaltyConfig: { milestones: [5, 20] } });
    expect(res.status).toBe(200);
    expect(savedConfig()).toEqual({ milestones: [5, 20] });
    expect(calls.updates[0].payload.loyalty_type).toBe("visit_based");
  });

  it("la fusion passe par validateLoyaltyProgram : une clé héritée devenue invalide (palier ≥ nouvel objectif) → 400, rien n'est écrit", async () => {
    state.current = { loyalty_type: "stamp_card", loyalty_config: { goal: 10, intermediate_milestone: 8 } };
    const res = await patch({ loyaltyType: "stamp_card", loyaltyConfig: { goal: 6 } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/intermédiaire/i);
    expect(calls.updates).toHaveLength(0);
  });

  it("pas de loyaltyType dans le body → loyalty_config jamais touchée", async () => {
    state.current = { loyalty_type: "stamp_card", loyalty_config: { goal: 10, welcome_stamps: 1 } };
    const res = await patch({ shopName: "Nouveau nom" });
    expect(res.status).toBe(200);
    expect(calls.updates[0].payload).toEqual({ shop_name: "Nouveau nom" });
  });
});

describe("PATCH /api/admin/merchants/[id] — marchand « points » (bug n°2)", () => {
  it("la config points complète (paliers, expiration, statuts) est acceptée → 200, tout est conservé", async () => {
    state.current = { loyalty_type: "points", loyalty_config: { pointsPerScan: 10, tiers: [{ threshold: 100, reward: "Un café" }] } };
    const res = await patch({
      loyaltyType: "points",
      loyaltyConfig: {
        pointsPerScan: 15,
        tiers: [{ threshold: 100, reward: "Un café" }, { threshold: 300, reward: "Un menu" }],
        expiration: { type: "rolling", months: 12 },
        statusTiers: [{ threshold: 0, label: "Bronze" }, { threshold: 500, label: "Or", benefit: "-10 %" }],
      },
    });
    expect(res.status).toBe(200);
    expect(savedConfig()).toEqual({
      pointsPerScan: 15,
      tiers: [{ threshold: 100, reward: "Un café" }, { threshold: 300, reward: "Un menu" }],
      expiration: { type: "rolling", months: 12 },
      statusTiers: [{ threshold: 0, label: "Bronze" }, { threshold: 500, label: "Or", benefit: "-10 %" }],
    });
    // pas de stamp_goal pour un programme points
    expect(calls.updates[0].payload).not.toHaveProperty("stamp_goal");
  });

  it("points : statusTiers et expiration posés au Studio survivent si la fiche n'envoie que pointsPerScan + tiers", async () => {
    state.current = {
      loyalty_type: "points",
      loyalty_config: {
        pointsPerScan: 10,
        tiers: [{ threshold: 100, reward: "Un café" }],
        expiration: { type: "fixed_date", month: 12, day: 31 },
        statusTiers: [{ threshold: 0, label: "Bronze" }],
      },
    };
    await patch({ loyaltyType: "points", loyaltyConfig: { pointsPerScan: 20, tiers: [{ threshold: 100, reward: "Un café" }] } });
    expect(savedConfig()).toMatchObject({
      pointsPerScan: 20,
      expiration: { type: "fixed_date", month: 12, day: 31 },
      statusTiers: [{ threshold: 0, label: "Bronze" }],
    });
  });

  it("l'ancien envoi de la fiche points ({ goal }) ne casse plus rien : la fusion complète la requête → 200 sans perte", async () => {
    state.current = { loyalty_type: "points", loyalty_config: { pointsPerScan: 10, tiers: [{ threshold: 100, reward: "Un café" }] } };
    const res = await patch({ loyaltyType: "points", loyaltyConfig: { goal: 10 } });
    // Avec la fusion, { goal } sur un marchand points ne casse plus rien : les
    // clés points existantes complètent la requête → 200 sans perte.
    expect(res.status).toBe(200);
    expect(savedConfig()).toMatchObject({ pointsPerScan: 10, tiers: [{ threshold: 100, reward: "Un café" }] });
    expect(savedConfig()).not.toHaveProperty("goal");
  });
});

describe("PATCH /api/admin/merchants/[id] — garde", () => {
  it("non admin → refus, aucune lecture ni écriture", async () => {
    state.denied = new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    const res = await patch({ loyaltyType: "stamp_card", loyaltyConfig: { goal: 10 } });
    expect(res.status).toBe(403);
    expect(calls.selects).toHaveLength(0);
    expect(calls.updates).toHaveLength(0);
  });
});
