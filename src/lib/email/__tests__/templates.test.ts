import { describe, it, expect } from "vitest";
import { notificationEmail } from "../templates";

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
