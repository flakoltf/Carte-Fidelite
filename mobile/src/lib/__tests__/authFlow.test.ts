import {
  isValidEmail,
  isValidTotpCode,
  loginErrorMessage,
  mfaStepUpRequired,
  statusAfterPassword,
  totpErrorMessage,
} from "../authFlow";

describe("isValidTotpCode", () => {
  it("accepte six chiffres, espaces autour tolérés", () => {
    expect(isValidTotpCode("123456")).toBe(true);
    expect(isValidTotpCode(" 123456 ")).toBe(true);
  });

  it("refuse tout le reste", () => {
    for (const code of ["12345", "1234567", "12345a", "", "      "]) {
      expect(isValidTotpCode(code)).toBe(false);
    }
  });
});

describe("mfaStepUpRequired", () => {
  it("demande le second facteur quand la 2FA est active mais non validée", () => {
    expect(mfaStepUpRequired("aal1", "aal2")).toBe(true);
  });

  it("ne demande rien sans 2FA ou une fois validée", () => {
    expect(mfaStepUpRequired("aal1", "aal1")).toBe(false);
    expect(mfaStepUpRequired("aal2", "aal2")).toBe(false);
    expect(mfaStepUpRequired(null, undefined)).toBe(false);
  });
});

describe("statusAfterPassword", () => {
  it("traduit les niveaux en statut d'app", () => {
    expect(statusAfterPassword("aal1", "aal2")).toBe("mfa-required");
    expect(statusAfterPassword("aal1", "aal1")).toBe("signed-in");
  });
});

describe("isValidEmail", () => {
  it("valide une adresse plausible", () => {
    expect(isValidEmail("cafe@rhone.ch")).toBe(true);
    expect(isValidEmail("  cafe@rhone.ch  ")).toBe(true);
  });

  it("refuse une adresse incomplète", () => {
    for (const value of ["cafe", "cafe@", "cafe@rhone", "@rhone.ch", "a b@c.ch"]) {
      expect(isValidEmail(value)).toBe(false);
    }
  });
});

describe("loginErrorMessage", () => {
  it("ne distingue jamais e-mail inconnu et mot de passe faux", () => {
    expect(loginErrorMessage("Invalid login credentials")).toBe(
      "E-mail ou mot de passe incorrect.",
    );
    expect(loginErrorMessage("User not found")).toBe("E-mail ou mot de passe incorrect.");
    expect(loginErrorMessage(null)).toBe("E-mail ou mot de passe incorrect.");
  });

  it("guide sur les cas actionnables", () => {
    expect(loginErrorMessage("Email not confirmed")).toMatch(/confirmée/);
    expect(loginErrorMessage("Too many requests")).toMatch(/Trop de tentatives/);
    expect(loginErrorMessage("Network request failed")).toMatch(/réseau/);
  });

  it("ne recopie jamais le message brut de Supabase", () => {
    expect(loginErrorMessage("AuthApiError: invalid grant")).not.toMatch(/AuthApiError/);
  });
});

describe("totpErrorMessage", () => {
  it("explique l'absence de facteur", () => {
    expect(totpErrorMessage("no-factor")).toMatch(/application d'authentification/);
  });

  it("retombe sur un message simple", () => {
    expect(totpErrorMessage("invalid totp")).toBe("Code incorrect. Réessayez.");
  });
});
