import { afterEach, beforeEach, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  CONFIRM_TTL_MS,
  signConsentToken,
  verifyConsentToken,
  confirmToken,
  unsubscribeToken,
  decodeConsentPayload,
} from "../token";

// Jetons des liens de confirmation / désinscription : HMAC-SHA256 (modèle
// signQRCode), secret DÉDIÉ (CONSENT_TOKEN_SECRET), payload en clair mais
// non falsifiable. Ne contiennent JAMAIS l'enrollment_token ni un secret.

const IDS = { customerId: "11111111-1111-4111-8111-111111111111", merchantId: "22222222-2222-4222-8222-222222222222" };
const NOW = Date.parse("2026-09-04T12:00:00Z");

beforeEach(() => {
  process.env.CONSENT_TOKEN_SECRET = "test-consent-secret";
});
afterEach(() => {
  delete process.env.CONSENT_TOKEN_SECRET;
});

describe("signConsentToken / verifyConsentToken", () => {
  it("round-trip : un jeton confirm signé est valide et rend les identifiants", () => {
    const t = signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 });
    expect(verifyConsentToken(t, "confirm", NOW)).toEqual({ valid: true, ...IDS });
  });

  it("URL-safe : aucun caractère à encoder dans une query string", () => {
    const t = signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 });
    expect(t).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  it("expiré → invalide (reason expired)", () => {
    const t = signConsentToken({ ...IDS, action: "confirm", exp: NOW - 1 });
    expect(verifyConsentToken(t, "confirm", NOW)).toEqual({ valid: false, reason: "expired" });
  });

  it("payload falsifié (autre client) → signature invalide", () => {
    const t = signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 });
    const [payload, sig] = t.split(".");
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    json.c = "33333333-3333-4333-8333-333333333333";
    const forged = `${Buffer.from(JSON.stringify(json)).toString("base64url")}.${sig}`;
    expect(verifyConsentToken(forged, "confirm", NOW)).toEqual({ valid: false, reason: "signature" });
  });

  it("signé avec un autre secret → invalide", () => {
    const t = signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 });
    process.env.CONSENT_TOKEN_SECRET = "autre-secret";
    expect(verifyConsentToken(t, "confirm", NOW)).toEqual({ valid: false, reason: "signature" });
  });

  it("signature tronquée ou vide → invalide, sans throw", () => {
    const t = signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 });
    const [payload, sig] = t.split(".");
    expect(verifyConsentToken(`${payload}.${sig.slice(0, 10)}`, "confirm", NOW)).toEqual({ valid: false, reason: "signature" });
    expect(verifyConsentToken(`${payload}.`, "confirm", NOW)).toEqual({ valid: false, reason: "malformed" });
    expect(verifyConsentToken("", "confirm", NOW)).toEqual({ valid: false, reason: "malformed" });
    expect(verifyConsentToken("pas.un.jeton.valide", "confirm", NOW)).toEqual({ valid: false, reason: "malformed" });
  });

  it("un jeton confirm ne sert PAS à se désinscrire (et inversement)", () => {
    const c = signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 });
    const u = signConsentToken({ ...IDS, action: "unsubscribe" });
    expect(verifyConsentToken(c, "unsubscribe", NOW)).toEqual({ valid: false, reason: "action" });
    expect(verifyConsentToken(u, "confirm", NOW)).toEqual({ valid: false, reason: "action" });
  });

  it("identifiants non-UUID dans le payload → rejetés (même bien signés)", () => {
    const t = signConsentToken({ customerId: "x' OR 1=1", merchantId: IDS.merchantId, action: "unsubscribe" });
    expect(verifyConsentToken(t, "unsubscribe", NOW)).toEqual({ valid: false, reason: "malformed" });
  });

  it("secret absent → throw explicite (jamais de jeton signé avec une clé vide)", () => {
    delete process.env.CONSENT_TOKEN_SECRET;
    expect(() => signConsentToken({ ...IDS, action: "confirm", exp: NOW + 1000 })).toThrow(/CONSENT_TOKEN_SECRET/);
  });
});

describe("confirmToken / unsubscribeToken", () => {
  it("confirm : expire 7 jours après émission", () => {
    const t = confirmToken(IDS, NOW);
    expect(CONFIRM_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(verifyConsentToken(t, "confirm", NOW + CONFIRM_TTL_MS - 1).valid).toBe(true);
    expect(verifyConsentToken(t, "confirm", NOW + CONFIRM_TTL_MS + 1)).toEqual({ valid: false, reason: "expired" });
  });

  it("unsubscribe : sans expiration (valable des années plus tard)", () => {
    const t = unsubscribeToken(IDS);
    const inTenYears = NOW + 10 * 365 * 24 * 60 * 60 * 1000;
    expect(verifyConsentToken(t, "unsubscribe", inTenYears)).toEqual({ valid: true, ...IDS });
    expect(decodeConsentPayload(t)).not.toHaveProperty("exp");
  });

  it("le payload ne contient QUE customer/merchant/action(/exp) — jamais d'enrollment_token ni de secret", () => {
    const t = confirmToken(IDS, NOW);
    const payload = decodeConsentPayload(t);
    expect(Object.keys(payload!).sort()).toEqual(["a", "c", "exp", "m"]);
    expect(t).not.toContain("test-consent-secret");
    expect(t).not.toContain(Buffer.from("test-consent-secret").toString("base64url"));
  });

  it("la signature est un HMAC-SHA256 complet du payload (32 octets)", () => {
    const t = unsubscribeToken(IDS);
    const [payload, sig] = t.split(".");
    const expected = crypto.createHmac("sha256", "test-consent-secret").update(payload).digest("base64url");
    expect(sig).toBe(expected);
  });
});
