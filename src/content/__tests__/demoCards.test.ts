import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { DEMO_CARDS } from "../demo-cards";
import { contrastRatio } from "@/lib/cardDesign/color";

// Règles de design des 4 cartes de démonstration (mission demo-cards) :
// contrastes CALCULÉS (pas déclarés), primary = progression, ≤ 3 secondaires,
// QR partout, Google toujours foncé, assets réellement présents dans public/.

const HEX = /^#[0-9A-Fa-f]{6}$/;

// Luminance relative WCAG — un fond « foncé » pour Google = luminance basse
// (Google choisit lui-même la couleur du texte ; un pastel devient illisible).
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

describe("DEMO_CARDS — les 4 cartes de démonstration Wallet", () => {
  it("compte exactement 4 cartes, slugs uniques", () => {
    expect(DEMO_CARDS).toHaveLength(4);
    expect(new Set(DEMO_CARDS.map((c) => c.slug)).size).toBe(4);
  });

  for (const card of DEMO_CARDS) {
    describe(card.title, () => {
      it("Apple : 3 couleurs à plat, contraste fg/bg ≥ 4.5 et label/bg ≥ 3", () => {
        const { background, foreground, label } = card.design.colors;
        for (const c of [background, foreground, label]) expect(c).toMatch(HEX);
        expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(label, background)).toBeGreaterThanOrEqual(3);
      });

      it("Google : fond FONCÉ (luminance < 0.2), jamais un pastel", () => {
        const googleBg = (card.googleColors ?? card.design.colors).background;
        expect(googleBg).toMatch(HEX);
        expect(luminance(googleBg), `fond Google ${googleBg} trop clair`).toBeLessThan(0.2);
      });

      it("primary = la progression vers la récompense (jeton), unique", () => {
        const primaries = card.design.fields.filter((f) => f.zone === "primary");
        expect(primaries).toHaveLength(1);
        // Progression = jeton vivant ({points} ou {palier}), jamais un nom de
        // programme ni un n° client figé.
        expect(primaries[0].value).toMatch(/^\{(points|palier)\}$/);
      });

      it("≤ 3 champs secondaires visibles, aucun champ header/auxiliary", () => {
        const zones = card.design.fields.map((f) => f.zone);
        expect(card.design.fields.filter((f) => f.zone === "secondary").length).toBeLessThanOrEqual(3);
        expect(zones).not.toContain("header");
        expect(zones).not.toContain("auxiliary");
      });

      it("code-barres : QR sur le jeton de carte + altText", () => {
        expect(card.design.barcode.type).toBe("QR");
        expect(card.design.barcode.source).toBe("card_token");
        expect((card.design.barcode.altText ?? "").length).toBeGreaterThan(0);
      });

      it("chaque asset référencé existe dans public/ (jamais de hotlink)", () => {
        const assets = card.design.logo.assets;
        const paths = [
          assets?.apple?.x1,
          assets?.apple?.strip1,
          assets?.apple?.icon1,
          assets?.google?.logo,
          assets?.google?.hero,
        ].filter((p): p is string => Boolean(p));
        expect(paths.length).toBeGreaterThanOrEqual(3);
        for (const p of paths) {
          expect(p.startsWith("/demo-cards/"), `chemin local attendu : ${p}`).toBe(true);
          const abs = path.join(process.cwd(), "public", p);
          expect(existsSync(abs), `asset manquant : ${p}`).toBe(true);
        }
      });
    });
  }

  it("les jetons des primaries sont couverts par le sample de chaque carte", () => {
    for (const card of DEMO_CARDS) {
      const primary = card.design.fields.find((f) => f.zone === "primary")!;
      const token = primary.value.slice(1, -1);
      expect(card.sample[token], `${card.slug} : sample.${token} manquant`).toBeTruthy();
    }
  });

  it("Boulangerie Perret : pastel assumé côté Apple, foncé imposé côté Google", () => {
    const perret = DEMO_CARDS.find((c) => c.slug === "boulangerie-perret")!;
    expect(luminance(perret.design.colors.background)).toBeGreaterThan(0.2); // farine claire
    expect(perret.googleColors).toBeDefined(); // override foncé documenté
  });
});
