import { describe, expect, it } from "vitest";
import { FAQ_ITEMS, faqJsonLd } from "../faq";

describe("FAQ landing", () => {
  it("couvre les objections clés du terrain (papier, prix, âge, temps)", () => {
    const all = FAQ_ITEMS.map((i) => i.question + " " + i.answer).join(" ");
    expect(all).toMatch(/papier/i);
    expect(all).toMatch(/69 CHF/);
    expect(all).toMatch(/âgés|smartphone/i);
    expect(all).toMatch(/caisse/i);
    expect(all).toMatch(/sans engagement/i);
  });

  it("au moins 6 questions, toutes complètes et substantielles", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(6);
    for (const item of FAQ_ITEMS) {
      expect(item.question.trim().length).toBeGreaterThan(10);
      expect(item.answer.trim().length).toBeGreaterThan(80);
      expect(item.question).toMatch(/\?\s*$|\.$/);
    }
  });

  it("cohérence pricing : aucun ancien prix ne se glisse dans la FAQ", () => {
    const all = FAQ_ITEMS.map((i) => i.answer).join(" ");
    for (const stale of ["49 CHF", "89 CHF", "149 CHF", "99 CHF", "179 CHF", "299 CHF"]) {
      expect(all).not.toContain(stale);
    }
  });

  it("le JSON-LD FAQPage est structurellement valide", () => {
    const ld = faqJsonLd() as { "@type": string; mainEntity: Array<Record<string, unknown>> };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(FAQ_ITEMS.length);
    for (const q of ld.mainEntity) {
      expect(q["@type"]).toBe("Question");
      expect(typeof q.name).toBe("string");
      expect((q.acceptedAnswer as Record<string, unknown>)["@type"]).toBe("Answer");
    }
  });
});
