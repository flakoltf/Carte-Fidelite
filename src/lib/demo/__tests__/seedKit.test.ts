import { describe, expect, it } from "vitest";
import {
  applyKitEntry,
  buildKitDesign,
  buildKitLogoAssets,
  buildKitMerchantUpdate,
  planKitCards,
  rewardReadyValue,
  demoKitCustomerEmail,
  type KitDb,
  type KitSeedDeps,
} from "../seedKit";
import { DEMO_KIT, getKitEntry } from "../kit";
import { validateLoyaltyProgram } from "@/lib/loyalty/validate";

const cafe = getKitEntry("demo")!;
const pizzeria = getKitEntry("pizzeria-molino")!;
const institut = getKitEntry("institut-belle-rive")!;

// ─── Fonctions pures ──────────────────────────────────────────────────────────

describe("buildKitLogoAssets — chemins Storage scoped au tenant", () => {
  it("préfixe TOUS les chemins par {merchantId}/ (apple + google)", () => {
    const a = buildKitLogoAssets("M1");
    expect(a.apple?.strip3).toBe("M1/apple/strip@3x.png");
    expect(a.apple?.x1).toBe("M1/apple/logo.png");
    expect(a.apple?.icon3).toBe("M1/apple/icon@3x.png");
    expect(a.google?.logo).toBe("M1/google/logo.png");
    expect(a.google?.hero).toBe("M1/google/hero.png");
    for (const v of [...Object.values(a.apple ?? {}), ...Object.values(a.google ?? {})]) {
      expect(v.startsWith("M1/")).toBe(true);
    }
  });
});

describe("buildKitDesign — design showcase v4 (champs riches, bannière maîtrisée)", () => {
  it("carte à tampons : cardType points + primary {points} + assets scoped", () => {
    const d = buildKitDesign(cafe, "m-cafe");
    expect(d.cardType).toBe("points");
    const primary = d.fields.find((f) => f.zone === "primary");
    expect(primary?.value).toBe("{points}");
    expect(primary?.label).toBe("TAMPONS");
    expect(d.logo.assets?.apple?.strip3).toBe("m-cafe/apple/strip@3x.png");
  });

  it("carte à niveaux : primary {palier} STATUT + {points} en auxiliary (progrès)", () => {
    const d = buildKitDesign(institut, "m-inst");
    expect(d.cardType).toBe("points");
    const palier = d.fields.find((f) => f.value === "{palier}");
    expect(palier?.zone).toBe("primary");
    expect(palier?.label).toBe("STATUT");
    // {points} doit exister quelque part (sinon fallback « carte morte » de passJson).
    expect(d.fields.some((f) => f.value === "{points}")).toBe(true);
  });

  it("remplit les zones natives dans les limites Apple + ≥1 champ {points}", () => {
    for (const entry of DEMO_KIT) {
      const d = buildKitDesign(entry, "m");
      const byZone = (z: string) => d.fields.filter((f) => f.zone === z).length;
      // ZÉRO champ header : la ligne du haut du pass Apple est partagée entre le
      // logo (wordmark large) et logoText (devise) — même UN headerField touchait
      // encore la devise sur iPhone (constaté sur device les 2026-07-02 et 03).
      // Le haut du pass = logo + devise, rien d'autre.
      expect(byZone("header"), entry.shopName).toBe(0);
      expect(byZone("primary"), entry.shopName).toBe(1);
      // 3 secondary design (+ récompense ajoutée par applyIdentity = 4 ≤ limite).
      expect(byZone("secondary"), entry.shopName).toBe(3);
      expect(byZone("auxiliary"), entry.shopName).toBeLessThanOrEqual(4);
      expect(byZone("back"), entry.shopName).toBeGreaterThanOrEqual(3);
      expect(d.fields.length, entry.shopName).toBeGreaterThanOrEqual(11);
      expect(d.fields.some((f) => f.value.includes("{points}")), entry.shopName).toBe(true);
    }
  });
});

describe("buildKitMerchantUpdate — identité + programme", () => {
  it("Café du Rhône : programme stamp + reward_label + place_id + stamp_goal 10 + concierge", () => {
    const u = buildKitMerchantUpdate(cafe, new Date("2026-06-24T10:00:00Z"));
    expect(u.loyalty_type).toBe("stamp_card");
    expect(u.reward_label).toBe("Un café offert");
    expect(u.google_place_id).toBeDefined();
    expect(u.stamp_goal).toBe(10);
    expect(u.managed_by_concierge).toBe(true);
    expect(u.setup_mode).toBe("concierge");
  });

  it("Pizzeria : amount_points, stamp_goal borné à 50 (contrainte 1-50), pas de place_id", () => {
    const u = buildKitMerchantUpdate(pizzeria, new Date());
    expect(u.loyalty_type).toBe("amount_points");
    expect(u.reward_label).toBe("CHF 20 offerts");
    expect(u.stamp_goal).toBe(50); // seuil 200 plafonné à 50 (primary statique de toute façon)
    expect(u.google_place_id).toBeUndefined();
  });

  it("stamp_goal de chaque marchand respecte la contrainte 1-50", () => {
    for (const entry of DEMO_KIT) {
      const g = buildKitMerchantUpdate(entry, new Date()).stamp_goal as number;
      expect(g, entry.shopName).toBeGreaterThanOrEqual(1);
      expect(g, entry.shopName).toBeLessThanOrEqual(50);
    }
  });
});

describe("planKitCards — clientèle à états variés", () => {
  for (const entry of DEMO_KIT) {
    it(`${entry.shopName} : 6 cartes, ≥1 reward-ready, ≥1 compteur 0`, () => {
      const cards = planKitCards(entry);
      expect(cards).toHaveLength(6);

      const ready = cards.filter((c) => c.state === "reward-ready");
      expect(ready).toHaveLength(1);
      const counter = entry.loyaltyType === "amount_points" ? ready[0].pointsBalance : ready[0].stampsCount;
      expect(counter).toBe(rewardReadyValue(entry));

      const justOffered = cards.find((c) => c.state === "just-offered");
      expect(justOffered).toBeDefined();
      expect(justOffered!.stampsCount + justOffered!.pointsBalance).toBe(0);
    });

    it(`${entry.shopName} : la bonne colonne porte le compteur selon la mécanique`, () => {
      for (const c of planKitCards(entry)) {
        if (entry.loyaltyType === "amount_points") expect(c.stampsCount).toBe(0);
        else expect(c.pointsBalance).toBe(0);
      }
    });
  }
});

describe("rewardReadyValue — cohérent avec validateLoyaltyProgram", () => {
  it("chaque entrée reste un programme valide et a une valeur reward-ready ≥ 1", () => {
    for (const entry of DEMO_KIT) {
      expect(validateLoyaltyProgram(entry.loyaltyType, entry.loyaltyConfig).ok).toBe(true);
      expect(rewardReadyValue(entry)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ─── Orchestrateur (faux db + render/upload stubés) ──────────────────────────

type Call = { table: string; op: string; payload?: Record<string, unknown>; filters: Record<string, unknown> };

function makeKitDb(opts: { merchant: Record<string, unknown> | null; designVersion?: number | null }) {
  const calls: Call[] = [];
  let custSeq = 0;
  let cardSeq = 0;

  const dataFor = (table: string, op: string): unknown => {
    if (op === "select" && table === "merchants") return opts.merchant;
    if (op === "select" && table === "card_designs") return opts.designVersion == null ? null : { version: opts.designVersion };
    if (op === "select" && table === "loyalty_cards") return []; // purge : aucune carte préexistante
    if (op === "insert" && table === "customers") return { id: `cust-${++custSeq}` };
    if (op === "insert" && table === "loyalty_cards") return { id: `card-${++cardSeq}` };
    return null;
  };

  function selectBuilder(table: string, op: string, payload?: Record<string, unknown>) {
    const filters: Record<string, unknown> = {};
    const api = {
      eq(col: string, val: unknown) { filters[col] = val; return api; },
      maybeSingle() { calls.push({ table, op, payload, filters }); return Promise.resolve({ data: dataFor(table, op), error: null }); },
      single() { calls.push({ table, op, payload, filters }); return Promise.resolve({ data: dataFor(table, op), error: null }); },
      select() { return api; },
      then(res: (v: { data: unknown; error: null }) => unknown, rej?: (e: unknown) => unknown) {
        calls.push({ table, op, payload, filters });
        return Promise.resolve({ data: dataFor(table, op), error: null }).then(res, rej);
      },
    };
    return api;
  }

  const db: KitDb = {
    from(table: string) {
      return {
        select: () => selectBuilder(table, "select") as never,
        insert: (payload: unknown) => selectBuilder(table, "insert", payload as Record<string, unknown>) as never,
        update: (payload: unknown) => ({
          eq(col: string, val: unknown) {
            calls.push({ table, op: "update", payload: payload as Record<string, unknown>, filters: { [col]: val } });
            return Promise.resolve({ data: null, error: null });
          },
        }),
        upsert: (payload: unknown) => {
          calls.push({ table, op: "upsert", payload: payload as Record<string, unknown>, filters: {} });
          return Promise.resolve({ data: null, error: null });
        },
        delete: () => ({
          in(col: string, vals: unknown[]) { calls.push({ table, op: "delete", filters: { [col]: { in: vals } } }); return Promise.resolve({ data: null, error: null }); },
          eq(col: string, val: unknown) { calls.push({ table, op: "delete", filters: { [col]: val } }); return Promise.resolve({ data: null, error: null }); },
        }),
      } as never;
    },
  };
  return { db, calls };
}

function stubDeps(db: KitDb): { deps: KitSeedDeps; uploads: string[] } {
  const uploads: string[] = [];
  const deps: KitSeedDeps = {
    db,
    readAsset: async () => Buffer.from("png"),
    upload: async (path: string) => { uploads.push(path); },
    actorUserId: "admin-1",
    now: new Date("2026-06-24T09:00:00Z"),
  };
  return { deps, uploads };
}

describe("applyKitEntry — garde stricte AVANT toute écriture", () => {
  it("refuse un marchand hors allowlist (aucun upload, aucune écriture)", async () => {
    const { db, calls } = makeKitDb({ merchant: { id: "x", slug: "vrai-commerce", email: "vrai@commerce.ch", role: "merchant" } });
    const { deps, uploads } = stubDeps(db);
    await expect(applyKitEntry(deps, cafe)).rejects.toThrow();
    expect(uploads).toHaveLength(0);
    expect(calls.some((c) => ["upsert", "update", "insert", "delete"].includes(c.op))).toBe(false);
  });

  it("refuse un marchand introuvable (null)", async () => {
    const { db } = makeKitDb({ merchant: null });
    const { deps, uploads } = stubDeps(db);
    await expect(applyKitEntry(deps, cafe)).rejects.toThrow();
    expect(uploads).toHaveLength(0);
  });

  it("refuse si l'email résolu ≠ email du kit (même si allowlisté)", async () => {
    // Ligne valide d'allowlist (boulangerie-demo) mais on applique l'entrée Café.
    const { db, calls } = makeKitDb({ merchant: { id: "x", slug: "boulangerie-demo", email: "boulangerie-demo@example.com", role: "merchant" } });
    const { deps } = stubDeps(db);
    await expect(applyKitEntry(deps, cafe)).rejects.toThrow(/email résolu/);
    expect(calls.some((c) => ["upsert", "update", "insert"].includes(c.op))).toBe(false);
  });
});

describe("applyKitEntry — chemin nominal (tenancy + assets + design + cartes)", () => {
  it("Café du Rhône : 11 assets scoped, design publié, programme, 6 cartes", async () => {
    const { db, calls } = makeKitDb({ merchant: { id: "m-cafe", slug: "demo", email: "demo@example.com", role: "merchant" }, designVersion: 2 });
    const { deps, uploads } = stubDeps(db);

    const res = await applyKitEntry(deps, cafe);

    expect(res.merchantId).toBe("m-cafe");
    expect(res.assets).toBe(11);
    expect(res.cards).toBe(6);

    // Tous les assets sous le préfixe du tenant.
    expect(uploads).toHaveLength(11);
    expect(uploads.every((p) => p.startsWith("m-cafe/"))).toBe(true);
    expect(uploads).toContain("m-cafe/apple/strip@3x.png");
    expect(uploads).toContain("m-cafe/google/hero.png");

    // Design publié : upsert card_designs (version 3 = 2 + 1) onConflict merchant_id.
    const designUpsert = calls.find((c) => c.table === "card_designs" && c.op === "upsert");
    expect(designUpsert?.payload?.merchant_id).toBe("m-cafe");
    expect(designUpsert?.payload?.version).toBe(3);
    expect(designUpsert?.payload?.published_at).toBeTruthy();

    // Programme : update merchants tenancy .eq("id").
    const upd = calls.find((c) => c.table === "merchants" && c.op === "update");
    expect(upd?.filters.id).toBe("m-cafe");
    expect(upd?.payload?.loyalty_type).toBe("stamp_card");

    // Purge scoped + 6 customers insérés avec merchant_id.
    expect(calls.some((c) => c.table === "customers" && c.op === "delete" && c.filters.merchant_id === "m-cafe")).toBe(true);
    const custInserts = calls.filter((c) => c.table === "customers" && c.op === "insert");
    expect(custInserts).toHaveLength(6);
    expect(custInserts.every((c) => c.payload?.merchant_id === "m-cafe")).toBe(true);
    expect(custInserts[0].payload?.email).toBe(demoKitCustomerEmail("demo", 0));

    // Cartes insérées avec merchant_id + au moins une reward-ready (10 tampons).
    const cardInserts = calls.filter((c) => c.table === "loyalty_cards" && c.op === "insert");
    expect(cardInserts).toHaveLength(6);
    expect(cardInserts.every((c) => c.payload?.merchant_id === "m-cafe")).toBe(true);
    expect(cardInserts.some((c) => c.payload?.stamps_count === 10)).toBe(true);
  });

  it("première publication (aucun design préexistant) : version = 1", async () => {
    const { db, calls } = makeKitDb({ merchant: { id: "m-piz", slug: "pizzeria-molino", email: "demo-pizzeria@example.com", role: "merchant" }, designVersion: null });
    const { deps } = stubDeps(db);
    await applyKitEntry(deps, pizzeria);
    const designUpsert = calls.find((c) => c.table === "card_designs" && c.op === "upsert");
    expect(designUpsert?.payload?.version).toBe(1);
    // amount_points → le compteur reward-ready va dans points_balance.
    const cardInserts = calls.filter((c) => c.table === "loyalty_cards" && c.op === "insert");
    expect(cardInserts.some((c) => c.payload?.points_balance === 200)).toBe(true);
  });
});
