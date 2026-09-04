import { beforeEach, describe, expect, it, vi } from "vitest";

// revokeMarketingConsent : désinscription en un clic. Idempotente (double clic
// = même résultat, un seul audit), tenancy (id + merchant_id), audit
// MARKETING_CONSENT_UPDATED. Fonctionne aussi sur un client seulement « en
// attente » (il ne veut rien recevoir : on le respecte tout de suite).

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

import { revokeMarketingConsent } from "../unsubscribe";

const INPUT = { customerId: "cust-1", merchantId: "merchant-1", ip: "203.0.113.7", userAgent: "vitest" };

beforeEach(() => {
  state.row = {
    id: "cust-1",
    marketing_consent: true,
    marketing_consent_at: "2026-09-04T10:00:00Z",
    marketing_consent_confirmed_at: "2026-09-04T10:05:00Z",
    marketing_consent_revoked_at: null,
  };
  state.updateError = null;
  calls.selectFilters = [];
  calls.updates = [];
  calls.audit = [];
});

describe("revokeMarketingConsent", () => {
  it("confirmed → revoked : flag à false + horodatage, filtre id + merchant_id", async () => {
    const before = Date.now();
    const r = await revokeMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "revoked" });
    expect(calls.selectFilters[0]).toEqual({ id: "cust-1", merchant_id: "merchant-1" });
    const { payload, filter } = calls.updates[0];
    expect(payload).toMatchObject({ marketing_consent: false });
    expect(Date.parse(payload.marketing_consent_revoked_at as string)).toBeGreaterThanOrEqual(before);
    // la preuve du consentement initial (confirmed_at) n'est PAS effacée
    expect(payload).not.toHaveProperty("marketing_consent_confirmed_at");
    expect(filter).toEqual({ id: "cust-1", merchant_id: "merchant-1" });
  });

  it("audit MARKETING_CONSENT_UPDATED status=revoked via unsubscribe_link", async () => {
    await revokeMarketingConsent(INPUT);
    expect(calls.audit).toHaveLength(1);
    expect(calls.audit[0]).toMatchObject({
      action: "MARKETING_CONSENT_UPDATED",
      merchant_id: "merchant-1",
      ip_address: "203.0.113.7",
      details: { customer_id: "cust-1", status: "revoked", previous: "confirmed", via: "unsubscribe_link" },
    });
  });

  it("déjà révoqué (double clic) → already, aucune écriture, aucun audit", async () => {
    state.row = { ...state.row!, marketing_consent: false, marketing_consent_revoked_at: "2026-09-05T10:00:00Z" };
    const r = await revokeMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "already" });
    expect(calls.updates).toHaveLength(0);
    expect(calls.audit).toHaveLength(0);
  });

  it("seulement en attente → révoqué quand même (le client ne veut rien recevoir)", async () => {
    state.row = { ...state.row!, marketing_consent: false, marketing_consent_confirmed_at: null };
    const r = await revokeMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "revoked" });
    expect(calls.audit[0]).toMatchObject({ details: { previous: "pending" } });
  });

  it("jamais demandé → révoqué quand même (aucun futur envoi possible), tracé previous=none", async () => {
    state.row = { id: "cust-1", marketing_consent: false, marketing_consent_at: null, marketing_consent_confirmed_at: null, marketing_consent_revoked_at: null };
    const r = await revokeMarketingConsent(INPUT);
    expect(r).toEqual({ outcome: "revoked" });
    expect(calls.audit[0]).toMatchObject({ details: { previous: "none" } });
  });

  it("client introuvable sous ce marchand → not_found, aucune écriture", async () => {
    state.row = null;
    const r = await revokeMarketingConsent({ ...INPUT, merchantId: "merchant-autre" });
    expect(r).toEqual({ outcome: "not_found" });
    expect(calls.updates).toHaveLength(0);
  });

  it("échec UPDATE → throw, aucun audit trompeur", async () => {
    state.updateError = { message: "boom" };
    await expect(revokeMarketingConsent(INPUT)).rejects.toThrow(/boom/);
    expect(calls.audit).toHaveLength(0);
  });
});
