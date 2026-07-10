import { describe, it, expect } from "vitest";
import { buildApnsRequest } from "../apns";

// Verrou anti-régression : une notification Wallet doit produire une BANNIÈRE
// (écran verrouillé). Le mode "background" + priorité 5 mettait la carte à jour
// SILENCIEUSEMENT (aucune notification) — cf. correctif 2026-07-10.
describe("buildApnsRequest — push Wallet visible", () => {
  it("apns-topic = le Pass Type ID (pas le bundle app)", () => {
    const r = buildApnsRequest("tok123", "pass.com.walletcard.fidelite");
    expect(r.headers["apns-topic"]).toBe("pass.com.walletcard.fidelite");
    expect(r.path).toBe("/3/device/tok123");
  });

  it("push-type = alert et priorité = 10 (bannière, pas silencieux)", () => {
    const r = buildApnsRequest("tok", "pass.x");
    expect(r.headers["apns-push-type"]).toBe("alert");
    expect(r.headers["apns-priority"]).toBe("10");
  });

  it("corps vide (le ping ne porte pas de payload — iOS re-fetch le pass)", () => {
    expect(buildApnsRequest("tok", "pass.x").body).toBe("{}");
  });
});
