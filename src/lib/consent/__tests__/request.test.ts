import { beforeEach, describe, expect, it, vi } from "vitest";

// requestMarketingConsent : enregistre la preuve « case cochée » (horodatage +
// IP) et place le client en attente de confirmation. Tenancy : chaque lecture /
// écriture porte .eq("merchant_id"). Audit : MARKETING_CONSENT_UPDATED (existant).

type Row = Record<string, unknown>;

const state = {
  consentRow: null as Row | null,
  updateError: null as { code?: string; message: string } | null,
};
const calls = {
  selectFilters: [] as Row[],
  updates: [] as { payload: Row; filter: Row }[],
  audit: [] as Row[],
};

vi.mock("@/lib/auditLog", () => ({
  logAuditEvent: async (e: Row) => {
    calls.audit.push(e);
  },
}));

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "customers") throw new Error(`table inattendue ${table}`);
      return {
        select: () => {
          const filter: Row = {};
          const chain = {
            eq: (col: string, val: unknown) => {
              filter[col] = val;
              return chain;
            },
            maybeSingle: async () => {
              calls.selectFilters.push({ ...filter });
              return { data: state.consentRow, error: null };
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
      };
    },
  },
}));

import { requestMarketingConsent } from "../request";

const INPUT = {
  customerId: "cust-1",
  merchantId: "merchant-1",
  email: "nadia@example.ch",
  ip: "203.0.113.7",
  userAgent: "vitest",
};

beforeEach(() => {
  state.consentRow = { marketing_consent: false, marketing_consent_at: null, marketing_consent_confirmed_at: null, marketing_consent_revoked_at: null };
  state.updateError = null;
  calls.selectFilters = [];
  calls.updates = [];
  calls.audit = [];
});

describe("requestMarketingConsent", () => {
  it("enregistre la preuve (horodatage ISO + IP + source) et met le client en attente", async () => {
    const before = Date.now();
    const r = await requestMarketingConsent(INPUT);
    expect(r.state).toBe("pending");
    expect(calls.updates).toHaveLength(1);
    const { payload, filter } = calls.updates[0];
    expect(payload).toMatchObject({
      marketing_consent: false,
      marketing_consent_ip: "203.0.113.7",
      marketing_consent_source: "enroll",
      marketing_consent_confirmed_at: null,
      marketing_consent_revoked_at: null,
    });
    const at = Date.parse(payload.marketing_consent_at as string);
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
    // tenancy : le client ET le marchand
    expect(filter).toEqual({ id: "cust-1", merchant_id: "merchant-1" });
  });

  it("audit MARKETING_CONSENT_UPDATED (action existante) avec l'état pending et l'IP", async () => {
    await requestMarketingConsent(INPUT);
    expect(calls.audit).toHaveLength(1);
    expect(calls.audit[0]).toMatchObject({
      action: "MARKETING_CONSENT_UPDATED",
      merchant_id: "merchant-1",
      ip_address: "203.0.113.7",
      user_agent: "vitest",
      details: { customer_id: "cust-1", status: "pending", source: "enroll" },
    });
  });

  it("la lecture de l'état courant est filtrée par merchant_id (tenancy)", async () => {
    await requestMarketingConsent(INPUT);
    expect(calls.selectFilters[0]).toEqual({ id: "cust-1", merchant_id: "merchant-1" });
  });

  it("client déjà confirmé (non révoqué) → rien à faire : pas d'écrasement, pas d'audit", async () => {
    state.consentRow = {
      marketing_consent: true,
      marketing_consent_at: "2026-08-01T10:00:00Z",
      marketing_consent_confirmed_at: "2026-08-01T10:05:00Z",
      marketing_consent_revoked_at: null,
    };
    const r = await requestMarketingConsent(INPUT);
    expect(r.state).toBe("confirmed");
    expect(calls.updates).toHaveLength(0);
    expect(calls.audit).toHaveLength(0);
  });

  it("client révoqué qui re-coche la case → nouvelle demande en attente (révocation levée, tracée par l'audit)", async () => {
    state.consentRow = {
      marketing_consent: false,
      marketing_consent_at: "2026-08-01T10:00:00Z",
      marketing_consent_confirmed_at: "2026-08-01T10:05:00Z",
      marketing_consent_revoked_at: "2026-08-20T10:00:00Z",
    };
    const r = await requestMarketingConsent(INPUT);
    expect(r.state).toBe("pending");
    expect(calls.updates[0].payload.marketing_consent_revoked_at).toBeNull();
    expect(calls.audit[0]).toMatchObject({ details: { status: "pending", previous: "revoked" } });
  });

  it("échec de l'UPDATE (ex. colonnes absentes, 42703) → throw explicite, aucun audit trompeur", async () => {
    state.updateError = { code: "42703", message: "column does not exist" };
    await expect(requestMarketingConsent(INPUT)).rejects.toThrow(/42703/);
    expect(calls.audit).toHaveLength(0);
  });
});
