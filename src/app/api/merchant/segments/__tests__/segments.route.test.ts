import { beforeEach, describe, expect, it, vi } from "vitest";

// Tests RUNTIME de /api/merchant/segments — le réglage « client en train de
// partir » côté commerçant. Vérifie : 401 sans session, validation des bornes,
// tenancy (l'update cible le marchand EFFECTIF, filtre .eq posé), et le
// GET-then-merge qui préserve les autres clés de segment_config (vip_visits…).

const state = {
  ctx: { merchantId: null as string | null, userId: null as string | null },
  row: null as Record<string, unknown> | null,
};

const calls = {
  selectedIds: [] as string[],
  updates: [] as { id: string; payload: Record<string, unknown> }[],
  audits: [] as Record<string, unknown>[],
};

vi.mock("@/lib/auth/currentMerchant", () => ({
  currentMerchantId: async () => state.ctx.merchantId,
  currentMerchantContext: async () => ({
    merchantId: state.ctx.merchantId,
    ownMerchantId: state.ctx.merchantId,
    userId: state.ctx.userId,
    role: "merchant",
    isImpersonating: false,
  }),
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: async () => {
            calls.selectedIds.push(id);
            return { data: state.row, error: null };
          },
        }),
      }),
      update: (payload: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          calls.updates.push({ id, payload });
          return { error: null };
        },
      }),
    }),
  },
}));

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (entry: Record<string, unknown>) => {
    calls.audits.push(entry);
  },
  extractRequestMeta: () => ({}),
}));

import { GET, PATCH } from "@/app/api/merchant/segments/route";

const patchReq = (body: unknown) =>
  new Request("http://localhost/api/merchant/segments", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  state.ctx = { merchantId: null, userId: null };
  state.row = null;
  calls.selectedIds = [];
  calls.updates = [];
  calls.audits = [];
});

describe("GET /api/merchant/segments", () => {
  it("non authentifié → 401", async () => {
    expect((await GET()).status).toBe(401);
  });
  it("renvoie les seuils résolus (défauts si segment_config vide)", async () => {
    state.ctx = { merchantId: "m1", userId: "u1" };
    state.row = { segment_config: null };
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ active_days: 30, at_risk_days: 90 });
    expect(calls.selectedIds).toEqual(["m1"]);
  });
});

describe("PATCH /api/merchant/segments", () => {
  it("non authentifié → 401, aucune écriture", async () => {
    const res = await PATCH(patchReq({ active_days: 30, at_risk_days: 90 }));
    expect(res.status).toBe(401);
    expect(calls.updates).toEqual([]);
  });

  it("bornes violées → 400, aucune écriture", async () => {
    state.ctx = { merchantId: "m1", userId: "u1" };
    for (const body of [
      { active_days: 6, at_risk_days: 90 },
      { active_days: 30, at_risk_days: 366 },
      { active_days: 90, at_risk_days: 30 },
      { active_days: "30", at_risk_days: 90 },
    ]) {
      expect((await PATCH(patchReq(body))).status).toBe(400);
    }
    expect(calls.updates).toEqual([]);
  });

  it("tenancy : l'écriture cible le marchand effectif et UNIQUEMENT lui", async () => {
    state.ctx = { merchantId: "m-effectif", userId: "u1" };
    state.row = { segment_config: {} };
    const res = await PATCH(patchReq({ active_days: 21, at_risk_days: 60 }));
    expect(res.status).toBe(200);
    expect(calls.updates).toHaveLength(1);
    expect(calls.updates[0].id).toBe("m-effectif");
  });

  it("GET-then-merge : préserve vip_visits et le cooldown existants", async () => {
    state.ctx = { merchantId: "m1", userId: "u1" };
    state.row = { segment_config: { vip_visits: 12, scan_cooldown_seconds: 120, active_days: 30, at_risk_days: 90 } };
    await PATCH(patchReq({ active_days: 14, at_risk_days: 45 }));
    expect(calls.updates[0].payload.segment_config).toEqual({
      vip_visits: 12, scan_cooldown_seconds: 120, active_days: 14, at_risk_days: 45,
    });
  });

  it("audite l'action MERCHANT_UPDATED (action existante — pas de nouvelle migration)", async () => {
    state.ctx = { merchantId: "m1", userId: "u1" };
    state.row = { segment_config: {} };
    await PATCH(patchReq({ active_days: 21, at_risk_days: 60 }));
    expect(calls.audits).toHaveLength(1);
    expect(calls.audits[0].action).toBe("MERCHANT_UPDATED");
    expect(calls.audits[0].merchant_id).toBe("m1");
  });
});
