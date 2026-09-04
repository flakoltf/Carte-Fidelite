import { beforeEach, describe, expect, it, vi } from "vitest";

// GARDE-FOU (maillon 4) : consentedRecipients(merchantId) est le SEUL chemin
// autorisé pour obtenir les destinataires d'un envoi marketing. Il ne rend que
// les clients au consentement CONFIRMÉ et NON RÉVOQUÉ, du marchand donné.

type Row = Record<string, unknown>;

const state = { rows: [] as Row[], error: null as { message: string } | null };
const calls = { filters: [] as { op: string; col: string; val: unknown }[], selects: [] as string[] };

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "customers") throw new Error(`table inattendue ${table}`);
      return {
        select: (cols: string) => {
          calls.selects.push(cols);
          const chain = {
            eq: (col: string, val: unknown) => {
              calls.filters.push({ op: "eq", col, val });
              return chain;
            },
            is: (col: string, val: unknown) => {
              calls.filters.push({ op: "is", col, val });
              return chain;
            },
            not: (col: string, op: string, val: unknown) => {
              calls.filters.push({ op: `not.${op}`, col, val });
              return chain;
            },
            then: (resolve: (v: unknown) => void) => resolve({ data: state.error ? null : state.rows, error: state.error }),
          };
          return chain;
        },
      };
    },
  },
}));

let sessionMerchantId: string | null = "22222222-2222-4222-8222-222222222222";
vi.mock("@/lib/auth/currentMerchant", () => ({
  currentMerchantId: async () => sessionMerchantId,
}));

import { consentedRecipients, consentedRecipientsForSession } from "../recipients";

const M = "22222222-2222-4222-8222-222222222222";
const CONFIRMED = {
  id: "c1",
  email: "nadia@example.ch",
  full_name: "Nadia",
  marketing_consent: true,
  marketing_consent_at: "2026-09-01T10:00:00Z",
  marketing_consent_confirmed_at: "2026-09-01T10:05:00Z",
  marketing_consent_revoked_at: null,
};

beforeEach(() => {
  state.rows = [CONFIRMED];
  state.error = null;
  calls.filters = [];
  calls.selects = [];
  sessionMerchantId = M;
});

describe("consentedRecipients", () => {
  it("filtre SQL : merchant_id (tenancy) + consentement confirmé + non révoqué + email présent", async () => {
    await consentedRecipients(M);
    expect(calls.filters).toEqual(
      expect.arrayContaining([
        { op: "eq", col: "merchant_id", val: M },
        { op: "eq", col: "marketing_consent", val: true },
        { op: "not.is", col: "marketing_consent_confirmed_at", val: null },
        { op: "is", col: "marketing_consent_revoked_at", val: null },
        { op: "not.is", col: "email", val: null },
      ]),
    );
    // le filtre tenant est posé EN PREMIER
    expect(calls.filters[0]).toEqual({ op: "eq", col: "merchant_id", val: M });
  });

  it("rend id / email / full_name des clients confirmés", async () => {
    const r = await consentedRecipients(M);
    expect(r).toEqual([{ id: "c1", email: "nadia@example.ch", fullName: "Nadia" }]);
  });

  it("ceinture + bretelles : exclut en mémoire un client en attente ou révoqué même si la BDD le renvoie", async () => {
    state.rows = [
      CONFIRMED,
      { ...CONFIRMED, id: "pending", marketing_consent: false, marketing_consent_confirmed_at: null },
      { ...CONFIRMED, id: "revoked", marketing_consent_revoked_at: "2026-09-03T10:00:00Z" },
      { ...CONFIRMED, id: "flag-only", marketing_consent_confirmed_at: null },
      { ...CONFIRMED, id: "no-email", email: null },
    ];
    const r = await consentedRecipients(M);
    expect(r.map((x) => x.id)).toEqual(["c1"]);
  });

  it("merchantId absent ou non-UUID → throw AVANT toute requête (jamais de SELECT non filtré)", async () => {
    await expect(consentedRecipients("")).rejects.toThrow(/merchantId/);
    await expect(consentedRecipients("pas-un-uuid")).rejects.toThrow(/merchantId/);
    // @ts-expect-error — garde runtime contre un appel mal typé
    await expect(consentedRecipients(undefined)).rejects.toThrow(/merchantId/);
    expect(calls.selects).toHaveLength(0);
  });

  it("erreur BDD → throw (jamais une liste vide silencieuse qui masquerait un bug)", async () => {
    state.error = { message: "boom" };
    await expect(consentedRecipients(M)).rejects.toThrow(/boom/);
  });
});

describe("consentedRecipientsForSession — résolution via le contexte marchand existant", () => {
  it("utilise currentMerchantId() (impersonation honorée) comme filtre tenant", async () => {
    const r = await consentedRecipientsForSession();
    expect(r).toHaveLength(1);
    expect(calls.filters[0]).toEqual({ op: "eq", col: "merchant_id", val: M });
  });

  it("sans marchand en session → liste vide, aucune requête", async () => {
    sessionMerchantId = null;
    expect(await consentedRecipientsForSession()).toEqual([]);
    expect(calls.selects).toHaveLength(0);
  });
});
