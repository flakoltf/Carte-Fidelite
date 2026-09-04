import { beforeEach, describe, expect, it, vi } from "vitest";

// confirmMarketingConsent : passage « pending » → « confirmed » au clic sur le
// lien de double opt-in. Idempotent (double clic = même résultat, un seul
// audit), tenancy (id + merchant_id), audit MARKETING_CONSENT_UPDATED.

type Row = Record<string, unknown>;

const state = { row: null as Row | null, updateError: null as { code?: string; message: string } | null };
const calls = { selectFilters: [] as Row[], updates: [] as { payload: Row; filter: Row }[], audit: [] as Row[] };

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audit.push(e);
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => {
        const filter: Row = {};
        const chain = {
          eq: (col: string, val: unknown) => {
            filter[col] = val;
            return chain;
          },
          maybeSingle: async () => {
            calls.selectFilters.push({ ...filter });
            return { data: state.row, error: null };
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
          then: (resolve: (v: unknown) => void) => {
            calls.updates.push({ payload, filter });
            resolve({ error: state.updateError });
          },
        };
        return chain;
      },
    }),
  },
}));

import { confirmMarketingConsent } from "../confirm";

const INPUT = { customerId: "cust-1", merchantId: "merchant-1", ip: "203.0.113.7", userAgent: "vitest" };

beforeEach(() => {
  state.row = {
    id: "cust-1",
    marketing_consent: false,
    marketing_consent_at: "2026-09-04T10:00:00Z",
    marketing_consent_confirmed_at: null,
    marketing_consent_revoked_at: null,
  };
  state.updateError = null;
  calls.selectFilters = [];
  calls.updates = [];
  calls.audit = [];
});

describe("confirmMarketingConsent", () => {
  it("pending → confirmed : flag + horodatage, révocation levée, filtre id + merchant_id", async () => {
    const before = Date.now();
    const r = await confirmMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "confirmed" });
    expect(calls.selectFilters[0]).toEqual({ id: "cust-1", merchant_id: "merchant-1" });
    const { payload, filter } = calls.updates[0];
    expect(payload).toMatchObject({ marketing_consent: true, marketing_consent_revoked_at: null });
    expect(Date.parse(payload.marketing_consent_confirmed_at as string)).toBeGreaterThanOrEqual(before);
    expect(filter).toEqual({ id: "cust-1", merchant_id: "merchant-1" });
  });

  it("audit MARKETING_CONSENT_UPDATED status=confirmed via double_opt_in", async () => {
    await confirmMarketingConsent(INPUT);
    expect(calls.audit).toHaveLength(1);
    expect(calls.audit[0]).toMatchObject({
      action: "MARKETING_CONSENT_UPDATED",
      merchant_id: "merchant-1",
      ip_address: "203.0.113.7",
      details: { customer_id: "cust-1", status: "confirmed", previous: "pending", via: "double_opt_in" },
    });
  });

  it("déjà confirmé (double clic) → already, aucune écriture, aucun audit", async () => {
    state.row = { ...state.row!, marketing_consent: true, marketing_consent_confirmed_at: "2026-09-04T10:05:00Z" };
    const r = await confirmMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "already" });
    expect(calls.updates).toHaveLength(0);
    expect(calls.audit).toHaveLength(0);
  });

  it("jamais demandé (case jamais cochée) → not_requested : on ne confirme pas un consentement inexistant", async () => {
    state.row = { ...state.row!, marketing_consent_at: null };
    const r = await confirmMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "not_requested" });
    expect(calls.updates).toHaveLength(0);
  });

  it("client introuvable sous ce marchand (jeton d'un autre tenant) → not_found, aucune écriture", async () => {
    state.row = null;
    const r = await confirmMarketingConsent({ ...INPUT, merchantId: "merchant-autre" });
    expect(r).toEqual({ outcome: "not_found" });
    expect(calls.selectFilters[0]).toEqual({ id: "cust-1", merchant_id: "merchant-autre" });
    expect(calls.updates).toHaveLength(0);
  });

  it("révoqué puis re-clic sur un vieux lien de confirmation encore valide → re-confirme (acte explicite), tracé", async () => {
    state.row = { ...state.row!, marketing_consent_revoked_at: "2026-09-05T10:00:00Z" };
    const r = await confirmMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "confirmed" });
    expect(calls.audit[0]).toMatchObject({ details: { previous: "revoked" } });
  });

  it("échec UPDATE → throw (la route répond « lien indisponible », jamais un faux succès)", async () => {
    state.updateError = { message: "boom" };
    await expect(confirmMarketingConsent(INPUT)).rejects.toThrow(/boom/);
    expect(calls.audit).toHaveLength(0);
  });
});
