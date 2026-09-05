import { beforeEach, describe, expect, it, vi } from "vitest";

// Cron quotidien d'expiration des cycles — étendu aux mécaniques à cycle sans
// ancre dédiée (stamp_card, amount_points ; ancre = last_scan, repli created_at).
// Pas de Postgres en unit : on mocke supabaseAdmin avec un mini-interpréteur de
// filtres et on prouve lots, tenancy, idempotence, audit et refresh wallet.

const NOW = new Date("2026-09-05T12:00:00Z");
const OLD = "2026-01-01T10:00:00Z"; // > 6 mois avant NOW
const FRESH = "2026-08-20T10:00:00Z";

type Row = Record<string, unknown>;
const state = {
  merchants: [] as Row[],
  cards: {} as Record<string, Row[]>, // par merchant_id
};
const updateCalls: { table: string; values: Row; filters: [string, unknown[]][] }[] = [];
const auditCalls: Row[] = [];
const notifyCalls: string[][] = [];

function applyFilters(rows: Row[], filters: [string, unknown[]][]): Row[] {
  return rows.filter((row) =>
    filters.every(([op, args]) => {
      const [col, a, b] = args as [string, unknown, unknown];
      if (op === "eq") return row[col] === a;
      if (op === "in") return (a as unknown[]).includes(row[col]);
      if (op === "gt") return typeof row[col] === "number" && (row[col] as number) > (a as number);
      if (op === "not") return !(a === "is" && b === null && row[col] === null);
      return true;
    })
  );
}

function selectChain(rows: () => Row[]) {
  const filters: [string, unknown[]][] = [];
  const b: Record<string, unknown> = {
    eq: (...a: unknown[]) => ((filters.push(["eq", a]), b)),
    in: (...a: unknown[]) => ((filters.push(["in", a]), b)),
    gt: (...a: unknown[]) => ((filters.push(["gt", a]), b)),
    not: (...a: unknown[]) => ((filters.push(["not", a]), b)),
    then: (res: (v: unknown) => void, rej: (e: unknown) => void) =>
      Promise.resolve({ data: applyFilters(rows(), filters), error: null }).then(res, rej),
  };
  return b;
}

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => selectChain(() => (table === "merchants" ? state.merchants : Object.values(state.cards).flat())),
      update: (values: Row) => {
        const rec = { table, values, filters: [] as [string, unknown[]][] };
        updateCalls.push(rec);
        const b: Record<string, unknown> = {
          eq: (...a: unknown[]) => ((rec.filters.push(["eq", a]), b)),
          then: (res: (v: unknown) => void, rej: (e: unknown) => void) => Promise.resolve({ error: null }).then(res, rej),
        };
        return b;
      },
    }),
  },
}));
vi.mock("@/lib/auditLog", () => ({ logAuditEvent: vi.fn(async (e: Row) => void auditCalls.push(e)) }));
vi.mock("@/lib/cron/recordRun", () => ({ recordCronRun: vi.fn(async () => {}) }));
vi.mock("@/lib/wallet/channel", () => ({
  getChannels: () => [{ notify: async (ids: string[]) => void notifyCalls.push(ids) }],
}));

import { POST } from "../route";

function request(auth = "Bearer test-cron-secret"): Request {
  return new Request("http://localhost/api/cron/points-expiry", { method: "POST", headers: { authorization: auth } });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-cron-secret";
  state.merchants = [];
  state.cards = {};
  updateCalls.length = 0;
  auditCalls.length = 0;
  notifyCalls.length = 0;
});

describe("cron cycles — stamp_card", () => {
  it("remet à zéro les cartes inactives, ignore les fraîches et celles à 0, tenancy double filtre", async () => {
    state.merchants = [{
      id: "m1", loyalty_type: "stamp_card", stamp_goal: 10,
      loyalty_config: { goal: 10, expiration: { type: "rolling", months: 6 } },
    }];
    state.cards.m1 = [
      { id: "c-old", merchant_id: "m1", stamps_count: 3, last_scan: OLD, created_at: OLD },
      { id: "c-fresh", merchant_id: "m1", stamps_count: 5, last_scan: FRESH, created_at: OLD },
      { id: "c-zero", merchant_id: "m1", stamps_count: 0, last_scan: OLD, created_at: OLD },
    ];
    const res = await POST(request() as never);
    expect(res.status).toBe(200);

    const resets = updateCalls.filter((u) => u.table === "loyalty_cards");
    expect(resets).toHaveLength(1);
    expect(resets[0].values).toEqual({ stamps_count: 0 });
    expect(resets[0].filters).toEqual(expect.arrayContaining([["eq", ["id", "c-old"]], ["eq", ["merchant_id", "m1"]]]));

    expect(auditCalls).toEqual([
      expect.objectContaining({
        action: "STAMPS_EXPIRED",
        merchant_id: "m1",
        card_id: "c-old",
        details: expect.objectContaining({ previous_stamps: 3, expiration: { type: "rolling", months: 6 } }),
      }),
    ]);
    expect(notifyCalls).toEqual([["c-old"]]); // refresh wallet silencieux
  });

  it("carte jamais scannée : le repli created_at fait foi (tampon de bienvenue)", async () => {
    state.merchants = [{ id: "m1", loyalty_type: "stamp_card", stamp_goal: 10, loyalty_config: { goal: 10, expiration: { type: "rolling", months: 6 } } }];
    state.cards.m1 = [{ id: "c-dormant", merchant_id: "m1", stamps_count: 1, last_scan: null, created_at: OLD }];
    await POST(request() as never);
    expect(updateCalls.filter((u) => u.table === "loyalty_cards")).toHaveLength(1);
  });

  it("sans expiration configurée : aucune carte touchée", async () => {
    state.merchants = [{ id: "m1", loyalty_type: "stamp_card", stamp_goal: 10, loyalty_config: { goal: 10 } }];
    state.cards.m1 = [{ id: "c-old", merchant_id: "m1", stamps_count: 3, last_scan: OLD, created_at: OLD }];
    await POST(request() as never);
    expect(updateCalls).toHaveLength(0);
    expect(auditCalls).toHaveLength(0);
  });
});

describe("cron cycles — amount_points", () => {
  it("remet le solde à zéro et audite POINTS_EXPIRED avec le type du programme", async () => {
    state.merchants = [{
      id: "m2", loyalty_type: "amount_points", stamp_goal: null,
      loyalty_config: { pointsPerChf: 1, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", expiration: { type: "rolling", months: 6 } },
    }];
    state.cards.m2 = [
      { id: "c-ap", merchant_id: "m2", points_balance: 250, last_scan: OLD, created_at: OLD },
      { id: "c-ap-zero", merchant_id: "m2", points_balance: 0, last_scan: OLD, created_at: OLD },
    ];
    await POST(request() as never);

    const resets = updateCalls.filter((u) => u.table === "loyalty_cards");
    expect(resets).toHaveLength(1);
    expect(resets[0].values).toEqual({ points_balance: 0 });
    expect(resets[0].filters).toEqual(expect.arrayContaining([["eq", ["id", "c-ap"]], ["eq", ["merchant_id", "m2"]]]));
    expect(auditCalls).toEqual([
      expect.objectContaining({
        action: "POINTS_EXPIRED",
        merchant_id: "m2",
        card_id: "c-ap",
        details: expect.objectContaining({ previous_balance: 250, loyalty_type: "amount_points" }),
      }),
    ]);
  });
});

describe("cron cycles — régression points et garde d'accès", () => {
  it("le chemin points existant reste intact (ancre points_cycle_started_at, reset complet)", async () => {
    state.merchants = [{
      id: "m3", loyalty_type: "points", stamp_goal: null,
      loyalty_config: { pointsPerScan: 10, tiers: [{ threshold: 100, reward: "Café" }], expiration: { type: "rolling", months: 6 } },
    }];
    state.cards.m3 = [{ id: "c-pts", merchant_id: "m3", points_balance: 40, points_cycle_started_at: OLD }];
    await POST(request() as never);

    const resets = updateCalls.filter((u) => u.table === "loyalty_cards");
    expect(resets).toHaveLength(1);
    expect(resets[0].values).toEqual({ points_balance: 0, redeemed_tiers: [], points_cycle_started_at: null });
    expect(auditCalls[0]).toMatchObject({ action: "POINTS_EXPIRED", card_id: "c-pts" });
  });

  it("refuse sans le secret cron", async () => {
    const res = await POST(request("Bearer mauvais") as never);
    expect(res.status).toBe(401);
    expect(updateCalls).toHaveLength(0);
  });
});
