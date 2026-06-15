import { describe, expect, it } from "vitest";
import { purgeDemoCustomerData } from "../purge";
import { resetDemoMerchant } from "../reset";
import { makeDb, demoMerchantRow, type Call } from "./mockDb";

// Purge / reset = chemins destructeurs. Tests : on ne touche QUE le périmètre
// démo, on mirror la suppression client (RGPD), et on REFUSE tout non-démo.

const find = (calls: Call[], table: string, op: Call["op"]) =>
  calls.find((c) => c.table === table && c.op === op);

describe("purgeDemoCustomerData — mirror suppression client, scoped au marchand", () => {
  it("purge wallet/campaign par cartes puis customers par merchant_id (cascade)", async () => {
    const db = makeDb({ merchant: demoMerchantRow(), cards: [{ id: "card-a" }, { id: "card-b" }] });
    const res = await purgeDemoCustomerData(db, "m-demo");

    expect(res.cards).toBe(2);

    const wallet = find(db.calls, "wallet_device_registrations", "delete");
    expect(wallet?.filters.serial_number).toEqual({ in: ["card-a", "card-b"] });

    const campaign = find(db.calls, "campaign_sends", "delete");
    expect(campaign?.filters.card_id).toEqual({ in: ["card-a", "card-b"] });

    const customers = find(db.calls, "customers", "delete");
    expect(customers?.filters.merchant_id).toBe("m-demo");

    // L'ordre compte : wallet/campaign AVANT customers (FK non-cascade).
    const order = db.calls.filter((c) => c.op === "delete").map((c) => c.table);
    expect(order.indexOf("customers")).toBeGreaterThan(order.indexOf("wallet_device_registrations"));
    expect(order.indexOf("customers")).toBeGreaterThan(order.indexOf("campaign_sends"));
  });

  it("sans carte : ne touche ni wallet ni campaign, supprime quand même les customers", async () => {
    const db = makeDb({ merchant: demoMerchantRow(), cards: [] });
    await purgeDemoCustomerData(db, "m-demo");
    expect(find(db.calls, "wallet_device_registrations", "delete")).toBeUndefined();
    expect(find(db.calls, "campaign_sends", "delete")).toBeUndefined();
    expect(find(db.calls, "customers", "delete")?.filters.merchant_id).toBe("m-demo");
  });

  it("ne supprime jamais le marchand lui-même", async () => {
    const db = makeDb({ merchant: demoMerchantRow(), cards: [{ id: "x" }] });
    await purgeDemoCustomerData(db, "m-demo");
    expect(find(db.calls, "merchants", "delete")).toBeUndefined();
  });
});

describe("resetDemoMerchant — refuse tout sauf le marchand démo réservé", () => {
  it("résout le marchand démo par slug et purge son périmètre", async () => {
    const db = makeDb({ merchant: demoMerchantRow(), cards: [{ id: "c1" }] });
    const res = await resetDemoMerchant(db);
    expect(res.merchantId).toBe("m-demo");
    expect(find(db.calls, "merchants", "select")?.filters.slug).toBeDefined();
    expect(find(db.calls, "customers", "delete")?.filters.merchant_id).toBe("m-demo");
  });

  it("marchand démo absent → throw, AUCUNE suppression", async () => {
    const db = makeDb({ merchant: null, cards: [] });
    await expect(resetDemoMerchant(db)).rejects.toThrow();
    expect(db.calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("ligne au mauvais email (slug squatté) → throw, AUCUNE suppression", async () => {
    const db = makeDb({ merchant: demoMerchantRow({ email: "vrai@boulangerie.ch" }), cards: [{ id: "c1" }] });
    await expect(resetDemoMerchant(db)).rejects.toThrow();
    expect(db.calls.some((c) => c.op === "delete")).toBe(false);
  });

  it("ligne de rôle admin → throw, AUCUNE suppression", async () => {
    const db = makeDb({ merchant: demoMerchantRow({ role: "admin" }), cards: [{ id: "c1" }] });
    await expect(resetDemoMerchant(db)).rejects.toThrow();
    expect(db.calls.some((c) => c.op === "delete")).toBe(false);
  });
});
