import { beforeEach, describe, expect, it, vi } from "vitest";

// Régression Important 3 + Minor 4 (revue finale cartes-à-points) : construction
// RUNTIME du pass Apple (buildApplePassBuffer).
//
// Important 3 : rewardReady (F2 — lien avis Google en tête des backFields) DOIT
// être dérivé du programme RÉEL du marchand. Pour une carte à POINTS, l'ancien
// code appelait canRedeem(stamps, stamp_goal) AVANT même de résoudre le
// programme — un `stamps` (stamps_count) résiduel pouvait donner un état
// FAUX, y compris faussement "prêt" alors que le solde de points ne l'était pas.
//
// Minor 4 : {visites} (COUNT sur scan_history) doit exclure les lignes de
// compensation du revert (points_added: -1) via .gte("points_added", 0).
//
// Certs/`passkit-generator` réels non nécessaires ici : on ne vérifie QUE la
// construction de pass.json (embarqué tel quel dans les buffers passés au
// PKPass mocké) et les requêtes Supabase — jamais la signature .pkpass.

type Row = Record<string, unknown>;

type QueryRecord = { table: string; calls: [string, unknown[]][] };

const state = {
  cardRow: null as Row | null,
  merchantRow: null as Row | null,
  visitsCount: 0,
  // Dernière ligne scan_history (jeton {derniere_visite}) ; null = aucun scan.
  lastScanRow: null as Row | null,
  // Ligne card_designs ; null = aucun design → rendu legacy.
  designRow: null as Row | null,
};

const calls = {
  queries: [] as QueryRecord[],
  pkpassBuffers: [] as Record<string, Buffer>[],
};

function resolveQuery(record: QueryRecord): { data: unknown; error: null; count?: number } {
  const selectCall = record.calls.find((c) => c[0] === "select");
  const selectCols = selectCall ? String(selectCall[1][0]) : "";
  const hasUpdate = record.calls.some((c) => c[0] === "update");

  if (record.table === "loyalty_cards") {
    if (hasUpdate) return { data: null, error: null };
    if (selectCols.includes("points_balance")) return { data: state.cardRow, error: null };
    if (selectCols.includes("auth_token")) return { data: { auth_token: "tok-1" }, error: null };
    if (selectCols.includes("pass_message")) return { data: { pass_message: "" }, error: null };
    return { data: null, error: null };
  }
  if (record.table === "merchants") return { data: state.merchantRow, error: null };
  if (record.table === "card_designs") return { data: state.designRow, error: null };
  if (record.table === "scan_history") {
    // Deux requêtes distinctes sur la table : le COUNT {visites} (select "id")
    // et la dernière visite {derniere_visite} (select "scanned_at").
    if (selectCols.includes("scanned_at")) return { data: state.lastScanRow, error: null };
    return { data: null, error: null, count: state.visitsCount };
  }
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
    gte: (...args: unknown[]) => {
      record.calls.push(["gte", args]);
      return builder;
    },
    is: (...args: unknown[]) => {
      record.calls.push(["is", args]);
      return builder;
    },
    update: (...args: unknown[]) => {
      record.calls.push(["update", args]);
      return builder;
    },
    order: (...args: unknown[]) => {
      record.calls.push(["order", args]);
      return builder;
    },
    limit: (...args: unknown[]) => {
      record.calls.push(["limit", args]);
      return builder;
    },
    single: async () => resolveQuery(record),
    maybeSingle: async () => resolveQuery(record),
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(resolveQuery(record)).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: (table: string) => makeBuilder(table) },
}));

// Strip tampons inerte : on teste pass.json, jamais le raster sharp.
vi.mock("@/lib/cardDesign/stampStripRaster", () => ({
  STRIP_SIZES: [] as [string, number, number][],
  compositeStampStrip: async () => Buffer.from(""),
  rasterStampStrip: async () => Buffer.from(""),
}));

vi.mock("passkit-generator", () => ({
  PKPass: class {
    constructor(buffers: Record<string, Buffer>) {
      calls.pkpassBuffers.push(buffers);
    }
    async getAsBuffer() {
      return Buffer.from("PKPASS");
    }
  },
}));

import { buildApplePassBuffer } from "@/lib/applePass";

function lastPassJson(): Row {
  const buffers = calls.pkpassBuffers[calls.pkpassBuffers.length - 1];
  return JSON.parse(buffers["pass.json"].toString("utf-8"));
}

function backFieldKeys(passJson: Row): string[] {
  const storeCard = passJson.storeCard as { backFields?: { key: string }[] } | undefined;
  return (storeCard?.backFields ?? []).map((f) => f.key);
}

beforeEach(() => {
  process.env.WWDR_PEM_BASE64 = Buffer.from("fake-wwdr").toString("base64");
  process.env.SIGNER_CERT_BASE64 = Buffer.from("fake-cert").toString("base64");
  process.env.SIGNER_KEY_BASE64 = Buffer.from("fake-key").toString("base64");
  calls.queries = [];
  calls.pkpassBuffers = [];
  state.visitsCount = 4;
  state.lastScanRow = null;
  state.designRow = null;
});

describe("buildApplePassBuffer — rewardReady d'une carte à POINTS (Important 3)", () => {
  const POINTS_MERCHANT: Row = {
    stamp_goal: 10,
    latitude: null,
    longitude: null,
    loyalty_type: "points",
    loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }] },
    reward_label: "Café offert",
    address: null,
    phone: null,
    business_hours: null,
    google_place_id: "ChIJN1t_tDeuEmsRUsoyG83frY4", // format valide (googleReview.ts)
  };

  it("solde de points au palier (non validé) → reward-ready même si `stamps` (résiduel) dit non", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 30, redeemed_tiers: [] };
    state.merchantRow = POINTS_MERCHANT;

    // `stamps` = compteur générique résiduel bas → canRedeem(0, 10) = false. La
    // RÉGRESSION corrigée : le vieux code utilisait CE `stamps` pour rewardReady,
    // ignorant le vrai solde de points (30, palier atteint).
    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 0, branding: {} });

    const json = lastPassJson();
    expect(backFieldKeys(json)).toContain("review");
  });

  it("solde de points SOUS le palier → jamais reward-ready, même si `stamps` (résiduel) dit oui", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 5, redeemed_tiers: [] };
    state.merchantRow = POINTS_MERCHANT;

    // `stamps` = compteur résiduel élevé → canRedeem(99, 10) = true. La
    // RÉGRESSION corrigée : l'ancien code aurait affiché "reward-ready" (et le
    // lien avis Google) alors que le solde de points réel ne l'est pas.
    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 99, branding: {} });

    const json = lastPassJson();
    expect(backFieldKeys(json)).not.toContain("review");
  });

  it("palier atteint mais déjà validé dans le cycle → plus reward-ready", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 30, redeemed_tiers: [30] };
    state.merchantRow = POINTS_MERCHANT;

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 0, branding: {} });

    const json = lastPassJson();
    expect(backFieldKeys(json)).not.toContain("review");
  });

  it("programme stamp_card : comportement inchangé (canRedeem(stamps, stamp_goal))", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = {
      ...POINTS_MERCHANT,
      loyalty_type: "stamp_card",
      loyalty_config: { goal: 10 },
    };

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 10, branding: {} });

    const json = lastPassJson();
    expect(backFieldKeys(json)).toContain("review");
  });
});

// Ligne card_designs minimale (rowToDesign) — champs paramétrables par test.
function designRow(fields: Row[], cardType: string): Row {
  return {
    background_color: "#0D6B5E",
    foreground_color: "#FFFFFF",
    label_color: "#BFEEE6",
    program_name: "Prog",
    logo_original_path: null,
    logo_assets: null,
    fields,
    barcode: null,
    google_class_id: null,
    card_type: cardType,
    stamps: null,
  };
}

const BASE_MERCHANT: Row = {
  stamp_goal: 10,
  latitude: null,
  longitude: null,
  loyalty_type: "stamp_card",
  loyalty_config: { goal: 10 },
  reward_label: null,
  address: null,
  phone: null,
  business_hours: null,
  google_place_id: null,
};

function secondaryValues(passJson: Row): string[] {
  const storeCard = passJson.storeCard as { secondaryFields?: { value: string }[] } | undefined;
  return (storeCard?.secondaryFields ?? []).map((f) => f.value);
}

describe("buildApplePassBuffer — jeton {derniere_visite}", () => {
  const FIELDS: Row[] = [
    { id: "p", zone: "primary", label: "POINTS", value: "{points}", order: 0 },
    { id: "lv", zone: "secondary", label: "DERNIER PASSAGE", value: "{derniere_visite}", order: 1 },
  ];

  it("requête : dernier scan_history hors compensations, scanned_at DESC, LIMIT 1", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = BASE_MERCHANT;

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 3, branding: {} });

    const lastVisitQuery = calls.queries.find(
      (q) => q.table === "scan_history" && q.calls.some((c) => c[0] === "select" && String(c[1][0]).includes("scanned_at"))
    );
    expect(lastVisitQuery).toBeTruthy();
    expect(lastVisitQuery!.calls).toContainEqual(["eq", ["card_id", "card-1"]]);
    expect(lastVisitQuery!.calls).toContainEqual(["gte", ["points_added", 0]]);
    expect(lastVisitQuery!.calls).toContainEqual(["order", ["scanned_at", { ascending: false }]]);
    expect(lastVisitQuery!.calls).toContainEqual(["limit", [1]]);
  });

  it("résout la date en jj.mm.aaaa dans le pass (design présent)", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = BASE_MERCHANT;
    state.lastScanRow = { scanned_at: "2026-08-14T10:30:00Z" };
    state.designRow = designRow(FIELDS, "stamps");

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 3, branding: {} });

    expect(secondaryValues(lastPassJson())).toContain("14.08.2026");
  });

  it("aucun scan → le jeton reste littéral (même convention que {palier})", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = BASE_MERCHANT;
    state.lastScanRow = null;
    state.designRow = designRow(FIELDS, "stamps");

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 3, branding: {} });

    expect(secondaryValues(lastPassJson())).toContain("{derniere_visite}");
  });
});

describe("buildApplePassBuffer — jeton {progression}", () => {
  const FIELDS: Row[] = [
    { id: "p", zone: "primary", label: "POINTS", value: "{points}", order: 0 },
    { id: "pg", zone: "secondary", label: "PROGRESSION", value: "{progression}", order: 1 },
  ];

  it("carte à POINTS : « solde/prochain palier non validé points »", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 32, redeemed_tiers: [30] };
    state.merchantRow = {
      ...BASE_MERCHANT,
      loyalty_type: "points",
      loyalty_config: {
        pointsPerScan: 5,
        tiers: [
          { threshold: 30, reward: "Café offert" },
          { threshold: 40, reward: "Boisson offerte" },
          { threshold: 50, reward: "Menu offert" },
        ],
      },
    };
    state.designRow = designRow(FIELDS, "points");

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 0, branding: {} });

    expect(secondaryValues(lastPassJson())).toContain("32/40 points");
  });

  it("carte à TAMPONS : « tampons/objectif tampons »", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = BASE_MERCHANT;
    state.designRow = designRow(FIELDS, "stamps");

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 3, branding: {} });

    expect(secondaryValues(lastPassJson())).toContain("3/10 tampons");
  });

  it("autres programmes (tiered…) → jeton littéral", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = {
      ...BASE_MERCHANT,
      loyalty_type: "tiered",
      loyalty_config: { tiers: [{ name: "Argent", at: 5 }] },
    };
    state.designRow = designRow(FIELDS, "stamps");

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 3, branding: {} });

    expect(secondaryValues(lastPassJson())).toContain("{progression}");
  });
});

describe("buildApplePassBuffer — {visites} exclut les compensations de revert (Minor 4)", () => {
  it("le COUNT scan_history est filtré par .gte('points_added', 0)", async () => {
    state.cardRow = { merchant_id: "merchant-1", points_balance: 0, redeemed_tiers: [] };
    state.merchantRow = {
      stamp_goal: 10,
      latitude: null,
      longitude: null,
      loyalty_type: "stamp_card",
      loyalty_config: { goal: 10 },
      reward_label: null,
      address: null,
      phone: null,
      business_hours: null,
      google_place_id: null,
    };

    await buildApplePassBuffer({ cardId: "card-1", customerName: "Nadia", stamps: 3, branding: {} });

    const scanHistoryQuery = calls.queries.find((q) => q.table === "scan_history");
    expect(scanHistoryQuery).toBeTruthy();
    const gteCall = scanHistoryQuery!.calls.find((c) => c[0] === "gte");
    expect(gteCall).toEqual(["gte", ["points_added", 0]]);
  });
});
