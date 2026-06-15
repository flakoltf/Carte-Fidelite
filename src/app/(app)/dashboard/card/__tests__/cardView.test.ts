import { describe, expect, it } from "vitest";
import { cardViewFromResult } from "../cardView";

// BUG #3 — la page « Ma carte » doit distinguer trois issues qu'elle confondait
// auparavant en un seul message trompeur « page d'inscription pas prête ».
describe("cardViewFromResult", () => {
  it("marchand configuré (slug présent) → carte prête (affiche le QR)", () => {
    const v = cardViewFromResult({
      ok: true,
      merchant: { shop_name: "Boulangerie du Dimanche", slug: "boulangerie-du-dimanche" },
    });
    expect(v).toEqual({
      kind: "ready",
      shopName: "Boulangerie du Dimanche",
      slug: "boulangerie-du-dimanche",
    });
  });

  it("marchand chargé SANS slug → « page pas prête » (le vrai cas du message)", () => {
    const v = cardViewFromResult({ ok: true, merchant: { shop_name: "Café Test", slug: null } });
    expect(v).toEqual({ kind: "no-slug" });
  });

  it("échec du fetch (réseau / HTTP non-2xx) → erreur de chargement DISTINCTE", () => {
    expect(cardViewFromResult({ ok: false })).toEqual({ kind: "error" });
  });

  it("réponse 2xx mais sans ligne marchand → erreur de chargement, PAS « pas prête »", () => {
    // ex. 401 dont le corps n'a pas de `merchant`, ou maybeSingle → null.
    expect(cardViewFromResult({ ok: true, merchant: null })).toEqual({ kind: "error" });
    expect(cardViewFromResult({ ok: true, merchant: undefined })).toEqual({ kind: "error" });
  });
});
