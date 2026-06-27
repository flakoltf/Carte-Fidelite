import { describe, expect, it } from "vitest";
import { buildArtSet, stripSvg, heroSvg, logoSvg, iconSvg, googleLogoSvg, type ArtSpec, type ArtPalette } from "../art";
import { DEMO_KIT, type DemoArtMotif } from "../kit";

const PALETTE: ArtPalette = { background: "#2A1A11", foreground: "#F7EFE4", label: "#C9A86A", accent: "#C9A86A" };
const TEXT = { wordmark: ["Café du Rhône"] };
const MOTIFS: DemoArtMotif[] = ["bean", "croissant", "pizza", "hairlock", "waves", "wheat"];
const spec = (motif: DemoArtMotif): ArtSpec => ({ motif, palette: PALETTE, text: TEXT });

function assertCleanSvg(s: string, w: number, h: number) {
  expect(s.startsWith("<svg")).toBe(true);
  expect(s).toContain(`width="${w}"`);
  expect(s).toContain(`height="${h}"`);
  expect(s).toContain(`viewBox="0 0 ${w} ${h}"`);
  expect(s).not.toMatch(/NaN|undefined|Infinity/);
  expect(s.endsWith("</svg>")).toBe(true);
}

describe("art SVG v3 — dimensions exactes par slot", () => {
  for (const m of MOTIFS) {
    it(`${m} : strip 1125×369, hero 1032×336, logo 480×150, icon 348, google 660`, () => {
      assertCleanSvg(stripSvg(spec(m)), 1125, 369);
      assertCleanSvg(heroSvg(spec(m)), 1032, 336);
      assertCleanSvg(logoSvg(spec(m)), 480, 150);
      assertCleanSvg(iconSvg(spec(m)), 348, 348);
      assertCleanSvg(googleLogoSvg(spec(m)), 660, 660);
    });
  }
});

describe("art SVG v3 — RÈGLE D'OR : le strip ne porte AUCUN texte", () => {
  for (const m of MOTIFS) {
    it(`${m} : strip + hero sans élément <text> ni nom`, () => {
      const strip = stripSvg(spec(m));
      const hero = heroSvg(spec(m));
      expect(strip).not.toContain("<text");
      expect(strip).not.toContain("Café du Rhône");
      expect(hero).not.toContain("<text");
      expect(hero).not.toContain("Café du Rhône");
    });
  }
});

describe("art SVG v3 — le NOM vit dans le LOGO (wordmark)", () => {
  it("le logo porte le wordmark en serif italique", () => {
    const s = logoSvg(spec("bean"));
    expect(s).toContain("Café du Rhône");
    expect(s).toContain('font-style="italic"');
  });

  it("le logo supporte 2 lignes", () => {
    const s = logoSvg({ motif: "wheat", palette: PALETTE, text: { wordmark: ["Boulangerie", "des Pâquis"] } });
    expect(s).toContain("Boulangerie");
    expect(s).toContain("des Pâquis");
    expect((s.match(/<text/g) ?? []).length).toBe(2);
  });

  it("le logo échappe le texte (pas d'injection)", () => {
    const s = logoSvg({ motif: "bean", palette: PALETTE, text: { wordmark: ["A<b>"] } });
    expect(s).toContain("A&lt;b&gt;");
    expect(s).not.toContain("<b>");
  });
});

describe("art SVG v3 — profondeur + métaphore confinée à droite", () => {
  it("profondeur/texture : lueur radiale, ombre portée, grain", () => {
    const s = stripSvg(spec("waves"));
    expect(s).toContain("radialGradient");
    expect(s).toContain("feDropShadow");
    expect(s).toContain("feTurbulence");
  });

  it("les scènes illustrées produisent des strips distincts", () => {
    // bean/pizza utilisent une PHOTO en prod → fallback générique partagé en SVG.
    const illustrated: DemoArtMotif[] = ["croissant", "wheat", "hairlock", "waves"];
    const strips = illustrated.map((m) => stripSvg(spec(m)));
    expect(new Set(strips).size).toBe(illustrated.length);
  });

  it("déterministe : même entrée → même sortie", () => {
    expect(stripSvg(spec("waves"))).toBe(stripSvg(spec("waves")));
  });

  it("buildArtSet expose les 5 slots", () => {
    const set = buildArtSet(spec("croissant"));
    expect(Object.keys(set).sort()).toEqual(["google-logo", "hero", "icon", "logo", "strip"]);
    for (const v of Object.values(set)) expect(v.startsWith("<svg")).toBe(true);
  });
});

describe("art SVG v3 — couvre le kit réel", () => {
  it("chaque entrée : strip pur (sans nom) + logo portant le wordmark", () => {
    for (const entry of DEMO_KIT) {
      const p: ArtPalette = { ...entry.design.colors, accent: entry.design.accent };
      const sp: ArtSpec = { motif: entry.motif, palette: p, text: entry.artText };
      const strip = stripSvg(sp);
      const logo = logoSvg(sp);
      expect(strip).not.toContain("<text");
      expect(logo).toContain(entry.artText.wordmark[0]);
      expect(strip).not.toMatch(/NaN|undefined/);
    }
  });
});
