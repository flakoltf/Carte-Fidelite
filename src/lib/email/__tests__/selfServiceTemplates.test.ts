import { describe, expect, it } from "vitest";
import {
  signupVerificationEmail,
  signupExistingAccountEmail,
  programLiveEmail,
} from "../templates";

// Templates du parcours self-service (Agent C) — fonctions pures, échappement
// HTML systématique (le nom du commerce vient d'une saisie marchand).

describe("signupVerificationEmail", () => {
  it("contient le lien de confirmation en HTML et en texte", () => {
    const url = "https://app.halocard.ch/signup/confirm?token_hash=abc&type=magiclink";
    const e = signupVerificationEmail({ confirmUrl: url });
    expect(e.html).toContain("token_hash=abc");
    expect(e.text).toContain(url);
    expect(e.subject).toContain("Confirmez");
  });
  it("échappe l'URL dans le HTML (anti-injection)", () => {
    const e = signupVerificationEmail({ confirmUrl: 'https://x/"><script>' });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("&lt;script&gt;");
  });
  it("annonce le lancement sans carte bancaire", () => {
    const e = signupVerificationEmail({ confirmUrl: "https://x" });
    expect(e.html).toContain("sans carte bancaire");
  });
});

describe("signupExistingAccountEmail", () => {
  it("avec lien de connexion en un clic", () => {
    const e = signupExistingAccountEmail({ loginUrl: "https://app.halocard.ch/signup/confirm?token_hash=t&type=magiclink" });
    expect(e.html).toContain("token_hash=t");
    expect(e.subject).toContain("déjà un compte");
  });
  it("sans lien → retombe sur /login", () => {
    const e = signupExistingAccountEmail();
    expect(e.html).toContain("https://app.halocard.ch/login");
    expect(e.text).toContain("https://app.halocard.ch/login");
  });
  it("rassure : mot de passe inchangé, aucune information communiquée", () => {
    const e = signupExistingAccountEmail();
    expect(e.html).toContain("mot de passe n'a pas changé");
  });
});

describe("programLiveEmail", () => {
  it("contient l'URL publique d'inscription client", () => {
    const e = programLiveEmail({ shopName: "Café du Léman", enrollUrl: "https://halocard.ch/c/cafe-du-leman" });
    expect(e.html).toContain("https://halocard.ch/c/cafe-du-leman");
    expect(e.text).toContain("https://halocard.ch/c/cafe-du-leman");
    expect(e.subject).toContain("Café du Léman");
  });
  it("échappe le nom du commerce (saisie marchand)", () => {
    const e = programLiveEmail({ shopName: '<img src=x onerror=alert(1)>', enrollUrl: "https://x" });
    expect(e.html).not.toContain("<img src=x");
    expect(e.html).toContain("&lt;img");
  });
});
