import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildConfirmUrl, buildUnsubscribeUrl, resolveConsentBaseUrl, unsubscribeFooter } from "../links";
import { verifyConsentToken } from "../token";

const IDS = { customerId: "11111111-1111-4111-8111-111111111111", merchantId: "22222222-2222-4222-8222-222222222222" };

beforeEach(() => {
  process.env.CONSENT_TOKEN_SECRET = "test-consent-secret";
});
afterEach(() => {
  delete process.env.CONSENT_TOKEN_SECRET;
});

describe("resolveConsentBaseUrl — jamais dérivée du Host en production", () => {
  it("APP_BASE_URL https prime (préviews)", () => {
    expect(
      resolveConsentBaseUrl({ envBaseUrl: "https://preview.vercel.app/", nodeEnv: "production", requestOrigin: "https://evil.example" }),
    ).toBe("https://preview.vercel.app");
  });
  it("production sans override → domaine vitrine canonique", () => {
    expect(resolveConsentBaseUrl({ envBaseUrl: undefined, nodeEnv: "production", requestOrigin: "https://evil.example" })).toBe(
      "https://halocard.ch",
    );
  });
  it("dev local → origine de la requête", () => {
    expect(resolveConsentBaseUrl({ envBaseUrl: undefined, nodeEnv: "development", requestOrigin: "http://localhost:3000" })).toBe(
      "http://localhost:3000",
    );
  });
});

describe("buildConfirmUrl", () => {
  it("pointe sur GET /api/consent/confirm avec un jeton confirm valide 7 jours", () => {
    const now = Date.parse("2026-09-04T12:00:00Z");
    const url = new URL(buildConfirmUrl("https://halocard.ch", IDS, now));
    expect(url.origin + url.pathname).toBe("https://halocard.ch/api/consent/confirm");
    const t = url.searchParams.get("t")!;
    expect(verifyConsentToken(t, "confirm", now)).toEqual({ valid: true, ...IDS });
    expect(verifyConsentToken(t, "confirm", now + 8 * 24 * 3600 * 1000).valid).toBe(false);
  });
});

describe("buildUnsubscribeUrl", () => {
  it("pointe sur GET /api/consent/unsubscribe avec un jeton unsubscribe SANS expiration", () => {
    const url = new URL(buildUnsubscribeUrl("https://halocard.ch", IDS));
    expect(url.origin + url.pathname).toBe("https://halocard.ch/api/consent/unsubscribe");
    const t = url.searchParams.get("t")!;
    const inTenYears = Date.now() + 10 * 365 * 24 * 3600 * 1000;
    expect(verifyConsentToken(t, "unsubscribe", inTenYears)).toEqual({ valid: true, ...IDS });
  });
});

describe("unsubscribeFooter — pied de page obligatoire de tout email marketing", () => {
  it("HTML : mention « Se désinscrire » liée à l'URL de désinscription, nom du commerce échappé", () => {
    const { html } = unsubscribeFooter({ baseUrl: "https://halocard.ch", ids: IDS, shopName: "A & B <Co>" });
    const m = html.match(/<a href="(https:\/\/halocard\.ch\/api\/consent\/unsubscribe\?t=[^"]+)"[^>]*>Se désinscrire<\/a>/);
    expect(m).not.toBeNull();
    expect(html).toContain("A &amp; B &lt;Co&gt;");
    expect(html).not.toContain("<Co>");
    const t = new URL(m![1]).searchParams.get("t")!;
    expect(verifyConsentToken(t, "unsubscribe")).toEqual({ valid: true, ...IDS });
  });

  it("texte : même URL en clair", () => {
    const { text, unsubscribeUrl } = unsubscribeFooter({ baseUrl: "https://halocard.ch", ids: IDS, shopName: "Café du Rhône" });
    expect(text).toContain(unsubscribeUrl);
    expect(text).toMatch(/désinscrire/i);
    expect(unsubscribeUrl.startsWith("https://halocard.ch/api/consent/unsubscribe?t=")).toBe(true);
  });
});
