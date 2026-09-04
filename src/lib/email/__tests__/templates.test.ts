import { describe, it, expect } from "vitest";
import { notificationEmail, leadConfirmationEmail } from "../templates";

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
