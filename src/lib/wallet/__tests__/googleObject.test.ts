import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mise à jour des objets Google Wallet après scan (phase NEXT n°2) :
// - verbe HTTP = PATCH, JAMAIS PUT (invariant n°2 — un UPDATE efface les champs
//   omis), vérifié au payload près ;
// - 404 = carte jamais installée côté Google → ignoré silencieusement ;
// - batch best-effort : une carte en échec ne bloque pas les suivantes.
//
// fetch est mocké (aucun réseau) ; l'access token vient d'un walletAccessToken
// mocké (l'auth réelle est celle de googleClass, testée par ailleurs).

type Row = Record<string, unknown>;

const state = {
  cards: [] as Row[],
  merchantRow: null as Row | null,
  designRow: null as Row | null,
};

function resolve(table: string): { data: unknown; error: null } {
  if (table === "loyalty_cards") return { data: state.cards, error: null };
  if (table === "merchants") return { data: state.merchantRow, error: null };
  if (table === "card_designs") return { data: state.designRow, error: null };
  return { data: null, error: null };
}

function makeBuilder(table: string): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    in: async () => resolve(table),
    single: async () => resolve(table),
    maybeSingle: async () => resolve(table),
  };
  return builder;
}

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: (table: string) => makeBuilder(table) },
}));

vi.mock("@/lib/wallet/googleClass", () => ({
  walletAccessToken: async () => "token-test",
}));

import { objectIdFor, pushGoogleObjectUpdates } from "@/lib/wallet/googleObject";

type FetchCall = { url: string; method: string; headers: Record<string, string>; body: Row };
const fetchCalls: FetchCall[] = [];
// File de statuts HTTP à servir, un par appel (défaut : 200).
let fetchStatuses: number[] = [];

beforeEach(() => {
  process.env.GOOGLE_ISSUER_ID = "issuer-1";
  state.cards = [];
  state.merchantRow = { loyalty_type: "stamp_card", loyalty_config: { goal: 10 }, stamp_goal: 10 };
  state.designRow = null; // aucun design → DEFAULT_CARD_DESIGN (label "TAMPONS")
  fetchCalls.length = 0;
  fetchStatuses = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    fetchCalls.push({
      url,
      method: init.method ?? "GET",
      headers: (init.headers ?? {}) as Record<string, string>,
      body: JSON.parse(init.body as string) as Row,
    });
    const status = fetchStatuses.shift() ?? 200;
    return { ok: status >= 200 && status < 300, status } as Response;
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.GOOGLE_ISSUER_ID;
});

describe("objectIdFor", () => {
  it("id déterministe ${GOOGLE_ISSUER_ID}.${cardId}, tirets → underscores (règle de l'émission)", () => {
    expect(objectIdFor("ab-12-cd")).toBe("issuer-1.ab_12_cd");
  });
});

describe("pushGoogleObjectUpdates", () => {
  it("PATCH (jamais PUT) avec le payload exact : solde + label, Bearer token", async () => {
    state.cards = [{ id: "card-1", merchant_id: "m-1", stamps_count: 7, points_balance: 0 }];

    const res = await pushGoogleObjectUpdates(["card-1"]);

    expect(res).toEqual({ pushed: 1 });
    expect(fetchCalls).toHaveLength(1);
    const call = fetchCalls[0];
    expect(call.method).toBe("PATCH");
    expect(call.url).toBe(
      "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/issuer-1.card_1",
    );
    expect(call.headers.Authorization).toBe("Bearer token-test");
    // Payload EXACT : loyaltyPoints en bloc (balance + label — un PATCH remplace
    // le champ de premier niveau entier), rien d'autre sans message.
    expect(call.body).toEqual({
      loyaltyPoints: { balance: { int: 7 }, label: "TAMPONS" },
    });
  });

  it("programme à POINTS : le solde vient de points_balance, pas de stamps_count", async () => {
    state.merchantRow = {
      loyalty_type: "points",
      loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
      stamp_goal: 10,
    };
    state.cards = [{ id: "card-1", merchant_id: "m-1", stamps_count: 99, points_balance: 42 }];

    await pushGoogleObjectUpdates(["card-1"]);

    expect((fetchCalls[0].body.loyaltyPoints as Row)).toEqual({ balance: { int: 42 }, label: "TAMPONS" });
  });

  it("message (campagne/récompense) → messages TEXT_AND_NOTIFY dans le PATCH", async () => {
    state.cards = [{ id: "card-1", merchant_id: "m-1", stamps_count: 3, points_balance: 0 }];

    await pushGoogleObjectUpdates(["card-1"], { title: "Bravo", body: "Café offert !" });

    expect(fetchCalls[0].body).toEqual({
      loyaltyPoints: { balance: { int: 3 }, label: "TAMPONS" },
      messages: [{ id: "halocard", header: "Bravo", body: "Café offert !", messageType: "TEXT_AND_NOTIFY" }],
    });
  });

  it("404 (carte jamais installée côté Google) : ignoré silencieusement, pas comptée", async () => {
    state.cards = [{ id: "card-1", merchant_id: "m-1", stamps_count: 3, points_balance: 0 }];
    fetchStatuses = [404];

    const res = await pushGoogleObjectUpdates(["card-1"]);

    expect(res).toEqual({ pushed: 0 });
    expect(console.error).not.toHaveBeenCalled();
  });

  it("batch partiellement en échec : la carte KO ne bloque pas les suivantes", async () => {
    state.cards = [
      { id: "card-1", merchant_id: "m-1", stamps_count: 3, points_balance: 0 },
      { id: "card-2", merchant_id: "m-1", stamps_count: 5, points_balance: 0 },
    ];
    fetchStatuses = [500, 200];

    const res = await pushGoogleObjectUpdates(["card-1", "card-2"]);

    expect(res).toEqual({ pushed: 1 });
    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls.every((c) => c.method === "PATCH")).toBe(true);
    expect(fetchCalls[1].url.endsWith("issuer-1.card_2")).toBe(true);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("GOOGLE_ISSUER_ID absent ou liste vide : no-op, aucun appel réseau", async () => {
    state.cards = [{ id: "card-1", merchant_id: "m-1", stamps_count: 3, points_balance: 0 }];

    expect(await pushGoogleObjectUpdates([])).toEqual({ pushed: 0 });
    delete process.env.GOOGLE_ISSUER_ID;
    expect(await pushGoogleObjectUpdates(["card-1"])).toEqual({ pushed: 0 });
    expect(fetchCalls).toHaveLength(0);
  });
});
