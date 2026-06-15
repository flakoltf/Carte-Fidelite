import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME des routes démo : la garde admin (403) prime sur tout effet de
// bord, et le parcours nominal seed/reset audite + renvoie le bon payload.

const state = {
  denied: null as unknown,
  rateOk: true,
  seedResult: { merchantId: "m-demo", mode: "created" as "created" | "reset", tempPassword: "pw" } as Record<string, unknown>,
  resetResult: { merchantId: "m-demo", cards: 3 } as Record<string, unknown>,
  seedThrows: null as Error | null,
  resetThrows: null as Error | null,
};
const calls = { seed: 0, reset: 0, audits: [] as Record<string, unknown>[], rateKeys: [] as string[] };

vi.mock("@/lib/adminAuth", () => ({
  requireAdminApi: async () => state.denied,
  getSessionRole: async () => ({ userId: "admin-1", role: "admin" }),
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (key: string) => {
    calls.rateKeys.push(key);
    return { success: state.rateOk, remaining: state.rateOk ? 9 : 0 };
  },
}));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Record<string, unknown>) => { calls.audits.push(e); },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: { auth: { admin: {} } } }));
vi.mock("@/lib/demo/seed", () => ({
  seedDemoMerchant: async () => {
    calls.seed++;
    if (state.seedThrows) throw state.seedThrows;
    return state.seedResult;
  },
}));
vi.mock("@/lib/demo/reset", () => ({
  resetDemoMerchant: async () => {
    calls.reset++;
    if (state.resetThrows) throw state.resetThrows;
    return state.resetResult;
  },
}));

import { POST as SEED } from "@/app/api/admin/demo/seed/route";
import { POST as RESET } from "@/app/api/admin/demo/reset/route";
import { DemoGuardError } from "@/lib/demo/identity";

function req() { return new Request("https://app.halocard.ch/api/admin/demo/seed", { method: "POST" }); }

beforeEach(() => {
  state.denied = null;
  state.rateOk = true;
  state.seedResult = { merchantId: "m-demo", mode: "created", tempPassword: "pw" };
  state.resetResult = { merchantId: "m-demo", cards: 3 };
  state.seedThrows = null;
  state.resetThrows = null;
  calls.seed = 0; calls.reset = 0; calls.audits = []; calls.rateKeys = [];
});

describe("garde admin (403)", () => {
  it("seed : non-admin → 403, aucun effet de bord", async () => {
    state.denied = Response.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    const res = await SEED(req());
    expect(res.status).toBe(403);
    expect(calls.seed).toBe(0);
    expect(calls.audits).toHaveLength(0);
  });
  it("reset : non-admin → 403, aucune purge", async () => {
    state.denied = Response.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    const res = await RESET(req());
    expect(res.status).toBe(403);
    expect(calls.reset).toBe(0);
  });
});

describe("seed nominal", () => {
  it("crée, audite DEMO_ACCOUNT_SEEDED, renvoie mode + lien d'enrôlement", async () => {
    const res = await SEED(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("created");
    expect(body.enrollPath).toBe("/c/boulangerie-demo");
    expect(body.tempPassword).toBe("pw");
    expect(calls.audits[0].action).toBe("DEMO_ACCOUNT_SEEDED");
    expect(calls.rateKeys).toContain("demo-seed:admin-1");
  });
  it("rate-limit dépassé → 429, pas de seed", async () => {
    state.rateOk = false;
    const res = await SEED(req());
    expect(res.status).toBe(429);
    expect(calls.seed).toBe(0);
  });
});

describe("reset nominal + gardes", () => {
  it("purge, audite DEMO_ACCOUNT_RESET, renvoie le nombre de cartes purgées", async () => {
    const res = await RESET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cardsPurged).toBe(3);
    expect(calls.audits[0].action).toBe("DEMO_ACCOUNT_RESET");
  });
  it("aucune démo (DemoGuardError not_found) → 404, pas d'audit", async () => {
    state.resetThrows = new DemoGuardError("introuvable", "not_found");
    const res = await RESET(req());
    expect(res.status).toBe(404);
    expect(calls.audits).toHaveLength(0);
  });
  it("slug réservé squatté (mismatch) → 409", async () => {
    state.resetThrows = new DemoGuardError("refus", "mismatch");
    const res = await RESET(req());
    expect(res.status).toBe(409);
  });
});
