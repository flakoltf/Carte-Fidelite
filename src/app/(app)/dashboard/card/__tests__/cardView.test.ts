import { describe, expect, it } from "vitest";
import { cardViewFromOutcome } from "../cardView";

// La page « Ma carte » doit distinguer les états qu'elle confondait jadis dans
// un seul message trompeur « page d'inscription pas prête ».
describe("cardViewFromOutcome", () => {
  it("marchand configuré (slug présent) → ready (affiche le QR)", () => {
    expect(
      cardViewFromOutcome({
        kind: "ok",
        merchant: { shop_name: "Boulangerie du Dimanche", slug: "boulangerie-du-dimanche" },
      })
    ).toEqual({
      status: "ready",
      shopName: "Boulangerie du Dimanche",
      slug: "boulangerie-du-dimanche",
    });
  });

  it("401 → auth (session expirée), JAMAIS « pas prête »", () => {
    expect(cardViewFromOutcome({ kind: "auth" })).toEqual({ status: "auth" });
  });

  it("échec réseau / HTTP non-2xx → error, JAMAIS « pas prête »", () => {
    expect(cardViewFromOutcome({ kind: "error" })).toEqual({ status: "error" });
  });

  it("marchand chargé sans slug → empty (le vrai cas « pas prête »)", () => {
    expect(cardViewFromOutcome({ kind: "ok", merchant: { shop_name: "Café", slug: null } })).toEqual(
      { status: "empty" }
    );
  });

  it("200 mais sans ligne marchand (null/undefined) → empty", () => {
    expect(cardViewFromOutcome({ kind: "ok", merchant: null })).toEqual({ status: "empty" });
    expect(cardViewFromOutcome({ kind: "ok", merchant: undefined })).toEqual({ status: "empty" });
  });
});
