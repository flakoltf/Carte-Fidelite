import { describe, expect, it } from "vitest";
import { seedDemoMerchant } from "../seed";
import { DEMO_CUSTOMERS, DEMO_EMAIL, DEMO_SLUG } from "../constants";
import { makeDb, makeAuthAdmin, demoMerchantRow, type Call } from "./mockDb";

const NOW = new Date("2026-06-15T09:00:00Z");
const find = (calls: Call[], table: string, op: Call["op"]) =>
  calls.filter((c) => c.table === table && c.op === op);

describe("seedDemoMerchant — création", () => {
  it("crée le user Auth (email confirmé) + le marchand pleinement configuré + les clients", async () => {
    const db = makeDb({ merchant: null, cards: [] });
    const auth = makeAuthAdmin();
    const res = await seedDemoMerchant(db, auth, NOW);

    expect(res.mode).toBe("created");
    expect(res.merchantId).toBe("m-demo");
    expect(typeof res.tempPassword).toBe("string");

    // Un seul user Auth, email confirmé (pas d'écran « validez votre email »).
    expect(auth.calls.createUser).toHaveLength(1);
    expect(auth.calls.createUser[0]).toMatchObject({ email: DEMO_EMAIL, email_confirm: true });

    // Marchand inséré avec l'identité réservée + marqueurs concierge.
    const insert = find(db.calls, "merchants", "insert")[0];
    const p = insert.payload as Record<string, unknown>;
    expect(p.slug).toBe(DEMO_SLUG);
    expect(p.reward_label).toBe("Un café offert");
    expect(p.google_place_id).toBeTruthy();
    expect(p.setup_mode).toBe("concierge");

    // Clients de démo semés (un par spec), avec leur carte.
    expect(find(db.calls, "customers", "insert")).toHaveLength(DEMO_CUSTOMERS.length);
    expect(find(db.calls, "loyalty_cards", "insert")).toHaveLength(DEMO_CUSTOMERS.length);
  });

  it("createUser échoue → throw, profil non créé", async () => {
    const db = makeDb({ merchant: null, cards: [] });
    const auth = makeAuthAdmin({ createError: true });
    await expect(seedDemoMerchant(db, auth, NOW)).rejects.toThrow();
    expect(find(db.calls, "merchants", "insert")).toHaveLength(0);
  });
});

describe("seedDemoMerchant — idempotence (reset si déjà présent)", () => {
  it("marchand démo existant → PAS de createUser, purge + reconfig + reseed", async () => {
    const db = makeDb({ merchant: demoMerchantRow(), cards: [{ id: "old-card" }] });
    const auth = makeAuthAdmin();
    const res = await seedDemoMerchant(db, auth, NOW);

    expect(res.mode).toBe("reset");
    expect(res.merchantId).toBe("m-demo");
    expect(auth.calls.createUser).toHaveLength(0); // jamais de doublon de compte
    expect(find(db.calls, "customers", "delete")).toHaveLength(1); // purge d'abord
    expect(find(db.calls, "merchants", "update")).toHaveLength(1); // reconfig
    expect(find(db.calls, "customers", "insert")).toHaveLength(DEMO_CUSTOMERS.length); // reseed
  });

  it("ligne existante NON-démo (email squatté) → throw, rien de destructif", async () => {
    const db = makeDb({ merchant: demoMerchantRow({ email: "vrai@boulangerie.ch" }), cards: [{ id: "x" }] });
    const auth = makeAuthAdmin();
    await expect(seedDemoMerchant(db, auth, NOW)).rejects.toThrow();
    expect(db.calls.some((c) => c.op === "delete")).toBe(false);
    expect(find(db.calls, "merchants", "update")).toHaveLength(0);
  });
});
