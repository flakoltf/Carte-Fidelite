import { describe, it, expect } from "vitest";
import { notificationEmail, leadConfirmationEmail, marketingConsentConfirmEmail } from "../templates";

describe("notificationEmail", () => {
  const base = { title: "Récompense débloquée", body: "Votre café offert vous attend !", merchantName: "Café Lumen" };

  it("utilise le titre comme objet", () => {
    expect(notificationEmail(base).subject).toBe("Récompense débloquée");
  });

  it("inclut le corps et le nom du marchand dans le HTML", () => {
    const { html } = notificationEmail(base);
    expect(html).toContain("Votre café offert vous attend !");
    expect(html).toContain("Café Lumen");
  });

  it("fournit une version texte avec le corps", () => {
    expect(notificationEmail(base).text).toContain("Votre café offert vous attend !");
  });

  it("échappe le HTML du contenu fourni (anti-injection)", () => {
    const evil = { title: "x", body: "<script>alert(1)</script>", merchantName: "A & B <Co>" };
    const { html } = notificationEmail(evil);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("A &amp; B &lt;Co&gt;");
  });
});

describe("leadConfirmationEmail", () => {
  it("confirme la réception dans l'objet", () => {
    expect(leadConfirmationEmail({ businessName: "Boulangerie du Bourg" }).subject).toMatch(
      /bien reçu votre demande/i
    );
  });

  it("rappelle le nom du commerce dans le HTML et le texte", () => {
    const { html, text } = leadConfirmationEmail({ businessName: "Boulangerie du Bourg" });
    expect(html).toContain("Boulangerie du Bourg");
    expect(text).toContain("Boulangerie du Bourg");
  });

  it("promet une réponse sous un jour ouvré et signe HaloCard", () => {
    const { html } = leadConfirmationEmail({ businessName: "Chez Ali" });
    expect(html).toMatch(/jour ouvré/i);
    expect(html).toContain("HaloCard");
  });

  it("échappe le nom du commerce (anti-injection)", () => {
    const { html } = leadConfirmationEmail({ businessName: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});

describe("marketingConsentConfirmEmail — double opt-in (LPD/RGPD)", () => {
  const input = { shopName: "Café du Rhône", confirmUrl: "https://halocard.ch/api/consent/confirm?t=abc.def" };

  it("objet : nomme le commerce et parle de confirmation", () => {
    const { subject } = marketingConsentConfirmEmail(input);
    expect(subject).toContain("Café du Rhône");
    expect(subject).toMatch(/confirm/i);
  });

  it("le lien de confirmation figure dans le HTML (href) et dans le texte", () => {
    const { html, text } = marketingConsentConfirmEmail(input);
    expect(html).toContain(`href="${input.confirmUrl}"`);
    expect(text).toContain(input.confirmUrl);
  });

  it("annonce la validité de 7 jours et rassure si ce n'est pas le destinataire", () => {
    const { html, text } = marketingConsentConfirmEmail(input);
    expect(html).toMatch(/7 jours/);
    expect(text).toMatch(/7 jours/);
    expect(html).toMatch(/ignorez/i);
  });

  it("échappe le nom du commerce (saisie marchand)", () => {
    const { html } = marketingConsentConfirmEmail({ ...input, shopName: "A & B <Co>" });
    expect(html).toContain("A &amp; B &lt;Co&gt;");
    expect(html).not.toContain("<Co>");
  });
});
