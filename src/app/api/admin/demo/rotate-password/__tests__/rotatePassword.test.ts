import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de la route de rotation : la garde admin (403) prime sur tout
// effet de bord, le parcours nominal audite DEMO_ACCOUNT_ROTATED + renvoie le
// mot de passe une seule fois, et les DemoGuardError mappent 404/409.

const state = {
  denied: null as unknown,
  rateOk: true,
  result: { merchantId: "m-demo", userId: "user-demo", tempPassword: "new-pw" } as Record<string, unknown>,
  throws: null as Error | null,
};
const calls = { rotate: 0, audits: [] as Record<string, unknown>[], rateKeys: [] as string[] };

vi.mock("@/lib/adminAuth", () => ({
  requireAdminApi: async () => state.denied,
  getSessionRole: async () => ({ userId: "admin-1", role: "admin" }),
}));
vi.mock("@/lib/rateLimit", () => ({
  rateLimit: async (key: string) => {
    calls.rateKeys.push(key);
    return { success: state.rateOk, remaining: state.rateOk ? 4 : 0 };
  },
}));
vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Record<string, unknown>) => { calls.audits.push(e); },
  extractRequestMeta: () => ({ ip_address: "203.0.113.7", user_agent: "vitest" }),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: { auth: { admin: {} } } }));
vi.mock("@/lib/demo/rotate", () => ({
  rotateDemoPassword: async () => {
    calls.rotate++;
    if (state.throws) throw state.throws;
    return state.result;
  },
}));

import { POST as ROTATE } from "@/app/api/admin/demo/rotate-password/route";
import { DemoGuardError } from "@/lib/demo/identity";

function req() { return new Request("https://app.halocard.ch/api/admin/demo/rotate-password", { method: "POST" }); }

beforeEach(() => {
  state.denied = null;
  state.rateOk = true;
  state.result = { merchantId: "m-demo", userId: "user-demo", tempPassword: "new-pw" };
  state.throws = null;
  calls.rotate = 0; calls.audits = []; calls.rateKeys = [];
});

describe("garde admin (403)", () => {
  it("non-admin → 403, aucune rotation, aucun audit", async () => {
    state.denied = Response.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    const res = await ROTATE(req());
    expect(res.status).toBe(403);
    expect(calls.rotate).toBe(0);
    expect(calls.audits).toHaveLength(0);
  });
});

describe("rotation nominale", () => {
  it("rote, audite DEMO_ACCOUNT_ROTATED, renvoie le mot de passe une fois", async () => {
    const res = await ROTATE(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.tempPassword).toBe("new-pw");
    expect(calls.audits[0].action).toBe("DEMO_ACCOUNT_ROTATED");
    expect(calls.audits[0].merchant_id).toBe("m-demo");
    expect(calls.rateKeys).toContain("demo-rotate:admin-1");
  });

  it("rate-limit dépassé → 429, pas de rotation", async () => {
    state.rateOk = false;
    const res = await ROTATE(req());
    expect(res.status).toBe(429);
    expect(calls.rotate).toBe(0);
    expect(calls.audits).toHaveLength(0);
  });
});

describe("gardes démo", () => {
  it("aucune démo (not_found) → 404, pas d'audit", async () => {
    state.throws = new DemoGuardError("introuvable", "not_found");
    const res = await ROTATE(req());
    expect(res.status).toBe(404);
    expect(calls.audits).toHaveLength(0);
  });

  it("slug réservé squatté (mismatch) → 409", async () => {
    state.throws = new DemoGuardError("refus", "mismatch");
    const res = await ROTATE(req());
    expect(res.status).toBe(409);
  });
});
