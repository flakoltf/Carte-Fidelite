import { describe, expect, it } from "vitest";
import { consentState, isConsented } from "../state";

// Machine d'états du consentement marketing (LPD/RGPD), dérivée des colonnes
// customers.marketing_consent*. Un seul état autorise un envoi : « confirmed ».

const NONE = {
  marketing_consent: false,
  marketing_consent_at: null,
  marketing_consent_confirmed_at: null,
  marketing_consent_revoked_at: null,
};

describe("consentState", () => {
  it("aucune case cochée → none", () => {
    expect(consentState(NONE)).toBe("none");
  });

  it("case cochée mais email non confirmé → pending", () => {
    expect(consentState({ ...NONE, marketing_consent_at: "2026-09-04T10:00:00Z" })).toBe("pending");
  });

  it("confirmé par le lien, non révoqué → confirmed", () => {
    expect(
      consentState({
        marketing_consent: true,
        marketing_consent_at: "2026-09-04T10:00:00Z",
        marketing_consent_confirmed_at: "2026-09-04T10:05:00Z",
        marketing_consent_revoked_at: null,
      }),
    ).toBe("confirmed");
  });

  it("révoqué (désinscription) → revoked, même si confirmed_at est posé", () => {
    expect(
      consentState({
        marketing_consent: false,
        marketing_consent_at: "2026-09-04T10:00:00Z",
        marketing_consent_confirmed_at: "2026-09-04T10:05:00Z",
        marketing_consent_revoked_at: "2026-09-10T08:00:00Z",
      }),
    ).toBe("revoked");
  });

  it("incohérence : marketing_consent=true SANS confirmed_at → jamais confirmed", () => {
    // Un flag posé à la main (ou par un ancien script) sans preuve de double
    // opt-in ne doit pas ouvrir la porte à un envoi.
    expect(consentState({ ...NONE, marketing_consent: true, marketing_consent_at: "2026-09-04T10:00:00Z" })).toBe(
      "pending",
    );
  });

  it("colonnes absentes (migration non appliquée) → none, sans throw", () => {
    expect(consentState({})).toBe("none");
  });
});

describe("isConsented", () => {
  it("n'est vrai QUE pour l'état confirmed", () => {
    expect(isConsented(NONE)).toBe(false);
    expect(isConsented({ ...NONE, marketing_consent_at: "2026-09-04T10:00:00Z" })).toBe(false);
    expect(
      isConsented({
        marketing_consent: true,
        marketing_consent_at: "2026-09-04T10:00:00Z",
        marketing_consent_confirmed_at: "2026-09-04T10:05:00Z",
        marketing_consent_revoked_at: null,
      }),
    ).toBe(true);
    expect(
      isConsented({
        marketing_consent: true,
        marketing_consent_at: "2026-09-04T10:00:00Z",
        marketing_consent_confirmed_at: "2026-09-04T10:05:00Z",
        marketing_consent_revoked_at: "2026-09-10T08:00:00Z",
      }),
    ).toBe(false);
  });
});
