import { beforeEach, describe, expect, it, vi } from "vitest";

// Régression Important 3 (revue finale cartes-à-points) : construction RUNTIME
// de l'objet Google Wallet (buildGoogleSaveUrl). rewardReady (F2 — lien avis
// Google dans linksModuleData) DOIT être dérivé du programme RÉEL du marchand.
// Pour une carte à POINTS, l'ancien code appelait canRedeem(stamps, stamp_goal)
// AVANT même de résoudre le programme — un `stamps` (stamps_count) résiduel
// pouvait donner un état FAUX, y compris faussement "prêt".
//
// jwt.sign est mocké (pas de vraie clé RSA en test) : on inspecte directement
// les claims signés pour vérifier le loyaltyObject construit.

type Row = Record<string, unknown>;
type QueryRecord = { table: string; calls: [string, unknown[]][] };

const state = {
  cardRow: null as Row | null,
  merchantRow: null as Row | null,
};

const calls = {
  queries: [] as QueryRecord[],
  signedClaims: [] as Row[],
};

function resolveQuery(record: QueryRecord): { data: unknown; error: null } {
  if (record.table === "loyalty_cards") return { data: state.cardRow, error: null };
  if (record.table === "merchants") return { data: state.merchantRow, error: null };
  if (record.table === "card_designs") return { data: null, error: null }; // aucun design → DEFAULT_CARD_DESIGN
  return { data: null, error: null };
}

function makeBuilder(table: string): Record<string, unknown> {
  const record: QueryRecord = { table, calls: [] };
  calls.queries.push(record);
  const builder: Record<string, unknown> = {
    select: (...args: unknown[]) => {
      record.calls.push(["select", args]);
      return builder;
    },
    eq: (...args: unknown[]) => {
      record.calls.push(["eq", args]);
      return builder;
    },
    single: async () => resolveQuery(record),
    maybeSingle: async () => resolveQuery(record),
  };
  return builder;
}

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: (table: string) => makeBuilder(table) },
}));

vi.mock("@/lib/wallet/googleClass", () => ({
  classIdFor: (merchantId: string) => `issuer-1.merchant_${merchantId}`,
  ensureLoyaltyClass: async (merchantId: string) => `issuer-1.merchant_${merchantId}`,
}));

vi.mock("jsonwebtoken", () => ({
  default: {
    sign: (claims: Row) => {
      calls.signedClaims.push(claims);
      return "fake.jwt.token";
    },
  },
}));

import { buildGoogleSaveUrl } from "@/lib/googlePass";

function lastLoyaltyObject(): Row {
  const claims = calls.signedClaims[calls.signedClaims.length - 1];
  const payload = claims.payload as { loyaltyObjects: Row[] };
  return payload.loyaltyObjects[0];
}

beforeEach(() => {
  process.env.GOOGLE_ISSUER_ID = "issuer-1";
  process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({
    client_email: "svc@example.test",
    private_key: "fake-key-not-used-jwt-is-mocked",
  });
  calls.queries = [];
  calls.signedClaims = [];
});

const POINTS_MERCHANT: Row = {
  shop_name: "Café du Rhône",
  latitude: null,
  longitude: null,
  reward_label: "Café offert",
  address: null,
  phone: null,
  business_hours: null,
  google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4", // format valide (googleReview.ts)
  stamp_goal: 10,
  loyalty_type: "points",
  loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
};

describe("buildGoogleSaveUrl — rewardReady d'une carte à POINTS (Important 3)", () => {
  it("solde de points au palier (non validé) → reward-ready même si `stamps` (résiduel) dit non", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 30, redeemed_tiers: [] };
    state.merchantRow = POINTS_MERCHANT;

    await buildGoogleSaveUrl({ cardId: "card-1", customerName: "Nadia", stamps: 0 });

    const obj = lastLoyaltyObject();
    const links = obj.linksModuleData as { uris?: { uri: string }[] } | undefined;
    expect(links?.uris?.some((u) => u.uri.includes("writereview"))).toBe(true);
    // loyaltyPoints.balance doit refléter le SOLDE DE POINTS, pas `stamps`.
    expect((obj.loyaltyPoints as { balance: { int: number } }).balance.int).toBe(30);
  });

  it("solde de points SOUS le palier → jamais reward-ready, même si `stamps` (résiduel) dit oui", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 5, redeemed_tiers: [] };
    state.merchantRow = POINTS_MERCHANT;

    await buildGoogleSaveUrl({ cardId: "card-1", customerName: "Nadia", stamps: 99 });

    const obj = lastLoyaltyObject();
    const links = obj.linksModuleData as { uris?: { uri: string }[] } | undefined;
    expect(links?.uris?.some((u) => u.uri.includes("writereview"))).toBeFalsy();
  });

  it("palier atteint mais déjà validé dans le cycle → plus reward-ready", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 30, redeemed_tiers: [30] };
    state.merchantRow = POINTS_MERCHANT;

    await buildGoogleSaveUrl({ cardId: "card-1", customerName: "Nadia", stamps: 0 });

    const obj = lastLoyaltyObject();
    const links = obj.linksModuleData as { uris?: { uri: string }[] } | undefined;
    expect(links?.uris?.some((u) => u.uri.includes("writereview"))).toBeFalsy();
  });

  it("programme stamp_card : comportement inchangé (canRedeem(stamps, stamp_goal))", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = { ...POINTS_MERCHANT, loyalty_type: "stamp_card", loyalty_config: { goal: 10 } };

    await buildGoogleSaveUrl({ cardId: "card-1", customerName: "Nadia", stamps: 10 });

    const obj = lastLoyaltyObject();
    const links = obj.linksModuleData as { uris?: { uri: string }[] } | undefined;
    expect(links?.uris?.some((u) => u.uri.includes("writereview"))).toBe(true);
    // Pas de programme points : balance reflète `stamps` (comportement historique).
    expect((obj.loyaltyPoints as { balance: { int: number } }).balance.int).toBe(10);
  });
});
